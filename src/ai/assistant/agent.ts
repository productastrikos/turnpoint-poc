// The live assistant: Claude with tool use, streamed. The browser runs the tool loop (the tools read the in-browser
// services) and talks to the relay (vite-relay.ts locally, server/index.mjs when deployed), which adds the API key server-side, so no key is ever
// shipped to the page. Server-side refusal fallback is on ("default" routing).
import Anthropic from '@anthropic-ai/sdk';
import { runTool, TOOL_DEFS, TOOL_LABEL, type ToolContext } from './tools';
import { API_URL } from '../../config';

export const ASSISTANT_MODEL = 'claude-opus-5-5';
const MAX_TURNS = 8;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  // The key placeholder never leaves the relay boundary: the relay drops it and sets the real key.
  client ??= new Anthropic({ apiKey: 'set-by-local-relay', baseURL: `${API_URL}/api/anthropic`, dangerouslyAllowBrowser: true, maxRetries: 1 });
  return client;
}

const SYSTEM = `You are the TURNPOINT assistant inside a turnaround (STO) management platform for OQ RPI's Sohar Refinery, Major STO 2026. The data date is 16 Aug 2026, TA day 14 of 32; the baseline end is 3 Sep 2026. Your users are turnaround managers, planners, engineers and executives.

Read the live data with the tools before you state a number, date, ID or status, and never make figures up. If the tools do not cover a question, say what you can and cannot see.

Lead with the answer in one or two sentences, then at most four short bullet points with the specifics (IDs, dates, numbers, owners). Stay under 120 words unless the user asks for more. Use the platform's terms: CP1/CP2/CP3, SCF, MOC, discovery job, NCR, gate 1/2/3, P50/P90.

When asked what to do, use the risk model's recommended actions and give their modelled effect. If a tool marks a value as restricted for the user's role, say it is restricted and do not estimate it. This is a demonstration dataset and the SAP / P6 connections are demo stand-ins; say so if asked whether the data is live.`;

export interface AgentStep {
  tool: string;
  label: string;
  ok: boolean;
}

export interface AgentCallbacks {
  onText: (delta: string) => void;
  onStep: (step: AgentStep) => void;
}

export interface AgentOutcome {
  text: string;
  pages: { to: string; label: string }[];
  steps: AgentStep[];
  refused: boolean;
  /** A fallback model answered after a refusal on the primary model. */
  servedBy?: string;
  history: Anthropic.Beta.BetaMessageParam[];
}

export async function runAgent(
  history: Anthropic.Beta.BetaMessageParam[],
  question: string,
  ctx: ToolContext & { persona: string },
  cb: AgentCallbacks,
  signal?: AbortSignal
): Promise<AgentOutcome> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history, { role: 'user', content: question }];
  const pages = new Map<string, { to: string; label: string }>();
  const steps: AgentStep[] = [];
  let text = '';
  let servedBy: string | undefined;
  // the viewer's role lives in the system prompt (stable per persona, so it caches); the tools enforce it regardless
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: SYSTEM },
    { type: 'text', text: `Viewer: ${ctx.persona}${ctx.role === 'contractor' ? ' (contractor: cost figures are withheld by the tools)' : ' (OQ staff)'}.` },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = getClient().beta.messages.stream(
      {
        model: ASSISTANT_MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' }, // chat: short, few consolidated tool calls
        cache_control: { type: 'ephemeral' },
        system,
        tools: TOOL_DEFS,
        messages,
      },
      { signal }
    );
    stream.on('text', (delta) => {
      text += delta;
      cb.onText(delta);
    });
    const message = await stream.finalMessage();
    if (message.content.some((b) => b.type === 'fallback')) servedBy = message.model;
    // keep the full content (thinking and fallback blocks included) so the next turn replays it unchanged
    messages.push({ role: 'assistant', content: message.content });

    if (message.stop_reason === 'refusal') return { text, pages: [...pages.values()], steps, refused: true, servedBy, history: messages };
    if (message.stop_reason === 'pause_turn') continue;
    const uses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (uses.length === 0) break; // end_turn, or a text answer cut at max_tokens
    if (message.stop_reason === 'max_tokens') throw new Error('The answer was cut off while calling a tool. Ask again in a narrower way.');

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
      uses.map(async (u) => {
        const label = TOOL_LABEL[u.name] ?? u.name;
        try {
          const r = await runTool(u.name, u.input, ctx);
          pages.set(r.page.to, r.page);
          const step = { tool: u.name, label, ok: true };
          steps.push(step);
          cb.onStep(step);
          return { type: 'tool_result' as const, tool_use_id: u.id, content: JSON.stringify(r.data) };
        } catch (err) {
          const step = { tool: u.name, label, ok: false };
          steps.push(step);
          cb.onStep(step);
          return { type: 'tool_result' as const, tool_use_id: u.id, is_error: true, content: err instanceof Error ? err.message : 'Tool failed' };
        }
      })
    );
    messages.push({ role: 'user', content: results });
  }
  return { text, pages: [...pages.values()], steps, refused: false, servedBy, history: messages };
}
