"""Free-response (Mode C) routes — ported from V5 app.py /api/fr/*.

Flow: list prompts (sanitized) → submit (scored immediately, keyword fallback
when no LLM is configured) → post-rating (asked before any score is shown) →
finalize (SOLO profile + writing-process overlay + confidence calibration +
Markdown report + research row).

The V5 in-memory _fr_state dict is replaced by the assessment's artifacts —
everything about a submission is durable from the moment it lands.
"""

import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from ..core import security
from ..db import database as db
from ..services import llm_bridge, reports, scoring, thinking, writing_process

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/fr", tags=["fr"])

MAX_SUBMISSION_CHARS = 40_000

# Learner-facing prompt fields. Expert answers / key points / pools are scoring
# material and never leave the server on these routes.
_LEARNER_PROMPT_FIELDS = ("id", "title", "description", "prompt_text", "word_limit",
                          "constraints", "general_guidance", "process_overlay_enabled",
                          "metadata")


def _sanitize_prompt(payload: dict) -> dict:
    return {k: payload.get(k) for k in _LEARNER_PROMPT_FIELDS}


def _coerce_rating(value):
    """Validate a rate/re-rate confidence rating (1-10 int); None if missing/invalid."""
    try:
        value = int(value)
    except (TypeError, ValueError):
        return None
    return value if 1 <= value <= 10 else None


def _get_owned_fr(assessment_id: str, user: dict) -> dict:
    a = db.get_assessment(assessment_id)
    if not a or a["mode"] != "free_response":
        raise HTTPException(status_code=404, detail="Assessment not found.")
    if a["username"] != user["username"] and user["role"] not in ("admin", "instructor"):
        raise HTTPException(status_code=404, detail="Assessment not found.")
    return a


@router.get("/prompts")
def list_prompts(user: dict = Depends(security.require_user)):
    return [
        {"contentId": it["content_id"], "version": it["version"],
         **_sanitize_prompt(it["payload"])}
        for it in db.list_content("fr_prompt")
    ]


class SubmitRequest(BaseModel):
    promptId: str
    text: str
    preRating: int | None = None
    writingMetrics: dict | None = None
    aiAssistance: dict | None = None


@router.post("/submit")
def submit(body: SubmitRequest, user: dict = Depends(security.require_user)):
    text = body.text.strip()[:MAX_SUBMISSION_CHARS]
    if not text:
        raise HTTPException(status_code=422, detail="Submission text is required.")
    item = db.get_content("fr_prompt", body.promptId)
    if not item:
        raise HTTPException(status_code=404, detail="Prompt not found.")
    prompt_data = item["payload"]

    try:
        name, model, cfg = llm_bridge.resolve_for_user(user)
        evaluation = scoring.score_free_response_with_llm(
            model, cfg["api_key"], cfg["base_url"], prompt_data, text)
        llm_meta = {"provider": name, "model": model}
    except llm_bridge.LLMNotConfigured:
        evaluation = scoring.score_free_response_with_keywords(prompt_data, text)
        llm_meta = {"provider": None, "model": "keyword-fallback"}

    ai = body.aiAssistance or {}
    ai_assistance = {
        "used": "yes" if ai.get("used") == "yes" else "no",
        "notes": security.sanitize_str(ai.get("notes", ""), max_len=2000),
    }

    # Log every accepted novel-equivalent match for admin review. The learner's
    # score is already final — this queue improves the rubric going forward,
    # never gates this submission.
    for m in evaluation.get("novel_equivalent_matches", []):
        db.log_novel_equivalent(
            prompt_id=body.promptId,
            key_point_id=m["key_point_id"],
            construct=m["construct"],
            submission_excerpt=text[:2000],
            evidence_spans=m["evidence_spans"],
            justification=m.get("functional_justification") or "",
            pool_id=m.get("pool_id"),
        )
    # Every accepted match (either type) feeds the novel-equivalent rate denominator.
    for m in evaluation.get("matched_points", []):
        if isinstance(m, dict) and m.get("key_point_id"):
            db.log_fr_match(body.promptId, m["key_point_id"],
                            m.get("construct", ""), m.get("match_type", "exemplar"))

    aid = db.create_assessment(
        username=user["username"], mode="free_response",
        name=prompt_data.get("title", body.promptId),
        description="Free-response submission",
        content_id=body.promptId, content_version=item["version"],
        status="in_progress",
        artifacts={
            "text": text,
            "evaluation": evaluation,
            "writing_metrics": body.writingMetrics,
            "pre_rating": _coerce_rating(body.preRating),
            "post_rating": None,
            "ai_assistance": ai_assistance,
            "llm": llm_meta,
        },
    )

    return {
        "assessmentId": aid,
        "evaluation": {
            "score": evaluation["score"],
            "feedback": evaluation["feedback"],
            "strengths": evaluation["strengths"],
            "gaps": evaluation["gaps"],
            "matched_points": evaluation["matched_points"],
            "missed_points": evaluation["missed_points"],
        },
    }


