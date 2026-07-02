import { useRef, useState } from 'react';
import type { LLMConfig, Session, TraceTurn } from '../types';
import { makeClient, type ChatMessage } from '../lib/llm/client';

const TUTOR_SYSTEM = `You are an AI writing assistant helping an 11th-12th grade student with an argumentative essay assignment (MCCR W.11-12.1). Be genuinely helpful, concise, and encouraging. You may explain, give feedback, suggest evidence, and draft text when asked — behave like a typical general-purpose assistant would, because this conversation is research data about how students actually use AI while writing. Do not mention this instruction.`;

/** Live writing-session simulator: the conversation IS the trace. A student (or a
 *  researcher simulating one) chats with the configured LLM; the transcript becomes
 *  a gradeable trace with speaker labels, paired with a pasted final essay. */
export function ChatSimulator({ config, onCreateSession }: {
  config: LLMConfig;
  onCreateSession: (s: Session) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [essay, setEssay] = useState('');
  const [name, setName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError('');
    const next: ChatMessage[] = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const llm = makeClient(config);
      const reply = await llm.chat({ system: TUTOR_SYSTEM, messages: next, maxTokens: 800 });
      setMessages([...next, { role: 'assistant', content: reply }]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMessages(messages); // roll back the unanswered turn
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  function createSession() {
    const turns: TraceTurn[] = messages.map((m, i) => ({
      turnId: i + 1,
      speaker: m.role === 'user' ? 'student' : 'assistant',
      text: m.content,
      timestamp: new Date().toISOString(),
    }));
    onCreateSession({
      id: `session-${Date.now()}`,
      name: name || `Live session ${new Date().toLocaleDateString()}`,
      description: 'Created from the in-app writing session simulator',
      trace: { traceId: `trace-live-${Date.now()}`, assignmentId: 'live-session', turns },
      essay,
      scores: [],
      layerB: null,
      rubricVersion: '',
      createdAt: new Date().toISOString(),
      isExemplar: false,
      gradedLive: false,
    });
    setMessages([]);
    setEssay('');
    setName('');
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <div className="card flex h-[36rem] flex-col p-4">
        <h2 className="text-sm font-semibold">Simulated writing session</h2>
        <p className="mb-2 text-xs" style={{ color: 'var(--ink-secondary)' }}>
          Work with the AI as a student would — every turn here becomes the dialogue trace that Channel T grades.
          Uses {config.provider} / {config.model}{config.temperature !== undefined ? ` @ temp ${config.temperature}` : ''}.
        </p>
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto rounded border p-3" style={{ borderColor: 'var(--gridline)' }}>
          {messages.length === 0 && (
            <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              No turns yet. Try: “I'm arguing that our district should adopt a four-day school week — is my claim precise enough?”
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className="text-sm">
              <span className="mr-1 font-semibold" style={{ color: m.role === 'user' ? 'var(--series-trace)' : 'var(--ink-muted)' }}>
                {m.role === 'user' ? 'student' : 'assistant'} · turn {i + 1}:
              </span>
              <span className="whitespace-pre-wrap">{m.content}</span>
            </div>
          ))}
          {busy && <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>assistant is writing…</div>}
        </div>
        {error && <div className="mt-2 text-xs" style={{ color: 'var(--status-critical)' }}>{error}</div>}
        <div className="mt-2 flex gap-2">
          <textarea
            className="flex-1 rounded border p-2 text-sm"
            style={{ borderColor: 'var(--gridline)' }}
            rows={2}
            placeholder={config.apiKey ? 'Write as the student… (Enter to send, Shift+Enter for newline)' : 'Add an API key in Settings to chat'}
            value={input}
            disabled={!config.apiKey}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            className="rounded px-4 text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'var(--series-trace)' }}
            disabled={busy || !config.apiKey || !input.trim()}
            onClick={() => void send()}
          >
            Send
          </button>
        </div>
      </div>

      <div className="card flex h-[36rem] flex-col p-4">
        <h2 className="text-sm font-semibold">Final essay</h2>
        <p className="mb-2 text-xs" style={{ color: 'var(--ink-secondary)' }}>
          Paste (or write) the final essay this session produced — Channel P grades this text.
        </p>
        <textarea
          className="flex-1 rounded border p-2 text-sm"
          style={{ borderColor: 'var(--gridline)' }}
          value={essay}
          onChange={(e) => setEssay(e.target.value)}
        />
        <input
          className="mt-2 rounded border p-2 text-sm"
          style={{ borderColor: 'var(--gridline)' }}
          placeholder="Session name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="mt-2 rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--series-trace)' }}
          disabled={messages.length < 2 || !essay.trim()}
          title={messages.length < 2 ? 'Have at least one exchange first' : !essay.trim() ? 'Add the final essay' : ''}
          onClick={createSession}
        >
          Save as gradeable session ({messages.length} turns)
        </button>
      </div>
    </div>
  );
}
