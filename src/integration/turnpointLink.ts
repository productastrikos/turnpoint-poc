// TURNPOINT's end of the integration bus: applies what the SAP and Primavera P6 stand-in consoles send, logs every
// message in the Integration Hub and tells open pages to reload. Outbound messages are sent by the services
// (approvals, freeze, merges, SCFs, field progress) through integrationService.sendToSystems.
import { publish, subscribe, type Envelope, type P6Reschedule, type SapNotification } from './bus';
import { createJobsFromSap, getJobs, patchJob } from '../services/jobsService';
import { applyP6Schedule, getCriticalPathActivities, getCpDailyChanges } from '../services/criticalPathService';
import { checkSapItems } from '../services/duplicateService';
import { logMessage, notePresence, sendToSystems } from '../services/integrationService';
import { sapWoForJob } from '../mocks/sapKeys';
import { dayToDate, shortDate } from '../mocks/_gen';
import { emitData } from '../app/dataEvents';
import type { SapItem } from '../types/execution';

type Notify = (text: string, tone: 'good' | 'warn' | 'accent' | 'crit') => void;

// Live feed of what SAP and P6 just sent, for the Command Dashboard ("Live from SAP & P6" card).
export interface LiveEvent {
  id: number;
  at: string;
  system: 'SAP' | 'P6';
  text: string;
  tone: 'good' | 'warn' | 'accent' | 'crit';
}
let liveEvents: LiveEvent[] = [];
let liveSeq = 1;
const liveListeners = new Set<() => void>();
export const getLiveEvents = () => liveEvents;
export function subscribeLive(fn: () => void) {
  liveListeners.add(fn);
  return () => {
    liveListeners.delete(fn);
  };
}
function pushLive(system: LiveEvent['system'], text: string, tone: LiveEvent['tone'], notify: Notify) {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  liveEvents = [{ id: liveSeq++, at: `${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`, system, text, tone }, ...liveEvents].slice(0, 8);
  liveListeners.forEach((l) => l());
  notify(text, tone);
}

const omr = (v: number) => `OMR ${v.toLocaleString()}`;
const day = (d: number) => shortDate(dayToDate(Math.round(d)));

async function onSapNotification(n: SapNotification, notify: Notify) {
  const item: SapItem = {
    number: n.MaintenanceNotification,
    kind: 'Notification',
    description: n.NotificationText,
    funcLoc: n.FunctionalLocation,
    equipment: n.TechnicalObject,
    priority: Number(n.MaintPriority) as SapItem['priority'],
    plannerGroup: 'from SAP',
    estCostOMR: n.ZZ_EstCostOMR,
    manhours: n.ZZ_Manhours,
    discipline: n.ZZ_Discipline,
    area: n.ZZ_Area,
    reportedBy: n.ReportedByUser,
    createdOn: '2026-08-16',
  };
  const check = (await checkSapItems([item]))[item.number];
  const [job] = await createJobsFromSap([item]);
  const ai = check?.kind === 'duplicate' ? ` AI check: possible duplicate of ${check.b.id} (${Math.round(check.probability * 100)}%).` : check?.kind === 'bundle' ? ` AI check: same work front as ${check.b.id}.` : ' AI check: no duplicate found.';
  logMessage({ system: 'SAP', direction: 'Inbound', object: 'Maintenance Notification', key: item.number, status: 'Delivered', latencyMs: 240, channel: 'OData V2 event (API_MAINTNOTIFICATION)', note: `New notification "${item.description}" received from SAP: scope item ${job.id} created at Gate 1.${ai}`, request: JSON.stringify({ d: n }, null, 2) });
  sendToSystems({ type: 'tp.notification.update', MaintenanceNotification: item.number, phase: 'In process', ref: job.id, note: `Received by TURNPOINT: scope item ${job.id} at Gate 1${check?.kind === 'duplicate' ? `, flagged as possible duplicate of ${check.b.id}` : ''}` });
  pushLive('SAP', `SAP notification ${item.number} received: ${job.id} created at Gate 1.${ai}`, check?.kind === 'duplicate' ? 'warn' : 'good', notify);
  emitData('scope');
}

