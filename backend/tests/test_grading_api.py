"""End-to-end Mode A API: exemplars seeded, grading job with a FakeLLM,
override flow, review queue, access control."""

import json
import time

import pytest

from app.services import llm_bridge
from app.services.grading import prompts


def test_exemplars_seeded_and_visible(admin_client):
    items = admin_client.get("/api/assessments", params={"mode": "essay_trace"}).json()
    ids = {a["id"] for a in items}
    assert {"exemplar-maya", "exemplar-jordan", "exemplar-sam", "exemplar-alex"} <= ids


def test_student_sees_only_own(student_client):
    items = student_client.get("/api/assessments").json()
    assert items, "emma owns exemplar-maya"
    assert all(a["username"] == "emma" for a in items)
    # cannot fetch another student's assessment
    assert student_client.get("/api/assessments/exemplar-jordan").status_code == 404


def test_assessment_detail_has_scores_divergence_layerb(admin_client):
    a = admin_client.get("/api/assessments/exemplar-maya").json()
    assert len(a["scores"]) == 24  # 12 criteria × 2 channels
    assert a["layerB"]["interpretiveLabel"]
    assert a["divergence"]
    assert a["interpretation"]["headline"]
    # parrot flags over-reliance... actually alex is the guard test; jordan is the flag
    jordan = admin_client.get("/api/assessments/exemplar-jordan").json()
    assert jordan["interpretation"]["tone"] == "flag"


def test_override_flow_and_review_queue(admin_client):
    queue_before = admin_client.get("/api/review-queue").json()
    assert queue_before, "weak-referenceability criteria must be routed"
    item = next(r for r in queue_before if r["teacherOverride"] is None)
    r = admin_client.post(
        f"/api/assessments/{item['assessmentId']}/override",
        json={"criterionId": item["criterionId"], "channel": item["channel"],
              "score": 4, "rationale": "Reviewed the evidence; anchor 4 fits."},
        headers={"X-Requested-With": "fetch"},
    )
    assert r.status_code == 200
    detail = admin_client.get(f"/api/assessments/{item['assessmentId']}").json()
    rec = next(s for s in detail["scores"]
               if s["criterionId"] == item["criterionId"] and s["channel"] == item["channel"])
    assert rec["teacherOverride"]["score"] == 4


def test_override_requires_rationale(admin_client):
    r = admin_client.post(
        "/api/assessments/exemplar-maya/override",
        json={"criterionId": "W1a-1", "channel": "product", "score": 3, "rationale": "  "},
        headers={"X-Requested-With": "fetch"},
    )
    assert r.status_code == 422


def test_students_cannot_override(student_client):
    r = student_client.post(
        "/api/assessments/exemplar-maya/override",
        json={"criterionId": "W1a-1", "channel": "product", "score": 3, "rationale": "x"},
        headers={"X-Requested-With": "fetch"},
    )
    assert r.status_code == 403


class FakeLLM:
    """Deterministic stand-in for llm_bridge.make_llm_json: quotes real source
    text so the provenance guard accepts it."""

    def __init__(self):
        self.calls = 0

    def __call__(self, system, prompt):
        self.calls += 1
        if "RelianceScope" in system:
            return {"helpSeeking": "active", "responseUse": "constructive",
                    "verification": True, "evidence": "checked the claim"}
        # Extract the source between <<< >>> and quote its first sentence-ish chunk.
        src = prompt.split("<<<", 1)[1].split(">>>", 1)[0].strip()
        if "DIALOGUE TRACE" in prompt:
            # find first student turn text
            quote = None
            for block in src.split("\n\n"):
                if "| STUDENT]" in block.splitlines()[0]:
                    quote = " ".join(block.splitlines()[1:])[:120]
                    break
            if not quote:
                return {"evidence": [], "score": "no-evidence", "selfConfidence": "med"}
            return {"evidence": [{"turnId": 0, "quote": quote, "reasoning": "student-authored"}],
                    "anchorMatched": "anchor", "score": 3, "selfConfidence": "med"}
        quote = src[:100]
        return {"evidence": [{"turnId": None, "quote": quote, "reasoning": "opens the essay"}],
                "anchorMatched": "anchor", "score": 4, "selfConfidence": "high"}


def test_grading_job_end_to_end(admin_client, monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(llm_bridge, "make_llm_json", lambda user: fake)

    r = admin_client.post("/api/assessments/exemplar-maya/grade",
                          headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200, r.text
    job_id = r.json()["jobId"]
    total = r.json()["total"]
    assert total == 24 + 6  # 12 criteria × 2 channels + 6 reliance segments

    deadline = time.time() + 60
    while time.time() < deadline:
        job = admin_client.get(f"/api/jobs/{job_id}").json()
        if job["status"] != "running":
            break
        time.sleep(0.2)
    assert job["status"] == "done", job
    assert job["done"] == total

    detail = admin_client.get("/api/assessments/exemplar-maya").json()
    assert detail["status"] == "graded"
    assert detail["gradedLive"] is True
    assert len(detail["scores"]) == 24
    # every product record scored 4 with verbatim evidence accepted by the guard
    product = [s for s in detail["scores"] if s["channel"] == "product"]
    assert all(s["median"] == 4 for s in product)
    assert all(s["evidence"] for s in product)
    assert detail["layerB"]["dominantResponseUse"] == "constructive"


def test_grading_without_provider_is_409(admin_client, monkeypatch):
    def raise_unconfigured(user):
        raise llm_bridge.LLMNotConfigured("No LLM provider is configured on the server.")
    monkeypatch.setattr(llm_bridge, "make_llm_json", raise_unconfigured)
    r = admin_client.post("/api/assessments/exemplar-sam/grade",
                          headers={"X-Requested-With": "fetch"})
    assert r.status_code == 409


def test_sse_stream_replays_completed_job(admin_client, monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(llm_bridge, "make_llm_json", lambda user: fake)
    r = admin_client.post("/api/assessments/exemplar-alex/grade",
                          headers={"X-Requested-With": "fetch"})
    job_id = r.json()["jobId"]
    deadline = time.time() + 60
    while time.time() < deadline:
        if admin_client.get(f"/api/jobs/{job_id}").json()["status"] != "running":
            break
        time.sleep(0.2)
    with admin_client.stream("GET", f"/api/jobs/{job_id}/events") as resp:
        assert resp.status_code == 200
        events = []
        for line in resp.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))
            if events and events[-1]["type"] in ("done", "error"):
                break
    assert events[-1]["type"] == "done"
