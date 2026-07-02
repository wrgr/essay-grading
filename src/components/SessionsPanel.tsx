import { useRef, useState } from 'react';
import type { Session, Trace } from '../types';
import { downloadJSON, exportOverrideCorpus } from '../lib/storage';
import { Drawer } from './Drawer';

export function SessionsPanel(props: {
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: (s: Session) => void;
  onDelete: (id: string) => void;
  onGrade: (id: string) => void;
  grading: boolean;
  hasKey: boolean;
  onOpenDashboard: () => void;
}) {
  const { sessions, activeId, onSelect, onAdd, onDelete, onGrade, grading, hasKey, onOpenDashboard } = props;
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="space-y-4">
      <ol className="card flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 text-xs" aria-label="Demo path" style={{ color: 'var(--ink-secondary)' }}>
        {['Pick an exemplar below', 'Open its dashboard', 'Click a dimension to see the evidence', 'Score the routed items in “Needs Your Judgment”'].map((step, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className="font-data font-semibold" style={{ color: 'var(--accent)' }}>{i + 1}</span> {step}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          className="rounded-sm px-3 py-1.5 font-medium text-white"
          style={{ background: 'var(--accent)' }}
          onClick={() => setShowImport(true)}
        >
          + Import trace &amp; essay
        </button>
        <button
          className="card px-3 py-1.5"
          onClick={() => downloadJSON('tgfwa-override-corpus.json', exportOverrideCorpus(sessions))}
          title="Every teacher override, exported as labeled calibration data"
        >
          Export override corpus
        </button>
        <span style={{ color: 'var(--ink-muted)' }}>Exemplars carry demo scores — no API key needed to explore.</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {sessions.map((s) => {
          const isActive = s.id === activeId;
          return (
            <div
              key={s.id}
              className="card cursor-pointer p-4 transition-shadow hover:shadow-md"
              style={isActive ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' } : undefined}
              onClick={() => onSelect(s.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-display text-base" style={{ fontWeight: 560 }}>{s.name}</div>
                <span className="font-data shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-wide" style={{ background: 'var(--div-mid)', color: 'var(--ink-secondary)' }}>
                  {s.gradedLive ? 'live' : s.isExemplar ? 'demo' : 'ungraded'}
                </span>
              </div>
              <p
                className="mt-1 overflow-hidden text-xs leading-snug"
                style={{ color: 'var(--ink-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                title={s.description}
              >
                {s.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  className="rounded-sm px-2.5 py-1 font-medium text-white"
                  style={{ background: 'var(--accent)' }}
                  onClick={(e) => { e.stopPropagation(); onSelect(s.id); onOpenDashboard(); }}
                >
                  Dashboard ›
                </button>
                <button
                  className="rounded-sm border px-2.5 py-1 disabled:opacity-40"
                  style={{ borderColor: 'var(--gridline)' }}
                  disabled={grading || !hasKey}
                  title={hasKey ? 'Run the full grading pipeline with your configured LLM' : 'Add an API key in Settings first'}
                  onClick={(e) => { e.stopPropagation(); onGrade(s.id); }}
                >
                  {s.scores.length ? 'Re-grade' : 'Grade'} live
                </button>
                <button
                  className="rounded-sm border px-2.5 py-1"
                  style={{ borderColor: 'var(--gridline)' }}
                  onClick={(e) => { e.stopPropagation(); downloadJSON(`${s.id}.json`, s); }}
                >
                  Export
                </button>
                {!s.isExemplar && (
                  <button
                    className="rounded-sm border px-2.5 py-1"
                    style={{ borderColor: 'var(--gridline)', color: 'var(--status-critical)' }}
                    onClick={(e) => { e.stopPropagation(); if (confirm(`Delete session "${s.name}"?`)) onDelete(s.id); }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Drawer open={showImport} onClose={() => setShowImport(false)} title="Import a session" kicker="trace JSON + final essay" wide>
        <ImportForm onAdd={(s) => { onAdd(s); setShowImport(false); }} />
      </Drawer>
    </div>
  );
}

function ImportForm({ onAdd }: { onAdd: (s: Session) => void }) {
  const [name, setName] = useState('');
  const [traceText, setTraceText] = useState('');
  const [essay, setEssay] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    try {
      const parsed = JSON.parse(traceText) as Trace;
      if (!Array.isArray(parsed.turns)) throw new Error('trace JSON must have a "turns" array');
      for (const t of parsed.turns) {
        if (t.speaker !== 'student' && t.speaker !== 'assistant') throw new Error(`turn ${t.turnId}: speaker must be "student" or "assistant"`);
      }
      onAdd({
        id: `session-${Date.now()}`,
        name: name || parsed.traceId || 'Imported session',
        description: 'Imported trace + essay',
        trace: parsed,
        essay,
        scores: [],
        layerB: null,
        rubricVersion: '',
        createdAt: new Date().toISOString(),
        isExemplar: false,
        gradedLive: false,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full rounded-sm border p-2 text-sm"
        style={{ borderColor: 'var(--gridline)' }}
        placeholder="Session name (student / assignment)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div>
        <div className="mb-1 flex items-center justify-between text-xs" style={{ color: 'var(--ink-secondary)' }}>
          <span className="font-data">{'{ traceId, assignmentId, turns: [{turnId, speaker, text}] }'}</span>
          <button className="underline" onClick={() => fileRef.current?.click()}>upload file</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setTraceText(await f.text());
            }}
          />
        </div>
        <textarea
          className="font-data h-44 w-full rounded-sm border p-2 text-xs"
          style={{ borderColor: 'var(--gridline)' }}
          placeholder="Paste trace JSON…"
          value={traceText}
          onChange={(e) => setTraceText(e.target.value)}
        />
      </div>
      <div>
        <div className="mb-1 text-xs" style={{ color: 'var(--ink-secondary)' }}>Final essay (plain text)</div>
        <textarea
          className="h-44 w-full rounded-sm border p-2 text-xs"
          style={{ borderColor: 'var(--gridline)' }}
          value={essay}
          onChange={(e) => setEssay(e.target.value)}
        />
      </div>
      {err && <div className="text-xs" style={{ color: 'var(--status-critical)' }}>{err}</div>}
      <button className="rounded-sm px-3 py-1.5 text-sm font-medium text-white" style={{ background: 'var(--accent)' }} onClick={submit}>
        Add session
      </button>
    </div>
  );
}
