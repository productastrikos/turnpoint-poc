// Conversation state for the assistant, shared by the header chat panel and AI > Assistant.
// Uses Claude (agent.ts) when the relay has an API key, otherwise the on-device engine (offline.ts).
// The conversation resets when the viewer's role changes, so a contractor never inherits staff answers.
import { useCallback, useEffect, useRef, useState } from 'react';
import type Anthropic from '@anthropic-ai/sdk';
import { useRole } from '../../app/RoleContext';
import { runAgent, type AgentStep } from './agent';
import { answerOffline } from './offline';
import { API_URL } from '../../config';

export type Engine = 'llm' | 'on-device';

export interface ChatMsg {
  id: number;
  from: 'user' | 'bot';
  text: string;
  pages?: { to: string; label: string }[];
  steps?: AgentStep[];
  engine?: Engine;
  note?: string;
  pending?: boolean;
}

interface RelayStatus {
  anthropic: boolean;
  model: string;
  sap: boolean;
}

let statusCache: Promise<RelayStatus | null> | null = null;
/** Asks the local relay which services are configured (never the keys). Cached for the page lifetime. */
export function relayStatus(): Promise<RelayStatus | null> {
  statusCache ??= fetch(`${API_URL}/api/relay/status`)
    .then((r) => (r.ok ? (r.json() as Promise<RelayStatus>) : null))
    .catch(() => null);
  return statusCache;
}

export const PROMPTS = [
  "What's blocking CP2 right now?",
  'How many times has the critical path changed?',
  'What are the chances we finish on the schedule forecast?',
  'Are there any duplicate scope items?',
  'Are we over budget?',
  "What should I look at before tomorrow's planning meeting?",
];

export const WELCOME =
  'Hi, I am the TURNPOINT assistant. Ask about the critical path, finish-date risk, scope and duplicates, budget, readiness, materials, safety or the SAP / P6 links. I read the same data as the screens.';

export function useAssistant() {
  const { role, persona } = useRole();
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState<Engine | null>(null);
  const history = useRef<Anthropic.Beta.BetaMessageParam[]>([]);
  const abort = useRef<AbortController | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    void relayStatus().then((s) => setEngine(s?.anthropic ? 'llm' : 'on-device'));
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    history.current = [];
    setMsgs([]);
    setBusy(false);
  }, []);

  // new viewer, new conversation
  useEffect(() => {
    reset();
  }, [role, persona.id, reset]);

  const patch = (id: number, p: Partial<ChatMsg>) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      const botId = ++seq.current + 1;
      seq.current = botId;
      setMsgs((m) => [...m, { id: botId - 1, from: 'user', text: q }, { id: botId, from: 'bot', text: '', pending: true, steps: [] }]);
      setBusy(true);
      const ctx = { role, persona: `${persona.person}, ${persona.label} (${persona.org})` };
      const status = await relayStatus();
      const ac = new AbortController();
      abort.current = ac;
      try {
        if (status?.anthropic) {
          let acc = '';
          const steps: AgentStep[] = [];
          const out = await runAgent(
            history.current,
            q,
            ctx,
            {
              onText: (d) => {
                acc += d;
                patch(botId, { text: acc, engine: 'llm' });
              },
              onStep: (s) => {
                steps.push(s);
                patch(botId, { steps: [...steps], engine: 'llm' });
              },
            },
            ac.signal
          );
          history.current = out.history;
          patch(botId, {
            text: out.refused ? out.text || 'That request was declined by the model.' : out.text || 'I could not produce an answer. Try rephrasing.',
            pages: out.pages,
            steps: out.steps,
            engine: 'llm',
            note: out.servedBy ? `Answered by fallback model ${out.servedBy} after a refusal.` : out.refused ? 'The model refused this request.' : undefined,
            pending: false,
          });
        } else {
          const ans = await answerOffline(q, ctx);
          patch(botId, { text: ans.text, pages: ans.pages, steps: ans.steps, engine: 'on-device', pending: false });
        }
      } catch (err) {
        if (ac.signal.aborted) {
          patch(botId, { pending: false, note: 'Stopped.' });
        } else {
          // the model path failed (offline, key rejected, rate limit): answer on-device so the demo never dead-ends
          try {
            const ans = await answerOffline(q, ctx);
            patch(botId, {
              text: ans.text,
              pages: ans.pages,
              steps: ans.steps,
              engine: 'on-device',
              note: `Language model unavailable (${err instanceof Error ? err.message.slice(0, 90) : 'error'}), answered on-device.`,
              pending: false,
            });
          } catch {
            patch(botId, { text: 'Something went wrong reading the data. Try again.', pending: false });
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, role, persona]
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  return { msgs, busy, engine, ask, stop, reset };
}
