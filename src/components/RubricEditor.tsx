import { useState } from 'react';
import type { Rubric } from '../types';
import { BASE_RUBRIC } from '../data/rubric';
import { bumpVersion, clearCustomRubric, downloadJSON, saveCustomRubric } from '../lib/storage';

/** Teacher rubric adaptation (spec §8): edit level descriptors, statements, and inject
 *  guidance. Every save bumps the version so scores are traceable to the rubric that
 *  produced them; the JSON export is diffable and citable. */
export function RubricEditor({ rubric, onChange }: { rubric: Rubric; onChange: (r: Rubric) => void }) {
  const [draft, setDraft] = useState<Rubric>(() => JSON.parse(JSON.stringify(rubric)));
  const [dirty, setDirty] = useState(false);

  function mutate(update: (r: Rubric) => void) {
    setDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as Rubric;
      update(next);
      return next;
    });
    setDirty(true);
  }

  function save() {
    const next = { ...draft, version: bumpVersion(rubric.version) };
    saveCustomRubric(next);
    onChange(next);
    setDraft(next);
    setDirty(false);
  }

  function reset() {
    clearCustomRubric();
    onChange(BASE_RUBRIC);
    setDraft(JSON.parse(JSON.stringify(BASE_RUBRIC)));
    setDirty(false);
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
        <div>
          <b>{draft.rubricId}</b> · current version <b>v{rubric.version}</b>
          {dirty && <span style={{ color: 'var(--status-serious)' }}> · unsaved edits → will save as v{bumpVersion(rubric.version)}</span>}
        </div>
        <div className="ml-auto flex gap-2">
          <button className="rounded px-3 py-1.5 font-medium text-white disabled:opacity-40" style={{ background: 'var(--series-trace)' }} disabled={!dirty} onClick={save}>
            Save as new version
          </button>
          <button className="rounded border px-3 py-1.5" style={{ borderColor: 'var(--gridline)' }} onClick={() => downloadJSON(`${draft.rubricId}-v${rubric.version}.json`, rubric)}>
            Export JSON
          </button>
          <button className="rounded border px-3 py-1.5" style={{ borderColor: 'var(--gridline)' }} onClick={reset}>
            Reset to base v{BASE_RUBRIC.version}
          </button>
        </div>
        <p className="w-full text-xs" style={{ color: 'var(--ink-muted)' }}>
          Guidance below is injected verbatim into the grading prompts. Every score records the rubric version that
          produced it, so a guidance edit → re-grade → changed score is fully reproducible.
        </p>
      </div>

      <div className="card p-4">
        <label className="block text-sm">
          <span className="font-semibold">Assignment-level guidance (injected into every grading call)</span>
          <textarea
            className="mt-1 w-full rounded border p-2 text-sm"
            style={{ borderColor: 'var(--gridline)' }}
            rows={2}
            placeholder='e.g. "This assignment requires at least 2 primary sources; weight W1b-1 accordingly."'
            value={draft.assignmentGuidance ?? ''}
            onChange={(e) => mutate((r) => { r.assignmentGuidance = e.target.value; })}
          />
        </label>
      </div>

      {draft.criteria.map((c, idx) => (
        <details key={c.criterionId} className="card p-4">
          <summary className="cursor-pointer text-sm">
            <b>{c.criterionId}</b> <span style={{ color: 'var(--ink-muted)' }}>({c.standard} · {c.referenceability === 'weak' ? 'teacher-reserve' : 'auto-gradable'})</span> — {c.statement}
          </summary>
          <div className="mt-3 space-y-2 text-sm">
            <label className="block">
              <span className="text-xs font-medium">Statement (one observable behavior)</span>
              <textarea className="mt-1 w-full rounded border p-2 text-sm" style={{ borderColor: 'var(--gridline)' }} rows={2}
                value={c.statement}
                onChange={(e) => mutate((r) => { r.criteria[idx].statement = e.target.value; })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium">Criterion guidance (injected into this criterion's prompts)</span>
              <textarea className="mt-1 w-full rounded border p-2 text-sm" style={{ borderColor: 'var(--gridline)' }} rows={2}
                value={c.teacherGuidance ?? ''}
                onChange={(e) => mutate((r) => { r.criteria[idx].teacherGuidance = e.target.value; })} />
            </label>
            <div className="grid gap-2 md:grid-cols-2">
              {Object.keys(c.anchors).sort().map((level) => (
                <label key={level} className="block">
                  <span className="text-xs font-medium">Level {level}</span>
                  <textarea className="mt-1 w-full rounded border p-2 text-xs" style={{ borderColor: 'var(--gridline)' }} rows={2}
                    value={c.anchors[level]}
                    onChange={(e) => mutate((r) => { r.criteria[idx].anchors[level] = e.target.value; })} />
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={c.referenceability === 'weak'}
                onChange={(e) => mutate((r) => { r.criteria[idx].referenceability = e.target.checked ? 'weak' : 'strong'; })} />
              Teacher-reserve (LLM score advisory-only, always routed to your judgment queue)
            </label>
          </div>
        </details>
      ))}
    </div>
  );
}
