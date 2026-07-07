import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth';
import type { User } from '../auth';

interface ProviderInfo {
  name: string;
  defaultModel: string;
  models: string[];
}

export default function Settings() {
  const { user, refresh } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get<{ providers: ProviderInfo[]; default: string }>('/api/providers'),
  });

  const [provider, setProvider] = useState(user?.preferredProvider ?? '');
  const [model, setModel] = useState(user?.preferredModel ?? '');
  const [saved, setSaved] = useState(false);

  const providers = data?.providers ?? [];
  const selected = providers.find((p) => p.name === (provider || data?.default));

  async function save() {
    await api.put<User>('/api/auth/prefs', {
      preferred_provider: provider || data?.default || '',
      preferred_model: model || selected?.defaultModel || '',
    });
    await refresh();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <header className="mb-5 border-b pb-4" style={{ borderColor: 'var(--gridline)' }}>
        <div className="kicker">Provider · model · account</div>
        <h1 className="font-display mt-0.5 text-[1.7rem] leading-tight" style={{ fontWeight: 560 }}>
          Settings
        </h1>
      </header>

      <div className="card max-w-xl p-5">
        <div className="panel-title">LLM grading preferences</div>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          API keys are configured on the server by an administrator and never leave it. Only
          providers with a configured key appear here. With no provider configured, scoring
          falls back to deterministic keyword matching.
        </p>

        {isLoading && (
          <div className="mt-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
            Loading providers…
          </div>
        )}

        {!isLoading && providers.length === 0 && (
          <div className="mt-4 border-l-2 p-3 text-sm" style={{ borderLeftColor: 'var(--status-warning)' }}>
            No LLM provider is configured on the server. The platform runs in keyword-fallback
            scoring mode. Add a key to <span className="font-data">.env</span> and restart to
            enable live LLM grading.
          </div>
        )}

        {providers.length > 0 && (
          <>
            <label className="mt-4 block text-xs font-semibold" htmlFor="pref-provider">
              Provider
            </label>
            <select
              id="pref-provider"
              className="mt-1 w-full rounded-sm border p-2 text-sm"
              style={{ borderColor: 'var(--gridline)', background: 'var(--surface-1)' }}
              value={provider || data?.default || ''}
              onChange={(e) => {
                setProvider(e.target.value);
                setModel('');
              }}
            >
              {providers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>

            <label className="mt-3 block text-xs font-semibold" htmlFor="pref-model">
              Model
            </label>
            <select
              id="pref-model"
              className="mt-1 w-full rounded-sm border p-2 text-sm"
              style={{ borderColor: 'var(--gridline)', background: 'var(--surface-1)' }}
              value={model || selected?.defaultModel || ''}
              onChange={(e) => setModel(e.target.value)}
            >
              {(selected?.models ?? []).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <button
              onClick={() => void save()}
              className="mt-5 rounded-sm px-4 py-2 text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              {saved ? 'Saved ✓' : 'Save preferences'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