class PostRatingRequest(BaseModel):
    postRating: int


@router.post("/{assessment_id}/post-rating")
def post_rating(assessment_id: str, body: PostRatingRequest,
                user: dict = Depends(security.require_user)):
    """Store the post-write confidence rating — asked immediately after submission
    but before any score or feedback is shown to the learner (rate → explain →
    re-rate; the feedback-before-score ordering is enforced by the client flow)."""
    a = _get_owned_fr(assessment_id, user)
    rating = _coerce_rating(body.postRating)
    if rating is None:
        raise HTTPException(status_code=422, detail="postRating must be an integer 1-10.")
    artifacts = a["artifacts"]
    artifacts["post_rating"] = rating
    db.update_assessment(assessment_id, artifacts=artifacts)
    return {"ok": True}


@router.post("/{assessment_id}/finalize")
def finalize(assessment_id: str, user: dict = Depends(security.require_user)):
    """Compute the deterministic SOLO profile, the writing-process overlay, and
    confidence calibration; render the Markdown report; persist the research row."""
    a = _get_owned_fr(assessment_id, user)
    artifacts = a["artifacts"]
    evaluation = artifacts.get("evaluation")
    if not evaluation:
        raise HTTPException(status_code=422, detail="Nothing submitted yet.")

    prompt_item = db.get_content("fr_prompt", a["content_id"], a["content_version"]) \
        or db.get_content("fr_prompt", a["content_id"])
    prompt_data = prompt_item["payload"] if prompt_item else {"title": a["name"], "id": a["content_id"]}

    # Deterministic, LLM-free SOLO derivation from already-grounded Coverage/Quality.
    profile = thinking.derive_fr_solo_level(evaluation)

    try:
        _, model, cfg = llm_bridge.resolve_for_user(user)
        api_key, base_url, use_llm = cfg["api_key"], cfg["base_url"], True
    except llm_bridge.LLMNotConfigured:
        model, api_key, base_url, use_llm = "keyword-fallback", "", "", False

    writing_metrics = artifacts.get("writing_metrics") or {}
    process_log = writing_metrics.get("process_log")
    process_overlay = None
    if prompt_data.get("process_overlay_enabled", True) and process_log:
        process_overlay = writing_process.analyze_writing_process(
            process_log, writing_metrics, evaluation["text"],
            product_score=evaluation["score"],
            model=model, api_key=api_key, base_url=base_url, use_llm=use_llm,
        )

    # Confidence calibration (rate → explain → re-rate) is independent of
    # process_log — it can be present even when no writing process was captured.
    calibration = writing_process.compute_confidence_calibration(
        artifacts.get("pre_rating"), artifacts.get("post_rating"))
    if calibration:
        process_overlay = dict(process_overlay or {})
        process_overlay["confidence_calibration"] = calibration

    # Closing nudge: report-facing metadata only — never passed to the grading
    # call, and not itself an evidence-model signal.
    if process_log and process_log.get("closing_nudge_used") is not None:
        process_overlay = dict(process_overlay or {})
        process_overlay["closing_nudge_used"] = bool(process_log.get("closing_nudge_used"))

    reports_dir = db.DATA_DIR / "reports" / a["username"]
    path = reports.generate_fr_report(
        prompt_data, evaluation,
        model=model, api_key=api_key, base_url=base_url,
        output_dir=reports_dir,
        thinking_profile=profile,
        process_overlay=process_overlay,
        ai_assistance=artifacts.get("ai_assistance"),
    )
    report_md = path.read_text(encoding="utf-8") if hasattr(path, "read_text") else \
        open(path, encoding="utf-8").read()

    artifacts.update({
        "profile": profile,
        "process_overlay": process_overlay,
        "report_md": report_md,
    })
    db.update_assessment(assessment_id, artifacts=artifacts, status="graded",
                         completed_at=db.utcnow())

    db.upsert_evaluation(assessment_id, _evaluation_row(
        a, prompt_data, evaluation, profile, process_overlay,
        artifacts.get("ai_assistance") or {}), evaluation)

    return {
        "profile": profile,
        "processOverlay": process_overlay,
        "reportMd": report_md,
    }


