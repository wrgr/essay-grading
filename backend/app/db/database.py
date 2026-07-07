"""
SQLite database layer for the unified assessment platform.

Design lineage: Performative_Assessment_V5 database.py (assessmentRework branch).
Carries forward its two load-bearing conventions:

  * CREATE TABLE IF NOT EXISTS + an idempotent PRAGMA table_info -> ALTER TABLE
    ADD COLUMN loop, so existing databases widen safely as new report-facing
    evidence becomes exportable (no migration framework needed).
  * export_schema_version stamped on every evaluation row, so longitudinal
    research exports can always tell which dictionary a row was written under.

New in the consolidated platform:

  * an `assessments` spine spanning all three modes (essay_trace / scenario /
    free_response) with raw inputs in artifacts_json,
  * `score_records` — per-criterion x channel rows for Mode A (the TGFWA
    ScoreRecord model, one claim per row),
  * `assessment_runs` — DB-backed live session state (replaces the V5
    in-memory _state/_fr_state dicts, so runs survive restarts),
  * `auth_sessions` — opaque-token auth (replaces Flask signed cookies),
  * versioned `content_items` for rubrics / scenarios / FR prompts.
"""

import json
import os
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from werkzeug.security import generate_password_hash

DATA_DIR = Path(os.environ.get("ASSESSMENT_DATA_DIR",
                               Path(__file__).resolve().parents[2] / "data"))
DB_FILE = Path(os.environ.get("ASSESSMENT_DB_PATH", DATA_DIR / "assessments.db"))

VALID_ROLES = ("admin", "instructor", "student")
VALID_MODES = ("essay_trace", "scenario", "free_response")
VALID_CONTENT_KINDS = ("rubric", "scenario", "fr_prompt")

# pbkdf2 relies only on hashlib.pbkdf2_hmac (present in every Python build).
# werkzeug's default of scrypt needs OpenSSL-with-scrypt, which the macOS
# system Python (linked against LibreSSL) lacks — so pin pbkdf2 for portability.
_HASH_METHOD = "pbkdf2:sha256"

EXPORT_SCHEMA_VERSION = "3"

# Canonical column list for the evaluations table (Modes B and C). Mirrors the
# research export data dictionary (docs/research_export_data_dictionary.md);
# the export builder derives its field list from this so the two cannot drift.
# username/display_name/role live on users/assessments and are joined at export.
EVALUATION_FIELDS = [
    "task_title",
    "report_type",
    "timestamp",
    "export_schema_version",
    "product_score_percent",
    "text_only_baseline_percent",
    "coverage_score_percent",
    "quality_score_percent",
    "matched_points",
    "missed_points",
    "strengths",
    "gaps",
    "word_count",
    "has_process_overlay",
    "process_quadrant",
    "effort_profile",
    "revision_toward_quality",
    "difficulty_point_count",
    "authenticity",
    "confidence_calibration",
    "closing_nudge_used",
    "process_caution",
    "thinking_honey_mumford",
    "thinking_solo",
    "ai_assistance_used",
    "ai_assistance_notes",
]

_SEED_USERS = [
    # (username, password, role, display_name)
    ("admin",      "admin123",   "admin",      "Administrator"),
    ("instructor", "Teach@2024", "instructor", "Instructor Demo"),
    ("emma",  "Learn@2024", "student", "Emma Clarke"),
    ("liam",  "Learn@2024", "student", "Liam Patel"),
    ("sofia", "Learn@2024", "student", "Sofia Nguyen"),
    ("james", "Learn@2024", "student", "James Okafor"),
    ("priya", "Learn@2024", "student", "Priya Singh"),
    ("tyler", "Learn@2024", "student", "Tyler Brooke"),
]


def utcnow() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def new_id() -> str:
    return uuid.uuid4().hex


def _conn():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(DB_FILE))
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA foreign_keys=ON")
    return c


def _widen(c, table: str, columns: dict):
    """Idempotent column additions: the V5 pattern for schema evolution."""
    existing = {row["name"] for row in c.execute(f"PRAGMA table_info({table})").fetchall()}
    for name, decl in columns.items():
        if name not in existing:
            c.execute(f"ALTER TABLE {table} ADD COLUMN {name} {decl}")


