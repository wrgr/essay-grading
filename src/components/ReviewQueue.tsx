import { useState } from 'react';
import type { Rubric, ScoreRecord, Session } from '../types';
import { EvidenceTrail } from './EvidenceTrail';
import { Drawer } from './Drawer';

/** "Needs your judgment" queue (spec §8): compact rows; click to drill into the
 *  advisory read and record an authoritative score. */
export function ReviewQueue({ session, rubric, onUpdate }: {
  session: Session;
  rubric: Rubric;
  onUpdate: (update: (s: Session) => Session) => void;
}) {
  const pending = session.scores.filter((r) => r.needsReview && !r.teacherOverride);
  const resolved = session.scores.filter((r) => r.needsReview && r.teacherOverride);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const open = pending.concat(resolved).find((r) => `${r.criterionId}|${r.channel}` === openKey) ?? null;
  const openCriterion = open ? rubric.criteria.find((c) => c.criterionId === open.criterionId) : null;

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm" style={{ color: 'var(--ink-secondary)' }}>
        Routed here by design: teacher-reserve criteria and high inter-pass spread. The LLM read is advisory — your
        score is authoritative and becomes labeled calibration data.
      </p>

      {pending.length === 0 ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          Nothing waiting — all routed items have been resolved.
        </div>
      ) : (
        <div className="card divide-y" style={{ borderColor: 'var(--gridline)' }}>
          {pending.map((r) => (
            <QueueRow key={`${r.criterionId}|${r.channel}`} r={r} rubric={rubric} onOpen={() => setOpenKey(`${r.criterionId}|${r.channel}`)} />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Resolved ({resolved.length})</summary>
          <div className="mt-2 divide-y" style={{ borderColor: 'var(--gridline)' }}>
            {resolved.map((r) => (
              <button
                key={`${r.criterionId}|${r.channel}`}
                className="flex w-full items-center gap-3 py-2 text-left text-xs hover:bg-black/[0.02]"
                onClick={() => setOpenKey(`${r.criterionId}|${r.channel}`)}
              >
                <span className="font-data font-semibold">{r.criterionId}</span>
                <span className="kicker">{r.channel}</span>
                <span style={{ color: 'var(--ink-secondary)' }}>
                  teacher {r.teacherOverride!.score}/5{r.median !== null && ` · advisory ${r.median}`}
                </span>
                <span className="ml-auto" style={{ color: 'var(--ink-muted)' }}>›</span>
              </button>
            ))}
          </div>
        </details>
      )}

      <Drawer
        open={open !== null}
        onClose={() => setOpenKey(null)}
        title={openCriterion ? openCriterion.statement : ''}
        kicker={open ? `${open.criterionId} · ${open.channel} channel · ${openCriterion?.standard ?? ''}` : ''}
        wide
      >
        {open && openCriterion && <EvidenceTrail record={open} criterion={openCriterion} onUpdate={onUpdate} startOpen />}
      </Drawer>
    </div>
  );
}

function QueueRow({ r, rubric, onOpen }: { r: ScoreRecord; rubric: Rubric; onOpen: () => void }) {
  const c = rubric.criteria.find((x) => x.criterionId === r.criterionId);
  if (!c) return null;
  return (
    <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02]" onClick={onOpen}>
      <span className="font-data shrink-0 text-xs font-semibold">{r.criterionId}</span>
      <span className="kicker shrink-0" style={{ color: r.channel === 'trace' ? 'var(--series-trace)' : 'var(--series-product)' }}>
        {r.channel}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs" style={{ color: 'var(--ink-secondary)' }} title={c.statement}>
        {c.statement}
      </span>
      <span className="hidden shrink-0 gap-1 md:flex">
        {r.reviewReasons.map((reason, i) => (
          <span key={i} className="rounded-sm px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--div-mid)', color: 'var(--status-serious)' }}
            title={reason}>
            {reason.startsWith('Teacher-reserve') ? 'reserve' : reason.startsWith('High inter-pass') ? 'high spread' : 'thin evidence'}
          </span>
        ))}
      </span>
      <span className="font-data shrink-0 text-xs" style={{ color: 'var(--ink-secondary)' }}>
        {r.noEvidence ? 'ø' : `${r.median}/5`}
      </span>
      <span style={{ color: 'var(--ink-muted)' }}>›</span>
    </button>
  );
}
