import { useRef, useState } from 'react';
import type { Session, Trace } from '../types';
import { downloadJSON, exportOverrideCorpus } from '../lib/storage';

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
      <div className="flex flex-wrap items-center gap-2">
        <button className="card px-3 py-1.5 text-sm font-medium" onClick={() => setShowImport((v) => !v)}>
          + Import trace &amp; essay
        </button>
        <button
          className="card px-3 py-1.5 text-sm"
          onClick={() => downloadJSON('tgfwa-override-corpus.json', exportOverrideCorpus(sessions))}
        >
          Export teacher-override corpus (calibration data)
        </button>
        <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          Bundled exemplars carry precomputed demo scores — no API key needed to explore. Re-grade live any time.
        </span>
      </div>

      {showImport && <ImportForm onAdd={(s) => { onAdd(s); setShowImport(false); }} />}

      <div className="grid gap-3 md:grid-cols-2">
        {sessions.map((s) => {
          const isActive = s.id === activeId;
          return (
            <div
              key={s.id}
              className="card cursor-pointer p-4"
              style={isActive ? { outline: '2px solid var(--series-trace)' } : undefined}
              onClick={() => onSelect(s.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--ink-secondary)' }}>
                    {s.description}
                  </div>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: 'var(--div-mid)', color: 'var(--ink-secondary)' }}
                >
                  {s.gradedLive ? 'graded live' : s.isExemplar ? 'bundled demo scores' : 'ungraded'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  className="rounded border px-2 py-1"
                  style={{ borderColor: 'var(--gridline)' }}
                  onClick={(e) => { e.stopPropagation(); onSelect(s.id); onOpenDashboard(); }}
                >
                  Open dashboard →
                </button>
                <button
                  className="rounded border px-2 py-1 disabled:opacity-40"
                  style={{ borderColor: 'var(--gridline)' }}
                  disabled={grading || !hasKey}
                  title={hasKey ? 'Run the full grading pipeline with your configured LLM' : 'Add an API key in Settings first'}
                  onClick={(e) => { e.stopPropagation(); onGrade(s.id); }}
                >
                  {s.scores.length ? 'Re-grade live' : 'Grade'} ({hasKey ? 'uses your key' : 'needs key'})
                </button>
                <button
                  className="rounded border px-2 py-1"
                  style={{ borderColor: 'var(--gridline)' }}
                  onClick={(e) => { e.stopPropagation(); downloadJSON(`${s.id}.json`, s); }}
                >
                  Export JSON
                </button>
                {!s.isExemplar && (
                  <button
                    className="rounded border px-2 py-1"
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
    <div className="card space-y-3 p-4">
      <div className="text-sm font-semibold">Import a session</div>
      <input
        className="w-full rounded border p-2 text-sm"
        style={{ borderColor: 'var(--gridline)' }}
        placeholder="Session name (student / assignment)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs" style={{ color: 'var(--ink-secondary)' }}>
            <span>Trace JSON — {'{ traceId, assignmentId, turns: [{turnId, speaker: "student"|"assistant", text}] }'}</span>
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
            className="h-48 w-full rounded border p-2 font-mono text-xs"
            style={{ borderColor: 'var(--gridline)' }}
            value={traceText}
            onChange={(e) => setTraceText(e.target.value)}
          />
        </div>
        <div>
          <div className="mb-1 text-xs" style={{ color: 'var(--ink-secondary)' }}>Final essay (plain text)</div>
          <textarea
            className="h-48 w-full rounded border p-2 text-xs"
            style={{ borderColor: 'var(--gridline)' }}
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
          />
        </div>
      </div>
      {err && <div className="text-xs" style={{ color: 'var(--status-critical)' }}>{err}</div>}
      <button className="rounded px-3 py-1.5 text-sm font-medium text-white" style={{ background: 'var(--series-trace)' }} onClick={submit}>
        Add session
      </button>
    </div>
  );
}
