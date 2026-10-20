// System of record of the Primavera P6 stand-in console (/ext/p6). Seeded from the same schedule TURNPOINT shows, so
// Activity IDs and dates line up; it keeps its own state from then on, like a separate system would. The planner edits
// durations here and presses Schedule (F9); the CPM result is compared with the last schedule and the changes are
// published to TURNPOINT. Progress from TURNPOINT arrives on the bus and waits for the next F9, as it does in P6.
import { criticalPathActivities, nearCritical } from '../mocks/criticalPathMock';
import { scheduleActivities } from '../mocks/scheduleMock';
import { dateToDay, STATUS_DAY } from '../mocks/_gen';
import { publish, stampNow, subscribe, type Envelope, type P6ActivityChange } from './bus';
import { schedule, type CpmResult } from './cpm';

export interface P6Activity {
  id: string; // P6 Activity ID
  tpId?: string;
  name: string;
  wbs: string;
  origDur: number;
  remDur: number;
  pct: number;
  status: 'Not Started' | 'In Progress' | 'Completed';
  actualStart?: number;
  preds: { id: string; lag: number }[];
  startOnOrAfter?: number;
  finishOnOrBefore?: number;
  milestone?: boolean;
  path?: 'CP1' | 'CP2' | 'CP3';
  changedBy?: string;
  changedAt?: string;
  /** Edited since the last Schedule (F9). */
  dirty?: boolean;
}

export interface P6LogEntry {
  at: string;
  dir: 'in' | 'out';
  text: string;
}

export const P6_PROJECT_ID = 'OQ-SOH-TA2026';
export const WBS = ['Unit 100 · HCU', 'Unit 200 · CDU', 'Unit 300 · FCC', 'Flare system', 'Milestones'] as const;

const CP_P6: Record<string, string> = {
  'CPA-001': 'HCU-1010', 'CPA-002': 'HCU-1020', 'CPA-003': 'HCU-1030', 'CPA-011': 'HCU-1040', 'CPA-009': 'HCU-1050', 'CPA-012': 'HCU-1060', 'CPA-013': 'HCU-1070',
  'CPA-004': 'CDU-2010', 'CPA-005': 'CDU-2020', 'CPA-014': 'CDU-2030', 'CPA-008': 'CDU-2040', 'CPA-010': 'CDU-2050',
  'CPA-006': 'FCC-3010', 'CPA-007': 'FCC-3020', 'CPA-015': 'FCC-3030', 'CPA-016': 'FCC-3040',
};
const WBS_OF: Record<string, (typeof WBS)[number]> = { 'Unit 100': 'Unit 100 · HCU', 'Unit 200': 'Unit 200 · CDU', 'Unit 300': 'Unit 300 · FCC', 'Flare System': 'Flare system' };
// unit milestone that each path hands back to, with its "finish on or before" date and the lag to the TA-end milestone
const UNIT_MS = { CP1: { id: 'HCU-MS', name: 'Unit 100 ready for start-up', due: 32, toEnd: 0 }, CP2: { id: 'CDU-MS', name: 'Unit 200 ready for start-up', due: 26, toEnd: 6 }, CP3: { id: 'FCC-MS', name: 'Unit 300 ready for start-up', due: 29, toEnd: 3 } } as const;
const NEAR_IDS = ['ACT-231', 'ACT-244', 'ACT-318', 'ACT-352', 'ACT-367'];
const EXTRA_IDS = ['ACT-203', 'ACT-108', 'ACT-109', 'ACT-502', 'ACT-602'];

