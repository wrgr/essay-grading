// Core data model for TGFWA. Mirrors the schemas in the implementation spec (§9).

export type Speaker = 'student' | 'assistant';

export interface TraceTurn {
  turnId: number;
  speaker: Speaker;
  text: string;
  timestamp?: string;
}

export interface Trace {
  traceId: string;
  assignmentId: string;
  turns: TraceTurn[];
}

export type Referenceability = 'strong' | 'weak';

export interface RubricCriterion {
  criterionId: string;
  standard: string; // e.g. "W.11-12.1a"
  dimension: string; // display grouping, e.g. "Claims (W1a)"
  statement: string; // single observable behavior
  scale: '0-5';
  anchors: Record<string, string>; // "0".."5"
  referenceability: Referenceability; // weak → teacher-reserve routing
  source: string; // literature / standards trace for the construct map
  teacherGuidance?: string; // optional injected text, versioned with the rubric
}

export interface Rubric {
  rubricId: string;
  version: string;
  genre: string;
  criteria: RubricCriterion[];
  assignmentGuidance?: string; // assignment-level guidance injected into every grading prompt
}

export type Channel = 'trace' | 'product';

export interface EvidenceItem {
  turnId?: number; // trace channel: which turn the quote comes from
  quote: string; // verbatim student text
  reasoning: string; // links evidence to the anchored level descriptor
}

export type ConfidenceLevel = 'low' | 'med' | 'high';

export interface TeacherOverride {
  score: number;
  rationale: string;
  ts: string;
}

export interface ScoreRecord {
  criterionId: string;
  channel: Channel;
  passes: (number | 'no-evidence')[];
  median: number | null; // null when no-evidence
  spread: number | null;
  noEvidence: boolean;
  confidence: ConfidenceLevel;
  evidence: EvidenceItem[];
  anchorMatched?: string; // the level descriptor the grader matched
  rubricVersion: string;
  gradedAt: string;
  teacherOverride: TeacherOverride | null;
  needsReview: boolean;
  reviewReasons: string[];
}

export type RelianceMode = 'passive' | 'active' | 'constructive';
export type RelianceLabel = 'reflective' | 'cautious' | 'thoughtless' | 'collaborative';

export interface SegmentCoding {
  segmentTurns: number[];
  helpSeeking: RelianceMode;
  responseUse: RelianceMode;
  evidence: string;
  verification: boolean; // did the student challenge / check / revise AI output?
}

export interface LayerBResult {
  segments: SegmentCoding[];
  grid: Record<RelianceMode, Record<RelianceMode, number>>; // helpSeeking × responseUse counts
  dominantHelpSeeking: RelianceMode;
  dominantResponseUse: RelianceMode;
  interpretiveLabel: RelianceLabel;
  verificationRate: number; // fraction of segments with verification behavior
}

export interface DimensionDivergence {
  dimension: string;
  standard: string;
  traceScore: number | null;
  productScore: number | null;
  divergence: number | null; // product − trace
  criterionIds: string[];
}

export interface Session {
  id: string;
  name: string;
  description: string;
  trace: Trace;
  essay: string;
  scores: ScoreRecord[];
  layerB: LayerBResult | null;
  rubricVersion: string;
  createdAt: string;
  isExemplar: boolean;
  gradedLive: boolean; // false = bundled precomputed demo scores
}

// ---- LLM configuration ----

export type Provider = 'anthropic' | 'openai' | 'gemini';

export interface LLMConfig {
  provider: Provider;
  apiKey: string;
  model: string; // primary grading model
  advisoryModel?: string; // optional stronger model for weak-referenceability criteria
  temperature?: number; // omitted → provider default. Note: newest Anthropic models reject non-default temperature.
}

export interface GradingProgress {
  done: number;
  total: number;
  label: string;
}
