"""M6 research surface: export v3 rows across modes, override corpus,
reliability dashboard, annotations, novel-equivalent review, user management."""

import csv
import io


def _fr_submission(client):
    r = client.post("/api/fr/submit", json={
        "promptId": "active_listening_paragraph",
        "text": ("Active listening means paraphrasing the speaker so they know I "
                 "understood, and keeping eye contact to show engagement."),
        "preRating": 7,
    }, headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200, r.text
    aid = r.json()["assessmentId"]
    r = client.post(f"/api/fr/{aid}/finalize", headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200, r.text
    return aid


def test_export_includes_all_modes(admin_client, student_client):
    fr_aid = _fr_submission(student_client)

    r = admin_client.get("/api/export/research.json")
    assert r.status_code == 200
    body = r.json()
    assert body["export_schema_version"] == "3"
    modes = {row["mode"] for row in body["rows"]}
    assert "free_response" in modes
    assert "essay_trace" in modes  # exemplars carry precomputed score records

    mode_a = next(row for row in body["rows"] if row["mode"] == "essay_trace")
    assert mode_a["trace_score_median"] != ""
    assert mode_a["product_score_median"] != ""
    assert mode_a["layer_b_label"] != ""

    fr_row = next(row for row in body["rows"] if row["assessment_id"] == fr_aid)
    assert fr_row["report_type"] == "free_response"
    assert fr_row["thinking_solo"] != ""
    assert fr_row["thinking_honey_mumford"] == ""


def test_export_csv_has_documented_header(admin_client):
    from app.api.export import EXPORT_FIELDS
    r = admin_client.get("/api/export/research.csv")
    assert r.status_code == 200
    reader = csv.reader(io.StringIO(r.text))
    header = next(reader)
    assert header == EXPORT_FIELDS


def test_override_corpus_export(admin_client):
    queue = admin_client.get("/api/review-queue").json()
    item = next(i for i in queue if i["teacherOverride"] is None)
    admin_client.post(
        f"/api/assessments/{item['assessmentId']}/override",
        json={"criterionId": item["criterionId"], "channel": item["channel"],
              "score": 2, "rationale": "Anchor 2 fits the evidence better."},
        headers={"X-Requested-With": "fetch"})
    corpus = admin_client.get("/api/export/override-corpus").json()
    assert corpus["n"] >= 1
    row = corpus["overrides"][-1]
    assert {"criterionId", "channel", "llmPasses", "llmMedian", "teacherScore",
            "teacherRationale", "rubricVersion"} <= set(row)


def test_annotation_feeds_reliability_dashboard(admin_client, student_client):
    aid = _fr_submission(student_client)
    r = admin_client.post(f"/api/admin/assessments/{aid}/annotate",
                          json={"label": "partial", "notes": "credited one point too generously"},
                          headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200, r.text

    stats = admin_client.get("/api/admin/reliability").json()
    assert stats["annotated"] >= 1
    assert stats["labels"]["partial"] >= 1
    assert stats["by_task"], "per-task breakdown must exist"
    # annotated tasks sort ahead of never-annotated ones
    assert stats["by_task"][0]["annotated"] >= 1
    recent = stats["recent"][0]
    assert recent["annotation_label"] in ("partial", "correct", "missing", "needs_expert_review")


def test_students_cannot_reach_research_surface(student_client):
    for path in ("/api/export/research.json", "/api/export/override-corpus",
                 "/api/admin/reliability", "/api/admin/users",
                 "/api/admin/novel-equivalents", "/api/admin/fr-match-stats"):
        assert student_client.get(path).status_code == 403, path


def test_novel_equivalent_review_flow(admin_client):
    from app.db import database as db
    db.log_novel_equivalent("active_listening_paragraph", "kp1", "construct text",
                            "excerpt", ["span one"], "a substantive mechanism explanation")
    pending = admin_client.get("/api/admin/novel-equivalents").json()
    assert pending
    rid = pending[0]["id"]
    r = admin_client.post(f"/api/admin/novel-equivalents/{rid}/status",
                          json={"status": "promoted"},
                          headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200
    promoted = admin_client.get("/api/admin/novel-equivalents",
                                params={"status": "promoted"}).json()
    assert any(p["id"] == rid for p in promoted)
    stats = admin_client.get("/api/admin/fr-match-stats").json()
    assert isinstance(stats, list)


def test_user_management(admin_client):
    r = admin_client.post("/api/admin/users",
                          json={"username": "newkid", "password": "Pw@12345",
                                "role": "student", "displayName": "New Kid"},
                          headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200, r.text
    users = admin_client.get("/api/admin/users").json()
    assert any(u["username"] == "newkid" for u in users)

    r = admin_client.put("/api/admin/users/newkid",
                         json={"displayName": "Renamed Kid", "role": "instructor"},
                         headers={"X-Requested-With": "fetch"})
    assert r.status_code == 200
    users = admin_client.get("/api/admin/users").json()
    u = next(u for u in users if u["username"] == "newkid")
    assert u["displayName"] == "Renamed Kid"
    assert u["role"] == "instructor"

    # the last admin cannot be demoted
    r = admin_client.put("/api/admin/users/admin", json={"role": "student"},
                         headers={"X-Requested-With": "fetch"})
    assert r.status_code == 422
