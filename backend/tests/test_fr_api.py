"""FR (Mode C) API flow: sanitized prompts, keyword-fallback submit,
post-rating, finalize (SOLO + overlay + calibration + report), research row."""

PROCESS_LOG = {
    "events": [],
    "snapshots": [],
    "closing_nudge_used": False,
}

SUBMISSION = (
    "Active listening means fully concentrating on the speaker rather than passively "
    "hearing. I would paraphrase what they said so that they know I understood, because "
    "if I misheard, the paraphrase exposes it before it causes a problem. I would also "
    "keep eye contact to show engagement."
)


def _submit(client, extra=None):
    body = {
        "promptId": "active_listening_paragraph",
        "text": SUBMISSION,
        "preRating": 8,
        "writingMetrics": {"process_log": PROCESS_LOG, "word_count": 50},
        "aiAssistance": {"used": "no", "notes": ""},
    }
    body.update(extra or {})
    return client.post("/api/fr/submit", json=body, headers={"X-Requested-With": "fetch"})


def test_prompt_list_is_sanitized(student_client):
    r = student_client.get("/api/fr/prompts")
    assert r.status_code == 200
    prompts = r.json()
    assert prompts
    blob = str(prompts)
    assert "expert_answers" not in blob
    assert "key_points" not in blob
    assert "exemplars" not in blob
    assert any(p["contentId"] == "active_listening_paragraph" for p in prompts)


def test_students_cannot_read_full_prompt_content(student_client):
    assert student_client.get("/api/content/prompts").status_code == 403
    assert student_client.get("/api/content/scenarios/Changing_Tire").status_code == 403


def test_submit_keyword_fallback_and_finalize(student_client):
    r = _submit(student_client)
    assert r.status_code == 200, r.text
    body = r.json()
    aid = body["assessmentId"]
    ev = body["evaluation"]
    assert 0 <= ev["score"] <= 1
    assert ev["matched_points"], "keyword matcher should credit at least one construct"

    # post-rating (rate → explain → re-rate)
    r = student_client.post(f"/api/fr/{aid}/post-rating", json={"postRating": 4},
                            headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200

    r = student_client.post(f"/api/fr/{aid}/finalize", headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["profile"]["solo_level"] in (
        "Prestructural", "Unistructural", "Multistructural", "Relational")
    # confidence collapse: 8 → 4
    cc = out["processOverlay"]["confidence_calibration"]
    assert cc["confidence_delta"] == -4
    assert "# Free Response Assessment" in out["reportMd"]
    # the Coverage Score calibration note must sit next to the score (Part A)
    assert "unaided recall can under-represent true knowledge" in out["reportMd"]

    # report retrievable
    r = student_client.get(f"/api/fr/{aid}/report.md")
    assert r.status_code == 200
    assert "Free Response Assessment" in r.text

    # research row persisted with schema version 3 and no H&M for FR
    from app.db import database as db
    rows = db.get_evaluations(aid)
    assert len(rows) == 1
    row = rows[0]
    assert row["report_type"] == "free_response"
    assert row["export_schema_version"] == db.EXPORT_SCHEMA_VERSION
    assert row["thinking_honey_mumford"] == ""
    assert row["thinking_solo"] == row["thinking_solo"]  # present key
    assert row["confidence_calibration"] == "confidence_collapse"
    assert row["closing_nudge_used"] == "no"


def test_post_rating_validation(student_client):
    aid = _submit(student_client).json()["assessmentId"]
    r = student_client.post(f"/api/fr/{aid}/post-rating", json={"postRating": 42},
                            headers={"X-Requested-With": "fetch"})
    assert r.status_code == 422


def test_other_students_cannot_touch_submission(client):
    for user in ("emma", "liam"):
        r = client.post("/api/auth/login", json={"username": user, "password": "Learn@2024"},
                        headers={"X-Requested-With": "fetch"})
        assert r.status_code == 200
        if user == "emma":
            aid = _submit(client).json()["assessmentId"]
            client.post("/api/auth/logout", headers={"X-Requested-With": "fetch"})
    r = client.post(f"/api/fr/{aid}/post-rating", json={"postRating": 5},
                    headers={"X-Requested-With": "fetch"})
    assert r.status_code == 404


def test_empty_submission_rejected(student_client):
    r = _submit(student_client, {"text": "   "})
    assert r.status_code == 422
