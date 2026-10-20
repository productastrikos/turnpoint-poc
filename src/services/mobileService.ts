// Mobile field app sync queue (checklist G6 / X13). SIMULATED: the "SIM" and the network are a toggle, nothing real is sent.
import { delay } from './_util';
import { addFieldUpdate, } from './p6Service';
import { logMessage } from './integrationService';

export type QueuedKind = 'progress' | 'approval' | 'photo' | 'gps' | 'scan';

export interface QueuedAction {
  id: string;
  kind: QueuedKind;
  label: string;
  detail: string;
  at: string; // wall-clock time captured
  status: 'queued' | 'syncing' | 'synced';
  activityId?: string;
  pct?: number;
}

export interface MobileState {
  online: boolean;
  signal: 0 | 1 | 2 | 3 | 4; // SIM signal bars
  mode: 'normal' | 'low';
  queue: QueuedAction[];
  syncing: boolean;
  lastSyncAt?: string;
}

let state: MobileState = { online: true, signal: 4, mode: 'normal', queue: [], syncing: false };
let seq = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (p: Partial<MobileState>) => {
  state = { ...state, ...p };
  emit();
};

export const subscribeMobile = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const getMobileState = () => state;

const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function setConnectivity(online: boolean, mode: 'normal' | 'low' = 'normal') {
  set({ online, mode, signal: online ? (mode === 'low' ? 1 : 4) : 0 });
}

/** Record an action. If online and the signal is good it syncs straight away, otherwise it waits in the queue. */
export async function enqueue(a: Omit<QueuedAction, 'id' | 'at' | 'status'>): Promise<QueuedAction> {
  const action: QueuedAction = { ...a, id: `Q-${seq++}`, at: clock(), status: 'queued' };
  set({ queue: [action, ...state.queue] });
  if (state.online && state.mode === 'normal') await sync();
  return action;
}

export async function sync(): Promise<number> {
  if (state.syncing || !state.online) return 0;
  const todo = [...state.queue].filter((q) => q.status === 'queued').reverse();
  if (todo.length === 0) return 0;
  set({ syncing: true });
  for (const q of todo) {
    set({ queue: state.queue.map((x) => (x.id === q.id ? { ...x, status: 'syncing' } : x)) });
    await delay(null, state.mode === 'low' ? 900 : 380);
    if (q.kind === 'progress' && q.activityId && q.pct !== undefined) {
      addFieldUpdate(q.activityId, q.pct, 'You (mobile)', 'Mobile (synced after offline)');
      logMessage({ system: 'P6', direction: 'Outbound', object: 'Activity', key: q.activityId, status: 'Delivered', latencyMs: 210, channel: 'P6 REST', note: `Progress ${q.pct}% from the mobile app` });
    } else if (q.kind === 'approval') {
      logMessage({ system: 'SAP', direction: 'Outbound', object: 'Maintenance Order status', key: q.label, status: 'Delivered', latencyMs: 330, channel: 'OData V2 / OAuth 2.0 + mTLS', note: 'Approval from the mobile app applied' });
    }
    set({ queue: state.queue.map((x) => (x.id === q.id ? { ...x, status: 'synced' } : x)) });
  }
  set({ syncing: false, lastSyncAt: clock() });
  return todo.length;
}

export function clearSynced() {
  set({ queue: state.queue.filter((q) => q.status !== 'synced') });
}