@router.get("/{assessment_id}/report.md", response_class=PlainTextResponse)
def report_md(assessment_id: str, user: dict = Depends(security.require_user)):
    a = _get_owned_fr(assessment_id, user)
    md = a["artifacts"].get("report_md")
    if not md:
        raise HTTPException(status_code=404, detail="Report not generated yet.")
    return md


def _evaluation_row(a: dict, prompt_data: dict, ev: dict, profile: dict,
                    overlay: dict | None, ai: dict) -> dict:
    """Build the flattened research row directly from structured data — the V5
    parse-the-report-back path (_research_rows_for_report) is retired."""

    def pct(v):
        return f"{round(v * 100)}" if isinstance(v, (int, float)) else ""

    def labels(points):
        return "; ".join(
            (m.get("construct", "") if isinstance(m, dict) else str(m)) for m in points or [])

    overlay = overlay or {}
    quadrant = overlay.get("quadrant") or {}
    ep = overlay.get("effort_profile") or {}
    rtq = overlay.get("revision_toward_quality") or {}
    authenticity = overlay.get("authenticity") or {}
    cc = overlay.get("confidence_calibration") or {}
    nudge = overlay.get("closing_nudge_used")
    effort_text = ""
    if ep:
        minutes = round((ep.get("total_active_time_s") or 0) / 60, 1)
        effort_text = (f"active {minutes} min; revisions {ep.get('revision_count', 0)}; "
                       f"words {ep.get('word_count', 0)}")

    return {
        "task_title": prompt_data.get("title", ""),
        "report_type": "free_response",
        "product_score_percent": pct(ev.get("score")),
        "text_only_baseline_percent": pct(ev.get("score")),
        "coverage_score_percent": "",
        "quality_score_percent": "",
        "matched_points": labels(ev.get("matched_points")),
        "missed_points": labels(ev.get("missed_points")),
        "strengths": "; ".join(ev.get("strengths") or []),
        "gaps": "; ".join(ev.get("gaps") or []),
        "word_count": str(len((ev.get("text") or "").split())),
        "has_process_overlay": "yes" if overlay else "no",
        "process_quadrant": quadrant.get("label", ""),
        "effort_profile": effort_text,
        "revision_toward_quality": rtq.get("rating", ""),
        "difficulty_point_count": str(len(overlay.get("difficulty_points") or [])) if overlay else "",
        "authenticity": authenticity.get("level", ""),
        "confidence_calibration": cc.get("finding", ""),
        "closing_nudge_used": ("yes" if nudge is True else "no" if nudge is False else ""),
        "process_caution": quadrant.get("interpretation", ""),
        "thinking_honey_mumford": "",  # removed from FR by design (see docs/fr_evidence_model.md)
        "thinking_solo": profile.get("solo_level", ""),
        "ai_assistance_used": ai.get("used", ""),
        "ai_assistance_notes": ai.get("notes", ""),
    }
