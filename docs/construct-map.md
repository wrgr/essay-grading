# TGFWA Construct Map

**Status:** v1.0, paired with rubric `mccr-w11-12-arg` v1.0 (`/rubrics/mccr-w11-12-arg-v1.json`)

This document is the backbone of the validity argument (Evidence-Centered Design; Mislevy et al.). Every scored criterion traces to (a) a named MCCR standard and (b) a named theoretical source. Nothing is scored that does not appear here.

## 1. Constructs assessed

The system assesses **two separate constructs** that are never blended into one score:

| Layer | Construct | Evidence sources | Reported as |
|---|---|---|---|
| **A** | Writing-standard mastery (MCCR W.11-12.1, L.11-12) | Final essay (Channel P) **and** dialogue trace (Channel T), scored separately on the same atomic criteria | Rubric scores, per criterion × channel |
| **B** | AI-interaction quality (reliance pattern) | Dialogue trace only | 3×3 RelianceScope grid + interpretive label; **never folded into Layer A** |

Rationale for separation: teachers and MSDE stakeholders read rubric scores as writing proficiency. Contaminating them with reliance behavior would corrupt the construct and the measurement claims (Bennett & Bejar 1997; McCaffrey et al. 2022).

## 2. Layer A criterion map

Performance levels are behaviorally anchored on a 0–5 scale (Li et al. 2026, arXiv 2601.03444: 0–5 maximizes human–LLM ICC). Level language is modeled on the MCAP/PARCC condensed scoring rubric for grades 6–11 ELA, adapted to per-sub-standard granularity. Each criterion states **one observable failure mode** (atomicity constraint, arXiv 2603.14732); criteria that resist criterion-referencing are classed `weak` and routed to the teacher-reserve queue (design feature, not fallback).

| Criterion | MCCR standard | Observable behavior | Referenceability | Theoretical source |
|---|---|---|---|---|
| W1a-1 | W.11-12.1a | Precise, knowledgeable central claim | strong | MCAP Written Expression anchors; Attali & Burstein 2006 (trait-level AES) |
| W1a-2 | W.11-12.1a | Claim distinguished from opposing claims | strong | MCCR standard text; Toulmin-model claim differentiation |
| W1b-1 | W.11-12.1b | Relevant, sufficient evidence per reason | strong | MCAP Knowledge of Language and Ideas anchors |
| W1b-2 | W.11-12.1b | Counterclaim developed fairly (strengths + limitations) | strong | MCCR standard text |
| W1b-3 | W.11-12.1b | Anticipates audience knowledge/concerns/values | **weak** → teacher-reserve | MCCR standard text; audience-awareness is holistic/inference-heavy (arXiv 2603.14732) |
| W1c-1 | W.11-12.1c | Linking words/phrases/clauses clarify relationships | strong | MCAP coherence anchors |
| W1c-2 | W.11-12.1c | Logical sequencing that builds the argument | strong | MCAP organization anchors |
| W1d-1 | W.11-12.1d | Formal style maintained | strong | MCCR standard text |
| W1d-2 | W.11-12.1d | Objective tone (evidence over unsupported appeal) | strong | MCCR standard text |
| W1e-1 | W.11-12.1e | Conclusion follows from and supports the argument | strong | MCCR standard text |
| L1-1 | L.11-12.1/2 | Command of grammar/usage/mechanics | strong | MCAP Conventions anchors |
| WR-1 | W.11-12.1 (holistic) | Strength/sophistication of reasoning | **weak** → teacher-reserve, advisory only | SOLO taxonomy (Biggs & Collis 1982); holistic judgments have near-zero LLM discriminative validity (arXiv 2603.14732) |

### Channel semantics (spec §7)

Both channels score the *same* atomic criteria so divergence is apples-to-apples:

- **Channel P (product):** the final essay text.
- **Channel T (trace):** student-authored dialogue turns only. The **student-attribution constraint** (spec §5.4) is enforced in the grading prompt and stress-tested by the bundled adversarial parrot exemplar: assistant-authored text, even when the student repeats it verbatim, is never mastery evidence. Some criteria are expected to be `no-evidence` in the trace (e.g., conventions, conclusion quality) — displayed, not imputed.

### Evidence model (spec §4)

- Per-criterion running estimate: `{criterionId, channel, median (0–5), spread, confidence, evidenceRefs[]}`.
- **No score without evidence**: every estimate links to verbatim quotes with turn IDs (trace) or essay spans (product). Quotes are programmatically verified to appear in the source (`scripts/verify-exemplars.mjs`; the live engine drops fabricated quotes and demotes evidence-free passes to `no-evidence`).
- **Confidence** = f(number of independent evidence instances, inter-pass agreement across ≥3 grading passes, referenceability class). One evidence instance → at most medium; spread ≥2 or weak referenceability → low + routed to teacher.
- **Recency:** within a task, later evidence supersedes earlier (growth within task is signal); the trace prompt instructs graders accordingly.

## 3. Layer B coding map

| Facet | Values | Source |
|---|---|---|
| Help-seeking mode | passive / active / constructive | RelianceScope (Jin et al., L@S '26), 3×3 grid axis 1 |
| Response-use mode | passive / active / constructive | RelianceScope, axis 2 |
| Verification behavior | boolean per segment | Overreliance literature; Lee et al., CHI 2025 (critical thinking shifts to verification/stewardship) |
| Interpretive label | reflective / cautious / thoughtless / collaborative | Hou et al. 2025, *Computers & Education* 234 |

Feasibility precedent: RelianceScope reports LLM detection F1 ≈ .76–.81 for passive modes; to be re-validated on our data (spec §5.6).

## 4. Divergence construct (spec §6)

Per dimension: `divergence = product − trace`. Interpretive frames are surfaced as **hypotheses, not verdicts**:

1. Product ≫ trace + passive/thoughtless reliance → possible over-reliance flag.
2. Trace ≫ product → execution/transfer gap; instructional target is execution, not concepts.
3. Convergence + constructive engagement → strongest validity for the scores.

**H1 (paper):** divergence magnitude is predicted by reliance pattern (Layer B).

## 5. Teacher authority (spec §8)

Overrides are authoritative and logged with rationale (LLM score retained as advisory history). Rubric/guidance edits bump the rubric version; every score records the version that produced it. Overrides export as a labeled corpus — the human-annotation dataset for the Phase-2 calibration layer (Hashemi et al., *LLM-Rubric*, ACL 2024) and the agreement analysis (validation plan §11).

## 6. Known threats to validity (tracked)

- **Attribution leakage:** an LLM will credit the student for assistant text without the guard — mitigated by prompt constraint + parrot-trace regression test + client-side quote-provenance check.
- **Halo effects:** one criterion per call; the grader never sees other scores (spec §5.5).
- **Verbosity bias:** evidence quotes capped (~40 words); "length is not quality" instruction.
- **Self-preference bias:** grading model configurable independently of the model that assisted the student.
- **Grader nondeterminism:** ≥3 passes; spread ≥2 routes to teacher rather than resampling.
- **Agreement without discrimination** (arXiv 2603.14732): validation plan requires discriminative-validity checks across genuinely different-quality work, not just distributional agreement.
