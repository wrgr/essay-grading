"""Admin & instructor research surface: user management, grading-reliability
dashboard, FR match stats, novel-equivalent review, annotations, AI authoring."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..core import security
from ..db import database as db
from ..services import llm_bridge, loaders, runner as runner_mod

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── User management (admin) ───────────────────────────────────────────────────

@router.get("/users")
def list_users(user: dict = Depends(security.require_admin)):
    return [
        {"username": u["username"], "role": u["role"], "displayName": u["display_name"],
         "createdAt": u["created_at"]}
        for u in db.all_users()
    ]


class CreateUser(BaseModel):
    username: str
    password: str
    role: str
    displayName: str


@router.post("/users")
def create_user(body: CreateUser, user: dict = Depends(security.require_admin)):
    username = security.sanitize_str(body.username, 64)
    if not username or not body.password:
        raise HTTPException(status_code=422, detail="Username and password are required.")
    ok, err = db.create_user(username, body.password, body.role,
                             security.sanitize_str(body.displayName, 128) or username)
    if not ok:
        raise HTTPException(status_code=422, detail=err)
    return {"ok": True}


class UpdateUser(BaseModel):
    username: str | None = None
    role: str | None = None
    displayName: str | None = None
    password: str | None = None


@router.put("/users/{username}")
def update_user(username: str, body: UpdateUser,
                user: dict = Depends(security.require_admin)):
    existing = db.get_user(username)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found.")
    ok, err = db.update_user(
        username,
        security.sanitize_str(body.username, 64) or username,
        security.sanitize_str(body.displayName, 128) or existing["display_name"],
        body.role or existing["role"],
    )
    if not ok:
        raise HTTPException(status_code=422, detail=err)
    if body.password:
        db.set_password(security.sanitize_str(body.username, 64) or username, body.password)
    return {"ok": True}


# ── Grading reliability dashboard (staff) ─────────────────────────────────────

@router.get("/reliability")
def reliability(user: dict = Depends(security.require_staff)):
    """LLM-vs-instructor calibration: agreement rate, average LLM score per
    annotation label (over-crediting signal), most-disagreeing tasks first."""
    return db.assessment_calibration_stats()


@router.get("/fr-match-stats")
def fr_match_stats(user: dict = Depends(security.require_staff)):
    return db.get_fr_match_stats()


# ── Novel-equivalent review queue (staff) ─────────────────────────────────────

@router.get("/novel-equivalents")
def novel_equivalents(status: str = "pending",
                      user: dict = Depends(security.require_staff)):
    return db.list_novel_equivalent_reviews(status)


class ReviewStatus(BaseModel):
    status: str  # promoted | dismissed | pending


@router.post("/novel-equivalents/{review_id}/status")
def set_review_status(review_id: int, body: ReviewStatus,
                      user: dict = Depends(security.require_staff)):
    if not db.get_novel_equivalent_review(review_id):
        raise HTTPException(status_code=404, detail="Review not found.")
    if not db.set_novel_equivalent_status(review_id, body.status):
        raise HTTPException(status_code=422, detail="Invalid status.")
    return {"ok": True}


# ── Instructor annotations (LLM-grading verdicts; staff) ──────────────────────

class AnnotateRequest(BaseModel):
    taskTitle: str = ""
    label: str  # correct | partial | missing | needs_expert_review
    notes: str = ""


@router.post("/assessments/{assessment_id}/annotate")
def annotate(assessment_id: str, body: AnnotateRequest,
             user: dict = Depends(security.require_staff)):
    if not db.get_assessment(assessment_id):
        raise HTTPException(status_code=404, detail="Assessment not found.")
    task_title = body.taskTitle
    if not task_title:
        evals = db.get_evaluations(assessment_id)
        task_title = evals[0]["task_title"] if evals else ""
    if not db.set_annotation(assessment_id, task_title, body.label,
                             security.sanitize_str(body.notes, 2000), user["username"]):
        raise HTTPException(status_code=422, detail="Invalid label.")
    return {"ok": True}


# ── AI-assisted content authoring (staff) ─────────────────────────────────────

class DraftRequest(BaseModel):
    description: str


@router.post("/authoring/scenario-draft")
def scenario_draft(body: DraftRequest, user: dict = Depends(security.require_staff)):
    try:
        _, model, cfg = llm_bridge.resolve_for_user(user)
    except llm_bridge.LLMNotConfigured as e:
        raise HTTPException(status_code=409, detail=str(e))
    draft = runner_mod.generate_scenario_draft(
        security.sanitize_str(body.description, 2000), model, cfg["api_key"], cfg["base_url"])
    if not draft or not draft.get("title"):
        raise HTTPException(status_code=502, detail="The model returned an unusable draft. Try again.")
    # V5 drafts use expert_answer/key_points/rubric at the top level — fold into
    # the scenario schema and normalise exactly like a file-loaded scenario.
    if "expert_answers" not in draft:
        draft["expert_answers"] = [{
            "answer": draft.pop("expert_answer", ""),
            "key_points": draft.pop("key_points", []),
            "rubric": draft.pop("rubric", {}),
        }]
    draft["id"] = _slug(draft["title"])
    return {"draft": loaders.normalize_scenario(draft)}


@router.post("/authoring/prompt-draft")
def prompt_draft(body: DraftRequest, user: dict = Depends(security.require_staff)):
    try:
        _, model, cfg = llm_bridge.resolve_for_user(user)
    except llm_bridge.LLMNotConfigured as e:
        raise HTTPException(status_code=409, detail=str(e))
    draft = runner_mod.generate_prompt_draft(
        security.sanitize_str(body.description, 2000), model, cfg["api_key"], cfg["base_url"])
    if not draft or not draft.get("title"):
        raise HTTPException(status_code=502, detail="The model returned an unusable draft. Try again.")
    if "expert_answers" not in draft:
        draft["expert_answers"] = [{
            "answer": draft.pop("expert_answer", ""),
            "key_points": draft.pop("key_points", []),
        }]
    draft["id"] = _slug(draft["title"])
    return {"draft": loaders.normalize_prompt(draft)}


def _slug(text: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_") or "draft"
