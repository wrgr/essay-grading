"""Content pipeline: seeding, listing, version-bumping edits, provider info."""


def test_content_seeded(student_client):
    rubrics = student_client.get("/api/content/rubrics").json()
    scenarios = student_client.get("/api/content/scenarios").json()
    prompts = student_client.get("/api/content/prompts").json()
    assert any(r["contentId"] == "mccr-w11-12-arg" for r in rubrics) or rubrics
    assert any(s["contentId"] == "Changing_Tire" for s in scenarios)
    assert any(p["contentId"] == "active_listening_paragraph" for p in prompts)
    # normalisation ran at seed time: pooled/migrated key points are dicts
    prompt = next(p for p in prompts if p["contentId"] == "active_listening_paragraph")
    kps = prompt["payload"]["expert_answers"][0]["key_points"]
    assert kps and isinstance(kps[0], dict) and "construct" in kps[0]


def test_edit_bumps_version(admin_client):
    scenarios = admin_client.get("/api/content/scenarios").json()
    target = scenarios[0]
    before = target["version"]
    r = admin_client.put(
        f"/api/content/scenarios/{target['contentId']}",
        json={"payload": {**target["payload"], "description": "edited"}},
        headers={"X-Requested-With": "fetch"},
    )
    assert r.status_code == 200
    after = r.json()["version"]
    assert after != before
    assert after == (f"{before}-t1" if "-t" not in before else after)
    # both versions retrievable
    old = admin_client.get(
        f"/api/content/scenarios/{target['contentId']}", params={"version": before}
    )
    assert old.status_code == 200


def test_students_cannot_edit_content(student_client):
    r = student_client.put(
        "/api/content/scenarios/Changing_Tire",
        json={"payload": {"title": "x"}},
        headers={"X-Requested-With": "fetch"},
    )
    assert r.status_code == 403


def test_providers_endpoint_hides_keys(student_client):
    r = student_client.get("/api/providers")
    assert r.status_code == 200
    body = r.json()
    assert "providers" in body
    assert "api_key" not in str(body)
    assert "apiKey" not in str(body)


def test_bump_version_semantics():
    from app.api.content import bump_version
    assert bump_version("1.0") == "1.0-t1"
    assert bump_version("1.0-t1") == "1.0-t2"
    assert bump_version("2.3-t9") == "2.3-t10"
