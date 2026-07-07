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

```bash
make setup      # python venv + npm install
make seed       # seed demo users and content
make dev        # API on :8000, web on :5173
```

Open http://localhost:5173 and sign in (demo accounts are printed by `make seed`; default admin is `admin` / `admin123`).

No API key? The platform still runs: scoring falls back to keyword matching, and bundled exemplar sessions carry precomputed scores. Add provider keys in `.env` (copy `.env.example`) to enable live LLM grading — keys stay server-side and are never sent to the browser.

## Architecture

- `backend/` — FastAPI + SQLite. All LLM calls, grading, scoring, and the research database live here.
- `frontend/` — React 18 + Vite + TypeScript + Tailwind SPA.
- `content/` — seed corpus: rubrics, scenarios, free-response prompts, exemplar sessions (loaded into the DB by `make seed`).
- `docs/` — the unified evidence model, research-export data dictionary, testing notes.

## Development

```bash
make test       # backend pytest suite
make build      # typecheck + production frontend build
make e2e        # zero-API-key end-to-end smoke test
```

## Exporting as a standalone repository

This tree is self-contained. To publish it as its own repository:

```bash
git push <new-repo-url> <this-branch>:main
```

## Lineage

Consolidates `wrgr/essay-grading` (TGFWA) and `wrgr/tacitknowledge` (Performative Assessment V5, `assessmentRework` branch).
