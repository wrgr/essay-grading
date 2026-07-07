"""Mode A grading engine — port of TGFWA src/lib/grading/engine.ts.

Methodology (TGFWA spec §5): one criterion per LLM call (halo prevention),
both channels (product = essay, trace = dialogue), 3 sequential passes per
criterion with one retry each, evidence-provenance guard on every pass,
median + spread aggregation, concurrency 6 across criterion×channel jobs.

The LLM is injected as a callable `llm_json(system, prompt) -> dict` so tests
can drive the engine with a FakeLLM and the API layer wires in the configured
provider (core.llm.llm_chat_json + _extract_json).
"""

import re
from concurrent.futures import ThreadPoolExecutor, as_completed

from .aggregate import aggregate_passes
from .prompts import (build_product_prompt, build_product_system,
                      build_trace_prompt, build_trace_system)

PASSES_PER_CRITERION = 3  # spec §5.3: ≥3 passes, report median + spread
CONCURRENCY = 6


def _normalize_text(s: str) -> str:
    """Whitespace-collapse + quote-unify + lowercase, mirroring the TS guard."""
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[\"'‘’“”]", "'", s)
    return s.lower()


def normalize_pass(raw: dict, channel: str, source: dict) -> dict:
    """Validate one raw LLM pass. Evidence-provenance guard (spec §4: "no score
    without evidence"): drop fabricated quotes; if all quotes for a scored pass
    are fabricated, demote the pass to no-evidence. On the trace channel quotes
    must come from STUDENT turns specifically — the attribution guard's
    server-side backstop: a quote of assistant text fails the lookup even if
    the model claimed a student turnId for it.
    """
    raw = raw if isinstance(raw, dict) else {}
    score = raw.get("score")
    if score in ("no-evidence", None):
        score = "no-evidence"
    else:
        try:
            n = int(round(float(score)))
            score = max(0, min(5, n))
        except (TypeError, ValueError):
            score = "no-evidence"

    student_turns = [t for t in (source.get("trace") or {}).get("turns", [])
                     if t.get("speaker") == "student"]

    def locate_in_student_turns(quote: str):
        q = _normalize_text(quote)
        for t in student_turns:
            if q in _normalize_text(t.get("text", "")):
                return t.get("turnId")
        return None

    raw_evidence = raw.get("evidence") or []
    if not isinstance(raw_evidence, list):
        raw_evidence = []
    evidence = []
    for e in raw_evidence:
        if not isinstance(e, dict) or not e.get("quote"):
            continue
        if channel == "product":
            if _normalize_text(e["quote"]) in _normalize_text(source.get("essay") or ""):
                evidence.append({"quote": e["quote"], "reasoning": e.get("reasoning", "")})
        else:
            # Trace: find the student turn the quote actually lives in; correct a
            # wrong turnId rather than trusting the model's citation.
            actual_turn_id = locate_in_student_turns(e["quote"])
            if actual_turn_id is not None:
                evidence.append({"turnId": actual_turn_id, "quote": e["quote"],
                                 "reasoning": e.get("reasoning", "")})

    if score != "no-evidence" and raw_evidence and not evidence:
        score = "no-evidence"

    self_conf = raw.get("selfConfidence")
    if self_conf not in ("high", "low"):
        self_conf = "med"

    return {
        "score": score,
        "selfConfidence": self_conf,
        "evidence": evidence,
        "anchorMatched": raw.get("anchorMatched"),
    }


def grade_criterion(llm_json, criterion: dict, channel: str, rubric: dict,
                    source: dict) -> dict:
    if channel == "product":
        system = build_product_system()
        prompt = build_product_prompt(criterion, source.get("essay") or "", rubric)
    else:
        system = build_trace_system()
        prompt = build_trace_prompt(criterion, source.get("trace") or {}, rubric)

    passes = []
    for _ in range(PASSES_PER_CRITERION):
        # One criterion per call; passes run sequentially per criterion so a
        # transient failure can be retried once without burning the whole batch.
        try:
            raw = llm_json(system, prompt)
        except Exception:
            raw = llm_json(system, prompt)  # one retry per pass; second failure propagates
        passes.append(normalize_pass(raw, channel, source))

    return aggregate_passes(
        criterion_id=criterion["criterionId"],
        channel=channel,
        referenceability=criterion.get("referenceability", "strong"),
        passes=passes,
        rubric_version=rubric.get("version", ""),
    )


def grade_session(*, llm_json, rubric: dict, essay: str, trace: dict,
                  on_progress=None, on_result=None) -> list:
    """Grade every criterion on both channels. Streams results via on_result as
    each criterion×channel completes (progressive persistence + SSE)."""
    jobs = [(c, channel)
            for c in rubric.get("criteria", [])
            for channel in ("product", "trace")]
    source = {"essay": essay, "trace": trace}

    results = []
    done = 0

    def run(job):
        criterion, channel = job
        return grade_criterion(llm_json, criterion, channel, rubric, source)

    with ThreadPoolExecutor(max_workers=min(CONCURRENCY, max(1, len(jobs)))) as pool:
        futures = {pool.submit(run, job): job for job in jobs}
        for future in as_completed(futures):
            criterion, channel = futures[future]
            record = future.result()  # propagate the first failure
            results.append(record)
            done += 1
            if on_progress:
                on_progress(done, len(jobs), f"{criterion['criterionId']} · {channel}")
            if on_result:
                on_result(record)
    return results
