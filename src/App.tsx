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

const NAV: { id: Tab; label: string; caption: string }[] = [
  { id: 'sessions', label: 'Sessions', caption: 'exemplars · import · export' },
  { id: 'dashboard', label: 'Scores & Divergence', caption: 'trace vs product, per dimension' },
  { id: 'layerb', label: 'AI Reliance', caption: 'Layer B — how they worked with AI' },
  { id: 'queue', label: 'Needs Your Judgment', caption: 'routed for teacher scoring' },
  { id: 'chat', label: 'Writing Session', caption: 'live chat → gradeable trace' },
  { id: 'rubric', label: 'Rubric', caption: 'anchors · guidance · versions' },
  { id: 'settings', label: 'Settings', caption: 'provider · model · temperature' },
];

const TAB_TITLES: Record<Tab, string> = {
  sessions: 'Sessions',
  dashboard: 'Scores & divergence',
  layerb: 'How the student worked with AI',
  queue: 'Needs your judgment',
  chat: 'Simulated writing session',
  rubric: 'Operational rubric',
  settings: 'Settings',
};

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
  const queueCount = active ? active.scores.filter((r) => r.needsReview && !r.teacherOverride).length : 0;

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
    <div className="flex min-h-screen">
      {/* ---- rail ---- */}
      <aside
        className="sticky top-0 flex h-screen w-60 shrink-0 flex-col px-4 py-5 max-md:hidden"
        style={{ background: 'var(--rail-bg)', color: 'var(--rail-ink)' }}
      >
        <div className="font-display text-[1.35rem] leading-tight" style={{ fontWeight: 590 }}>
          Trace-Grounded
          <br />
          Writing Assessment
        </div>
        <div className="mt-1.5 text-[11px] leading-snug" style={{ color: 'var(--rail-muted)' }}>
          Process vs product evidence of MCCR W.11-12 mastery — divergence as formative signal.
        </div>

        <nav className="mt-6 flex flex-col gap-0.5">
          {NAV.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="group relative rounded-sm px-3 py-2 text-left"
                style={isActive ? { background: 'rgba(242,241,237,0.07)' } : undefined}
              >
                <span
                  className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full"
                  style={{ background: isActive ? 'var(--accent)' : 'transparent' }}
                />
                <span className="flex items-center justify-between text-[13px]" style={{ color: isActive ? 'var(--rail-ink)' : 'var(--rail-muted)', fontWeight: isActive ? 600 : 400 }}>
                  {t.label}
                  {t.id === 'queue' && queueCount > 0 && (
                    <span className="font-data rounded-sm px-1 text-[10px] font-semibold" style={{ background: 'var(--status-serious)', color: '#191813' }}>
                      {queueCount}
                    </span>
                  )}
                </span>
                <span className="block text-[10px]" style={{ color: 'var(--rail-muted)', opacity: isActive ? 0.9 : 0.6 }}>
                  {t.caption}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto border-t pt-4" style={{ borderColor: 'var(--rail-line)' }}>
          <div className="kicker mb-1.5" style={{ color: 'var(--rail-muted)' }}>Active session</div>
          <select
            className="w-full rounded-sm border-0 p-2 text-xs"
            style={{ background: 'rgba(242,241,237,0.08)', color: 'var(--rail-ink)' }}
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id} style={{ color: '#16150f' }}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="mt-3 text-[10px] leading-relaxed" style={{ color: 'var(--rail-muted)' }}>
            All data stays in this browser. LLM calls go directly to your provider with your key.
          </div>
        </div>
      </aside>

      {/* ---- content ---- */}
      <main className="min-w-0 flex-1 px-5 pb-16 pt-5 md:px-8">
        {/* mobile nav */}
        <div className="mb-4 flex flex-wrap gap-1 md:hidden">
          {NAV.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="rounded-sm border px-2.5 py-1.5 text-xs"
              style={tab === t.id ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 } : { borderColor: 'var(--gridline)', color: 'var(--ink-secondary)' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <header className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b pb-4" style={{ borderColor: 'var(--gridline)' }}>
          <div>
            <div className="kicker">{active ? active.name : 'no session selected'}</div>
            <h1 className="font-display mt-0.5 text-[1.7rem] leading-tight" style={{ fontWeight: 560 }}>
              {TAB_TITLES[tab]}
            </h1>
          </div>
          {active && (
            <span className="font-data rounded-sm border px-2 py-1 text-[10px] uppercase tracking-wide" style={{ borderColor: 'var(--gridline)', color: 'var(--ink-muted)' }}>
              {active.gradedLive ? 'graded live' : active.isExemplar ? 'bundled demo scores' : 'ungraded'} · rubric v{active.rubricVersion || rubric.version}
            </span>
          )}
        </header>

        {error && (
          <div className="card mb-4 border-l-2 p-3 text-sm" style={{ borderLeftColor: 'var(--status-critical)' }}>
            <b>Error:</b> {error}
          </div>
        )}
        {progress && (
          <div className="card mb-4 p-3 text-sm">
            <div className="mb-1.5 flex justify-between">
              <span>
                Grading with {config.provider} / {config.model} — {progress.label}
              </span>
              <span className="font-data text-xs">{progress.done}/{progress.total}</span>
            </div>
            <div className="h-1 w-full" style={{ background: 'var(--div-mid)' }}>
              <div
                className="h-1 transition-all"
                style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%`, background: 'var(--accent)' }}
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
          (active ? <Dashboard session={active} rubric={rubric} onUpdate={(u) => updateSession(active.id, u)} /> : <Empty label="Select a session first." />)}
        {tab === 'layerb' && (active ? <LayerBPanel session={active} /> : <Empty label="Select a session first." />)}
        {tab === 'queue' &&
          (active ? <ReviewQueue session={active} rubric={rubric} onUpdate={(u) => updateSession(active.id, u)} /> : <Empty label="Select a session first." />)}
        {tab === 'chat' && <ChatSimulator config={config} onCreateSession={addSession} />}
        {tab === 'rubric' && <RubricEditor rubric={rubric} onChange={setRubric} />}
        {tab === 'settings' && <SettingsPanel config={config} onChange={setConfig} />}
      </main>
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