function seed(): P6Activity[] {
  const byTp = Object.fromEntries(criticalPathActivities.map((a) => [a.id, a]));
  const acts: P6Activity[] = [];
  for (const a of criticalPathActivities) {
    const finish = dateToDay(a.plannedFinish);
    const start = finish - a.durationDays;
    const slip = dateToDay(a.forecastFinish) - finish;
    const predSlip = Math.max(0, ...a.predecessors.map((p) => dateToDay(byTp[p].forecastFinish) - dateToDay(byTp[p].plannedFinish)));
    const own = Math.max(0, slip - predSlip); // delay the planner has already put into the remaining duration
    const latestPredFinish = Math.max(-Infinity, ...a.predecessors.map((p) => dateToDay(byTp[p].plannedFinish)));
    const sa = scheduleActivities.find((s) => s.id === a.id);
    acts.push({
      id: CP_P6[a.id],
      tpId: a.id,
      name: a.name,
      wbs: WBS_OF[sa?.area ?? 'Unit 100'] ?? 'Unit 100 · HCU',
      origDur: a.durationDays,
      remDur: a.durationDays + own,
      pct: 0,
      status: 'Not Started',
      preds: a.predecessors.map((p) => ({ id: CP_P6[p], lag: start - latestPredFinish })),
      startOnOrAfter: start,
      path: a.path,
    });
  }
  // hand-back activity on CP1 and the unit / TA-end milestones
  acts.push({ id: 'HCU-1080', name: 'Unit 100 hand-back and start-up preparation', wbs: 'Unit 100 · HCU', origDur: 2, remDur: 2, pct: 0, status: 'Not Started', preds: [{ id: 'HCU-1070', lag: 0 }], startOnOrAfter: 30, path: 'CP1' });
  const last = { CP1: 'HCU-1080', CP2: 'CDU-2050', CP3: 'FCC-3040' } as const;
  for (const p of ['CP1', 'CP2', 'CP3'] as const) {
    const ms = UNIT_MS[p];
    acts.push({ id: ms.id, name: ms.name, wbs: 'Milestones', origDur: 0, remDur: 0, pct: 0, status: 'Not Started', preds: [{ id: last[p], lag: 0 }], finishOnOrBefore: ms.due, milestone: true, path: p });
  }
  acts.push({ id: 'TA-END', name: 'Turnaround complete: all units handed back', wbs: 'Milestones', origDur: 0, remDur: 0, pct: 0, status: 'Not Started', preds: (['CP1', 'CP2', 'CP3'] as const).map((p) => ({ id: UNIT_MS[p].id, lag: UNIT_MS[p].toEnd })), finishOnOrBefore: 32, milestone: true });
  // near-critical and supporting work in progress at the data date
  for (const id of [...NEAR_IDS, ...EXTRA_IDS]) {
    const s = scheduleActivities.find((x) => x.id === id);
    if (!s) continue;
    const dur = s.endDay - s.startDay + 1;
    const started = s.pct > 0;
    const remDur = Math.max(1, Math.round(dur * (1 - s.pct / 100)));
    const ef = started ? STATUS_DAY + remDur : s.endDay;
    const float = 2;
    acts.push({
      id: s.p6Id,
      tpId: s.id,
      name: s.name,
      wbs: WBS_OF[s.area] ?? 'Unit 200 · CDU',
      origDur: dur,
      remDur,
      pct: s.pct,
      status: started ? 'In Progress' : 'Not Started',
      actualStart: started ? s.startDay - 1 : undefined,
      preds: id === 'ACT-352' ? [{ id: 'FLR-2005', lag: 0 }] : id === 'ACT-203' ? [{ id: 'CDU-1020', lag: 0 }] : [],
      startOnOrAfter: started ? undefined : s.startDay - 1,
      finishOnOrBefore: ef + float, // provisional; set from the CPM early finish below
    });
  }
  // window end = early finish from the network + today's float, so P6 opens with the same float TURNPOINT shows
  const first = schedule(toCpm(acts.map((a) => (a.tpId?.startsWith('ACT-') ? { ...a, finishOnOrBefore: undefined } : a))), STATUS_DAY);
  return acts.map((a) => (a.tpId?.startsWith('ACT-') ? { ...a, finishOnOrBefore: first.ef[a.id] + (nearCritical.find((n) => n.id === a.tpId)?.floatDays ?? 2) } : a));
}

// ---------------------------------------------------------------- store

