import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { WritingTracker } from '../lib/writingTracker';

interface FRPrompt {
  contentId: string;
  version: string;
  id: string;
  title: string;
  description: string;
  prompt_text: string;
  word_limit: number | null;
  constraints: string[];
  general_guidance: string;
  process_overlay_enabled: boolean;
}

interface MatchedPoint {
  construct: string;
  match_type?: string;
  evidence_spans?: string[];
  quality_rating?: number;
}

interface Evaluation {
  score: number;
  feedback: string;
  strengths: string[];
  gaps: string[];
  matched_points: (MatchedPoint | string)[];
  missed_points: (MatchedPoint | string)[];
}

interface FinalizeResult {
  profile: { solo_level: string; matched_count: number; mean_quality: number };
  processOverlay: Record<string, unknown> | null;
  reportMd: string;
}

type Stage = 'pick' | 'preRate' | 'write' | 'declare' | 'postRate' | 'results';

/** Free-response workspace: rate → write (instrumented) → closing nudge →
 *  AI declaration → re-rate (before any score is shown) → results + report.
 *  Flow ported from V5 static/index.js FR mode. */
export default function AssessFR() {
  const { data: prompts = [] } = useQuery({
    queryKey: ['fr-prompts'],
    queryFn: () => api.get<FRPrompt[]>('/api/fr/prompts'),
  });

  const [stage, setStage] = useState<Stage>('pick');
  const [prompt, setPrompt] = useState<FRPrompt | null>(null);
  const [preRating, setPreRating] = useState(5);
  const [postRating, setPostRating] = useState(5);
  const [text, setText] = useState('');
  const [aiUsed, setAiUsed] = useState(false);
  const [aiNotes, setAiNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [finalized, setFinalized] = useState<FinalizeResult | null>(null);
  // Closing nudge: capped at two displays; "used" only if the learner adds content.
  const nudgeShown = useRef(0);
  const nudgeUsed = useRef(false);
  const [showNudge, setShowNudge] = useState(false);

  const tracker = useMemo(() => new WritingTracker(), []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function start(p: FRPrompt) {
    setPrompt(p);
    setStage('preRate');
    setText('');
    nudgeShown.current = 0;
    nudgeUsed.current = false;
    setEvaluation(null);
    setFinalized(null);
    tracker.reset();
  }

  function requestSubmit() {
    if (nudgeShown.current < 2) {
      nudgeShown.current++;
      setShowNudge(true);
      return;
    }
    setStage('declare');
  }

  async function submit() {
    if (!prompt) return;
    setBusy(true);
    setError('');
    try {
      const metrics = tracker.collect(text);
      if (metrics.process_log) metrics.process_log.closing_nudge_used = nudgeUsed.current;
      const res = await api.post<{ assessmentId: string; evaluation: Evaluation }>(
        '/api/fr/submit',
        {
          promptId: prompt.contentId,
          text,
          preRating,
          writingMetrics: metrics,
          aiAssistance: { used: aiUsed ? 'yes' : 'no', notes: aiNotes },
        },
      );
      setAssessmentId(res.assessmentId);
      setEvaluation(res.evaluation);
      setStage('postRate'); // re-rate BEFORE any score or feedback is shown
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('write');
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/fr/${assessmentId}/post-rating`, { postRating });
      const res = await api.post<FinalizeResult>(`/api/fr/${assessmentId}/finalize`);
      setFinalized(res);
      setStage('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div>
      <header className="mb-5 border-b pb-4" style={{ borderColor: 'var(--gridline)' }}>
        <div className="kicker">Free response · unaided single-pass writing</div>
        <h1 className="font-display mt-0.5 text-[1.7rem] leading-tight" style={{ fontWeight: 560 }}>
          {prompt ? prompt.title : 'Choose a task'}
        </h1>
      </header>

      {error && (
        <div role="alert" className="card mb-4 border-l-2 p-3 text-sm" style={{ borderLeftColor: 'var(--status-critical)' }}>
          {error}
        </div>
      )}

      {stage === 'pick' && (
        <div className="grid gap-3 md:grid-cols-2">
          {prompts.map((p) => (
            <button key={p.contentId} className="card p-4 text-left transition-shadow hover:shadow-md" onClick={() => start(p)}>
              <div className="font-display text-base" style={{ fontWeight: 560 }}>{p.title}</div>
              <p className="mt-1 text-xs" style={{ color: 'var(--ink-secondary)' }}>{p.description}</p>
              {p.word_limit && (
                <div className="mt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>~{p.word_limit} words</div>
              )}
            </button>
          ))}
        </div>
      )}

      {stage === 'preRate' && prompt && (
        <div className="card max-w-xl p-5">
          <div className="panel-title">Before you write</div>
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-secondary)' }}>{prompt.prompt_text}</p>
          <RatingScale
            label="How confident are you that you understand this topic? (1 = not at all, 10 = completely)"
            value={preRating}
            onChange={setPreRating}
          />
          <button className="mt-4 rounded-sm px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }} onClick={() => setStage('write')}>
            Start writing
          </button>
        </div>
      )}

      {stage === 'write' && prompt && (
        <div className="space-y-4">
          <div className="card p-4 text-sm">
            <p>{prompt.prompt_text}</p>
            {prompt.general_guidance && (
              <p className="mt-2 text-xs" style={{ color: 'var(--ink-secondary)' }}>{prompt.general_guidance}</p>
            )}
            {prompt.constraints.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs" style={{ color: 'var(--ink-secondary)' }}>
                {prompt.constraints.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            )}
          </div>
          <div className="card p-4">
            <textarea
              ref={textareaRef}
              className="h-72 w-full rounded border p-3 text-sm"
              style={{ borderColor: 'var(--gridline)' }}
              aria-label="Your response"
              placeholder="Write your response here…"
              value={text}
              onKeyDown={(e) => tracker.onKey(e)}
              onPaste={(e) => tracker.onPaste(e, textareaRef.current?.selectionStart ?? 0)}
              onChange={(e) => {
                setText(e.target.value);
                tracker.onInput(e.target.value, e.target.selectionStart ?? e.target.value.length);
              }}
            />
            <div className="mt-2 flex items-center justify-between text-xs" style={{ color: 'var(--ink-muted)' }}>
              <span>
                {words} words{prompt.word_limit ? ` / ~${prompt.word_limit}` : ''} · your writing process is
                recorded (timing, revisions, pastes) as disclosed by your instructor
              </span>
              <button
                className="rounded-sm px-4 py-2 font-semibold text-white disabled:opacity-40"
                style={{ background: 'var(--accent)' }}
                disabled={!text.trim() || busy}
                onClick={requestSubmit}
              >
                Submit response
              </button>
            </div>
          </div>
        </div>
      )}

      {showNudge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(22,21,15,0.4)' }} role="dialog" aria-modal="true" aria-label="Before you submit">
          <div className="card w-full max-w-md p-5">
            <div className="panel-title">Before you submit…</div>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-secondary)' }}>
              Is there anything else you know about this topic that you haven't written down —
              a step, a reason why something matters, or a situation where it would change?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="rounded-sm border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--gridline)' }}
                onClick={() => {
                  nudgeUsed.current = true;
                  setShowNudge(false);
                  textareaRef.current?.focus();
                }}
              >
                Add more
              </button>
              <button
                className="rounded-sm px-3 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--accent)' }}
                onClick={() => {
                  setShowNudge(false);
                  setStage('declare');
                }}
              >
                Submit as is
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'declare' && (
        <div className="card max-w-xl p-5">
          <div className="panel-title">AI assistance declaration</div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={aiUsed} onChange={(e) => setAiUsed(e.target.checked)} />
            I used AI assistance while preparing this response
          </label>
          {aiUsed && (
            <textarea
              className="mt-2 w-full rounded border p-2 text-sm"
              style={{ borderColor: 'var(--gridline)' }}
              placeholder="Briefly describe how you used it"
              value={aiNotes}
              onChange={(e) => setAiNotes(e.target.value)}
            />
          )}
          <div className="mt-4 flex gap-2">
            <button className="rounded-sm border px-3 py-2 text-sm" style={{ borderColor: 'var(--gridline)' }} onClick={() => setStage('write')}>
              Back
            </button>
            <button className="rounded-sm px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: 'var(--accent)' }} disabled={busy} onClick={() => void submit()}>
              {busy ? 'Scoring…' : 'Confirm & submit'}
            </button>
          </div>
        </div>
      )}

      {stage === 'postRate' && (
        <div className="card max-w-xl p-5">
          <div className="panel-title">One more rating</div>
          <p className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
            Asked before you see any score — comparing this with your first rating is part of the assessment.
          </p>
          <RatingScale
            label="Now that you've written your explanation: how confident are you that you understand this topic?"
            value={postRating}
            onChange={setPostRating}
          />
          <button className="mt-4 rounded-sm px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: 'var(--accent)' }} disabled={busy} onClick={() => void finalize()}>
            {busy ? 'Preparing results…' : 'See my results'}
          </button>
        </div>
      )}

      {stage === 'results' && evaluation && finalized && (
        <Results evaluation={evaluation} finalized={finalized} assessmentId={assessmentId} />
      )}
    </div>
  );
}

function RatingScale({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mt-4">
      <div className="text-sm font-semibold">{label}</div>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label={label}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={value === n}
            className="h-9 w-9 rounded-sm border text-sm font-semibold"
            style={value === n ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : { borderColor: 'var(--gridline)' }}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function Results({ evaluation, finalized, assessmentId }: {
  evaluation: Evaluation;
  finalized: FinalizeResult;
  assessmentId: string;
}) {
  const overlay = finalized.processOverlay as {
    quadrant?: { label: string; interpretation: string; alternative_interpretation?: string };
    confidence_calibration?: { note: string; alternative_interpretation?: string; pre_rating: number; post_rating: number; confidence_delta: number };
    authenticity?: { level: string; alternative_interpretations?: string[] };
  } | null;

  const label = (m: MatchedPoint | string) => (typeof m === 'string' ? m : m.construct);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="card p-3.5">
          <div className="kicker">Coverage score</div>
          <div className="font-data mt-1 text-2xl font-semibold">{Math.round(evaluation.score * 100)}%</div>
          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            what was addressed in a single unaided pass — a missed point is not conclusive evidence of a gap
          </div>
        </div>
        <div className="card p-3.5">
          <div className="kicker">SOLO level</div>
          <div className="font-display mt-1 text-xl" style={{ fontWeight: 560 }}>{finalized.profile.solo_level}</div>
          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            structural complexity, derived from coverage + explanation quality
          </div>
        </div>
        {overlay?.confidence_calibration && (
          <div className="card p-3.5">
            <div className="kicker">Confidence calibration</div>
            <div className="font-data mt-1 text-xl font-semibold">
              {overlay.confidence_calibration.pre_rating} → {overlay.confidence_calibration.post_rating}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>pre-write vs post-write self-rating</div>
          </div>
        )}
      </div>

      <div className="card p-4 text-sm">
        <div className="panel-title">Feedback</div>
        <p className="mt-2">{evaluation.feedback}</p>
        {evaluation.strengths.length > 0 && (
          <p className="mt-2"><b>Strengths:</b> {evaluation.strengths.join('; ')}</p>
        )}
        {evaluation.gaps.length > 0 && (
          <p className="mt-1"><b>Gaps:</b> {evaluation.gaps.join(' ')}</p>
        )}
      </div>

      <div className="card p-4 text-sm">
        <div className="panel-title">Key points</div>
        <ul className="mt-2 space-y-1">
          {evaluation.matched_points.map((m, i) => (
            <li key={i}>✓ {label(m)}{typeof m !== 'string' && m.match_type === 'novel_equivalent' && (
              <span className="ml-1 rounded-sm px-1 text-[10px]" style={{ background: 'var(--div-mid)' }}>novel equivalent</span>
            )}</li>
          ))}
          {evaluation.missed_points.map((m, i) => (
            <li key={`m${i}`} style={{ color: 'var(--ink-muted)' }}>— {label(m)} (not evidenced in this pass)</li>
          ))}
        </ul>
      </div>

      {overlay?.confidence_calibration && (
        <div className="card border-l-2 p-4 text-sm" style={{ borderLeftColor: 'var(--series-trace)' }}>
          <div className="panel-title">What the ratings show</div>
          <p className="mt-1">{overlay.confidence_calibration.note}</p>
          {overlay.confidence_calibration.alternative_interpretation && (
            <p className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
              Alternative: {overlay.confidence_calibration.alternative_interpretation}
            </p>
          )}
        </div>
      )}

      {overlay?.quadrant && (
        <div className="card p-4 text-sm">
          <div className="panel-title">Writing process</div>
          <p className="mt-1">{overlay.quadrant.interpretation}</p>
          {overlay.quadrant.alternative_interpretation && (
            <p className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
              Alternative: {overlay.quadrant.alternative_interpretation}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2 text-sm">
        <a
          className="rounded-sm border px-3 py-2"
          style={{ borderColor: 'var(--gridline)' }}
          href={`/api/fr/${assessmentId}/report.md`}
          target="_blank"
          rel="noreferrer"
        >
          Open instructor report (Markdown)
        </a>
      </div>
    </div>
  );
}