def init_db():
    with _conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS users (
                username           TEXT PRIMARY KEY,
                password_hash      TEXT NOT NULL,
                role               TEXT NOT NULL CHECK(role IN ('admin','instructor','student')),
                display_name       TEXT NOT NULL,
                theme              TEXT NOT NULL DEFAULT 'light',
                preferred_provider TEXT NOT NULL DEFAULT '',
                preferred_model    TEXT NOT NULL DEFAULT '',
                created_at         TEXT NOT NULL DEFAULT ''
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS auth_sessions (
                token_hash TEXT PRIMARY KEY,
                username   TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS content_items (
                kind       TEXT NOT NULL CHECK(kind IN ('rubric','scenario','fr_prompt')),
                content_id TEXT NOT NULL,
                version    TEXT NOT NULL,
                payload    TEXT NOT NULL,
                active     INTEGER NOT NULL DEFAULT 1,
                created_by TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                PRIMARY KEY (kind, content_id, version)
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS assessments (
                id              TEXT PRIMARY KEY,
                username        TEXT NOT NULL,
                mode            TEXT NOT NULL CHECK(mode IN ('essay_trace','scenario','free_response')),
                status          TEXT NOT NULL DEFAULT 'draft'
                                CHECK(status IN ('draft','in_progress','grading','graded','error')),
                name            TEXT NOT NULL DEFAULT '',
                description     TEXT NOT NULL DEFAULT '',
                content_id      TEXT NOT NULL DEFAULT '',
                content_version TEXT NOT NULL DEFAULT '',
                artifacts       TEXT NOT NULL DEFAULT '{}',
                is_exemplar     INTEGER NOT NULL DEFAULT 0,
                graded_live     INTEGER NOT NULL DEFAULT 0,
                export_schema_version TEXT NOT NULL DEFAULT '',
                created_at      TEXT NOT NULL,
                completed_at    TEXT NOT NULL DEFAULT ''
            )
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_assessments_user ON assessments(username)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_assessments_mode ON assessments(mode)")

        c.execute("""
            CREATE TABLE IF NOT EXISTS score_records (
                assessment_id      TEXT NOT NULL,
                criterion_id       TEXT NOT NULL,
                channel            TEXT NOT NULL CHECK(channel IN ('trace','product')),
                passes             TEXT NOT NULL DEFAULT '[]',
                median             REAL,
                spread             REAL,
                no_evidence        INTEGER NOT NULL DEFAULT 0,
                confidence         TEXT NOT NULL DEFAULT 'low',
                evidence           TEXT NOT NULL DEFAULT '[]',
                anchor_matched     TEXT NOT NULL DEFAULT '',
                rubric_version     TEXT NOT NULL DEFAULT '',
                graded_at          TEXT NOT NULL DEFAULT '',
                needs_review       INTEGER NOT NULL DEFAULT 0,
                review_reasons     TEXT NOT NULL DEFAULT '[]',
                override_score     REAL,
                override_rationale TEXT NOT NULL DEFAULT '',
                override_ts        TEXT NOT NULL DEFAULT '',
                PRIMARY KEY (assessment_id, criterion_id, channel)
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS layer_b_results (
                assessment_id         TEXT PRIMARY KEY,
                result                TEXT NOT NULL,
                dominant_help_seeking TEXT NOT NULL DEFAULT '',
                dominant_response_use TEXT NOT NULL DEFAULT '',
                interpretive_label    TEXT NOT NULL DEFAULT '',
                verification_rate     REAL
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS evaluations (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                assessment_id TEXT NOT NULL,
                evaluation    TEXT NOT NULL DEFAULT '{{}}',
                {cols},
                UNIQUE(assessment_id, task_title)
            )
        """.format(cols=", ".join(f"{f} TEXT NOT NULL DEFAULT ''"
                                  for f in EVALUATION_FIELDS)))
        _widen(c, "evaluations",
               {f: "TEXT NOT NULL DEFAULT ''" for f in EVALUATION_FIELDS})
        c.execute("CREATE INDEX IF NOT EXISTS idx_evaluations_assessment "
                  "ON evaluations(assessment_id)")

        c.execute("""
            CREATE TABLE IF NOT EXISTS annotations (
                assessment_id TEXT NOT NULL,
                task_title    TEXT NOT NULL DEFAULT '',
                label         TEXT NOT NULL
                              CHECK(label IN ('correct','partial','missing','needs_expert_review')),
                notes         TEXT NOT NULL DEFAULT '',
                reviewer      TEXT NOT NULL DEFAULT '',
                updated_at    TEXT NOT NULL,
                PRIMARY KEY (assessment_id, task_title)
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS assessment_runs (
                assessment_id TEXT PRIMARY KEY,
                state         TEXT NOT NULL,
                updated_at    TEXT NOT NULL,
                expires_at    TEXT NOT NULL
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id            TEXT PRIMARY KEY,
                assessment_id TEXT NOT NULL,
                kind          TEXT NOT NULL,
                status        TEXT NOT NULL DEFAULT 'running'
                              CHECK(status IN ('running','done','error')),
                done          INTEGER NOT NULL DEFAULT 0,
                total         INTEGER NOT NULL DEFAULT 0,
                label         TEXT NOT NULL DEFAULT '',
                error         TEXT NOT NULL DEFAULT '',
                created_at    TEXT NOT NULL,
                updated_at    TEXT NOT NULL
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS llm_eval_cache (
                key        TEXT PRIMARY KEY,
                response   TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        # Every accepted novel-equivalent FR match is logged for admin review --
        # promotion into a key point's exemplars list is always an explicit human
        # action, never automatic. Scoring never waits on this.
        c.execute("""
            CREATE TABLE IF NOT EXISTS novel_equivalent_review (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id          TEXT NOT NULL,
                key_point_id       TEXT NOT NULL,
                construct          TEXT NOT NULL,
                submission_excerpt TEXT NOT NULL,
                evidence_spans     TEXT NOT NULL,
                justification      TEXT NOT NULL,
                pool_id            TEXT,
                status             TEXT NOT NULL DEFAULT 'pending'
                                   CHECK(status IN ('pending','promoted','dismissed')),
                created_at         TEXT NOT NULL
            )
        """)
        # Every accepted FR match (exemplar or novel_equivalent) is logged so the
        # novel-equivalent rate per key point has a real denominator.
        c.execute("""
            CREATE TABLE IF NOT EXISTS fr_match_log (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id    TEXT NOT NULL,
                key_point_id TEXT NOT NULL,
                construct    TEXT NOT NULL,
                match_type   TEXT NOT NULL CHECK(match_type IN ('exemplar','novel_equivalent')),
                created_at   TEXT NOT NULL
            )
        """)
        c.commit()


def seed_default_users():
    """Populate the DB with demo accounts on first run (idempotent)."""
    init_db()
    with _conn() as c:
        if c.execute("SELECT COUNT(*) FROM users").fetchone()[0] > 0:
            return False
        c.executemany(
            "INSERT OR IGNORE INTO users "
            "(username,password_hash,role,display_name,theme,preferred_provider,"
            " preferred_model,created_at) VALUES (?,?,?,?,?,?,?,?)",
            [(u, generate_password_hash(p, method=_HASH_METHOD), r, n, "light", "", "", utcnow())
             for u, p, r, n in _SEED_USERS],
        )
        c.commit()
    return True


# ── User CRUD ─────────────────────────────────────────────────────────────────

def get_user(username: str):
    with _conn() as c:
        row = c.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        return dict(row) if row else None


def all_users():
    with _conn() as c:
        rows = c.execute("SELECT * FROM users ORDER BY role, display_name").fetchall()
        return [dict(r) for r in rows]


def create_user(username: str, password: str, role: str, display_name: str):
    if role not in VALID_ROLES:
        return False, "Invalid role."
    with _conn() as c:
        if c.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone():
            return False, "That username is already taken."
        c.execute(
            "INSERT INTO users (username,password_hash,role,display_name,created_at) "
            "VALUES (?,?,?,?,?)",
            (username, generate_password_hash(password, method=_HASH_METHOD),
             role, display_name, utcnow()),
        )
        c.commit()
    return True, None


def set_password(username: str, new_password: str) -> bool:
    with _conn() as c:
        cur = c.execute(
            "UPDATE users SET password_hash=? WHERE username=?",
            (generate_password_hash(new_password, method=_HASH_METHOD), username),
        )
        c.commit()
        return cur.rowcount > 0


def update_user(old_username: str, new_username: str, display_name: str, role: str):
    """Update a user's username (PK), display name, and role.

    Returns (True, None) on success or (False, error_message) on failure.
    """
    if role not in VALID_ROLES:
        return False, "Invalid role."
    with _conn() as c:
        existing = c.execute(
            "SELECT role FROM users WHERE username=?", (old_username,)
        ).fetchone()
        if not existing:
            return False, "User not found."
        # Block removing the final admin (demotion or rename both count).
        if existing["role"] == "admin" and role != "admin":
            others = c.execute(
                "SELECT COUNT(*) FROM users WHERE role='admin' AND username!=?",
                (old_username,),
            ).fetchone()[0]
            if others == 0:
                return False, "Cannot demote the last remaining admin."
        if new_username != old_username:
            if c.execute("SELECT 1 FROM users WHERE username=?", (new_username,)).fetchone():
                return False, "That username is already taken."
        try:
            c.execute(
                "UPDATE users SET username=?, display_name=?, role=? WHERE username=?",
                (new_username, display_name, role, old_username),
            )
            c.execute("UPDATE assessments SET username=? WHERE username=?",
                      (new_username, old_username))
            c.execute("UPDATE auth_sessions SET username=? WHERE username=?",
                      (new_username, old_username))
        except sqlite3.IntegrityError:
            return False, "Could not update user (constraint violation)."
        c.commit()
        return True, None


def set_theme(username: str, theme: str):
    if theme not in ("light", "dark"):
        return
    with _conn() as c:
        c.execute("UPDATE users SET theme=? WHERE username=?", (theme, username))
        c.commit()


def set_model_pref(username: str, provider: str, model: str):
    with _conn() as c:
        c.execute(
            "UPDATE users SET preferred_provider=?, preferred_model=? WHERE username=?",
            (provider or "", model or "", username),
        )
        c.commit()


# ── Auth sessions (opaque token, hash at rest) ────────────────────────────────

SESSION_TTL_DAYS = 14


def create_auth_session(token_hash: str, username: str):
    with _conn() as c:
        expires = (datetime.now(timezone.utc)
                   + timedelta(days=SESSION_TTL_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
        c.execute(
            "INSERT INTO auth_sessions (token_hash, username, created_at, expires_at) "
            "VALUES (?,?,?,?)",
            (token_hash, username, utcnow(), expires),
        )
        c.commit()


def get_auth_session(token_hash: str):
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM auth_sessions WHERE token_hash=?", (token_hash,)
        ).fetchone()
        if not row:
            return None
        if row["expires_at"] < utcnow():
            c.execute("DELETE FROM auth_sessions WHERE token_hash=?", (token_hash,))
            c.commit()
            return None
        return dict(row)


def delete_auth_session(token_hash: str):
    with _conn() as c:
        c.execute("DELETE FROM auth_sessions WHERE token_hash=?", (token_hash,))
        c.execute("DELETE FROM auth_sessions WHERE expires_at < ?", (utcnow(),))
        c.commit()


# ── Content items (versioned rubrics / scenarios / FR prompts) ────────────────

def upsert_content(kind: str, content_id: str, version: str, payload: dict,
                   created_by: str = "", active: bool = True):
    if kind not in VALID_CONTENT_KINDS:
        raise ValueError(f"invalid content kind: {kind}")
    with _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO content_items "
            "(kind, content_id, version, payload, active, created_by, created_at) "
            "VALUES (?,?,?,?,?,?,?)",
            (kind, content_id, version, json.dumps(payload), 1 if active else 0,
             created_by, utcnow()),
        )
        c.commit()


def get_content(kind: str, content_id: str, version: str = None):
    """Fetch one content item; latest version (by created_at, then version) if unspecified."""
    with _conn() as c:
        if version:
            row = c.execute(
                "SELECT * FROM content_items WHERE kind=? AND content_id=? AND version=?",
                (kind, content_id, version),
            ).fetchone()
        else:
            row = c.execute(
                "SELECT * FROM content_items WHERE kind=? AND content_id=? AND active=1 "
                "ORDER BY created_at DESC, version DESC LIMIT 1",
                (kind, content_id),
            ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["payload"] = json.loads(d["payload"])
        return d


def list_content(kind: str):
    """Latest active version of every content item of a kind."""
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM content_items WHERE kind=? AND active=1 "
            "ORDER BY content_id, created_at DESC, version DESC",
            (kind,),
        ).fetchall()
        latest = {}
        for r in rows:
            if r["content_id"] not in latest:
                d = dict(r)
                d["payload"] = json.loads(d["payload"])
                latest[r["content_id"]] = d
        return list(latest.values())


def list_content_versions(kind: str, content_id: str):
    with _conn() as c:
        rows = c.execute(
            "SELECT kind, content_id, version, created_by, created_at FROM content_items "
            "WHERE kind=? AND content_id=? ORDER BY created_at DESC",
            (kind, content_id),
        ).fetchall()
        return [dict(r) for r in rows]


# ── Assessments spine ─────────────────────────────────────────────────────────

def create_assessment(username: str, mode: str, name: str = "", description: str = "",
                      content_id: str = "", content_version: str = "",
                      artifacts: dict = None, is_exemplar: bool = False,
                      status: str = "draft", assessment_id: str = None):
    if mode not in VALID_MODES:
        raise ValueError(f"invalid mode: {mode}")
    aid = assessment_id or new_id()
    with _conn() as c:
        c.execute(
            "INSERT INTO assessments (id, username, mode, status, name, description, "
            "content_id, content_version, artifacts, is_exemplar, export_schema_version, "
            "created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (aid, username, mode, status, name, description, content_id, content_version,
             json.dumps(artifacts or {}), 1 if is_exemplar else 0,
             EXPORT_SCHEMA_VERSION, utcnow()),
        )
        c.commit()
    return aid


def _assessment_from_row(row):
    d = dict(row)
    d["artifacts"] = json.loads(d["artifacts"] or "{}")
    d["is_exemplar"] = bool(d["is_exemplar"])
    d["graded_live"] = bool(d["graded_live"])
    return d


def get_assessment(assessment_id: str):
    with _conn() as c:
        row = c.execute("SELECT * FROM assessments WHERE id=?", (assessment_id,)).fetchone()
        return _assessment_from_row(row) if row else None


def list_assessments(username: str = None, mode: str = None):
    q, params = "SELECT * FROM assessments", []
    clauses = []
    if username:
        clauses.append("username=?")
        params.append(username)
    if mode:
        clauses.append("mode=?")
        params.append(mode)
    if clauses:
        q += " WHERE " + " AND ".join(clauses)
    q += " ORDER BY created_at DESC"
    with _conn() as c:
        return [_assessment_from_row(r) for r in c.execute(q, params).fetchall()]


def update_assessment(assessment_id: str, **fields):
    allowed = {"status", "name", "description", "artifacts", "completed_at",
               "graded_live", "content_version"}
    updates, params = [], []
    for k, v in fields.items():
        if k not in allowed:
            raise ValueError(f"cannot update field: {k}")
        if k == "artifacts":
            v = json.dumps(v)
        if k == "graded_live":
            v = 1 if v else 0
        updates.append(f"{k}=?")
        params.append(v)
    if not updates:
        return
    params.append(assessment_id)
    with _conn() as c:
        c.execute(f"UPDATE assessments SET {', '.join(updates)} WHERE id=?", params)
        c.commit()


def delete_assessment(assessment_id: str):
    with _conn() as c:
        for table in ("score_records", "layer_b_results", "evaluations",
                      "annotations", "assessment_runs", "jobs"):
            c.execute(f"DELETE FROM {table} WHERE assessment_id=?", (assessment_id,))
        c.execute("DELETE FROM assessments WHERE id=?", (assessment_id,))
        c.commit()


# ── Score records (Mode A: one claim per row) ─────────────────────────────────

def upsert_score_record(assessment_id: str, rec: dict):
    """rec follows the TGFWA ScoreRecord shape (snake_case keys)."""
    with _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO score_records "
            "(assessment_id, criterion_id, channel, passes, median, spread, no_evidence, "
            " confidence, evidence, anchor_matched, rubric_version, graded_at, "
            " needs_review, review_reasons, override_score, override_rationale, override_ts) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (assessment_id, rec["criterion_id"], rec["channel"],
             json.dumps(rec.get("passes", [])), rec.get("median"), rec.get("spread"),
             1 if rec.get("no_evidence") else 0, rec.get("confidence", "low"),
             json.dumps(rec.get("evidence", [])), rec.get("anchor_matched", "") or "",
             rec.get("rubric_version", ""), rec.get("graded_at", utcnow()),
             1 if rec.get("needs_review") else 0,
             json.dumps(rec.get("review_reasons", [])),
             rec.get("override_score"), rec.get("override_rationale", "") or "",
             rec.get("override_ts", "") or ""),
        )
        c.commit()


def _score_record_from_row(row):
    d = dict(row)
    d["passes"] = json.loads(d["passes"])
    d["evidence"] = json.loads(d["evidence"])
    d["review_reasons"] = json.loads(d["review_reasons"])
    d["no_evidence"] = bool(d["no_evidence"])
    d["needs_review"] = bool(d["needs_review"])
    return d


def get_score_records(assessment_id: str):
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM score_records WHERE assessment_id=? "
            "ORDER BY criterion_id, channel",
            (assessment_id,),
        ).fetchall()
        return [_score_record_from_row(r) for r in rows]


def delete_score_records(assessment_id: str):
    with _conn() as c:
        c.execute("DELETE FROM score_records WHERE assessment_id=?", (assessment_id,))
        c.commit()


def set_score_override(assessment_id: str, criterion_id: str, channel: str,
                       score: float, rationale: str) -> bool:
    with _conn() as c:
        cur = c.execute(
            "UPDATE score_records SET override_score=?, override_rationale=?, override_ts=? "
            "WHERE assessment_id=? AND criterion_id=? AND channel=?",
            (score, rationale, utcnow(), assessment_id, criterion_id, channel),
        )
        c.commit()
        return cur.rowcount > 0


def review_queue():
    """All score records routed to instructor judgment, unresolved first."""
    with _conn() as c:
        rows = c.execute(
            "SELECT sr.*, a.username, a.name AS assessment_name FROM score_records sr "
            "JOIN assessments a ON a.id = sr.assessment_id "
            "WHERE sr.needs_review=1 ORDER BY (sr.override_ts != '') ASC, sr.graded_at DESC"
        ).fetchall()
        return [_score_record_from_row(r) for r in rows]


def override_corpus():
    """Every overridden score record — the labeled calibration dataset
    (TGFWA exportOverrideCorpus, now cross-user and durable)."""
    with _conn() as c:
        rows = c.execute(
            "SELECT sr.*, a.username FROM score_records sr "
            "JOIN assessments a ON a.id = sr.assessment_id "
            "WHERE sr.override_ts != '' ORDER BY sr.override_ts"
        ).fetchall()
        return [_score_record_from_row(r) for r in rows]


# ── Layer B results ───────────────────────────────────────────────────────────

def upsert_layer_b(assessment_id: str, result: dict):
    with _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO layer_b_results "
            "(assessment_id, result, dominant_help_seeking, dominant_response_use, "
            " interpretive_label, verification_rate) VALUES (?,?,?,?,?,?)",
            (assessment_id, json.dumps(result),
             result.get("dominantHelpSeeking", ""), result.get("dominantResponseUse", ""),
             result.get("interpretiveLabel", ""), result.get("verificationRate")),
        )
        c.commit()


def get_layer_b(assessment_id: str):
    with _conn() as c:
        row = c.execute(
            "SELECT result FROM layer_b_results WHERE assessment_id=?", (assessment_id,)
        ).fetchone()
        return json.loads(row["result"]) if row else None


# ── Evaluations (Modes B & C flattened research rows) ─────────────────────────

def upsert_evaluation(assessment_id: str, fields: dict, evaluation: dict = None):
    """Insert or replace the structured research row for an assessment task.

    Idempotent on (assessment_id, task_title): re-generating never duplicates.
    """
    fields = dict(fields)
    fields.setdefault("export_schema_version", EXPORT_SCHEMA_VERSION)
    fields.setdefault("timestamp", utcnow())
    cols = ", ".join(EVALUATION_FIELDS)
    placeholders = ", ".join("?" for _ in EVALUATION_FIELDS)
    with _conn() as c:
        c.execute(
            f"INSERT OR REPLACE INTO evaluations (assessment_id, evaluation, {cols}) "
            f"VALUES (?,?,{placeholders})",
            (assessment_id, json.dumps(evaluation or {}),
             *(str(fields.get(f, "") or "") for f in EVALUATION_FIELDS)),
        )
        c.commit()


def get_evaluations(assessment_id: str):
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM evaluations WHERE assessment_id=? ORDER BY task_title",
            (assessment_id,),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["evaluation"] = json.loads(d["evaluation"] or "{}")
            out.append(d)
        return out


def all_evaluation_rows():
    """Every evaluation row joined to its assessment/user — the research export."""
    with _conn() as c:
        rows = c.execute(
            "SELECT e.*, a.username, a.mode, a.id AS assessment_id, "
            "       u.display_name, u.role, "
            "       ann.label AS annotation_label, ann.notes AS annotation_notes, "
            "       ann.reviewer AS annotation_reviewer, ann.updated_at AS annotation_updated_at "
            "FROM evaluations e "
            "JOIN assessments a ON a.id = e.assessment_id "
            "LEFT JOIN users u ON u.username = a.username "
            "LEFT JOIN annotations ann ON ann.assessment_id = e.assessment_id "
            "  AND ann.task_title = e.task_title "
            "ORDER BY a.username, e.timestamp, e.task_title"
        ).fetchall()
        return [dict(r) for r in rows]


# ── Annotations (instructor verdicts on LLM grading) ──────────────────────────

def set_annotation(assessment_id: str, task_title: str, label: str,
                   notes: str, reviewer: str) -> bool:
    if label not in ("correct", "partial", "missing", "needs_expert_review"):
        return False
    with _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO annotations "
            "(assessment_id, task_title, label, notes, reviewer, updated_at) "
            "VALUES (?,?,?,?,?,?)",
            (assessment_id, task_title or "", label, notes, reviewer, utcnow()),
        )
        c.commit()
        return True


def assessment_calibration_stats():
    """Aggregate instructor-annotation labels against LLM product scores.

    The annotation labels record an instructor's verdict on the LLM's grading
    ('correct'/'partial'/'missing'/'needs_expert_review'), so the share labelled
    'correct' is the LLM-vs-instructor agreement rate, and the average LLM score
    per label is the miscalibration signal (a high average score on
    'missing'-labelled rows means the LLM over-credits).
    """
    labels = ("correct", "partial", "missing", "needs_expert_review")
    with _conn() as c:
        total = c.execute("SELECT COUNT(*) FROM evaluations").fetchone()[0]

        label_rows = c.execute(
            "SELECT ann.label AS label, COUNT(*) AS n, "
            "       AVG(CAST(NULLIF(e.product_score_percent,'') AS REAL)) AS avg_score "
            "FROM annotations ann "
            "JOIN evaluations e ON e.assessment_id = ann.assessment_id "
            "  AND e.task_title = ann.task_title "
            "GROUP BY ann.label"
        ).fetchall()
        by_label = {r["label"]: r["n"] for r in label_rows}
        avg_scores = {r["label"]: (round(r["avg_score"], 1) if r["avg_score"] is not None else None)
                      for r in label_rows}
        annotated = sum(by_label.values())

        task_rows = c.execute(
            "SELECT e.task_title, e.report_type, COUNT(*) AS total, "
            "  SUM(ann.label IS NOT NULL) AS annotated, "
            "  SUM(ann.label = 'correct') AS correct, "
            "  SUM(ann.label = 'partial') AS partial, "
            "  SUM(ann.label = 'missing') AS missing, "
            "  SUM(ann.label = 'needs_expert_review') AS needs_expert_review, "
            "  AVG(CAST(NULLIF(e.product_score_percent,'') AS REAL)) AS avg_score "
            "FROM evaluations e "
            "LEFT JOIN annotations ann ON ann.assessment_id = e.assessment_id "
            "  AND ann.task_title = e.task_title "
            "GROUP BY e.task_title, e.report_type"
        ).fetchall()
        by_task = []
        for r in task_rows:
            t = dict(r)
            t["avg_score"] = round(t["avg_score"], 1) if t["avg_score"] is not None else None
            t["agreement_rate"] = (t["correct"] / t["annotated"]) if t["annotated"] else None
            by_task.append(t)
        # most-disagreeing tasks first; un-annotated tasks sink to the bottom
        by_task.sort(key=lambda t: (t["agreement_rate"] is None,
                                    t["agreement_rate"] if t["agreement_rate"] is not None else 0))

        recent = [dict(r) for r in c.execute(
            "SELECT a.username, e.task_title, ann.label AS annotation_label, "
            "       e.product_score_percent, ann.reviewer AS annotation_reviewer, "
            "       ann.updated_at AS annotation_updated_at "
            "FROM annotations ann "
            "JOIN evaluations e ON e.assessment_id = ann.assessment_id "
            "  AND e.task_title = ann.task_title "
            "JOIN assessments a ON a.id = ann.assessment_id "
            "ORDER BY ann.updated_at DESC LIMIT 10"
        ).fetchall()]

    return {
        "total": total,
        "annotated": annotated,
        "labels": {l: by_label.get(l, 0) for l in labels},
        "avg_score_by_label": {l: avg_scores.get(l) for l in labels},
        "agreement_rate": (by_label.get("correct", 0) / annotated) if annotated else None,
        "by_task": by_task,
        "recent": recent,
    }


# ── Live run state (replaces V5 in-memory _state/_fr_state dicts) ─────────────

RUN_TTL_HOURS = 12


def save_run_state(assessment_id: str, state: dict):
    with _conn() as c:
        expires = (datetime.now(timezone.utc)
                   + timedelta(hours=RUN_TTL_HOURS)).strftime("%Y-%m-%dT%H:%M:%SZ")
        c.execute(
            "INSERT OR REPLACE INTO assessment_runs (assessment_id, state, updated_at, expires_at) "
            "VALUES (?,?,?,?)",
            (assessment_id, json.dumps(state), utcnow(), expires),
        )
        c.commit()


def load_run_state(assessment_id: str):
    with _conn() as c:
        c.execute("DELETE FROM assessment_runs WHERE expires_at < ?", (utcnow(),))
        row = c.execute(
            "SELECT state FROM assessment_runs WHERE assessment_id=?", (assessment_id,)
        ).fetchone()
        c.commit()
        return json.loads(row["state"]) if row else None


def delete_run_state(assessment_id: str):
    with _conn() as c:
        c.execute("DELETE FROM assessment_runs WHERE assessment_id=?", (assessment_id,))
        c.commit()


# ── Jobs (grading progress; SSE + polling fallback) ───────────────────────────

def create_job(assessment_id: str, kind: str, total: int = 0):
    jid = new_id()
    with _conn() as c:
        c.execute(
            "INSERT INTO jobs (id, assessment_id, kind, status, done, total, label, "
            "created_at, updated_at) VALUES (?,?,?,'running',0,?,'',?,?)",
            (jid, assessment_id, kind, total, utcnow(), utcnow()),
        )
        c.commit()
    return jid


def update_job(job_id: str, done: int = None, total: int = None, label: str = None,
               status: str = None, error: str = None):
    updates, params = ["updated_at=?"], [utcnow()]
    for col, val in (("done", done), ("total", total), ("label", label),
                     ("status", status), ("error", error)):
        if val is not None:
            updates.append(f"{col}=?")
            params.append(val)
    params.append(job_id)
    with _conn() as c:
        c.execute(f"UPDATE jobs SET {', '.join(updates)} WHERE id=?", params)
        c.commit()


def get_job(job_id: str):
    with _conn() as c:
        row = c.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        return dict(row) if row else None


# ── LLM evaluative-call cache ─────────────────────────────────────────────────
# Determinism/testing aid only (see core.llm.cached_evaluative_call) -- not a
# cost-saving cache. Identical (model, base_url, prompt_version, prompt) input
# always returns the same stored response, so repeated test runs stay reproducible.

_EVAL_CACHE_MAX_ROWS = 2000


def eval_cache_get(key: str):
    with _conn() as c:
        row = c.execute("SELECT response FROM llm_eval_cache WHERE key=?", (key,)).fetchone()
        return row["response"] if row else None


def eval_cache_set(key: str, response: str):
    with _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO llm_eval_cache (key, response, created_at) "
            "VALUES (?, ?, datetime('now'))",
            (key, response),
        )
        excess = c.execute("SELECT COUNT(*) FROM llm_eval_cache").fetchone()[0] - _EVAL_CACHE_MAX_ROWS
        if excess > 0:
            c.execute(
                "DELETE FROM llm_eval_cache WHERE key IN ("
                "  SELECT key FROM llm_eval_cache ORDER BY created_at ASC, key ASC LIMIT ?)",
                (excess,),
            )
        c.commit()


# ── Novel-equivalent review queue (FR construct/exemplar matching) ────────────

def log_novel_equivalent(prompt_id: str, key_point_id: str, construct: str,
                         submission_excerpt: str, evidence_spans: list, justification: str,
                         pool_id: str = None):
    with _conn() as c:
        c.execute(
            "INSERT INTO novel_equivalent_review "
            "(prompt_id, key_point_id, construct, submission_excerpt, evidence_spans, "
            "justification, pool_id, status, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))",
            (prompt_id, key_point_id, construct, submission_excerpt,
             json.dumps(list(evidence_spans or [])), justification or "", pool_id),
        )
        c.commit()


def _row_to_review(row):
    d = dict(row)
    try:
        d["evidence_spans"] = json.loads(d["evidence_spans"])
    except (TypeError, ValueError):
        d["evidence_spans"] = []
    return d


def list_novel_equivalent_reviews(status: str = "pending"):
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM novel_equivalent_review WHERE status=? ORDER BY created_at DESC",
            (status,),
        ).fetchall()
        return [_row_to_review(r) for r in rows]


def get_novel_equivalent_review(review_id: int):
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM novel_equivalent_review WHERE id=?", (review_id,)
        ).fetchone()
        return _row_to_review(row) if row else None


def set_novel_equivalent_status(review_id: int, status: str) -> bool:
    if status not in ("pending", "promoted", "dismissed"):
        return False
    with _conn() as c:
        cur = c.execute(
            "UPDATE novel_equivalent_review SET status=? WHERE id=?", (status, review_id)
        )
        c.commit()
        return cur.rowcount > 0


# ── FR match log / novel-equivalent reliability metric ────────────────────────

def log_fr_match(prompt_id: str, key_point_id: str, construct: str, match_type: str):
    """Record one accepted FR match (of either type) -- the denominator for the
    novel-equivalent rate. Purely additive bookkeeping; never read at grading time.
    """
    if match_type not in ("exemplar", "novel_equivalent"):
        return
    with _conn() as c:
        c.execute(
            "INSERT INTO fr_match_log (prompt_id, key_point_id, construct, match_type, created_at) "
            "VALUES (?, ?, ?, ?, datetime('now'))",
            (prompt_id, key_point_id, construct, match_type),
        )
        c.commit()


def get_fr_match_stats():
    """Per-key-point reliability metric: total matches, novel-equivalent count/rate,
    and promote/dismiss counts among reviewed novel-equivalent entries. A high rate
    for a key point is a signal to expand that point's exemplars, not evidence the
    grader is behaving unreliably.
    """
    with _conn() as c:
        totals = c.execute(
            "SELECT prompt_id, key_point_id, construct, "
            "  COUNT(*) AS total_matches, "
            "  SUM(CASE WHEN match_type='novel_equivalent' THEN 1 ELSE 0 END) AS novel_count "
            "FROM fr_match_log GROUP BY prompt_id, key_point_id, construct"
        ).fetchall()
        reviews = c.execute(
            "SELECT prompt_id, key_point_id, "
            "  SUM(CASE WHEN status='promoted' THEN 1 ELSE 0 END) AS promoted, "
            "  SUM(CASE WHEN status='dismissed' THEN 1 ELSE 0 END) AS dismissed, "
            "  SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending "
            "FROM novel_equivalent_review GROUP BY prompt_id, key_point_id"
        ).fetchall()
        review_by_kp = {(r["prompt_id"], r["key_point_id"]): dict(r) for r in reviews}

        stats = []
        for row in totals:
            key = (row["prompt_id"], row["key_point_id"])
            review = review_by_kp.pop(key, None)
            total = row["total_matches"] or 0
            novel = row["novel_count"] or 0
            stats.append({
                "prompt_id": row["prompt_id"],
                "key_point_id": row["key_point_id"],
                "construct": row["construct"],
                "total_matches": total,
                "novel_count": novel,
                "novel_rate": (novel / total) if total else 0.0,
                "promoted": (review or {}).get("promoted", 0) or 0,
                "dismissed": (review or {}).get("dismissed", 0) or 0,
                "pending_review": (review or {}).get("pending", 0) or 0,
            })
        # Key points with reviewed novel-equivalents but no match-log rows
        # (pre-existing data) -- surface them with total=novel so the rate still
        # reads as 100% rather than silently disappearing from the view.
        for key, review in review_by_kp.items():
            promoted = review.get("promoted", 0) or 0
            dismissed = review.get("dismissed", 0) or 0
            pending = review.get("pending", 0) or 0
            novel = promoted + dismissed + pending
            stats.append({
                "prompt_id": key[0],
                "key_point_id": key[1],
                "construct": "",
                "total_matches": novel,
                "novel_count": novel,
                "novel_rate": 1.0 if novel else 0.0,
                "promoted": promoted,
                "dismissed": dismissed,
                "pending_review": pending,
            })
        stats.sort(key=lambda s: s["novel_rate"], reverse=True)
        return stats
