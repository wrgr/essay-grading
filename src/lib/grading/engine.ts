import type { Channel, GradingProgress, Rubric, RubricCriterion, ScoreRecord, Trace } from '../../types';
import type { LLMClient } from '../llm/client';
import { GRADING_SCHEMA, buildProductPrompt, buildProductSystem, buildTracePrompt, buildTraceSystem } from './prompts';
import { aggregatePasses, type PassResult } from './aggregate';

const PASSES_PER_CRITERION = 3; // spec §5.3: ≥3 passes, report median + spread
const CONCURRENCY = 6;

interface RawPass {
  evidence?: { turnId?: number | null; quote: string; reasoning: string }[];
  anchorMatched?: string;
  score: number | string;
  selfConfidence?: string;
}

function normalizePass(raw: unknown, channel: Channel, source: { essay?: string; trace?: Trace }): PassResult {
  const r = raw as RawPass;
  let score: number | 'no-evidence';
  if (r.score === 'no-evidence' || r.score === undefined || r.score === null) {
    score = 'no-evidence';
  } else {
    const n = typeof r.score === 'number' ? r.score : parseInt(String(r.score), 10);
    score = Number.isFinite(n) ? Math.max(0, Math.min(5, Math.round(n))) : 'no-evidence';
  }

  // Verify quotes actually appear in the source (evidence-provenance guard, spec §4:
  // "No score without evidence"). Drop fabricated quotes; if all quotes for a scored
  // pass are fabricated, demote the pass to no-evidence.
  const sourceText =
    channel === 'product'
      ? (source.essay ?? '')
      : (source.trace?.turns.filter((t) => t.speaker === 'student').map((t) => t.text).join('\n') ?? '');
  const normalize = (s: string) => s.replace(/\s+/g, ' ').replace(/["'‘’“”]/g, "'").toLowerCase();
  const haystack = normalize(sourceText);

  const evidence = (r.evidence ?? [])
    .filter((e) => e.quote && haystack.includes(normalize(e.quote)))
    .map((e) => ({ turnId: e.turnId ?? undefined, quote: e.quote, reasoning: e.reasoning ?? '' }));

  if (score !== 'no-evidence' && (r.evidence ?? []).length > 0 && evidence.length === 0) {
    score = 'no-evidence';
  }

  return {
    score,
    selfConfidence: r.selfConfidence === 'high' || r.selfConfidence === 'low' ? r.selfConfidence : 'med',
    evidence,
    anchorMatched: r.anchorMatched,
  };
}

async function gradeCriterion(
  llm: LLMClient,
  criterion: RubricCriterion,
  channel: Channel,
  rubric: Rubric,
  source: { essay?: string; trace?: Trace },
): Promise<ScoreRecord> {
  const system = channel === 'product' ? buildProductSystem() : buildTraceSystem();
  const prompt =
    channel === 'product'
      ? buildProductPrompt(criterion, source.essay ?? '', rubric)
      : buildTracePrompt(criterion, source.trace as Trace, rubric);

  const passes: PassResult[] = [];
  for (let i = 0; i < PASSES_PER_CRITERION; i++) {
    // One criterion per call (spec §5.1); passes run sequentially per criterion so a
    // transient failure can be retried once without burning the whole batch.
    let raw: unknown;
    try {
      raw = await llm.completeJSON({
        system,
        prompt,
        schema: GRADING_SCHEMA,
        useAdvisoryModel: criterion.referenceability === 'weak',
      });
    } catch (err) {
      // one retry per pass
      raw = await llm.completeJSON({
        system,
        prompt,
        schema: GRADING_SCHEMA,
        useAdvisoryModel: criterion.referenceability === 'weak',
      });
    }
    passes.push(normalizePass(raw, channel, source));
  }

  return aggregatePasses({
    criterionId: criterion.criterionId,
    channel,
    referenceability: criterion.referenceability,
    passes,
    rubricVersion: rubric.version,
  });
}

/** Grade every criterion on both channels. Streams results via onResult as each
 *  criterion×channel completes (progressive UI, spec §10 cost/latency budget). */
export async function gradeSession(args: {
  llm: LLMClient;
  rubric: Rubric;
  essay: string;
  trace: Trace;
  onProgress?: (p: GradingProgress) => void;
  onResult?: (r: ScoreRecord) => void;
}): Promise<ScoreRecord[]> {
  const { llm, rubric, essay, trace, onProgress, onResult } = args;
  const jobs: { criterion: RubricCriterion; channel: Channel }[] = [];
  for (const c of rubric.criteria) {
    jobs.push({ criterion: c, channel: 'product' });
    jobs.push({ criterion: c, channel: 'trace' });
  }

  const results: ScoreRecord[] = [];
  let done = 0;
  let next = 0;

  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      const record = await gradeCriterion(llm, job.criterion, job.channel, rubric, { essay, trace });
      results.push(record);
      done++;
      onProgress?.({ done, total: jobs.length, label: `${job.criterion.criterionId} · ${job.channel}` });
      onResult?.(record);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  return results;
}
