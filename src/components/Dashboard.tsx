import { useState } from 'react';
import type { DimensionDivergence, Rubric, Session } from '../types';
import { computeDivergence, effectiveScore, interpretDivergence } from '../lib/divergence';
import { median } from '../lib/grading/aggregate';
import { EvidenceTrail } from './EvidenceTrail';
import { Drawer } from './Drawer';

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
  const [openDim, setOpenDim] = useState<DimensionDivergence | null>(null);
  const [source, setSource] = useState<'essay' | 'trace' | null>(null);
  const [why, setWhy] = useState(false);

  if (!session.scores.length) {
    return (
      <div className="card p-8 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        This session has no scores yet. Run grading from the Sessions tab (requires an API key in Settings).
      </div>
    );
  }

  const overall = (channel: 'trace' | 'product'): number | null => {
    const vals = session.scores
      .filter((r) => r.channel === channel)
      .map((r) => effectiveScore(r))
      .filter((v): v is number => v !== null);
    return vals.length ? median(vals) : null;
  };
  const traceOverall = overall('trace');
  const productOverall = overall('product');
  const meanDiv =
    dims.filter((d) => d.divergence !== null).length > 0
      ? dims.filter((d) => d.divergence !== null).reduce((a, d) => a + (d.divergence as number), 0) /
        dims.filter((d) => d.divergence !== null).length
      : null;
  const flags = session.scores.filter((r) => r.needsReview && !r.teacherOverride).length;

  return (
    <div className="space-y-4">
      {/* ---- overview tiles ---- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Trace-inferred mastery" value={traceOverall} accent="var(--series-trace)" sub="from the dialogue" />
        <Tile label="Product score" value={productOverall} accent="var(--series-product)" sub="from the final essay" />
        <Tile
          label="Mean divergence"
          value={meanDiv}
          signed
          accent={meanDiv !== null && Math.abs(meanDiv) >= 1 ? (meanDiv > 0 ? 'var(--div-pos)' : 'var(--div-neg)') : 'var(--baseline)'}
          sub="product − trace"
        />
        <Tile label="Awaiting your judgment" value={flags} count accent={flags ? 'var(--status-serious)' : 'var(--baseline)'} sub="routed items" />
      </div>

      {/* ---- interpretation, one line + drill-in ---- */}
      <div className="card flex items-start gap-3 border-l-2 p-4" style={{ borderLeftColor: TONE_COLOR[interp.tone] }}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{interp.headline}</div>
          {why && (
            <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-secondary)' }}>
              {interp.detail}{' '}
              <span style={{ color: 'var(--ink-muted)' }}>Interpretive frame, not a verdict — scores are preliminary until you confirm or override them.</span>
            </p>
          )}
        </div>
        <button className="shrink-0 text-xs underline" style={{ color: 'var(--ink-secondary)' }} onClick={() => setWhy((v) => !v)}>
          {why ? 'hide' : 'why?'}
        </button>
      </div>

      {/* ---- dimension bars, click to drill in ---- */}
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="panel-title">By dimension</h2>
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--ink-secondary)' }}>
            <span className="flex items-center gap-1.5"><Swatch color="var(--series-trace)" /> Trace</span>
            <span className="flex items-center gap-1.5"><Swatch color="var(--series-product)" /> Product</span>
            <span className="flex gap-2">
              <button className="underline" onClick={() => setSource('essay')}>essay</button>
              <button className="underline" onClick={() => setSource('trace')}>dialogue</button>
            </span>
          </div>
        </div>
        <div>
          {dims.map((d) => (
            <button
              key={d.dimension}
              className="grid w-full grid-cols-[9rem_1fr_4.5rem_1rem] items-center gap-3 rounded-sm px-2 py-2.5 text-left hover:bg-black/[0.03]"
              onClick={() => setOpenDim(d)}
              title="Open evidence for this dimension"
            >
              <div className="truncate text-xs font-medium">{d.dimension}</div>
              <div className="space-y-1">
                <Bar value={d.traceScore} color="var(--series-trace)" />
                <Bar value={d.productScore} color="var(--series-product)" />
              </div>
              <DivergenceChip value={d.divergence} />
              <span style={{ color: 'var(--ink-muted)' }}>›</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          Median of criterion medians, 0–5 · click a row for evidence · teacher overrides take precedence.
        </p>
      </div>

      {/* ---- dimension drill-in drawer ---- */}
      <Drawer
        open={openDim !== null}
        onClose={() => setOpenDim(null)}
        title={openDim?.dimension ?? ''}
        kicker={`${openDim?.standard ?? ''} · evidence trails`}
        wide
      >
        {openDim && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Trace" value={openDim.traceScore} color="var(--series-trace)" />
              <MiniStat label="Product" value={openDim.productScore} color="var(--series-product)" />
              <div className="rounded-sm border p-2 text-center" style={{ borderColor: 'var(--gridline)' }}>
                <div className="kicker">Divergence</div>
                <div className="mt-1"><DivergenceChip value={openDim.divergence} /></div>
              </div>
            </div>
            {rubric.criteria
              .filter((c) => openDim.criterionIds.includes(c.criterionId))
              .map((c) => {
                const trace = session.scores.find((r) => r.criterionId === c.criterionId && r.channel === 'trace');
                const product = session.scores.find((r) => r.criterionId === c.criterionId && r.channel === 'product');
                return (
                  <div key={c.criterionId}>
                    <div className="mb-1.5 text-sm">
                      <span className="font-data text-xs font-semibold">{c.criterionId}</span>{' '}
                      {c.referenceability === 'weak' && (
                        <span className="rounded-sm px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--div-mid)', color: 'var(--status-serious)' }}>teacher-reserve</span>
                      )}
                      <div className="text-xs" style={{ color: 'var(--ink-secondary)' }}>{c.statement}</div>
                    </div>
                    <div className="space-y-2">
                      {trace && <EvidenceTrail record={trace} criterion={c} onUpdate={onUpdate} />}
                      {product && <EvidenceTrail record={product} criterion={c} onUpdate={onUpdate} />}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Drawer>

      {/* ---- source drawers ---- */}
      <Drawer open={source === 'essay'} onClose={() => setSource(null)} title="Final essay" kicker="channel P source" wide>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{session.essay}</div>
      </Drawer>
      <Drawer open={source === 'trace'} onClose={() => setSource(null)} title="Dialogue trace" kicker="channel T source" wide>
        <div className="space-y-3 text-sm">
          {session.trace.turns.map((t) => (
            <div key={t.turnId} className="rounded-sm p-2.5" style={{ background: t.speaker === 'student' ? 'rgba(42,120,214,0.06)' : 'var(--page)' }}>
              <div className="kicker mb-1" style={{ color: t.speaker === 'student' ? 'var(--series-trace)' : 'var(--ink-muted)' }}>
                turn {t.turnId} · {t.speaker}
              </div>
              {t.text}
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
}

function Tile({ label, value, sub, accent, signed, count }: {
  label: string;
  value: number | null;
  sub: string;
  accent: string;
  signed?: boolean;
  count?: boolean;
}) {
  const text = value === null ? '—' : count ? String(value) : `${signed && value > 0 ? '+' : ''}${value.toFixed(1)}`;
  return (
    <div className="card p-3.5">
      <div className="kicker">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-data text-2xl font-semibold" style={{ color: value === null ? 'var(--ink-muted)' : 'var(--ink-primary)' }}>{text}</span>
        {!count && value !== null && <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>/5</span>}
        <span className="ml-1 inline-block h-2 w-2 rounded-full" style={{ background: accent }} />
      </div>
      <div className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{sub}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="rounded-sm border p-2 text-center" style={{ borderColor: 'var(--gridline)' }}>
      <div className="kicker">{label}</div>
      <div className="font-data mt-1 text-lg font-semibold" style={{ color: value === null ? 'var(--ink-muted)' : color }}>
        {value === null ? 'ø' : value.toFixed(1)}
      </div>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />;
}

function Bar({ value, color }: { value: number | null; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-[2px]" style={{ background: 'var(--div-mid)' }}>
        {value !== null && (
          <div className="absolute inset-y-0 left-0 rounded-r-[3px] transition-all" style={{ width: `${(value / 5) * 100}%`, background: color }} />
        )}
      </div>
      <span className="font-data w-7 text-right text-[11px]" style={{ color: 'var(--ink-secondary)' }}>
        {value === null ? '—' : value.toFixed(1)}
      </span>
    </div>
  );
}

export function DivergenceChip({ value }: { value: number | null }) {
  if (value === null)
    return <span className="rounded-sm px-2 py-0.5 text-center text-[11px]" style={{ background: 'var(--div-mid)', color: 'var(--ink-muted)' }}>n/a</span>;
  const mag = Math.abs(value);
  const bg = mag < 1 ? 'var(--div-mid)' : value > 0 ? 'var(--div-pos)' : 'var(--div-neg)';
  const fg = mag < 1 ? 'var(--ink-secondary)' : '#ffffff';
  const arrow = mag < 1 ? '≈' : value > 0 ? '▲' : '▼';
  return (
    <span className="font-data rounded-sm px-1.5 py-0.5 text-center text-[11px] font-semibold" style={{ background: bg, color: fg }}
      title={value > 0 ? 'Product exceeds trace' : value < 0 ? 'Trace exceeds product' : 'Converged'}>
      {arrow} {value > 0 ? '+' : ''}{value.toFixed(1)}
    </span>
  );
}