export interface P6State {
  acts: P6Activity[];
  cpm: CpmResult;
  /** Result of the last Schedule (F9): what TURNPOINT has been told. */
  scheduled: CpmResult;
  dirty: boolean;
  log: P6LogEntry[];
  lastScheduledAt: string;
  connected: boolean;
  /** Rows changed in the last few seconds (inbound updates, rescheduled dates), for the highlight. */
  flash: string[];
}

const toCpm = (acts: P6Activity[]) =>
  acts.map((a) => ({ id: a.id, remaining: a.remDur, preds: a.preds, started: a.status === 'In Progress', complete: a.status === 'Completed', startOnOrAfter: a.startOnOrAfter, finishOnOrBefore: a.finishOnOrBefore }));

function fresh(): P6State {
  const acts = seed();
  const cpm = schedule(toCpm(acts), STATUS_DAY);
  return { acts, cpm, scheduled: cpm, dirty: false, log: [], lastScheduledAt: '16.08.2026 06:00:00', connected: false, flash: [] };
}

let state = fresh();
const listeners = new Set<() => void>();
const set = (patch: Partial<P6State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const addLog = (dir: P6LogEntry['dir'], text: string) => [{ at: stampNow(), dir, text }, ...state.log].slice(0, 60);
function flash(ids: string[]) {
  if (!ids.length) return;
  set({ flash: [...state.flash, ...ids] });
  setTimeout(() => set({ flash: state.flash.filter((k) => !ids.includes(k)) }), 4500);
}

export const getP6State = () => state;
export function subscribeP6(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Planner edit in the grid: takes effect on the next Schedule (F9). */
export function editActivity(id: string, patch: Partial<Pick<P6Activity, 'origDur' | 'remDur' | 'pct'>>) {
  const acts = state.acts.map((a) => (a.id === id ? { ...a, ...patch, dirty: true, changedBy: 'Planner (P6)', changedAt: stampNow() } : a));
  set({ acts, cpm: schedule(toCpm(acts), STATUS_DAY), dirty: true });
}

/** Schedule (F9): CPM over the network, compare with the last schedule, publish the differences to TURNPOINT. */
export function runSchedule(reason?: string): P6ActivityChange[] {
  const before = state.scheduled;
  const after = schedule(toCpm(state.acts), STATUS_DAY);
  const changes: P6ActivityChange[] = state.acts
    .filter((a) => !a.milestone || a.id === 'TA-END')
    .filter((a) => Math.abs(after.ef[a.id] - before.ef[a.id]) >= 0.5 || (after.tf[a.id] <= 0) !== (before.tf[a.id] <= 0))
    .map((a) => ({ activityId: a.id, tpId: a.tpId, name: a.name, finishBefore: before.ef[a.id], finishAfter: after.ef[a.id], floatBefore: before.tf[a.id], floatAfter: after.tf[a.id], critical: after.tf[a.id] <= 0 }));
  const pathOf = (r: CpmResult) => state.acts.find((a) => a.id === r.driving.find((d) => state.acts.find((x) => x.id === d)?.path))?.path ?? 'CP1';
  const drivingBefore = pathOf(before);
  const drivingAfter = pathOf(after);
  const newlyCritical = state.acts.filter((a) => !a.milestone && after.tf[a.id] <= 0 && before.tf[a.id] > 0).map((a) => a.tpId ?? a.id);
  const edited = state.acts.filter((a) => a.dirty).map((a) => a.id);
  const why = reason ?? (edited.length ? `Planner changes on ${edited.join(', ')}` : 'Scheduled with no changes');
  if (changes.length) {
    publish('P6', {
      type: 'p6.rescheduled',
      result: { project: P6_PROJECT_ID, dataDate: STATUS_DAY, reason: why, changes, drivingBefore, drivingAfter, finishBefore: before.ef['TA-END'], finishAfter: after.ef['TA-END'], newlyCritical },
    });
  }
  set({
    acts: state.acts.map((a) => ({ ...a, dirty: false })),
    cpm: after,
    scheduled: after,
    dirty: false,
    lastScheduledAt: stampNow(),
    log: addLog('out', changes.length ? `Schedule (F9): ${changes.length} activit${changes.length === 1 ? 'y' : 'ies'} moved, sent to TURNPOINT. ${why}.` : `Schedule (F9): no date changes. ${why}.`),
  });
  flash(changes.map((c) => c.activityId));
  return changes;
}

export function resetP6() {
  state = { ...fresh(), connected: state.connected };
  listeners.forEach((l) => l());
}

/** Wire the console to the bus. Returns the unsubscribe. */
export function connectP6(): () => void {
  const off = subscribe((m: Envelope) => {
    if (m.type === 'reset') return resetP6();
    if (m.type === 'demo.run' && (m.action === 'p6.extend' || m.action === 'p6.recover')) {
      // E-204 Retube: +3 days, or take 3 days back (night crew), then Schedule (F9) as the planner would
      const a = state.acts.find((x) => x.id === 'CDU-2020');
      if (!a) return;
      const v = Math.max(1, a.remDur + (m.action === 'p6.extend' ? 3 : -3));
      editActivity(a.id, a.status === 'Not Started' ? { remDur: v, origDur: v } : { remDur: v });
      runSchedule(m.action === 'p6.extend' ? 'Planner extends CDU-2020 E-204 Retube by 3 days' : 'Planner recovers 3 days on CDU-2020 E-204 Retube (second night crew)');
      return;
    }
    if (m.type === 'hello' && m.system === 'TURNPOINT') {
      if (m.ping) publish('P6', { type: 'hello', system: 'P6' });
      return set({ connected: true });
    }
    if (m.type === 'tp.progress') {
      const a = state.acts.find((x) => x.tpId === m.tpId);
      if (!a) return;
      const remDur = Math.max(0, Math.round(a.origDur * (1 - m.pct / 100) * 10) / 10);
      const acts = state.acts.map((x) =>
        x.id === a.id
          ? { ...x, pct: m.pct, remDur, status: m.pct >= 100 ? ('Completed' as const) : ('In Progress' as const), actualStart: x.actualStart ?? STATUS_DAY - 1, startOnOrAfter: undefined, dirty: true, changedBy: `TURNPOINT_INT (${m.by})`, changedAt: stampNow() }
          : x
      );
      set({ acts, cpm: schedule(toCpm(acts), STATUS_DAY), dirty: true, connected: true, log: addLog('in', `Progress from TURNPOINT ${m.via}: ${a.id} ${a.name} ${m.pct}% complete (by ${m.by}). Remaining duration ${remDur} d. Schedule (F9) to recalculate.`) });
      flash([a.id]);
    }
    if (m.type === 'tp.activity.added') {
      const after = state.acts.find((x) => x.tpId === m.afterTpId);
      if (!after || state.acts.some((x) => x.tpId === m.tpId)) return;
      const id = `${after.id.split('-')[0]}-${9000 + state.acts.length}`;
      const before = m.beforeTpId ? state.acts.find((x) => x.tpId === m.beforeTpId) : undefined;
      const added: P6Activity = { id, tpId: m.tpId, name: m.name, wbs: after.wbs, origDur: m.durationDays, remDur: m.durationDays, pct: 0, status: 'Not Started', preds: [{ id: after.id, lag: 0 }], path: after.path, dirty: true, changedBy: `TURNPOINT_INT (${m.source})`, changedAt: stampNow() };
      const acts = [...state.acts.map((x) => (before && x.id === before.id ? { ...x, preds: [...x.preds, { id, lag: 0 }], dirty: true } : x)), added];
      set({ acts, cpm: schedule(toCpm(acts), STATUS_DAY), dirty: true, log: addLog('in', `New activity from TURNPOINT (${m.source}): ${id} ${m.name}, ${m.durationDays} d after ${after.id}. Schedule (F9) to recalculate.`) });
      flash([id]);
    }
  });
  publish('P6', { type: 'hello', system: 'P6', ping: true });
  const beat = setInterval(() => publish('P6', { type: 'hello', system: 'P6' }), 20_000);
  return () => {
    off();
    clearInterval(beat);
  };
}
