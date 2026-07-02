import { useState } from 'react';
import type { Rubric, ScoreRecord, Session } from '../types';
import { computeDivergence, effectiveScore, interpretDivergence } from '../lib/divergence';
import { EvidenceTrail } from './EvidenceTrail';

const TONE_COLOR: Record<string, string> = {
  flag: 'var(--status-serious)',
  target: 'var(--series-trace)',
  valid: 'var(--status-good)',
  neutral: 'var(--baseline)',
};

export function Dashboard({ session, rubric, onUpdate }: {
  session: Session;
  rubric: Rubric;
  onUpdate: (update: (s: Session) => Session) => void;
}) {
  const dims = computeDivergence(rubric, session.scores);
  const interp = interpretDivergence(dims, session.layerB);
  const [showSource, setShowSource] = useState<'none' | 'essay' | 'trace'>('none');

  if (!session.scores.length) {
    return (
      <div className="card p-8 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        This session has no scores yet. Run grading from the Sessions tab (requires an API key in Settings).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card border-l-4 p-4" style={{ borderLeftColor: TONE_COLOR[interp.tone] }}>
        <div className="text-sm font-semibold">{interp.headline}</div>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-secondary)' }}>{interp.detail}</p>
        <p className="mt-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
          Interpretive frame, not a verdict. Rubric v{session.rubricVersion || rubric.version} · scores are preliminary
          until you confirm or override them.
        </p>
      </div>

      <div className="card p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Trace-inferred vs product scores, by dimension</h2>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--ink-secondary)' }}>
            <span className="flex items-center gap-1"><Swatch color="var(--series-trace)" /> Trace (dialogue)</span>
            <span className="flex items-center gap-1"><Swatch color="var(--series-product)" /> Product (essay)</span>
          </div>
        </div>
        <p className="mb-3 text-xs" style={{ color: 'var(--ink-muted)' }}>
          Median of criterion medians per dimension, 0–5. Divergence = product − trace. Teacher overrides take
          precedence where present.
        </p>
        <div className="space-y-3">
          {dims.map((d) => (
            <DimensionRow key={d.dimension} label={d.dimension} trace={d.traceScore} product={d.productScore} divergence={d.divergence} />
          ))}
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Per-criterion evidence trails</h2>
          <div className="flex gap-2 text-xs">
            <button className="rounded border px-2 py-1" style={{ borderColor: 'var(--gridline)' }}
              onClick={() => setShowSource(showSource === 'essay' ? 'none' : 'essay')}>
              {showSource === 'essay' ? 'Hide' : 'View'} essay
            </button>
            <button className="rounded border px-2 py-1" style={{ borderColor: 'var(--gridline)' }}
              onClick={() => setShowSource(showSource === 'trace' ? 'none' : 'trace')}>
              {showSource === 'trace' ? 'Hide' : 'View'} dialogue
            </button>
          </div>
        </div>
        {showSource === 'essay' && (
          <div className="mb-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded border p-3 text-xs leading-relaxed" style={{ borderColor: 'var(--gridline)' }}>
            {session.essay}
          </div>
        )}
        {showSource === 'trace' && (
          <div className="mb-3 max-h-64 space-y-2 overflow-y-auto rounded border p-3 text-xs" style={{ borderColor: 'var(--gridline)' }}>
            {session.trace.turns.map((t) => (
              <div key={t.turnId}>
                <span className="font-semibold" style={{ color: t.speaker === 'student' ? 'var(--series-trace)' : 'var(--ink-muted)' }}>
                  turn {t.turnId} · {t.speaker}:
                </span>{' '}
                {t.text}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {rubric.criteria.map((c) => {
            const records = session.scores.filter((r) => r.criterionId === c.criterionId);
            if (!records.length) return null;
            const trace = records.find((r) => r.channel === 'trace');
            const product = records.find((r) => r.channel === 'product');
            return (
              <div key={c.criterionId} className="rounded border p-3" style={{ borderColor: 'var(--gridline)' }}>
                <div className="mb-1 text-sm">
                  <span className="font-semibold">{c.criterionId}</span>{' '}
                  <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>({c.standard}{c.referenceability === 'weak' ? ' · teacher-reserve' : ''})</span>
                  <div className="text-xs" style={{ color: 'var(--ink-secondary)' }}>{c.statement}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {trace && <EvidenceTrail record={trace} criterion={c} onUpdate={onUpdate} />}
                  {product && <EvidenceTrail record={product} criterion={c} onUpdate={onUpdate} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />;
}

function DimensionRow({ label, trace, product, divergence }: {
  label: string;
  trace: number | null;
  product: number | null;
  divergence: number | null;
}) {
  return (
    <div className="grid grid-cols-[10rem_1fr_5.5rem] items-center gap-3">
      <div className="truncate text-xs font-medium" title={label}>{label}</div>
      <div className="space-y-0.5">
        <Bar value={trace} color="var(--series-trace)" />
        <Bar value={product} color="var(--series-product)" />
      </div>
      <DivergenceChip value={divergence} />
    </div>
  );
}

function Bar({ value, color }: { value: number | null; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-3 flex-1 overflow-hidden rounded-sm" style={{ background: 'var(--div-mid)' }}>
        {value !== null && (
          <div className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${(value / 5) * 100}%`, background: color }} />
        )}
      </div>
      <span className="w-8 text-right text-xs tabular" style={{ color: 'var(--ink-secondary)' }}>
        {value === null ? '—' : value.toFixed(1)}
      </span>
    </div>
  );
}

export function DivergenceChip({ value }: { value: number | null }) {
  if (value === null)
    return <span className="rounded px-2 py-0.5 text-center text-xs" style={{ background: 'var(--div-mid)', color: 'var(--ink-muted)' }}>n/a</span>;
  const mag = Math.abs(value);
  const bg = mag < 1 ? 'var(--div-mid)' : value > 0 ? 'var(--div-pos)' : 'var(--div-neg)';
  const fg = mag < 1 ? 'var(--ink-secondary)' : '#ffffff';
  const arrow = mag < 1 ? '≈' : value > 0 ? '▲' : '▼';
  return (
    <span className="rounded px-2 py-0.5 text-center text-xs font-medium tabular" style={{ background: bg, color: fg }}
      title={value > 0 ? 'Product exceeds trace' : value < 0 ? 'Trace exceeds product' : 'Converged'}>
      {arrow} {value > 0 ? '+' : ''}{value.toFixed(1)}
    </span>
  );
}

export function scoreOf(r: ScoreRecord): number | null {
  return effectiveScore(r);
}
