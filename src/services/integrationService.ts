// Integration Hub service layer. Nothing here talks to a real SAP or Primavera P6: messages go to the SAP / P6 stand-in
// consoles over the local bus (src/integration/bus.ts) and are logged here.
// State lives in a tiny external store so the TopBar sync pill, the hub and the Alerts feed stay in step.
import {
  P6_PROJECT,
  SEED_MESSAGES,
} from '../mocks/integrationMock';
import type { IntegrationMessage, MsgStatus } from '../types/execution';
import { publish, type BusMessage, type SystemId } from '../integration/bus';
import { delay } from './_util';

/** Send to the SAP / P6 stand-in consoles. Callers log the message in their own words. */
export function sendToSystems(msg: BusMessage) {
  publish('TURNPOINT', msg);
}

// ---------------------------------------------------------------- stand-in consoles seen on the bus

const presence: Partial<Record<SystemId, number>> = {};
const presenceListeners = new Set<() => void>();
let presenceSnapshot: Partial<Record<SystemId, number>> = {};

export function notePresence(system: SystemId) {
  presence[system] = Date.now();
  presenceSnapshot = { ...presence };
  presenceListeners.forEach((l) => l());
}
export function subscribePresence(fn: () => void) {
  presenceListeners.add(fn);
  return () => {
    presenceListeners.delete(fn);
  };
}
export const getPresence = () => presenceSnapshot;

export interface SystemHealth {
  status: 'Connected' | 'Syncing' | 'Degraded';
  lastSyncAt: number; // epoch ms, wall clock, so "x min ago" really ticks
  nextSyncMin: number;
  messagesToday: number;
  latencyMs: number;
}

export interface HubState {
  p6: SystemHealth;
  sap: SystemHealth;
  running: boolean;
  step: number;
  stepLabel: string;
  syncCount: number;
  messages: IntegrationMessage[];
  /** ids of messages that the platform can resolve without manual action */
  resolvable: string[];
  lastP6Import?: { at: number; activities: number };
}

const now = () => Date.now();

let state: HubState = {
  p6: { status: 'Connected', lastSyncAt: now() - 2 * 60_000, nextSyncMin: 13, messagesToday: 186, latencyMs: 172 },
  sap: { status: 'Connected', lastSyncAt: now() - 4 * 60_000, nextSyncMin: 11, messagesToday: 241, latencyMs: 348 },
  running: false,
  step: -1,
  stepLabel: '',
  syncCount: 0,
  messages: [...SEED_MESSAGES],
  resolvable: ['MSG-0409', 'MSG-0408'],
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<HubState>) => {
  state = { ...state, ...patch };
  emit();
};

