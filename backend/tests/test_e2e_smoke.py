"""End-to-end smoke path with ZERO API keys — the `git clone && make dev`
guarantee. Drives the platform over HTTP through all three modes:

  login → FR keyword-fallback submit → report renders
        → scenario recall → probes → keyword evaluate
        → Mode A exemplar with precomputed scores → override → corpus export
"""


def test_zero_key_smoke(client):
    # ── sign in as a student ──────────────────────────────────────────────────
    r = client.post("/api/auth/login", json={"username": "priya", "password": "Learn@2024"},
                    headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200

    # no provider configured → keyword-fallback mode everywhere (providers are
    # still listed so a user could bring their own key)
    providers = client.get("/api/providers").json()["providers"]
    assert all(not p["configured"] for p in providers)

    # ── Mode C: free response, keyword scoring ───────────────────────────────
    r = client.post("/api/fr/submit", json={
        "promptId": "active_listening_paragraph",
        "text": ("Active listening means giving full attention. I would paraphrase what "
                 "the speaker said to confirm understanding, and hold eye contact so they "
                 "know I am engaged."),
        "preRating": 9,
    }, headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200, r.text
    fr_id = r.json()["assessmentId"]
    assert r.json()["evaluation"]["matched_points"]

    r = client.post(f"/api/fr/{fr_id}/post-rating", json={"postRating": 6},
                    headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200
    r = client.post(f"/api/fr/{fr_id}/finalize", headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200, r.text
    assert "# Free Response Assessment" in r.json()["reportMd"]

    # ── Mode B: scenario, keyword scoring ────────────────────────────────────
    r = client.post("/api/scenario/start", json={"scenarioId": "Changing_Tire"},
                    headers={"X-Requested-With": "fetch"})
    sc_id = r.json()["assessmentId"]
    client.post(f"/api/scenario/{sc_id}/respond",
                json={"text": "Pull over safely, engage the parking brake, loosen the lug "
                              "nuts before jacking, jack at the correct point, swap the "
                              "tire, tighten in a star pattern, lower and torque."},
                headers={"X-Requested-With": "fetch"})
    r = client.post(f"/api/scenario/{sc_id}/end-recall", headers={"X-Requested-With": "fetch"})
    concluded = r.json()["concluded"]
    guard = 0
    while not concluded and guard < 10:
        r = client.post(f"/api/scenario/{sc_id}/respond",
                        json={"text": "Because the wheel would spin otherwise and the car "
                                      "could slip off the jack."},
                        headers={"X-Requested-With": "fetch"})
        concluded = r.json()["concluded"]
        guard += 1
    assert concluded
    r = client.post(f"/api/scenario/{sc_id}/evaluate", headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200, r.text
    assert r.json()["evaluations"][0]["matched_points"]

    # ── Mode A: exemplar carries precomputed demo scores ─────────────────────
    client.post("/api/auth/logout", headers={"X-Requested-With": "fetch"})
    r = client.post("/api/auth/login",
                    json={"username": "instructor", "password": "Teach@2024"},
                    headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200

    detail = client.get("/api/assessments/exemplar-maya").json()
    assert len(detail["scores"]) == 24
    assert detail["interpretation"]["tone"] == "valid"

    queue = client.get("/api/review-queue").json()
    item = next(i for i in queue if i["teacherOverride"] is None)
    r = client.post(f"/api/assessments/{item['assessmentId']}/override",
                    json={"criterionId": item["criterionId"], "channel": item["channel"],
                          "score": 3, "rationale": "Smoke-test override."},
                    headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200

    corpus = client.get("/api/export/override-corpus").json()
    assert corpus["n"] >= 1

    # ── research export covers everything just produced ──────────────────────
    rows = client.get("/api/export/research.json").json()["rows"]
    modes = {row["mode"] for row in rows}
    assert {"essay_trace", "scenario", "free_response"} <= modes
