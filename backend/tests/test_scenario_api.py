"""Scenario (Mode B) API: recall → end-recall → probes → evaluate, with the
runner state round-tripping through the DB (keyword-fallback mode)."""

from app.services.runner import ScenarioRunner

RECALL = (
    "First I would pull over somewhere safe and flat, turn on my hazard lights, and put "
    "the car in park with the parking brake engaged. Then I would get the spare tire, "
    "jack, and lug wrench out. Before jacking I would loosen the lug nuts slightly while "
    "the wheel is on the ground so they don't spin. Then I would jack up the car at the "
    "correct jacking point, remove the lug nuts and the flat tire, mount the spare, "
    "hand-tighten the nuts in a star pattern, lower the car, and torque them fully."
)


def _start(client):
    r = client.post("/api/scenario/start", json={"scenarioId": "Changing_Tire"},
                    headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200, r.text
    return r.json()


def test_list_is_sanitized(student_client):
    r = student_client.get("/api/scenario/list")
    assert r.status_code == 200
    blob = str(r.json())
    assert "expert_answers" not in blob
    assert "probe_bank" not in blob
    assert "failure_modes" not in blob
    assert any(s["contentId"] == "Changing_Tire" for s in r.json())


def test_full_run_keyword_fallback(student_client):
    started = _start(student_client)
    aid = started["assessmentId"]
    assert started["phase"] == "recall"
    assert "Examiner:" in started["message"]

    # recall turn — neutral ack only (fallback ack in keyword mode)
    r = student_client.post(f"/api/scenario/{aid}/respond", json={"text": RECALL},
                            headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200
    body = r.json()
    assert body["phase"] == "recall"
    assert not body["concluded"]
    assert len(body["message"]) < 80, "recall acks must be minimal and non-leading"

    # I'm Done → probing (authored probe bank; coverage analysis falls back to 'missing')
    r = student_client.post(f"/api/scenario/{aid}/end-recall",
                            headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200
    body = r.json()
    assert body["phase"] in ("probing", "concluded")

    # answer probes until concluded (keyword mode: probe turn falls back to advance)
    guard = 0
    concluded = body["concluded"]
    while not concluded and guard < 10:
        r = student_client.post(
            f"/api/scenario/{aid}/respond",
            json={"text": "Because otherwise the wheel would spin when I try to loosen "
                          "the nuts, and the car could slip off the jack."},
            headers={"X-Requested-With": "fetch"})
        assert r.status_code == 200
        concluded = r.json()["concluded"]
        guard += 1
    assert concluded, "run must conclude"

    # evaluate: phase-merged keyword scoring + report + research row
    r = student_client.post(f"/api/scenario/{aid}/evaluate",
                            headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200, r.text
    out = r.json()
    ev = out["evaluations"][0]
    assert ev["matched_points"], "keyword scoring should credit recall content"
    assert 0 < ev["score"] <= 1
    assert "recall_score" in ev and "probe_score" in ev
    assert "expert_answer" not in ev
    assert "# " in out["reportMd"]

    from app.db import database as db
    rows = db.get_evaluations(aid)
    assert rows and rows[0]["report_type"] == "scenario"
    assert rows[0]["coverage_score_percent"] != ""

    # report retrievable; run state cleaned up
    assert student_client.get(f"/api/scenario/{aid}/report.md").status_code == 200
    assert db.load_run_state(aid) is None


def test_run_state_survives_restart_roundtrip():
    """to_dict/from_dict must reconstruct an equivalent runner mid-probing."""
    scenario = {
        "id": "s", "title": "T", "situation": "You are testing.", "user_role": "tester",
        "constraints": [], "decision_points": [], "failure_modes": [], "edge_cases": [],
        "probe_bank": [
            {"probe_type": "how", "probe_text": "How exactly?", "target_key_point": "x",
             "success_criteria": "detail"},
        ],
        "expert_answers": [{"answer": "do x", "key_points": ["x"], "rubric": {"x": 2}}],
        "scoring_weights": {"coverage": 0.6, "quality": 0.4},
    }
    runner = ScenarioRunner(scenario, "keyword-fallback", "", "")
    runner.start()
    runner.respond("I would do x first.")
    runner.end_recall()

    state = runner.to_dict()
    import json
    state = json.loads(json.dumps(state))  # force the JSON round-trip
    restored = ScenarioRunner.from_dict(state, scenario, "keyword-fallback", "", "")

    assert restored.phase == runner.phase
    assert restored.recall_transcript == runner.recall_transcript
    assert restored.probe_queue == runner.probe_queue
    assert restored.probe_index == runner.probe_index
    assert restored.probe_results == runner.probe_results

    message, concluded = restored.respond("Because of the consequence.")
    assert concluded or message


def test_cannot_respond_to_others_run(client):
    client.post("/api/auth/login", json={"username": "emma", "password": "Learn@2024"},
                headers={"X-Requested-With": "fetch"})
    aid = _start(client)["assessmentId"]
    client.post("/api/auth/logout", headers={"X-Requested-With": "fetch"})
    client.post("/api/auth/login", json={"username": "liam", "password": "Learn@2024"},
                headers={"X-Requested-With": "fetch"})
    r = client.post(f"/api/scenario/{aid}/respond", json={"text": "hi"},
                    headers={"X-Requested-With": "fetch"})
    assert r.status_code == 404


def test_evaluate_requires_conclusion(student_client):
    aid = _start(student_client)["assessmentId"]
    r = student_client.post(f"/api/scenario/{aid}/evaluate",
                            headers={"X-Requested-With": "fetch"})
    assert r.status_code == 409
