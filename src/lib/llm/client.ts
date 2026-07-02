import Anthropic from '@anthropic-ai/sdk';
import type { LLMConfig, Provider } from '../../types';

export interface CompleteRequest {
  system: string;
  prompt: string;
  schema: Record<string, unknown>; // JSON schema the response must satisfy
  maxTokens?: number;
  useAdvisoryModel?: boolean; // weak-referenceability criteria → stronger model if configured
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

export interface LLMClient {
  completeJSON(req: CompleteRequest): Promise<unknown>;
  /** Plain multi-turn chat — used by the in-app writing-session simulator. */
  chat(req: ChatRequest): Promise<string>;
}

export const PROVIDER_DEFAULTS: Record<Provider, { label: string; models: string[]; defaultModel: string; defaultAdvisory: string }> = {
  anthropic: {
    label: 'Anthropic (Claude)',
    models: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'],
    defaultModel: 'claude-opus-4-8',
    defaultAdvisory: 'claude-opus-4-8',
  },
  openai: {
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    defaultModel: 'gpt-4o',
    defaultAdvisory: 'gpt-4o',
  },
  gemini: {
    label: 'Google (Gemini)',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    defaultModel: 'gemini-1.5-pro',
    defaultAdvisory: 'gemini-1.5-pro',
  },
};

/** Extract the first JSON object from a text response (fallback when the provider
 *  cannot enforce a schema server-side). */
export function extractJSON(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fall through */
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error('Model response contained no parseable JSON');
}

class AnthropicClient implements LLMClient {
  private client: Anthropic;
  constructor(private cfg: LLMConfig) {
    this.client = new Anthropic({
      apiKey: cfg.apiKey,
      dangerouslyAllowBrowser: true, // BYO-key demo: key lives in the user's browser only
    });
  }

  async completeJSON(req: CompleteRequest): Promise<unknown> {
    const model = (req.useAdvisoryModel && this.cfg.advisoryModel) || this.cfg.model;
    const response = await this.client.messages.create({
      model,
      max_tokens: req.maxTokens ?? 4096,
      system: req.system,
      messages: [{ role: 'user', content: req.prompt }],
      output_config: { format: { type: 'json_schema', schema: req.schema } },
      // Newest Anthropic models (Opus 4.7+, Sonnet 5) reject sampling params; only
      // pass temperature when the user set one and let the API error surface if not.
      ...(this.cfg.temperature !== undefined ? { temperature: this.cfg.temperature } : {}),
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return extractJSON(text);
  }

  async chat(req: ChatRequest): Promise<string> {
    const response = await this.client.messages.create({
      model: this.cfg.model,
      max_tokens: req.maxTokens ?? 1024,
      system: req.system,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      ...(this.cfg.temperature !== undefined ? { temperature: this.cfg.temperature } : {}),
    });
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }
}

class OpenAIClient implements LLMClient {
  constructor(private cfg: LLMConfig) {}

  async completeJSON(req: CompleteRequest): Promise<unknown> {
    const model = (req.useAdvisoryModel && this.cfg.advisoryModel) || this.cfg.model;
    const body: Record<string, unknown> = {
      model,
      max_tokens: req.maxTokens ?? 4096,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'grading_output', strict: false, schema: req.schema },
      },
    };
    if (this.cfg.temperature !== undefined) body.temperature = this.cfg.temperature;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return extractJSON(data.choices[0].message.content);
  }

  async chat(req: ChatRequest): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.cfg.model,
      max_tokens: req.maxTokens ?? 1024,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
    };
    if (this.cfg.temperature !== undefined) body.temperature = this.cfg.temperature;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content as string;
  }
}

class GeminiClient implements LLMClient {
  constructor(private cfg: LLMConfig) {}

  async completeJSON(req: CompleteRequest): Promise<unknown> {
    const model = (req.useAdvisoryModel && this.cfg.advisoryModel) || this.cfg.model;
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: req.maxTokens ?? 4096,
      responseMimeType: 'application/json',
    };
    if (this.cfg.temperature !== undefined) generationConfig.temperature = this.cfg.temperature;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.cfg.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
          generationConfig,
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    return extractJSON(text);
  }

  async chat(req: ChatRequest): Promise<string> {
    const generationConfig: Record<string, unknown> = { maxOutputTokens: req.maxTokens ?? 1024 };
    if (this.cfg.temperature !== undefined) generationConfig.temperature = this.cfg.temperature;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.cfg.model}:generateContent?key=${this.cfg.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: req.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          generationConfig,
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  }
}

export function makeClient(cfg: LLMConfig): LLMClient {
  if (!cfg.apiKey) throw new Error('No API key configured. Add one in Settings to run live grading.');
  switch (cfg.provider) {
    case 'anthropic':
      return new AnthropicClient(cfg);
    case 'openai':
      return new OpenAIClient(cfg);
    case 'gemini':
      return new GeminiClient(cfg);
  }
}
