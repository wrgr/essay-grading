import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { WritingTracker } from '../lib/writingTracker';

interface ScenarioListItem {
  contentId: string;
  version: string;
  title: string;
  description: string;
  user_role: string;
  constraints: string[];
}

interface TurnResponse {
  message: string;
  concluded: boolean;
  phase: 'recall' | 'probing' | 'concluded';
  probeNumber: number;
  probeCount: number;
}

interface Evaluation {
  score: number;
  coverage_score: number;
  quality_score: number;
  matched_points: string[];
  missed_points: string[];
  point_sources: Record<string, 'recall' | 'probe'>;
  quality_ratings: Record<string, number>;
  feedback: string;
  strengths: string[];
  gaps: string[];
  recall_score?: number;
  probe_score?: number;
}

interface EvaluateResult {
  evaluations: Evaluation[];
  profile: Record<string, unknown> | null;
  reportMd: string;
}

interface ChatMsg {
  who: 'examiner' | 'you';
  text: string;
}

type Stage = 'pick' | 'run' | 'results';

/** Scenario workspace: free recall (neutral acks) → "I'm Done" → CTA probes →
 *  evaluation. UX ported from V5 static/index.js scenario mode. */
export default function AssessScenario() {
  const { data: scenarios = [] } = useQuery({
    queryKey: ['scenario-list'],
    queryFn: () => api.get<ScenarioListItem[]>('/api/scenario/list'),
  });

  const [stage, setStage] = useState<Stage>('pick');
  const [scenario, setScenario] = useState<ScenarioListItem | null>(null);
  const [assessmentId, setAssessmentId] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [phase, setPhase] = useState<TurnResponse['phase']>('recall');
  const [probe, setProbe] = useState({ n: 0, total: 0 });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<EvaluateResult | null>(null);
  const tracker = useMemo(() => new WritingTracker(), []);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollDown() {
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
  }

  async function start(s: ScenarioListItem) {
    setBusy(true);
    setError('');
    try {
      const res = await api.post<TurnResponse & { assessmentId: string }>('/api/scenario/start', {
        scenarioId: s.contentId,
      });
      setScenario(s);
      setAssessmentId(res.assessmentId);
      setMessages([{ who: 'examiner', text: res.message }]);
      setPhase(res.phase);
      setStage('run');
      setResult(null);
      tracker.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    setMessages((m) => [...m, { who: 'you', text }]);
    setInput('');
    scrollDown();
    try {
      const metrics = tracker.collect(text);
      tracker.reset();
      const res = await api.post<TurnResponse>(`/api/scenario/${assessmentId}/respond`, {
        text,
        writingMetrics: metrics,
      });
      if (res.message) setMessages((m) => [...m, { who: 'examiner', text: res.message }]);
      setPhase(res.phase);
      setProbe({ n: res.probeNumber, total: res.probeCount });
      scrollDown();
      if (res.concluded) await evaluate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function done() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post<TurnResponse>(`/api/scenario/${assessmentId}/end-recall`);
      if (res.message) setMessages((m) => [...m, { who: 'examiner', text: res.message }]);
      setPhase(res.phase);
      setProbe({ n: res.probeNumber, total: res.probeCount });
      scrollDown();
      if (res.concluded) await evaluate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function evaluate() {
    setMessages((m) => [...m, { who: 'examiner', text: 'Evaluating your responses…' }]);
    const res = await api.post<EvaluateResult>(`/api/scenario/${assessmentId}/evaluate`);
    setResult(res);
    setStage('results');
  }

  return (
    <div>
      <header className="mb-5 border-b pb-4" style={{ borderColor: 'var(--gridline)' }}>
        <div className="kicker">Scenario · free recall → structured probing</div>
        <h1 className="font-display mt-0.5 text-[1.7rem] leading-tight" style={{ fontWeight: 560 }}>
          {scenario ? scenario.title : 'Choose a scenario'}
        </h1>
      </header>

      {error && (
        <div role="alert" className="card mb-4 border-l-2 p-3 text-sm" style={{ borderLeftColor: 'var(--status-critical)' }}>
          {error}
        </div>
      )}

      {stage === 'pick' && (
        <div className="grid gap-3 md:grid-cols-2">
          {scenarios.map((s) => (
            <button key={s.contentId} className="card p-4 text-left transition-shadow hover:shadow-md" disabled={busy} onClick={() => void start(s)}>
              <div className="font-display text-base" style={{ fontWeight: 560 }}>{s.title}</div>
              <p className="mt-1 text-xs" style={{ color: 'var(--ink-secondary)' }}>{s.description}</p>
              <div className="mt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>role: {s.user_role}</div>
            </button>
          ))}
        </div>
      )}

      {stage === 'run' && (
        <div className="card flex h-[34rem] flex-col p-4">
          <div className="mb-2 flex items-center justify-between text-xs" style={{ color: 'var(--ink-muted)' }}>
            <span>
              {phase === 'recall'
                ? 'Free recall — walk through what you would do; the examiner will not hint or help.'
                : `Probing — question ${probe.n} of ${probe.total}: explain the reasoning behind your answers.`}
            </span>
            {phase === 'recall' && (
              <button
                className="rounded-sm px-3 py-1.5 font-semibold text-white disabled:opacity-40"
                style={{ background: 'var(--accent)' }}
                disabled={busy || messages.filter((m) => m.who === 'you').length === 0}
                onClick={() => void done()}
              >
                I'm Done — start questions
              </button>
            )}
          </div>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto rounded border p-3" style={{ borderColor: 'var(--gridline)' }}>
            {messages.map((m, i) => (
              <div key={i} className="text-sm">
                <span className="mr-1 font-semibold" style={{ color: m.who === 'you' ? 'var(--series-trace-text)' : 'var(--ink-muted)' }}>
                  {m.who === 'you' ? 'you' : 'examiner'}:
                </span>
                <span className="whitespace-pre-wrap">{m.text}</span>
              </div>
            ))}
            {busy && <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>…</div>}
          </div>
          <div className="mt-2 flex gap-2">
            <textarea
              className="flex-1 rounded border p-2 text-sm"
              style={{ borderColor: 'var(--gridline)' }}
              rows={2}
              placeholder="Type your response… (Enter to send)"
              aria-label="Your response"
              value={input}
              onKeyDown={(e) => {
                tracker.onKey(e);
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              className="rounded px-4 text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'var(--accent)' }}
              disabled={busy || !input.trim()}
              onClick={() => void send()}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {stage === 'results' && result && <ScenarioResults result={result} assessmentId={assessmentId} />}
    </div>
  );
}

function ScenarioResults({ result, assessmentId }: { result: EvaluateResult; assessmentId: string }) {
  const ev = result.evaluations[0];
  if (!ev) return null;
  const pct = (v: number | undefined) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : '—');
  const hm = (result.profile as { honey_mumford?: { style?: string } } | null)?.honey_mumford;
  const solo = (result.profile as { solo?: { level?: string } } | null)?.solo;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Combined score" value={pct(ev.score)} sub="coverage × quality weighted" />
        <Stat label="Coverage" value={pct(ev.coverage_score)} sub="key points evidenced" />
        <Stat label="Quality" value={pct(ev.quality_score)} sub="explanation depth (Chi 0/1/2)" />
        <Stat
          label="Recall vs probe"
          value={`${pct(ev.recall_score)} / ${pct(ev.probe_score)}`}
          sub="volunteered vs surfaced under questioning"
        />
      </div>

      <div className="card p-4 text-sm">
        <div className="panel-title">Key points</div>
        <ul className="mt-2 space-y-1">
          {ev.matched_points.map((p) => (
            <li key={p}>
              ✓ {p}{' '}
              <span className="rounded-sm px-1 text-[10px]" style={{ background: 'var(--div-mid)', color: 'var(--ink-secondary)' }}>
                {ev.point_sources[p] === 'recall' ? 'volunteered' : 'surfaced via probe'}
              </span>
              {typeof ev.quality_ratings[p] === 'number' && (
                <span className="ml-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  quality {ev.quality_ratings[p]}/2
                </span>
              )}
            </li>
          ))}
          {ev.missed_points.map((p) => (
            <li key={p} style={{ color: 'var(--ink-muted)' }}>— {p} (not evidenced)</li>
          ))}
        </ul>
      </div>

      <div className="card p-4 text-sm">
        <div className="panel-title">Feedback</div>
        <p className="mt-2">{ev.feedback}</p>
        {ev.strengths.length > 0 && <p className="mt-2"><b>Strengths:</b> {ev.strengths.join('; ')}</p>}
        {ev.gaps.length > 0 && <p className="mt-1"><b>Gaps:</b> {ev.gaps.join(' ')}</p>}
      </div>

      {(hm?.style || solo?.level) && (
        <div className="card p-4 text-sm">
          <div className="panel-title">Thinking profile (scenario mode)</div>
          {solo?.level && <p className="mt-2"><b>SOLO level:</b> {solo.level}</p>}
          {hm?.style && (
            <p className="mt-1">
              <b>Honey &amp; Mumford style:</b> {hm.style}{' '}
              <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                — legacy label with weak validity evidence (Coffield 2004; Pashler 2008); read as a
                hypothesis, never as a basis for instructional decisions. FR mode dropped it entirely.
              </span>
            </p>
          )}
        </div>
      )}

      <a
        className="inline-block rounded-sm border px-3 py-2 text-sm"
        style={{ borderColor: 'var(--gridline)' }}
        href={`/api/scenario/${assessmentId}/report.md`}
        target="_blank"
        rel="noreferrer"
      >
        Open instructor report (Markdown)
      </a>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-3.5">
      <div className="kicker">{label}</div>
      <div className="font-data mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{sub}</div>
    </div>
  );
}
