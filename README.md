# Assessment Platform

A unified research platform for assessing competence from **process, not just outcome** — combining and maturing two prior research prototypes (a trace-grounded writing-assessment demo and a performative-assessment app) into one system.

Three assessment modes, one evidence model:

| Mode | What it measures | Method |
|---|---|---|
| **Essay + AI trace** | Writing-standard mastery from both the final essay (*product*) and the student↔AI dialogue (*trace*); their divergence is the formative signal | One-criterion-per-LLM-call, 3 passes, median + spread, verbatim evidence-provenance guard, student-attribution guard |
| **Scenario** | Procedural/diagnostic knowledge under free recall, then structured CTA probing | Recall → gap analysis → typed probes (sequencing/how/rationale/decision/error/edge case); Coverage + explanation Quality |
| **Free response** | Spontaneously produced knowledge in unaided single-pass writing | Coverage + Chi explanation-quality, deterministic SOLO derivation, keystroke writing-process overlay |

Plus: instructor review queue with overrides, versioned rubrics, a grading reliability dashboard (LLM-vs-instructor calibration), and a versioned research export.

**Governing rule ("no row, no claim"):** every signal rendered as a claim anywhere in the platform must have a row in [`docs/evidence-model.md`](docs/evidence-model.md) stating the claim it supports, its confidence, and what it does *not* rule out.

## Quick start

Prerequisites: Python ≥ 3.10, Node ≥ 20 (Docker optional, for deployment).

```bash
make setup      # python venv + npm install
make seed       # seed demo users and content
make dev        # API on :8000, web on :5173
```

Open http://localhost:5173 and sign in with a demo account:

| Account | Password | Role |
|---|---|---|
| `admin` | `admin123` | admin (users, reliability dashboard, export) |
| `instructor` | `Teach@2024` | instructor (review queue, overrides, rubric/library) |
| `emma` `liam` `sofia` `james` `priya` `tyler` | `Learn@2024` | students (own assessments only) |

Change these before any non-demo use.

No API key? The platform still runs: scoring falls back to keyword matching, and bundled exemplar sessions carry precomputed scores. Two ways to enable live LLM grading:

- **Server keys** (default): add provider keys to `.env` (copy `.env.example`). They stay server-side and are never sent to the browser.
- **Bring your own key**: any signed-in user can save a personal key under **Settings → Use your own API key**. It lives in that browser's localStorage only and rides on each of the user's grading requests as a header; the server uses it transiently and never stores or logs it. While set, it takes precedence over the server key.

## Architecture

- `backend/` — FastAPI + SQLite. All LLM calls, grading, scoring, and the research database live here.
- `frontend/` — React 18 + Vite + TypeScript + Tailwind SPA.
- `content/` — seed corpus: rubrics, scenarios, free-response prompts, exemplar sessions (loaded into the DB by `make seed`).
- `docs/` — the unified evidence model, research-export data dictionary, testing notes.

## Development

```bash
make test       # backend pytest suite (147 tests, no network or keys needed)
make build      # typecheck + production frontend build
make e2e        # zero-API-key end-to-end smoke test
```

CI (`.github/workflows/ci.yml`) runs the backend suite and the strict-TypeScript
frontend build on every push and pull request.

## Deployment

The platform deploys as a **single process**: uvicorn serves the API and, when
`frontend/dist/` exists, the built SPA and its assets on the same port. All
state lives in one SQLite database plus generated report files under
`backend/data/` — persist that directory and you've persisted everything.

### Option A — Docker (recommended)

```bash
cp .env.example .env    # optional: add provider keys; empty = keyword fallback
docker compose up --build
```

Serves everything on http://localhost:8000. The `app-data` named volume holds
`backend/data/` (database + reports) across container rebuilds.

### Option B — bare metal

```bash
make setup && make build         # install deps, build frontend/dist
cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The app seeds demo users and content on first boot; `make seed` is only needed
if you want the seed output printed explicitly.

### Production checklist

- **Change the demo passwords** (Admin → Users) or replace the seed accounts
  before real use.
- **Run behind TLS.** Put a reverse proxy (Caddy, nginx, etc.) in front.
  Session cookies get the `Secure` flag when the app sees an HTTPS scheme — the
  Docker image already runs uvicorn with `--proxy-headers` so the proxy's
  `X-Forwarded-Proto` is honored; add those flags yourself on bare metal
  (`--proxy-headers --forwarded-allow-ips '<proxy-ip>'`). Browser-supplied
  (BYO) keys especially should never transit plain HTTP.
- **Persist and back up `backend/data/`** (or point `ASSESSMENT_DATA_DIR` /
  `ASSESSMENT_DB_PATH` somewhere durable). The SQLite file is the research
  record: assessments, score records, evaluations, annotations.
- **Provider keys** go in `.env` (see `.env.example`); they are read at startup
  and never exposed to the browser. `DEFAULT_PROVIDER` picks the fallback
  provider for users with no preference.
- **Schema migrations are automatic**: on startup, `init_db()` widens existing
  tables idempotently — upgrading the code and restarting is the whole
  procedure.
- **Scope note:** this is a research instrument. BYO-key mode and the demo
  accounts are suited to pilots and demos; review your institution's data
  handling requirements (e.g. FERPA) before collecting real student data.

## Importing legacy V5 reports (future work)

Assessments produced by Performative Assessment V5 live on disk as
`reports/<username>/*.md` (plus `.trace.json` writing-process sidecars and
`_annotations/*.json` instructor verdicts) wherever that instance ran — they were
never committed to git. An importer is planned but not yet built:
`backend/app/services/report_parser.py` is retained precisely for it. The importer
will walk a copied `reports/` folder, parse each Markdown report, and map the rows
onto `create_assessment(assessment_id=…)` + `upsert_evaluation` (both idempotent,
so re-running is safe), stamping rows with their original v2 schema version.
Bring the report files within reach and it can be wired up.

## Exporting as a standalone repository

This tree is self-contained. To publish it as its own repository:

```bash
git push <new-repo-url> <this-branch>:main
```

## Lineage

Consolidates `wrgr/essay-grading` (TGFWA) and `wrgr/tacitknowledge` (Performative Assessment V5, `assessmentRework` branch).