export function subscribeHub(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getHubState(): HubState {
  return state;
}

export function relativeTime(ms: number): string {
  const s = Math.max(0, Math.round((now() - ms) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

// ---------------------------------------------------------------- message log

let msgSeq = 413;
const SCENARIO_NOW = '2026-08-16T08:'; // messages created during the demo are stamped on the scenario clock

function stamp(): string {
  const s = state.syncCount + state.messages.length;
  const mm = String(Math.min(59, 3 + (s % 55))).padStart(2, '0');
  const ss = String((s * 7) % 60).padStart(2, '0');
  return `${SCENARIO_NOW}${mm}:${ss}`;
}

export function logMessage(m: Omit<IntegrationMessage, 'id' | 'at' | 'request' | 'response'> & { request?: string; response?: string }): IntegrationMessage {
  const full: IntegrationMessage = {
    request: JSON.stringify({ object: m.object, key: m.key, direction: m.direction }, null, 2),
    response: JSON.stringify({ status: m.status === 'Delivered' ? 'OK' : m.status, latencyMs: m.latencyMs }, null, 2),
    ...m,
    id: `MSG-${String(msgSeq++).padStart(4, '0')}`,
    at: stamp(),
  };
  const bump = (h: SystemHealth): SystemHealth => ({ ...h, messagesToday: h.messagesToday + 1 });
  set({
    messages: [full, ...state.messages],
    p6: m.system === 'P6' ? bump(state.p6) : state.p6,
    sap: m.system === 'SAP' ? bump(state.sap) : state.sap,
  });
  return full;
}

/** Queue an outbound status push to SAP (scope freeze, work pack ready, MC certificate ...). Shown in the monitoring log. */
export function pushSapStatus(object: string, key: string, note?: string): IntegrationMessage {
  return logMessage({
    system: 'SAP',
    direction: 'Outbound',
    object,
    key,
    status: 'Delivered',
    latencyMs: 300 + ((key.length * 37) % 220),
    channel: 'OData V2 / OAuth 2.0 + mTLS',
    note,
  });
}

export function pushP6Progress(key: string, note?: string): IntegrationMessage {
  return logMessage({ system: 'P6', direction: 'Outbound', object: 'Activity', key, status: 'Delivered', latencyMs: 150 + ((key.length * 23) % 90), channel: 'P6 REST', note });
}

export async function getMessages(): Promise<IntegrationMessage[]> {
  return delay([...state.messages], 120);
}

export function errorQueue(messages: IntegrationMessage[]): IntegrationMessage[] {
  return messages.filter((m) => m.status === 'Failed' || m.status === 'Retrying');
}

export async function autoResolve(id: string): Promise<{ ok: boolean; message: IntegrationMessage }> {
  const target = state.messages.find((m) => m.id === id)!;
  const can = state.resolvable.includes(id);
  const status: MsgStatus = can ? 'Auto-resolved' : 'Failed';
  const note = can
    ? `${target.note ?? ''} Auto-resolved by the platform: retried with back-off and delivered, no manual intervention.`.trim()
    : `${target.note ?? ''} Escalated: this error needs a decision (mapping or constraint). Notification sent to the owning team.`.trim();
  const updated = { ...target, status, note };
  set({ messages: state.messages.map((m) => (m.id === id ? updated : m)) });
  return delay({ ok: can, message: updated }, 600);
}

export async function autoResolveAll(): Promise<{ resolved: number; escalated: number }> {
  let resolved = 0;
  let escalated = 0;
  for (const m of errorQueue(state.messages)) {
    const r = await autoResolve(m.id);
    if (r.ok) resolved += 1;
    else escalated += 1;
  }
  return { resolved, escalated };
}

// ---------------------------------------------------------------- sync now

export const SYNC_STEPS = [
  'Authenticating (OAuth 2.0 token, mTLS certificate)',
  'P6: pulling schedule changes (dates, logic, resources)',
  'P6: pushing progress, actuals and remaining duration',
  'SAP: pulling new notifications and work orders',
  'SAP: pushing order status and confirmations',
  'Reconciling field ownership and conflicts',
  'Writing sync log',
];

export async function runSync(): Promise<{ p6Msgs: number; sapMsgs: number }> {
  if (state.running) return { p6Msgs: 0, sapMsgs: 0 };
  set({ running: true, step: 0, stepLabel: SYNC_STEPS[0], p6: { ...state.p6, status: 'Syncing' }, sap: { ...state.sap, status: 'Syncing' } });
  for (let i = 0; i < SYNC_STEPS.length; i++) {
    set({ step: i, stepLabel: SYNC_STEPS[i] });
    await delay(null, 520);
    if (i === 2) pushP6Progress('CDU-1020', 'Progress 40% and remaining duration 5 d written back');
    if (i === 4) pushSapStatus('Maintenance Order status', '4000033201', 'Status REL confirmed, 3 operations confirmed');
  }
  const t = now();
  set({
    running: false,
    step: SYNC_STEPS.length,
    stepLabel: 'Complete',
    syncCount: state.syncCount + 1,
    p6: { ...state.p6, status: 'Connected', lastSyncAt: t, nextSyncMin: 15 },
    sap: { ...state.sap, status: 'Connected', lastSyncAt: t, nextSyncMin: 15 },
  });
  return { p6Msgs: 2, sapMsgs: 2 };
}

export function markP6Import(activities: number) {
  set({ lastP6Import: { at: now(), activities }, p6: { ...state.p6, lastSyncAt: now() } });
}

export function summary() {
  return { activities: P6_PROJECT.activities, relationships: P6_PROJECT.relationships };
}
