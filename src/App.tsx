import { useEffect, useMemo, useState } from 'react';
import type { GradingProgress, LLMConfig, Rubric, Session } from './types';
import { BASE_RUBRIC } from './data/rubric';
import { buildExemplarSessions } from './data/exemplars';
import { loadConfig, loadCustomRubric, loadStoredSessions, saveConfig, saveStoredSessions } from './lib/storage';
import { makeClient } from './lib/llm/client';
import { gradeSession } from './lib/grading/engine';
import { codeLayerB } from './lib/layerb';
import { SessionsPanel } from './components/SessionsPanel';
import { Dashboard } from './components/Dashboard';
import { LayerBPanel } from './components/LayerBPanel';
import { ReviewQueue } from './components/ReviewQueue';
import { RubricEditor } from './components/RubricEditor';
import { SettingsPanel } from './components/SettingsPanel';
import { ChatSimulator } from './components/ChatSimulator';

type Tab = 'sessions' | 'dashboard' | 'layerb' | 'queue' | 'chat' | 'rubric' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'dashboard', label: 'Scores & Divergence' },
  { id: 'layerb', label: 'AI Reliance (Layer B)' },
  { id: 'queue', label: 'Needs Your Judgment' },
  { id: 'chat', label: 'Writing Session (live)' },
  { id: 'rubric', label: 'Rubric' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('sessions');
  const [config, setConfig] = useState<LLMConfig>(loadConfig);
  const [rubric, setRubric] = useState<Rubric>(() => loadCustomRubric() ?? BASE_RUBRIC);
  const exemplars = useMemo(() => buildExemplarSessions(BASE_RUBRIC), []);
  const [sessions, setSessions] = useState<Session[]>(() => {
    const stored = loadStoredSessions();
    const storedIds = new Set(stored.map((s) => s.id));
    return [...exemplars.filter((e) => !storedIds.has(e.id)), ...stored];
  });
  const [activeId, setActiveId] = useState<string>(sessions[0]?.id ?? '');
  const [progress, setProgress] = useState<GradingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = sessions.find((s) => s.id === activeId) ?? null;

  useEffect(() => saveConfig(config), [config]);
  useEffect(() => saveStoredSessions(sessions), [sessions]);

  function updateSession(id: string, update: (s: Session) => Session) {
    setSessions((prev) => prev.map((s) => (s.id === id ? update(s) : s)));
  }

  function addSession(s: Session) {
    setSessions((prev) => [...prev, s]);
    setActiveId(s.id);
  }

  async function runGrading(sessionId: string) {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;
    setError(null);
    try {
      const llm = makeClient(config);
      setProgress({ done: 0, total: rubric.criteria.length * 2, label: 'starting…' });
      const scores = await gradeSession({
        llm,
        rubric,
        essay: target.essay,
        trace: target.trace,
        onProgress: setProgress,
        onResult: (r) =>
          updateSession(sessionId, (s) => ({
            ...s,
            scores: [...s.scores.filter((x) => !(x.criterionId === r.criterionId && x.channel === r.channel)), r],
            gradedLive: true,
            rubricVersion: rubric.version,
          })),
      });
      setProgress({ done: 0, total: 1, label: 'coding AI-reliance segments…' });
      const layerB = await codeLayerB(llm, target.trace, (done, total) =>
        setProgress({ done, total, label: `reliance segment ${done}/${total}` }),
      );
      updateSession(sessionId, (s) => ({ ...s, scores, layerB, gradedLive: true, rubricVersion: rubric.version }));
      setProgress(null);
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="pb-2 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">Trace-Grounded Formative Writing Assessment</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-secondary)' }}>
          Compares what a student's <b>AI dialogue</b> reveals about their writing mastery (MCCR W.11-12) against the{' '}
          <b>final essay</b> — and flags when the two diverge. Preliminary, evidence-cited scores; the teacher is always
          the authoritative evaluator. All data stays in this browser except calls you make to your own LLM provider.
        </p>
      </header>

      <nav className="mb-4 flex flex-wrap gap-1 border-b" style={{ borderColor: 'var(--gridline)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-t-md px-3 py-2 text-sm ${tab === t.id ? 'font-semibold' : ''}`}
            style={
              tab === t.id
                ? { background: 'var(--surface-1)', border: '1px solid var(--gridline)', borderBottom: '1px solid var(--surface-1)', marginBottom: -1 }
                : { color: 'var(--ink-secondary)' }
            }
          >
            {t.label}
            {t.id === 'queue' && active && (
              <span
                className="ml-1.5 rounded-full px-1.5 text-xs font-semibold text-white"
                style={{ background: 'var(--status-serious)' }}
              >
                {active.scores.filter((r) => r.needsReview && !r.teacherOverride).length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {error && (
        <div className="card mb-4 border-l-4 p-3 text-sm" style={{ borderLeftColor: 'var(--status-critical)' }}>
          <b>Error:</b> {error}
        </div>
      )}
      {progress && (
        <div className="card mb-4 p-3 text-sm">
          <div className="mb-1 flex justify-between">
            <span>Grading with {config.provider} / {config.model} — {progress.label}</span>
            <span className="tabular">{progress.done}/{progress.total}</span>
          </div>
          <div className="h-2 w-full rounded" style={{ background: 'var(--div-mid)' }}>
            <div
              className="h-2 rounded transition-all"
              style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%`, background: 'var(--series-trace)' }}
            />
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <SessionsPanel
          sessions={sessions}
          activeId={activeId}
          onSelect={(id) => setActiveId(id)}
          onAdd={addSession}
          onDelete={(id) => setSessions((prev) => prev.filter((s) => s.id !== id))}
          onGrade={runGrading}
          grading={progress !== null}
          hasKey={!!config.apiKey}
          onOpenDashboard={() => setTab('dashboard')}
        />
      )}
      {tab === 'dashboard' &&
        (active ? (
          <Dashboard session={active} rubric={rubric} onUpdate={(u) => updateSession(active.id, u)} />
        ) : (
          <Empty label="Select a session first." />
        ))}
      {tab === 'layerb' && (active ? <LayerBPanel session={active} /> : <Empty label="Select a session first." />)}
      {tab === 'queue' &&
        (active ? (
          <ReviewQueue session={active} rubric={rubric} onUpdate={(u) => updateSession(active.id, u)} />
        ) : (
          <Empty label="Select a session first." />
        ))}
      {tab === 'chat' && <ChatSimulator config={config} onCreateSession={addSession} />}
      {tab === 'rubric' && <RubricEditor rubric={rubric} onChange={setRubric} />}
      {tab === 'settings' && <SettingsPanel config={config} onChange={setConfig} />}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="card p-8 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
      {label}
    </div>
  );
}
