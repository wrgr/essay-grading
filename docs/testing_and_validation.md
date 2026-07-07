# Testing and Validation

Run these checks after changing prompts, scoring, grading-engine, report, or
process-analysis code:

```bash
make test        # full backend suite (backend/tests)
make e2e         # zero-API-key end-to-end smoke path
make build       # frontend typecheck (tsc strict) + production build
```

All backend tests are local and deterministic: they require no LLM API key, no
network access, and no running server (ambient provider keys are explicitly
cleared by `tests/conftest.py`). LLM calls in tested paths are either driven by
a FakeLLM, mocked at the module boundary, or exercised through the keyword-
fallback path.

## What the suite covers

**Mode A (essay + trace) — ported from TGFWA's CI exit criteria**
- `test_exemplars.py` — the `verify-exemplars` port: every exemplar evidence
  quote is verbatim in its source and student-turn-attributed; the adversarial
  parrot's trace is never inflated; the live provenance guard accepts the corpus
  and rejects fabricated/assistant-authored quotes; exemplar expansion through
  the Python aggregate matches seed semantics (the cross-language port check).
- `test_aggregate.py`, `test_divergence.py` — median/spread/no-evidence/
  confidence/routing semantics; override-wins effective scores; interpretation
  frames.
- `test_grading_api.py` — FakeLLM grading job end-to-end (jobs, SSE replay,
  progressive persistence), override flow, access control.

**Mode B (scenario)**
- `test_scenario_api.py` — recall → end-recall → probes → evaluate over HTTP in
  keyword mode; ScenarioRunner to_dict/from_dict JSON round-trip (DB-backed
  state); ownership checks.

**Mode C (free response) — ported from V5**
- `test_fr_pooled_key_points.py`, `test_fr_thinking_profile_solo.py`,
  `test_writing_process_calibration.py`,
  `test_fr_closing_nudge_and_coverage_note.py` — the four V5 suites, including
  the evidence-model doc-contract tests ("no row, no claim").
- `test_fr_api.py` — sanitized prompt listing, keyword-fallback submit,
  rate→explain→re-rate, finalize, research-row persistence.
- `test_prompt_inventory.py` — Phase 1a/1b prompt corpus integrity (unique ids,
  scoring evidence, circuit prompts' research metadata).

**Research surface & platform**
- `test_assessment_export_schema.py` — schema v3: canonical columns exist, the
  idempotent widening migration works, every export column is documented in the
  data dictionary (enforced).
- `test_research_surface.py` — export rows across all modes, override corpus,
  reliability dashboard, annotations, novel-equivalent review, user management.
- `test_auth.py`, `test_content.py` — sessions, CSRF header guard, role gates,
  content versioning (bump semantics), key-material never serialized.
- `test_e2e_smoke.py` — the `git clone && make dev` zero-key guarantee, driving
  all three modes over HTTP.

## Manual verification with a live provider

Set a key in `.env` (e.g. `ANTHROPIC_API_KEY`), `make dev`, then:
1. Grade an exemplar live from its session page and watch the SSE progress bar;
   check evidence quotes in the drill-in drawers are verbatim.
2. Run a scenario end-to-end — recall acks must stay minimal and non-leading,
   probes must reference your own words.
3. Submit an FR task with real typing/pasting and confirm the process overlay's
   claims each carry their alternative interpretation.
