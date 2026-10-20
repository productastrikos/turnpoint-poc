import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../app/icons';
import { SimBadge } from '../../components/ui/SimBadge';
import { PROMPTS, useAssistant, WELCOME, type ChatMsg, type Engine } from './useAssistant';

/** **bold** and "- " bullets are all the answers use. */
function Rich({ text }: { text: string }) {
  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
  const lines = text.split('\n');
  return (
    <>
      {lines.map((l, i) =>
        l.startsWith('- ') ? (
          <div key={i} className="chat-li">
            <span aria-hidden>•</span>
            <span>{inline(l.slice(2))}</span>
          </div>
        ) : (
          <div key={i}>{l ? inline(l) : <br />}</div>
        )
      )}
    </>
  );
}

function EngineBadge({ engine }: { engine: Engine | null }) {
  if (!engine) return null;
  return engine === 'llm' ? (
    <SimBadge kind="llm" />
  ) : (
    <SimBadge kind="ondevice" title="No language-model key is configured, so answers are composed on this device from the same live tool data. Add ANTHROPIC_API_KEY to .env.local for open questions." />
  );
}

function Bubble({ m, onNavigate }: { m: ChatMsg; onNavigate: (to: string) => void }) {
  if (m.from === 'user') return <div className="bubble-user">{m.text}</div>;
  return (
    <div className="bubble-bot chat-bot">
      {m.steps && m.steps.length > 0 && (
        <div className="chat-steps" aria-label="Data read">
          {m.steps.map((s, i) => (
            <span key={i} className={`chat-step ${s.ok ? '' : 'bad'}`}>
              ✓ {s.label}
            </span>
          ))}
        </div>
      )}
      {m.text ? <Rich text={m.text} /> : m.pending ? <span className="muted">Reading live data…</span> : null}
      {m.note && <div className="chat-note">{m.note}</div>}
      {!m.pending && m.pages && m.pages.length > 0 && (
        <div className="chat-pages">
          {m.pages.slice(0, 3).map((p) => (
            <button key={p.to} className="btn btn-sm" onClick={() => onNavigate(p.to)}>
              {p.label} →
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AssistantChat({
  onNavigate,
  minHeight,
  className,
}: {
  onNavigate?: () => void;
  minHeight?: number;
  className?: string;
}) {
  const { msgs, busy, engine, ask, stop, reset } = useAssistant();
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [msgs]);

  const go = (to: string) => {
    navigate(to);
    onNavigate?.();
  };
  const send = (t: string) => {
    setDraft('');
    void ask(t);
  };

  return (
    <div className={`chat-body ${className ?? ''}`}>
      <div className="chat-engine">
        <EngineBadge engine={engine} />
        <span className="small muted">{engine === 'llm' ? 'Claude reads live data through tools' : 'On-device answers from live data'}</span>
        {msgs.length > 0 && (
          <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={reset}>
            New conversation
          </button>
        )}
      </div>
      <div className="chat-log" ref={logRef} style={minHeight ? { minHeight } : undefined}>
        <div className="bubble-bot">{WELCOME}</div>
        {msgs.map((m) => (
          <Bubble key={m.id} m={m} onNavigate={go} />
        ))}
      </div>
      {msgs.length === 0 && (
        <div className="chat-suggest">
          {PROMPTS.map((p) => (
            <button key={p} className="fchip" onClick={() => send(p)} disabled={busy}>
              {p}
            </button>
          ))}
        </div>
      )}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <input type="text" placeholder="Ask a question…" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Ask the assistant" />
        {busy ? (
          <button className="btn" type="button" onClick={stop}>
            Stop
          </button>
        ) : (
          <button className="btn btn-primary" type="submit">
            <Icon name="send" size={14} /> Send
          </button>
        )}
      </form>
    </div>
  );
}
