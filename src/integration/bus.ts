// Local integration bus between TURNPOINT and the SAP / Primavera P6 stand-in consoles (/ext/sap, /ext/p6).
// A BroadcastChannel: every tab, window and iframe of this app on the same machine sees every message, nothing leaves
// the browser. Payloads use the field names the real interfaces carry (SAP OData API_MAINTENANCEORDER /
// API_MAINTNOTIFICATION, P6 TASK fields), so the console screens and the message log read like the real thing.
import type { Discipline } from '../types';

export type SystemId = 'TURNPOINT' | 'SAP' | 'P6';

// ---------------------------------------------------------------- payloads

export interface SapNotification {
  MaintenanceNotification: string;
  NotificationText: string;
  NotificationType: 'M1' | 'M2';
  MaintPriority: '1' | '2' | '3' | '4';
  TechnicalObject: string; // equipment
  FunctionalLocation: string;
  ReportedByUser: string;
  CreationDate: string;
  NotifProcessingPhaseDesc: string; // Outstanding, In process, Completed
  // TURNPOINT extension fields (custom fields on the notification, populated by the planner)
  ZZ_Discipline: Discipline;
  ZZ_Area: string;
  ZZ_EstCostOMR: number;
  ZZ_Manhours: number;
  ZZ_TurnpointRef?: string;
}

export interface SapOrder {
  MaintenanceOrder: string;
  MaintenanceOrderDesc: string;
  MaintenanceOrderType: string;
  Equipment: string;
  FunctionalLocation: string;
  MaintPriority: '1' | '2' | '3' | '4';
  SystemStatusText: string; // CRTD, REL, TECO ...
  UserStatusText: string; // APRV, SFRZ, DUPL ...
  MaintenancePlannerGroup: string;
  WBSElement: string;
  PlannedCostOMR: number;
  MaintenanceNotification?: string;
  LastChangedBy: string;
  LastChangeDateTime: string;
  ZZ_TurnpointRef?: string;
}

export interface FieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface P6ActivityChange {
  activityId: string; // P6 Activity ID
  tpId?: string; // TURNPOINT activity id (CPA-xxx, ACT-xxx)
  name: string;
  finishBefore: number; // TA day
  finishAfter: number;
  floatBefore: number;
  floatAfter: number;
  critical: boolean;
}

export interface P6Reschedule {
  project: string;
  dataDate: number;
  reason: string;
  changes: P6ActivityChange[];
  drivingBefore: string;
  drivingAfter: string;
  finishBefore: number;
  finishAfter: number;
  newlyCritical: string[];
}

// ---------------------------------------------------------------- messages

/** One-click presenter actions fired from the split view; each console performs the planner action itself. */
export type DemoAction = 'sap.notification.0' | 'sap.notification.1' | 'sap.notification.2' | 'sap.cost.up' | 'p6.extend' | 'p6.recover';

export type BusMessage =
  | { type: 'hello'; system: SystemId; /** asks the other side to answer with its own hello */ ping?: boolean }
  | { type: 'reset' }
  | { type: 'demo.run'; action: DemoAction }
  // SAP -> TURNPOINT
  | { type: 'sap.notification.created'; notification: SapNotification }
  | { type: 'sap.order.changed'; order: SapOrder; changes: FieldChange[] }
  // TURNPOINT -> SAP
  | { type: 'tp.order.upsert'; order: Partial<SapOrder> & { MaintenanceOrder: string }; note: string }
  | { type: 'tp.notification.update'; MaintenanceNotification: string; phase: string; ref?: string; note: string }
  // P6 -> TURNPOINT
  | { type: 'p6.rescheduled'; result: P6Reschedule }
  // TURNPOINT -> P6
  | { type: 'tp.progress'; tpId: string; pct: number; by: string; via: string }
  | { type: 'tp.activity.added'; tpId: string; name: string; afterTpId: string; beforeTpId?: string; durationDays: number; source: string };

export type Envelope = BusMessage & { id: string; at: number; from: SystemId };

const NAME = 'turnpoint-integration-bus';
let channel: BroadcastChannel | null = null;
const handlers = new Set<(m: Envelope) => void>();
let seq = 0;

function open(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(NAME);
  channel.onmessage = (e: MessageEvent<Envelope>) => handlers.forEach((h) => h(e.data));
  return channel;
}

/** Send to every other window. The sender does not receive its own message. */
export function publish(from: SystemId, msg: BusMessage): Envelope {
  const env = { ...msg, id: `${from}-${Date.now().toString(36)}-${(seq++).toString(36)}`, at: Date.now(), from } as Envelope;
  open()?.postMessage(env);
  return env;
}

export function subscribe(handler: (m: Envelope) => void): () => void {
  open();
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/** Wall-clock time as SAP / P6 would stamp a change, e.g. "16.08.2026 10:42:13" (scenario date, real time of day). */
export function stampNow(): string {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `16.08.2026 ${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`;
}
