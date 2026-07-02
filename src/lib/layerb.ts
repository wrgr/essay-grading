import type { LayerBResult, RelianceLabel, RelianceMode, SegmentCoding, Trace, TraceTurn } from '../types';
import type { LLMClient } from './llm/client';
import { SEGMENT_SCHEMA, buildSegmentPrompt, buildSegmentSystem } from './grading/prompts';

/** Split the dialogue into segments: each student turn plus the assistant reply that
 *  follows it (and the assistant turn it responds to, for context). */
export function segmentTrace(trace: Trace): TraceTurn[][] {
  const segments: TraceTurn[][] = [];
  const turns = trace.turns;
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].speaker !== 'student') continue;
    const seg: TraceTurn[] = [];
    if (i > 0 && turns[i - 1].speaker === 'assistant') seg.push(turns[i - 1]);
    seg.push(turns[i]);
    if (i + 1 < turns.length && turns[i + 1].speaker === 'assistant') seg.push(turns[i + 1]);
    segments.push(seg);
  }
  return segments;
}

const MODES: RelianceMode[] = ['passive', 'active', 'constructive'];

export function summarizeSegments(segments: SegmentCoding[]): LayerBResult {
  const grid = {} as LayerBResult['grid'];
  for (const h of MODES) {
    grid[h] = { passive: 0, active: 0, constructive: 0 };
  }
  for (const s of segments) grid[s.helpSeeking][s.responseUse]++;

  const count = (dim: 'helpSeeking' | 'responseUse', m: RelianceMode) => segments.filter((s) => s[dim] === m).length;
  const dominant = (dim: 'helpSeeking' | 'responseUse'): RelianceMode =>
    MODES.reduce((best, m) => (count(dim, m) > count(dim, best) ? m : best), 'passive' as RelianceMode);

  const dominantHelpSeeking = dominant('helpSeeking');
  const dominantResponseUse = dominant('responseUse');
  const verificationRate = segments.length ? segments.filter((s) => s.verification).length / segments.length : 0;

  // Interpretive label heuristic per Hou et al. (2025): shown as a hypothesis, not a verdict.
  let interpretiveLabel: RelianceLabel;
  if (dominantResponseUse === 'passive' && verificationRate < 0.2) interpretiveLabel = 'thoughtless';
  else if (dominantResponseUse === 'constructive' && dominantHelpSeeking === 'constructive') interpretiveLabel = 'collaborative';
  else if (verificationRate >= 0.5) interpretiveLabel = 'reflective';
  else interpretiveLabel = 'cautious';

  return { segments, grid, dominantHelpSeeking, dominantResponseUse, interpretiveLabel, verificationRate };
}

export async function codeLayerB(
  llm: LLMClient,
  trace: Trace,
  onProgress?: (done: number, total: number) => void,
): Promise<LayerBResult> {
  const rawSegments = segmentTrace(trace);
  const codings: SegmentCoding[] = [];
  let done = 0;
  for (const seg of rawSegments) {
    const text = seg.map((t) => `[turn ${t.turnId} | ${t.speaker.toUpperCase()}]\n${t.text}`).join('\n\n');
    const raw = (await llm.completeJSON({
      system: buildSegmentSystem(),
      prompt: buildSegmentPrompt(text),
      schema: SEGMENT_SCHEMA,
    })) as Partial<SegmentCoding>;
    codings.push({
      segmentTurns: seg.map((t) => t.turnId),
      helpSeeking: (raw.helpSeeking as RelianceMode) ?? 'active',
      responseUse: (raw.responseUse as RelianceMode) ?? 'active',
      verification: Boolean(raw.verification),
      evidence: raw.evidence ?? '',
    });
    done++;
    onProgress?.(done, rawSegments.length);
  }
  return summarizeSegments(codings);
}
