import type { Rubric, Session } from '../types';
import { EvidenceTrail } from './EvidenceTrail';

/** "Needs your judgment" queue (spec §8): teacher-reserve criteria and high-spread /
 *  low-confidence scores, pre-populated with the LLM's advisory read. */
export function ReviewQueue({ session, rubric, onUpdate }: {
  session: Session;
  rubric: Rubric;
  onUpdate: (update: (s: Session) => Session) => void;
}) {
  const pending = session.scores.filter((r) => r.needsReview && !r.teacherOverride);
  const resolved = session.scores.filter((r) => r.needsReview && r.teacherOverride);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="text-sm font-semibold">Needs your judgment ({pending.length})</h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--ink-secondary)' }}>
          Routed here by design: teacher-reserve criteria (holistic judgments the validity literature says LLMs score
          poorly), high inter-pass spread (usually rubric ambiguity, not a sampling problem), and single-evidence
          scores. The LLM read is advisory; your score is authoritative and is captured as labeled calibration data.
        </p>
      </div>

      {pending.length === 0 && (
        <div className="card p-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          Nothing waiting — all routed items have been resolved.
        </div>
      )}

      {pending.map((r) => {
        const c = rubric.criteria.find((x) => x.criterionId === r.criterionId);
        if (!c) return null;
        return (
          <div key={`${r.criterionId}-${r.channel}`} className="card p-3">
            <div className="mb-1 text-sm">
              <b>{c.criterionId}</b> <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>({c.standard})</span>
              <div className="text-xs" style={{ color: 'var(--ink-secondary)' }}>{c.statement}</div>
            </div>
            <EvidenceTrail record={r} criterion={c} onUpdate={onUpdate} />
          </div>
        );
      })}

      {resolved.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold">Resolved ({resolved.length})</h3>
          <ul className="mt-2 space-y-1 text-xs" style={{ color: 'var(--ink-secondary)' }}>
            {resolved.map((r) => (
              <li key={`${r.criterionId}-${r.channel}`}>
                <b>{r.criterionId}</b> · {r.channel} — teacher score {r.teacherOverride!.score}/5
                {r.median !== null && <> (LLM advisory: {r.median})</>} — “{r.teacherOverride!.rationale}”
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
