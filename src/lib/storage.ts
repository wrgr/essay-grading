import type { LLMConfig, Rubric, ScoreRecord, Session } from '../types';
import { PROVIDER_DEFAULTS } from './llm/client';

// v1 persistence: in-browser only (spec §10). No student data leaves the browser
// except LLM API calls, and only when the user runs live grading with their own key.

const KEYS = {
  config: 'tgfwa.llmConfig',
  rubric: 'tgfwa.rubric',
  sessions: 'tgfwa.sessions',
};

export function loadConfig(): LLMConfig {
  const fallback: LLMConfig = {
    provider: 'anthropic',
    apiKey: '',
    model: PROVIDER_DEFAULTS.anthropic.defaultModel,
    advisoryModel: PROVIDER_DEFAULTS.anthropic.defaultAdvisory,
    temperature: undefined,
  };
  try {
    const raw = localStorage.getItem(KEYS.config);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<LLMConfig>;
    // Validate against schema drift from older stored versions.
    const provider = parsed.provider && parsed.provider in PROVIDER_DEFAULTS ? parsed.provider : fallback.provider;
    return {
      provider,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' && parsed.model ? parsed.model : PROVIDER_DEFAULTS[provider].defaultModel,
      advisoryModel: typeof parsed.advisoryModel === 'string' && parsed.advisoryModel ? parsed.advisoryModel : undefined,
      temperature: typeof parsed.temperature === 'number' && Number.isFinite(parsed.temperature) ? parsed.temperature : undefined,
    };
  } catch {
    return fallback;
  }
}

export function saveConfig(cfg: LLMConfig): void {
  localStorage.setItem(KEYS.config, JSON.stringify(cfg));
}

export function loadCustomRubric(): Rubric | null {
  try {
    const raw = localStorage.getItem(KEYS.rubric);
    return raw ? (JSON.parse(raw) as Rubric) : null;
  } catch {
    return null;
  }
}

/** Every teacher edit bumps the version (spec §8: every score records which
 *  rubric/guidance version produced it). Base "1.0" → "1.0-t1" → "1.0-t2" ... */
export function bumpVersion(version: string): string {
  const m = version.match(/^(.*)-t(\d+)$/);
  return m ? `${m[1]}-t${parseInt(m[2], 10) + 1}` : `${version}-t1`;
}

export function saveCustomRubric(rubric: Rubric): void {
  localStorage.setItem(KEYS.rubric, JSON.stringify(rubric));
}

export function clearCustomRubric(): void {
  localStorage.removeItem(KEYS.rubric);
}

export function loadStoredSessions(): Session[] {
  try {
    const raw = localStorage.getItem(KEYS.sessions);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredSessions(sessions: Session[]): void {
  // Exemplars are bundled with the app; persist them only once the user has changed
  // them — a live re-grade OR a teacher override on the demo scores. (Overrides are
  // calibration data; losing them on reload would be a silent data loss.)
  const worthKeeping = sessions.filter(
    (s) => !s.isExemplar || s.gradedLive || s.scores.some((r) => r.teacherOverride),
  );
  try {
    localStorage.setItem(KEYS.sessions, JSON.stringify(worthKeeping));
  } catch {
    // Quota exceeded (long traces / many sessions): drop bundled exemplars from the
    // payload before giving up entirely — user-created sessions take priority.
    try {
      localStorage.setItem(KEYS.sessions, JSON.stringify(worthKeeping.filter((s) => !s.isExemplar)));
    } catch {
      console.warn('TGFWA: localStorage quota exceeded; sessions not persisted this change.');
    }
  }
}

export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Calibration capture (spec §8.5): every teacher override is a labeled data point.
 *  Export as a corpus for the Phase-2 calibration layer / agreement analysis. */
export function exportOverrideCorpus(sessions: Session[]): unknown {
  const rows: unknown[] = [];
  for (const s of sessions) {
    for (const r of s.scores) {
      if (!r.teacherOverride) continue;
      rows.push({
        sessionId: s.id,
        sessionName: s.name,
        criterionId: r.criterionId,
        channel: r.channel,
        llmPasses: r.passes,
        llmMedian: r.median,
        llmSpread: r.spread,
        llmConfidence: r.confidence,
        llmEvidence: r.evidence,
        rubricVersion: r.rubricVersion,
        teacherScore: r.teacherOverride.score,
        teacherRationale: r.teacherOverride.rationale,
        overriddenAt: r.teacherOverride.ts,
      });
    }
  }
  return { exportedAt: new Date().toISOString(), n: rows.length, overrides: rows };
}

export function applyOverride(scores: ScoreRecord[], criterionId: string, channel: string, score: number, rationale: string): ScoreRecord[] {
  return scores.map((r) =>
    r.criterionId === criterionId && r.channel === channel
      ? { ...r, teacherOverride: { score, rationale, ts: new Date().toISOString() } }
      : r,
  );
}

export function clearOverride(scores: ScoreRecord[], criterionId: string, channel: string): ScoreRecord[] {
  return scores.map((r) => (r.criterionId === criterionId && r.channel === channel ? { ...r, teacherOverride: null } : r));
}
