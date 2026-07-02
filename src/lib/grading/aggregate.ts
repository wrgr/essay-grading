import type { ConfidenceLevel, EvidenceItem, Referenceability, ScoreRecord, Channel } from '../../types';

export function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface PassResult {
  score: number | 'no-evidence';
  selfConfidence: ConfidenceLevel;
  evidence: EvidenceItem[];
  anchorMatched?: string;
}

/**
 * Aggregate ≥3 grading passes into one ScoreRecord (spec §5.3):
 * median score + inter-pass spread; high spread or weak referenceability → teacher routing.
 * Confidence = f(evidence count, inter-pass agreement, referenceability class) (spec §4).
 */
export function aggregatePasses(args: {
  criterionId: string;
  channel: Channel;
  referenceability: Referenceability;
  passes: PassResult[];
  rubricVersion: string;
}): ScoreRecord {
  const { criterionId, channel, referenceability, passes, rubricVersion } = args;
  const numeric = passes.map((p) => p.score).filter((s): s is number => typeof s === 'number');
  const noEvidenceCount = passes.length - numeric.length;
  // Majority no-evidence → the criterion did not surface in this source (expected for
  // some trace criteria, spec §7); displayed, not imputed.
  const noEvidence = noEvidenceCount > passes.length / 2 || numeric.length === 0;

  const med = noEvidence ? null : median(numeric);
  const spread = noEvidence || numeric.length < 2 ? null : Math.max(...numeric) - Math.min(...numeric);

  // Evidence from the pass whose score is closest to the median (representative pass).
  let evidence: EvidenceItem[] = [];
  let anchorMatched: string | undefined;
  if (!noEvidence && med !== null) {
    const rep = passes
      .filter((p) => typeof p.score === 'number')
      .sort((a, b) => Math.abs((a.score as number) - med) - Math.abs((b.score as number) - med))[0];
    evidence = rep?.evidence ?? [];
    anchorMatched = rep?.anchorMatched;
  }

  const distinctEvidence = new Set(evidence.map((e) => e.quote.trim().toLowerCase())).size;

  let confidence: ConfidenceLevel;
  if (noEvidence) {
    confidence = 'low';
  } else if (referenceability === 'weak') {
    confidence = 'low'; // advisory-only class (spec §3.4)
  } else if ((spread ?? 0) >= 2) {
    confidence = 'low'; // disagreement across runs usually indicates criterion ambiguity
  } else if (distinctEvidence >= 2 && (spread ?? 0) <= 1) {
    confidence = 'high';
  } else {
    confidence = 'med'; // e.g. single evidence instance (spec §4)
  }

  const reviewReasons: string[] = [];
  if (referenceability === 'weak') reviewReasons.push('Teacher-reserve criterion (weak referenceability) — LLM read is advisory only');
  if ((spread ?? 0) >= 2) reviewReasons.push(`High inter-pass spread (${spread}) — possible rubric ambiguity or borderline case`);
  if (!noEvidence && distinctEvidence < 2 && confidence === 'med') reviewReasons.push('Single evidence instance');

  return {
    criterionId,
    channel,
    passes: passes.map((p) => p.score),
    median: med,
    spread,
    noEvidence,
    confidence,
    evidence,
    anchorMatched,
    rubricVersion,
    gradedAt: new Date().toISOString(),
    teacherOverride: null,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
  };
}
