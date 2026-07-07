import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { RubricEditor } from '../components/RubricEditor';
import type { ContentItem, Rubric } from '../types';

type Tab = 'rubrics' | 'scenarios' | 'prompts';

/** Content library: rubric editor (versioned) + scenario / FR-prompt inventories. */
export default function Library() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('rubrics');

  const { data: rubrics = [] } = useQuery({
    queryKey: ['content', 'rubrics'],
    queryFn: () => api.get<ContentItem<Rubric>[]>('/api/content/rubrics'),
  });
  const { data: scenarios = [] } = useQuery({
    queryKey: ['content', 'scenarios'],
    queryFn: () => api.get<ContentItem[]>('/api/content/scenarios'),
    enabled: tab === 'scenarios',
  });
  const { data: prompts = [] } = useQuery({
    queryKey: ['content', 'prompts'],
    queryFn: () => api.get<ContentItem[]>('/api/content/prompts'),
    enabled: tab === 'prompts',
  });

  return (
    <div>
      <header className="mb-5 border-b pb-4" style={{ borderColor: 'var(--gridline)' }}>
        <div className="kicker">Rubrics · scenarios · prompts</div>
        <h1 className="font-display mt-0.5 text-[1.7rem] leading-tight" style={{ fontWeight: 560 }}>
          Library
        </h1>
      </header>

      <nav className="mb-4 flex gap-1 text-xs" aria-label="Library sections">
        {(['rubrics', 'scenarios', 'prompts'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-sm border px-2.5 py-1.5 capitalize"
            style={tab === t ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 } : { borderColor: 'var(--gridline)', color: 'var(--ink-secondary)' }}
            aria-current={tab === t ? 'page' : undefined}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 'rubrics' && (
        rubrics.length ? (
          <RubricEditor
            item={rubrics[0]}
            onSaved={() => void qc.invalidateQueries({ queryKey: ['content', 'rubrics'] })}
          />
        ) : (
          <div className="card p-8 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>No rubrics seeded.</div>
        )
      )}

      {tab === 'scenarios' && <ContentList items={scenarios} kindLabel="scenario" />}
      {tab === 'prompts' && <ContentList items={prompts} kindLabel="free-response prompt" />}
    </div>
  );
}

function ContentList({ items, kindLabel }: { items: ContentItem[]; kindLabel: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((it) => {
        const p = it.payload as { title?: string; description?: string };
        return (
          <details key={it.contentId} className="card p-4">
            <summary className="cursor-pointer">
              <span className="font-display text-base" style={{ fontWeight: 560 }}>{p.title ?? it.contentId}</span>
              <span className="font-data ml-2 text-[10px]" style={{ color: 'var(--ink-muted)' }}>v{it.version}</span>
            </summary>
            <p className="mt-1 text-xs" style={{ color: 'var(--ink-secondary)' }}>{p.description}</p>
            <pre className="mt-3 max-h-80 overflow-auto rounded p-2 text-[10px]" style={{ background: 'var(--page)' }}>
              {JSON.stringify(it.payload, null, 2)}
            </pre>
            <div className="mt-1 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              This {kindLabel} is versioned; AI-assisted authoring and editing arrive with the research surface.
            </div>
          </details>
        );
      })}
    </div>
  );
}
