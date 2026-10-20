// System of record of the SAP S/4HANA stand-in console (/ext/sap): maintenance orders and notifications, seeded from
// the same SAP numbers TURNPOINT shows, then kept separately like a real system. Planner actions here (new notification,
// changed order) are published to TURNPOINT; TURNPOINT's approvals, freeze, merges and SCFs arrive on the bus and are
// written to the orders with the technical user TURNPOINT_INT, as an Integration Suite flow would.
import { jobs } from '../mocks/jobsMock';
import { SAP_PENDING } from '../mocks/integrationMock';
import { sapWoForJob } from '../mocks/sapKeys';
import { unitOf } from '../mocks/master';
import { publish, stampNow, subscribe, type Envelope, type FieldChange, type SapNotification, type SapOrder } from './bus';
import type { Discipline, Job } from '../types';

export interface SapLogEntry {
  at: string;
  user: string;
  dir: 'in' | 'out' | 'local';
  object: string;
  text: string;
}

const PLANNER_GROUP: Record<Discipline, string> = { Inspection: 'MPG-INS', 'Rotating Equipment': 'MPG-ROT', Process: 'MPG-PRC', Instrumentation: 'MPG-INST', Civil: 'MPG-CIV', Electrical: 'MPG-ELE' };
const prio = (j: Pick<Job, 'likelihood' | 'consequence'>): SapOrder['MaintPriority'] => {
  const r = j.likelihood * j.consequence;
  return r >= 16 ? '1' : r >= 10 ? '2' : r >= 5 ? '3' : '4';
};
export const funcLoc = (area: string, tag: string) => `SOH-${unitOf(area)}-${tag.replace(/[^A-Z0-9]/gi, '').toUpperCase()}`;

function seedOrders(): SapOrder[] {
  return jobs
    .filter((j) => sapWoForJob(j))
    .map((j) => ({
      MaintenanceOrder: sapWoForJob(j)!,
      MaintenanceOrderDesc: j.desc,
      MaintenanceOrderType: j.source === 'SAP work order' ? 'PM01' : 'PM02',
      Equipment: j.tag,
      FunctionalLocation: funcLoc(j.area, j.tag),
      MaintPriority: prio(j),
      SystemStatusText: j.status === 'approved' || j.inBaseline ? 'REL' : 'CRTD',
      UserStatusText: j.inBaseline ? 'SFRZ' : j.status === 'approved' ? 'APRV' : 'TPSC',
      MaintenancePlannerGroup: PLANNER_GROUP[j.discipline],
      WBSElement: `TA26.${unitOf(j.area)}`,
      PlannedCostOMR: j.costOMR,
      MaintenanceNotification: j.source === 'SAP notification' ? j.sapRef : undefined,
      LastChangedBy: j.inBaseline ? 'TURNPOINT_INT' : 'PLANNER01',
      LastChangeDateTime: j.inBaseline ? '12.06.2026 10:20:00' : `${j.createdAt.slice(8, 10)}.${j.createdAt.slice(5, 7)}.2026 09:00:00`,
      ZZ_TurnpointRef: j.id,
    }));
}

function seedNotifications(): SapNotification[] {
  const fromJobs: SapNotification[] = jobs
    .filter((j) => j.source === 'SAP notification' && j.sapRef)
    .map((j) => ({
      MaintenanceNotification: j.sapRef!,
      NotificationText: j.desc,
      NotificationType: prio(j) <= '2' ? 'M1' : 'M2',
      MaintPriority: prio(j),
      TechnicalObject: j.tag,
      FunctionalLocation: funcLoc(j.area, j.tag),
      ReportedByUser: j.requestedBy,
      CreationDate: j.createdAt,
      NotifProcessingPhaseDesc: j.status === 'rejected' ? 'Completed' : 'In process',
      ZZ_Discipline: j.discipline,
      ZZ_Area: j.area,
      ZZ_EstCostOMR: j.costOMR,
      ZZ_Manhours: j.manhours,
      ZZ_TurnpointRef: j.id,
    }));
  const pending: SapNotification[] = SAP_PENDING.filter((s) => s.kind === 'Notification').map((s) => ({
    MaintenanceNotification: s.number,
    NotificationText: s.description,
    NotificationType: s.priority <= 2 ? 'M1' : 'M2',
    MaintPriority: String(s.priority) as SapNotification['MaintPriority'],
    TechnicalObject: s.equipment,
    FunctionalLocation: s.funcLoc,
    ReportedByUser: s.reportedBy,
    CreationDate: s.createdOn,
    NotifProcessingPhaseDesc: 'Outstanding',
    ZZ_Discipline: s.discipline,
    ZZ_Area: s.area,
    ZZ_EstCostOMR: s.estCostOMR,
    ZZ_Manhours: s.manhours,
  }));
  return [...pending, ...fromJobs].sort((a, b) => b.MaintenanceNotification.localeCompare(a.MaintenanceNotification));
}

