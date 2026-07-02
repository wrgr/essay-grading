# TGFWA — Trace-Grounded Formative Writing Assessment

A research demo that infers 11th–12th grade writing proficiency against **Maryland College and Career Ready (MCCR) ELA standards** from a student's **LLM interaction trace** (the dialogue between student and AI during a writing task), and compares that trace-inferred estimate to the **summative quality of the final essay**. The teacher remains the authoritative evaluator.

**Core research claim:** process evidence (dialogue trace) and product evidence (final essay) measure related but distinct aspects of writing proficiency. Their **divergence** is diagnostically meaningful, and we hypothesize it is moderated by the student's **AI-reliance pattern** (H1).

## Quick start

```bash
npm install
npm run dev          # local dev server
npm run build        # static build → dist/
npm run verify-exemplars  # exit-criterion check: every evidence quote is verbatim in its source
```

The app ships with **four synthetic exemplar sessions** (one per divergence pattern) carrying precomputed demo scores, so the cold-start demo needs zero setup and no API key. Add a key in **Settings** (Anthropic, OpenAI, or Gemini — model and temperature configurable) to:

- re-grade any session live through the full pipeline,
- chat in the **Writing Session (live)** tab, where the conversation itself becomes a gradeable trace.

## What's inside

| Piece | Where | Spec section |
|---|---|---|
| Construct map (ECD validity backbone) | `docs/construct-map.md` | §2 |
| Operational rubric v1 (versioned JSON, 12 atomic criteria, 0–5 anchors) | `rubrics/mccr-w11-12-arg-v1.json` | §3 |
| Grading engine: 1 criterion/call, evidence-before-score, 3 passes, median+spread, quote-provenance guard | `src/lib/grading/` | §5 |
| Student-attribution guard (trace channel) + adversarial parrot exemplar | `src/lib/grading/prompts.ts`, `src/data/exemplars/alex.ts` | §5.4 |
| Layer B: RelianceScope 3×3 coding + Hou et al. interpretive labels | `src/lib/layerb.ts` | §2B, §5.6 |
| Divergence analysis + interpretive frames (hypotheses, not verdicts) | `src/lib/divergence.ts` | §6 |
| Teacher-in-the-loop: overrides w/ rationale, rubric adaptation w/ versioning, "needs your judgment" routing, override-corpus export | `src/components/` | §8 |
| Swappable LLM adapter (Anthropic / OpenAI / Gemini, BYO key, browser-only) | `src/lib/llm/client.ts` | §10 |

## Architecture & privacy

React 18 + Vite + TypeScript + Tailwind; fully static (GitHub Pages). **No backend.** Sessions, scores, overrides, rubric versions, and the API key live in the browser's localStorage; the only network traffic is direct calls to the user's chosen LLM provider. BYO-key mode is Option A from the spec — suitable for demos and research piloting only. A thin keyed proxy (Option B) is required before classroom use with real student data (FERPA).

## Deploying

`npm run build` emits a relocatable static bundle (`base: './'`). The `gh-pages` branch carries the built demo; to refresh it:

```bash
npm run build && cp dist/index.html dist/404.html && touch dist/.nojekyll
git worktree add /tmp/ghp gh-pages
rm -rf /tmp/ghp/* && cp -r dist/. /tmp/ghp/
cd /tmp/ghp && git add -A && git commit -m "Deploy" && git push origin gh-pages
```

## Research scaffolding

- Every score records the rubric/guidance version that produced it (reproducibility).
- Teacher overrides export as a labeled corpus (`Sessions → Export teacher-override corpus`) — the human-annotation dataset for the Phase-2 calibration layer (LLM-Rubric, Hashemi et al. ACL 2024) and the human–LLM agreement analysis.
- `scripts/verify-exemplars.mjs` enforces the milestone exit criteria: evidence quotes verifiably in source text; the parrot trace does not inflate scores.

See `docs/construct-map.md` for the full criterion→standard→literature mapping and the tracked threats to validity.