async function onSapOrderChanged(m: Extract<Envelope, { type: 'sap.order.changed' }>, notify: Notify) {
  const jobs = await getJobs();
  const job = jobs.find((j) => sapWoForJob(j) === m.order.MaintenanceOrder || j.sapRef === m.order.MaintenanceOrder);
  const cost = m.changes.find((c) => c.field === 'PlannedCostOMR');
  let applied = 'logged (no TURNPOINT field mapped)';
  if (job && cost) {
    await patchJob(job.id, { costOMR: m.order.PlannedCostOMR });
    applied = `${job.id} estimate ${omr(Number(cost.from))} → ${omr(Number(cost.to))}, budget roll-up updated`;
  } else if (job) {
    applied = `${job.id} updated`;
  }
  const what = m.changes.map((c) => `${c.label} ${c.from} → ${c.to}`).join('; ');
  logMessage({ system: 'SAP', direction: 'Inbound', object: 'Maintenance Order', key: m.order.MaintenanceOrder, status: 'Delivered', latencyMs: 260, channel: 'OData V2 event (API_MAINTENANCEORDER)', note: `Changed in SAP: ${what}. ${applied}.`, request: JSON.stringify({ d: m.order }, null, 2) });
  pushLive('SAP', `SAP order ${m.order.MaintenanceOrder} changed (${what}): ${applied}.`, 'accent', notify);
  emitData('scope');
}

async function onP6Reschedule(r: P6Reschedule, notify: Notify) {
  const cps = await getCriticalPathActivities();
  const known = new Set(cps.map((a) => a.id));
  const updates = r.changes
    .filter((c) => c.tpId && (known.has(c.tpId) || c.tpId.startsWith('ACT-')))
    .map((c) => ({ id: c.tpId!, forecastFinish: dayToDate(Math.round(c.finishAfter)), floatDays: Math.round(c.floatAfter) }));
  const moved = r.changes.filter((c) => c.tpId && known.has(c.tpId) && c.finishAfter > c.finishBefore + 0.4);
  const pathChanged = r.drivingBefore !== r.drivingAfter;
  const endMoved = Math.abs(r.finishAfter - r.finishBefore) >= 0.5;
  const parts = [
    moved.length ? `${moved.map((c) => `${c.tpId} ${c.name} finish ${day(c.finishBefore)} → ${day(c.finishAfter)}`).slice(0, 3).join('; ')}` : '',
    endMoved ? `TA end ${day(r.finishBefore)} → ${day(r.finishAfter)}` : '',
    pathChanged ? `critical path now ${r.drivingAfter} (was ${r.drivingBefore})` : '',
    r.newlyCritical.length ? `newly critical: ${r.newlyCritical.join(', ')}` : '',
  ].filter(Boolean);
  const cpNote = moved.length || pathChanged || r.newlyCritical.length ? `P6 reschedule: ${parts.join('; ')}` : null;
  await applyP6Schedule(updates, cpNote);
  const total = (await getCpDailyChanges()).reduce((s, d) => s + d.changes, 0);
  logMessage({ system: 'P6', direction: 'Inbound', object: 'Schedule (F9)', key: r.project, status: 'Delivered', latencyMs: 190, channel: 'P6 EPPM REST (activity dates, float)', note: `${r.reason}. ${parts.join('. ') || 'No date changes on TURNPOINT activities'}.`, request: JSON.stringify(r, null, 2) });
  pushLive('P6', `Primavera P6 rescheduled: ${parts.join('; ') || 'no date changes on TURNPOINT activities'}.${cpNote ? ` Critical-path change logged (${total} this TA).` : ''}`, pathChanged || endMoved ? 'warn' : 'accent', notify);
  emitData('schedule');
}

/** Start listening. Call once from the app shell; returns the unsubscribe. */
export function startTurnpointLink(notify: Notify): () => void {
  const off = subscribe((m: Envelope) => {
    if (m.type === 'hello' && m.system !== 'TURNPOINT') {
      notePresence(m.system);
      if (m.ping) publish('TURNPOINT', { type: 'hello', system: 'TURNPOINT' }); // a console that just opened learns TURNPOINT is here
      return;
    }
    if (m.from !== 'TURNPOINT') notePresence(m.from);
    if (m.type === 'sap.notification.created') void onSapNotification(m.notification, notify);
    else if (m.type === 'sap.order.changed') void onSapOrderChanged(m, notify);
    else if (m.type === 'p6.rescheduled') void onP6Reschedule(m.result, notify);
  });
  publish('TURNPOINT', { type: 'hello', system: 'TURNPOINT', ping: true }); // consoles already open answer, so the top bar knows
  return off;
}