/** Ready-made notifications for the demo: one repeats existing scope, one shares a work front, one is new work. */
export const EXAMPLE_NOTIFICATIONS: Omit<SapNotification, 'MaintenanceNotification' | 'CreationDate' | 'NotifProcessingPhaseDesc'>[] = [
  { NotificationText: 'V-102 nozzle N4 corrosion found at internal inspection, wall loss 22%', NotificationType: 'M1', MaintPriority: '2', TechnicalObject: 'V-102', FunctionalLocation: funcLoc('Unit 200', 'V-102'), ReportedByUser: 'A. Hinai', ZZ_Discipline: 'Inspection', ZZ_Area: 'Unit 200', ZZ_EstCostOMR: 16_500, ZZ_Manhours: 280 },
  { NotificationText: 'E-204 channel head gasket leak, steam at the cover flange', NotificationType: 'M1', MaintPriority: '2', TechnicalObject: 'E-204', FunctionalLocation: funcLoc('Unit 200', 'E-204'), ReportedByUser: 'R. Fernandes', ZZ_Discipline: 'Rotating Equipment', ZZ_Area: 'Unit 200', ZZ_EstCostOMR: 7_800, ZZ_Manhours: 120 },
  { NotificationText: 'P-305 suction strainer blocked, low discharge pressure alarm', NotificationType: 'M2', MaintPriority: '3', TechnicalObject: 'P-305', FunctionalLocation: funcLoc('Unit 300', 'P-305'), ReportedByUser: 'T. Said', ZZ_Discipline: 'Rotating Equipment', ZZ_Area: 'Unit 300', ZZ_EstCostOMR: 3_900, ZZ_Manhours: 60 },
];

// ---------------------------------------------------------------- store

export interface SapState {
  orders: SapOrder[];
  notifications: SapNotification[];
  log: SapLogEntry[];
  /** Keys changed in the last few seconds, for the row highlight. */
  flash: string[];
  connected: boolean;
}

