# Unified Evidence Model

This is the governing validity document for the platform, unifying the two
documents it was consolidated from:

- **`construct-map.md`** — the Evidence-Centered Design construct map for Mode A
  (essay + AI-dialogue trace), carried over from TGFWA. Layer A / Layer B
  definitions, criterion→standard mappings, channel semantics, divergence
  construct, and tracked threats to validity live there.
- **`fr_evidence_model.md`** — the free-response writing-process evidence table,
  carried over from Performative Assessment V5 (assessmentRework). Every FR
  process signal's claim, confidence, and "does not rule out" alternative lives
  there, together with the language-audit rules the report renderer implements.

Both remain normative for their modes. This document states what is now
**platform-wide**.

## The global rule: no row, no claim

> Every signal rendered as a claim in any mode's report or UI must have a row in
> an evidence table (here or in the two mode documents) stating (1) the claim it
> supports, (2) how much confidence that claim can bear, and (3) the plausible
> alternative interpretations it does not rule out. A signal with no row must not
> render as a claim anywhere — at most it may appear as a raw, unlabeled number
> in a debug/instructor-only view.

This rule governed FR in V5 (it is the reason Honey & Mumford was deleted from
FR rather than retrofitted). The consolidated platform promotes it to all three
modes. Its enforcement is partly automated: `backend/tests/` includes doc-contract
tests that fail when a claim-bearing row disappears from these documents.

## Layer separation (never blended)

- **Layer A — domain mastery.** Essay/trace criterion scores (Mode A), Coverage +
  explanation Quality and the SOLO derivation (Modes B/C). These are competence
  estimates, always advisory to the instructor.
- **Layer B — process & AI-interaction context.** RelianceScope coding (Mode A)
  and the FR writing-process overlay (effort profile, difficulty points,
  authenticity, revision-toward-quality, confidence calibration) are **siblings**:
  both describe *how* the work was produced, and neither is ever folded into a
  Layer A score. They contextualise interpretation; they never gate or adjust
  competence estimates.

## Mode-level evidence summaries

### Mode A — essay + AI-dialogue trace (see construct-map.md)

| Signal | Claim it supports | Confidence | Does NOT rule out |
|---|---|---|---|
| Per-criterion score record (3 passes, median + spread, verbatim evidence) | The student's essay/dialogue exhibits the anchored behavior at the scored level | Moderate; every quote is provenance-verified, and confidence is reported per record (evidence count × inter-pass agreement × referenceability) | Rubric ambiguity (high spread), criterion not surfacing in a short dialogue (no-evidence), grader miscalibration (why overrides are collected) |
| Trace-channel score | The student's OWN contributions evidence mastery (assistant text never counts, enforced by prompt constraint + server-side quote-in-student-turn guard) | Moderate | Mastery the student has but never displayed in dialogue |
| Product − trace divergence | The two channels measure related-but-distinct aspects; large divergence is a formative signal | Hypothesis-level by design — every interpretive frame is labeled a hypothesis, not a verdict | Drafting work invisible to the dialogue; legitimate assistance; short traces |
| RelianceScope label (Layer B) | Descriptive pattern of how the student worked with the AI | Low-moderate; a to-be-validated heuristic | Task-specific behavior; segment coding errors |

### Mode B — scenario (recall → CTA probing)

| Signal | Claim it supports | Confidence | Does NOT rule out |
|---|---|---|---|
| Coverage (recall ∪ probe, importance-weighted) | The learner produced this knowledge during the session | Moderate; matches require grounded supporting quotes (deterministic check) | Recall failure under pressure (why the probe phase exists) |
| Quality rating (Chi 0/1/2) | Depth of explanation: conditional / goal-linked / consequence-aware reasoning | Moderate; explicitly instructed that fluency and length are not quality | Understanding the learner has but did not verbalise |
| volunteered vs. surfaced-via-probe attribution | Whether knowledge was spontaneously accessible or required elicitation | Moderate (string-match on recall text) | Paraphrase missed by matching |
| Honey & Mumford style (**legacy, candidate for removal**) | — | Low. Weak validity in its own 80-item instrument (Coffield et al. 2004); inferred here from one transcript; acting on style labels shows no credible benefit (Pashler et al. 2008). FR already removed it; scenario mode retains it only with this caveat rendered alongside, and it must never inform instructional decisions. | Essentially everything — treat as annotation, not evidence |
| LLM SOLO judgment (scenario) | Structural complexity of the responses | Low-moderate; requires evidence quotes in the classification | Divergence from FR's deterministic SOLO derivation — the two are not computed the same way |

### Mode C — free response (see fr_evidence_model.md for the full table)

The FR table is normative and unchanged, including: Coverage's own calibration
row (unaided single-pass recall under-represents true knowledge — rendered next
to the score itself), the deterministic SOLO derivation (never Extended
Abstract), and every process-overlay signal with its alternative rendered in
the same breath.

## Calibration ground truth

Instructor judgment is the authoritative layer everywhere:

- **Overrides** (Mode A, per criterion×channel, rationale required) and
  **annotations** (Modes B/C, per task: correct/partial/missing/needs_expert_review)
  are the labeled human dataset.
- The reliability dashboard reads them as LLM-vs-instructor agreement and
  per-label average LLM score (the over-crediting signal), surfacing the most
  disagreeing tasks first.
- Both export as calibration corpora (`/api/export/override-corpus`, and the
  annotation columns of the v3 research export) for the planned calibration
  layer (LLM-Rubric, Hashemi et al. 2024) and human–LLM agreement analysis.

## Standing limits

- The platform measures reasoning and declarative/procedural knowledge as
  expressed in text. It does not verify physical execution or psychomotor skill
  (every scenario/FR report carries this inference boundary).
- No readiness-gate or certification claims. The research roadmap this platform
  serves tests a method; it certifies no one.
- LLM scores of any kind are preliminary/advisory. The instructor is the
  authoritative evaluator.
