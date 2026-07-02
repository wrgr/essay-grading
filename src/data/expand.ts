import type { Channel, EvidenceItem, LayerBResult, Rubric, ScoreRecord, SegmentCoding, Session, Trace } from '../types';
import { aggregatePasses, type PassResult } from '../lib/grading/aggregate';
import { summarizeSegments } from '../lib/layerb';

/** Compact seed for one criterion×channel of a bundled exemplar. Expanded through the
 *  same aggregation code the live grading engine uses, so demo data and live data are
 *  structurally identical. */
export interface ScoreSeed {
  criterionId: string;
  channel: Channel;
  passes: (number | 'no-evidence')[];
  evidence?: EvidenceItem[];
  anchorMatched?: string;
}

export interface ExemplarDef {
  id: string;
  name: string;
  description: string;
  trace: Trace;
  essay: string;
  scoreSeeds: ScoreSeed[];
  layerBSegments: SegmentCoding[];
}

function seedToRecord(seed: ScoreSeed, rubric: Rubric): ScoreRecord {
  const criterion = rubric.criteria.find((c) => c.criterionId === seed.criterionId);
  const passes: PassResult[] = seed.passes.map((score) => ({
    score,
    selfConfidence: 'med',
    evidence: typeof score === 'number' ? (seed.evidence ?? []) : [],
    anchorMatched: seed.anchorMatched,
  }));
  return aggregatePasses({
    criterionId: seed.criterionId,
    channel: seed.channel,
    referenceability: criterion?.referenceability ?? 'strong',
    passes,
    rubricVersion: rubric.version,
  });
}

export function expandExemplar(def: ExemplarDef, rubric: Rubric): Session {
  const layerB: LayerBResult = summarizeSegments(def.layerBSegments);
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    trace: def.trace,
    essay: def.essay,
    scores: def.scoreSeeds.map((s) => seedToRecord(s, rubric)),
    layerB,
    rubricVersion: rubric.version,
    createdAt: '2026-06-15T09:00:00Z',
    isExemplar: true,
    gradedLive: false,
  };
}