let nextNotif = 100052001;
const fresh = (): SapState => ({ orders: seedOrders(), notifications: seedNotifications(), log: [], flash: [], connected: false });
let state = fresh();
const listeners = new Set<() => void>();
const set = (patch: Partial<SapState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const log = (e: Omit<SapLogEntry, 'at'>) => [{ ...e, at: stampNow() }, ...state.log].slice(0, 80);
function flash(key: string) {
  set({ flash: [...state.flash, key] });
  setTimeout(() => set({ flash: state.flash.filter((k) => k !== key) }), 4500);
}

export const getSapState = () => state;
export function subscribeSap(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Planner creates a notification in SAP: it is sent to TURNPOINT straight away (event-driven integration). */
export function createNotification(input: Omit<SapNotification, 'MaintenanceNotification' | 'CreationDate' | 'NotifProcessingPhaseDesc'>): SapNotification {
  const n: SapNotification = { ...input, MaintenanceNotification: String(nextNotif++), CreationDate: '2026-08-16', NotifProcessingPhaseDesc: 'Outstanding' };
  set({
    notifications: [n, ...state.notifications],
    log: log({ user: 'PLANNER01', dir: 'out', object: `Notification ${n.MaintenanceNotification}`, text: `Created "${n.NotificationText}" (${n.NotificationType}, priority ${n.MaintPriority}). Event sent to TURNPOINT.` }),
  });
  flash(n.MaintenanceNotification);
  publish('SAP', { type: 'sap.notification.created', notification: n });
  return n;
}

const ORDER_LABEL: Partial<Record<keyof SapOrder, string>> = { PlannedCostOMR: 'Planned cost (OMR)', MaintPriority: 'Priority', SystemStatusText: 'System status', UserStatusText: 'User status', MaintenanceOrderDesc: 'Description' };

/** Planner changes an order in SAP: changed fields go to TURNPOINT. */
export function changeOrder(order: string, patch: Partial<SapOrder>): FieldChange[] {
  const cur = state.orders.find((o) => o.MaintenanceOrder === order);
  if (!cur) return [];
  const changes: FieldChange[] = (Object.keys(patch) as (keyof SapOrder)[])
    .filter((k) => patch[k] !== undefined && String(patch[k]) !== String(cur[k]))
    .map((k) => ({ field: k, label: ORDER_LABEL[k] ?? k, from: String(cur[k] ?? ''), to: String(patch[k]) }));
  if (!changes.length) return [];
  const updated: SapOrder = { ...cur, ...patch, LastChangedBy: 'PLANNER01', LastChangeDateTime: stampNow() };
  set({
    orders: state.orders.map((o) => (o.MaintenanceOrder === order ? updated : o)),
    log: log({ user: 'PLANNER01', dir: 'out', object: `Order ${order}`, text: `${changes.map((c) => `${c.label}: ${c.from} → ${c.to}`).join('; ')}. Change sent to TURNPOINT.` }),
  });
  flash(order);
  publish('SAP', { type: 'sap.order.changed', order: updated, changes });
  return changes;
}

export function resetSap() {
  state = { ...fresh(), connected: state.connected };
  nextNotif = 100052001;
  listeners.forEach((l) => l());
}

/** Wire the console to the bus. Returns the unsubscribe. */
export function connectSap(): () => void {
  const off = subscribe((m: Envelope) => {
    if (m.type === 'reset') return resetSap();
    if (m.type === 'demo.run') {
      const n = /^sap\.notification\.(\d)$/.exec(m.action);
      if (n) createNotification(EXAMPLE_NOTIFICATIONS[Number(n[1])]);
      else if (m.action === 'sap.cost.up') {
        // raise the planned cost of an order that is already a TURNPOINT scope item by 20%
        const o = state.orders.find((x) => x.ZZ_TurnpointRef && x.PlannedCostOMR > 0);
        if (o) changeOrder(o.MaintenanceOrder, { PlannedCostOMR: Math.round((o.PlannedCostOMR * 1.2) / 100) * 100 });
      }
      return;
    }
    if (m.type === 'hello' && m.system === 'TURNPOINT') {
      if (m.ping) publish('SAP', { type: 'hello', system: 'SAP' });
      return set({ connected: true });
    }
    if (m.type === 'tp.order.upsert') {
      const cur = state.orders.find((o) => o.MaintenanceOrder === m.order.MaintenanceOrder);
      const merged: SapOrder = cur
        ? { ...cur, ...m.order, LastChangedBy: 'TURNPOINT_INT', LastChangeDateTime: stampNow() }
        : {
            MaintenanceOrderDesc: '',
            MaintenanceOrderType: 'PM02',
            Equipment: '',
            FunctionalLocation: '',
            MaintPriority: '3',
            SystemStatusText: 'CRTD',
            UserStatusText: '',
            MaintenancePlannerGroup: 'MPG-TA',
            WBSElement: 'TA26',
            PlannedCostOMR: 0,
            ...m.order,
            LastChangedBy: 'TURNPOINT_INT',
            LastChangeDateTime: stampNow(),
          };
      const fields = Object.keys(m.order).filter((k) => k !== 'MaintenanceOrder' && k !== 'ZZ_TurnpointRef');
      set({
        connected: true,
        orders: cur ? state.orders.map((o) => (o.MaintenanceOrder === merged.MaintenanceOrder ? merged : o)) : [merged, ...state.orders],
        log: log({ user: 'TURNPOINT_INT', dir: 'in', object: `Order ${merged.MaintenanceOrder}`, text: `${cur ? 'Changed' : 'Created'} from TURNPOINT: ${m.note}${cur ? ` (${fields.map((k) => `${ORDER_LABEL[k as keyof SapOrder] ?? k} ${String((m.order as Record<string, unknown>)[k])}`).join(', ')})` : ''}.` }),
      });
      flash(merged.MaintenanceOrder);
    }
    if (m.type === 'tp.notification.update') {
      const cur = state.notifications.find((n) => n.MaintenanceNotification === m.MaintenanceNotification);
      if (!cur) return;
      set({
        connected: true,
        notifications: state.notifications.map((n) => (n.MaintenanceNotification === m.MaintenanceNotification ? { ...n, NotifProcessingPhaseDesc: m.phase, ZZ_TurnpointRef: m.ref ?? n.ZZ_TurnpointRef } : n)),
        log: log({ user: 'TURNPOINT_INT', dir: 'in', object: `Notification ${m.MaintenanceNotification}`, text: `Status ${m.phase} from TURNPOINT: ${m.note}.` }),
      });
      flash(m.MaintenanceNotification);
    }
  });
  publish('SAP', { type: 'hello', system: 'SAP', ping: true });
  const beat = setInterval(() => publish('SAP', { type: 'hello', system: 'SAP' }), 20_000);
  return () => {
    off();
    clearInterval(beat);
  };
}
