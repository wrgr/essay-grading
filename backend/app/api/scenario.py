"""Scenario (Mode B) routes — ported from V5 app.py /api/start|respond|end-recall|
evaluate|thinking-profile|report.

The recall → CTA-probing state machine (services.runner.ScenarioRunner) is
DB-backed: each turn loads the runner from assessment_runs, advances it, and
saves it back — in-flight assessments survive restarts, unlike V5's _state dict.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from ..core import security
from ..core.llm import LLMError
from ..db import database as db
from ..services import llm_bridge, reports, thinking
from ..services.runner import ScenarioRunner
from ..services.session import Session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scenario", tags=["scenario"])

MAX_INPUT_CHARS = 20_000

# Learner-facing scenario fields — expert answers, probe bank, failure modes
# etc. are examiner material and never leave the server on these routes.
_LEARNER_SCENARIO_FIELDS = ("id", "title", "description", "user_role", "constraints")


def _llm_for(user: dict, override: dict | None = None):
    """(model, api_key, base_url, use_llm) with keyword-fallback blanks."""
    try:
        _, model, cfg = llm_bridge.resolve_for_user(user, override)
        return model, cfg["api_key"], cfg["base_url"], True
    except llm_bridge.UnknownProvider as e:
        raise HTTPException(status_code=422, detail=str(e))
    except llm_bridge.LLMNotConfigured:
        return "keyword-fallback", "", "", False


def _get_owned_scenario(assessment_id: str, user: dict) -> dict:
    a = db.get_assessment(assessment_id)
    if not a or a["mode"] != "scenario":
        raise HTTPException(status_code=404, detail="Assessment not found.")
    if a["username"] != user["username"] and user["role"] not in ("admin", "instructor"):
        raise HTTPException(status_code=404, detail="Assessment not found.")
    return a


def _load_runner(a: dict, user: dict, override: dict | None = None) -> ScenarioRunner:
    state = db.load_run_state(a["id"])
    if state is None:
        raise HTTPException(status_code=409, detail="This scenario run has expired or concluded.")
    item = db.get_content("scenario", a["content_id"], a["content_version"]) \
        or db.get_content("scenario", a["content_id"])
    if not item:
        raise HTTPException(status_code=404, detail="Scenario content not found.")
    model, api_key, base_url, _ = _llm_for(user, override)
    return ScenarioRunner.from_dict(state, item["payload"], model, api_key, base_url)


def _progress(runner: ScenarioRunner) -> dict:
    return {
        "phase": runner.phase,
        "probeNumber": runner.current_probe_number() if runner.phase != "recall" else 0,
        "probeCount": runner.probe_count(),
    }


@router.get("/list")
def list_scenarios(user: dict = Depends(security.require_user)):
    return [
        {"contentId": it["content_id"], "version": it["version"],
         **{k: it["payload"].get(k) for k in _LEARNER_SCENARIO_FIELDS}}
        for it in db.list_content("scenario")
    ]


class StartRequest(BaseModel):
    scenarioId: str


@router.post("/start")
def start(body: StartRequest, user: dict = Depends(security.require_user),
          override: dict | None = Depends(llm_bridge.llm_override)):
    item = db.get_content("scenario", body.scenarioId)
    if not item:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    model, api_key, base_url, _ = _llm_for(user, override)
    runner = ScenarioRunner(item["payload"], model, api_key, base_url)
    opening = runner.start()

    aid = db.create_assessment(
        username=user["username"], mode="scenario",
        name=item["payload"].get("title", body.scenarioId),
        description="Scenario assessment (recall → probing)",
        content_id=body.scenarioId, content_version=item["version"],
        status="in_progress",
        artifacts={},
    )
    db.save_run_state(aid, runner.to_dict())
    return {"assessmentId": aid, "message": opening, **_progress(runner)}


class RespondRequest(BaseModel):
    text: str
    writingMetrics: dict | None = None


@router.post("/{assessment_id}/respond")
def respond(assessment_id: str, body: RespondRequest,
            user: dict = Depends(security.require_user),
            override: dict | None = Depends(llm_bridge.llm_override)):
    a = _get_owned_scenario(assessment_id, user)
    text = body.text.strip()[:MAX_INPUT_CHARS]
    if not text:
        raise HTTPException(status_code=422, detail="A response is required.")
    runner = _load_runner(a, user, override)
    if runner.is_concluded:
        raise HTTPException(status_code=409, detail="This scenario has concluded.")
    message, concluded = runner.respond(text, body.writingMetrics)
    db.save_run_state(assessment_id, runner.to_dict())
    return {"message": message, "concluded": concluded, **_progress(runner)}


@router.post("/{assessment_id}/end-recall")
def end_recall(assessment_id: str, user: dict = Depends(security.require_user),
               override: dict | None = Depends(llm_bridge.llm_override)):
    """Learner clicked "I'm Done": lock recall, run gap analysis, start probing."""
    a = _get_owned_scenario(assessment_id, user)
    runner = _load_runner(a, user, override)
    if runner.phase != "recall":
        raise HTTPException(status_code=409, detail="Recall has already ended.")
    message, concluded = runner.end_recall()
    db.save_run_state(assessment_id, runner.to_dict())
    return {"message": message, "concluded": concluded, **_progress(runner)}


@router.post("/{assessment_id}/evaluate")
def evaluate(assessment_id: str, user: dict = Depends(security.require_user),
             override: dict | None = Depends(llm_bridge.llm_override)):
    """Score the concluded run (phase-merged), classify the thinking profile,
    render the instructor report, and persist the research row."""
    a = _get_owned_scenario(assessment_id, user)
    runner = _load_runner(a, user, override)
    if not runner.is_concluded:
        raise HTTPException(status_code=409, detail="The scenario has not concluded yet.")

    model, api_key, base_url, use_llm = _llm_for(user, override)
    scenario = runner.scenario
    transcript = runner.transcript()
    recall_t, probe_t = runner.recall_transcript, runner.probe_transcript

    sess = Session(use_llm, model, api_key, base_url)
    try:
        evaluations = sess.evaluate(scenario, transcript,
                                    recall_transcript=recall_t, probe_transcript=probe_t)
    except (LLMError, ConnectionError) as e:
        # A rejected/broken key (server or BYO) must fail loud and clean, not 500.
        raise HTTPException(status_code=502, detail=str(e))

    profile = None
    if use_llm:
        try:
            profile = thinking.analyse_thinking_profile(
                scenario, transcript, model, api_key, base_url,
                writing_metrics=runner.writing_metrics, user_inputs=runner.user_inputs,
                recall_transcript=recall_t, probe_transcript=probe_t,
            )
        except Exception:
            logger.exception("thinking profile failed; report will omit it")

    reports_dir = db.DATA_DIR / "reports" / a["username"]
    path = reports.generate_report(sess, model, api_key, base_url, reports_dir,
                                   thinking_profile=profile)
    report_md = open(path, encoding="utf-8").read()

    artifacts = a["artifacts"]
    artifacts.update({
        "transcript": transcript,
        "recall_transcript": recall_t,
        "probe_transcript": probe_t,
        "evaluations": evaluations,
        "profile": profile,
        "report_md": report_md,
        "probe_queue": [
            {k: v for k, v in p.items() if not k.startswith("_")}
            for p in runner.probe_queue
        ],
    })
    db.update_assessment(assessment_id, artifacts=artifacts, status="graded",
                         completed_at=db.utcnow())
    db.delete_run_state(assessment_id)

    hm = (profile or {}).get("honey_mumford") or {}
    solo = (profile or {}).get("solo") or {}
    for ev in evaluations:
        db.upsert_evaluation(assessment_id, {
            "task_title": scenario.get("title", ""),
            "report_type": "scenario",
            "product_score_percent": str(round(ev["score"] * 100)),
            "text_only_baseline_percent": str(round(ev["score"] * 100)),
            "coverage_score_percent": str(round(ev.get("coverage_score", 0) * 100)),
            "quality_score_percent": str(round(ev.get("quality_score", 0) * 100)),
            "matched_points": "; ".join(ev.get("matched_points", [])),
            "missed_points": "; ".join(ev.get("missed_points", [])),
            "strengths": "; ".join(ev.get("strengths", [])),
            "gaps": "; ".join(ev.get("gaps", [])),
            "word_count": str(len(transcript.split())),
            "has_process_overlay": "no",
            "thinking_honey_mumford": hm.get("style", ""),
            "thinking_solo": solo.get("level", ""),
        }, ev)

    return {
        "evaluations": [_evaluation_out(ev) for ev in evaluations],
        "profile": profile,
        "reportMd": report_md,
    }


@router.get("/{assessment_id}/report.md", response_class=PlainTextResponse)
def report_md(assessment_id: str, user: dict = Depends(security.require_user)):
    a = _get_owned_scenario(assessment_id, user)
    md = a["artifacts"].get("report_md")
    if not md:
        raise HTTPException(status_code=404, detail="Report not generated yet.")
    return md


def _evaluation_out(ev: dict) -> dict:
    """Learner/instructor-facing evaluation summary (drop bulky expert_answer)."""
    return {k: v for k, v in ev.items() if k != "expert_answer"}
