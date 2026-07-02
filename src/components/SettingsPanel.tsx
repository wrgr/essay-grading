import type { LLMConfig, Provider } from '../types';
import { PROVIDER_DEFAULTS } from '../lib/llm/client';

export function SettingsPanel({ config, onChange }: { config: LLMConfig; onChange: (c: LLMConfig) => void }) {
  const defaults = PROVIDER_DEFAULTS[config.provider];

  function setProvider(provider: Provider) {
    const d = PROVIDER_DEFAULTS[provider];
    onChange({ ...config, provider, model: d.defaultModel, advisoryModel: d.defaultAdvisory });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card space-y-4 p-4">
        <h2 className="text-sm font-semibold">LLM provider</h2>
        <div className="flex gap-2">
          {(Object.keys(PROVIDER_DEFAULTS) as Provider[]).map((p) => (
            <button
              key={p}
              className="rounded border px-3 py-1.5 text-sm"
              style={config.provider === p
                ? { borderColor: 'var(--series-trace)', outline: '1px solid var(--series-trace)', fontWeight: 600 }
                : { borderColor: 'var(--gridline)' }}
              onClick={() => setProvider(p)}
            >
              {PROVIDER_DEFAULTS[p].label}
            </button>
          ))}
        </div>

        <label className="block text-sm">
          <span className="font-medium">API key</span> <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>(stored in this browser's localStorage only; sent only to {defaults.label})</span>
          <input
            type="password"
            className="mt-1 w-full rounded border p-2 font-mono text-sm"
            style={{ borderColor: 'var(--gridline)' }}
            value={config.apiKey}
            placeholder={config.provider === 'anthropic' ? 'sk-ant-…' : config.provider === 'openai' ? 'sk-…' : 'AIza…'}
            onChange={(e) => onChange({ ...config, apiKey: e.target.value.trim() })}
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Grading model</span>
            <input
              className="mt-1 w-full rounded border p-2 font-mono text-sm"
              style={{ borderColor: 'var(--gridline)' }}
              value={config.model}
              list="model-suggestions"
              onChange={(e) => onChange({ ...config, model: e.target.value.trim() })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Advisory model</span> <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>(teacher-reserve criteria; optional)</span>
            <input
              className="mt-1 w-full rounded border p-2 font-mono text-sm"
              style={{ borderColor: 'var(--gridline)' }}
              value={config.advisoryModel ?? ''}
              list="model-suggestions"
              onChange={(e) => onChange({ ...config, advisoryModel: e.target.value.trim() || undefined })}
            />
          </label>
          <datalist id="model-suggestions">
            {defaults.models.map((m) => <option key={m} value={m} />)}
          </datalist>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Temperature</span>{' '}
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            (blank = provider default. Note: Anthropic's newest models reject a non-default temperature.)
          </span>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            className="mt-1 w-28 rounded border p-2 text-sm tabular"
            style={{ borderColor: 'var(--gridline)' }}
            value={config.temperature ?? ''}
            onChange={(e) => onChange({ ...config, temperature: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </label>
      </div>

      <details className="card p-4 text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
        <summary className="cursor-pointer text-sm font-semibold" style={{ color: 'var(--ink-primary)' }}>
          Privacy, data handling &amp; bias mitigations
        </summary>
        <p className="mt-2">
          <b>Privacy.</b> This demo is a static page: sessions, scores, overrides, rubric edits, and your API key are
          stored in this browser (localStorage) and never sent to any server we operate. The only network traffic is
          the calls this page makes directly to your selected LLM provider with your key. BYO-key mode is for demos and
          research piloting — a keyed serverless proxy is required before any classroom deployment with real student
          data (FERPA).
        </p>
        <p className="mt-2">
          <b>Bias mitigations baked into grading:</b> one criterion per call (halo prevention) · evidence-before-score
          with verbatim-quote verification · 3 passes with median + spread · quote-length caps (verbosity bias) ·
          "length is not quality" instruction · grading model is configurable independently of the model the student
          worked with (self-preference bias).
        </p>
      </details>
    </div>
  );
}
