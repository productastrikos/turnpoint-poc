// Critical path monitor (PBC 3, 4, 10). OQ runs its own live CPM over the same logic network as the Primavera P6 stand-in
// (integration/p6Store.ts seed): durations, finish-to-start links with lags, the unit hand-back milestones and the TA-end
// milestone. Criticality is COMPUTED (total float against the contractual dates), never hand-labelled:
//   critical      total float <= 0 days  (zero = on the longest path, negative = already behind a contractual date)
//   near-critical total float 1 to 5 days (GAO Schedule Assessment Guide)
// CP1 / CP2 / CP3 are the three parallel chains that feed the TA-end milestone, ranked by when they arrive: CP1 is the
// chain that drives the end date today. When a delay makes another chain arrive last, the labels switch.
// Injected delays, recoveries and P6 write-backs are all "own" duration changes on one activity; everything else follows from the logic.
import { criticalPathActivities, cpDailyChanges, nearCritical } from '../mocks/criticalPathMock';
import { scheduleActivities } from '../mocks/scheduleMock';
import { dayToDate, STATUS_DAY } from '../mocks/_gen';
import { DELAY_COST_PER_DAY_OMR } from '../mocks/riskContext';
import { seedP6Network, type P6Activity } from '../integration/p6Store';
import { ancestorsOf, criticalityOf, rankChains, schedule, type CpmActivity, type CpmResult, type Criticality } from '../integration/cpm';
import type { CPStatus, CriticalPathActivity } from '../types';
import { delay } from './_util';

// ------------------------------------------------------------------ network
const NET: P6Activity[] = seedP6Network();
const P6_OF = new Map(NET.filter((a) => a.tpId).map((a) => [a.tpId!, a.id]));
const TP_OF = new Map(NET.filter((a) => a.tpId).map((a) => [a.id, a.tpId!]));
const CP_META = new Map(criticalPathActivities.map((a) => [a.id, a]));
const SCHED = new Map(scheduleActivities.map((a) => [a.id, a]));
const NEAR_META = new Map(nearCritical.map((n) => [n.id, n]));
const END_ID = 'TA-END';
const GATES = ['HCU-MS', 'CDU-MS', 'FCC-MS'];
export const CHAIN_NAMES: Record<string, string> = { 'HCU-MS': 'Reactor R-101 · Unit 100', 'CDU-MS': 'E-204 / Train B · Unit 200', 'FCC-MS': 'Compressor C-301 · Unit 300' };
const REPORTED = NET.filter((a) => a.tpId && (a.tpId.startsWith('CPA-') || NEAR_META.has(a.tpId)));

/** Remaining duration of each activity in the plan (no delay), and what P6 already carries as own delay at the data date. */
const BASE_REM = new Map(NET.map((a) => [a.id, a.tpId?.startsWith('CPA-') ? a.origDur : a.remDur]));
const SEED_OWN = new Map(NET.map((a) => [a.id, a.remDur - (BASE_REM.get(a.id) ?? a.remDur)]));
const CPM_ACTS = (rem: (a: P6Activity) => number): CpmActivity[] =>
  NET.map((a) => ({ id: a.id, remaining: rem(a), preds: a.preds, started: a.status === 'In Progress', complete: a.status === 'Completed', startOnOrAfter: a.startOnOrAfter, finishOnOrBefore: a.finishOnOrBefore }));
const GRAPH = CPM_ACTS((a) => a.remDur);
const SUCCS = new Map<string, string[]>();
NET.forEach((a) => a.preds.forEach((p) => SUCCS.set(p.id, [...(SUCCS.get(p.id) ?? []), a.id])));

// ------------------------------------------------------------------ state
export interface DelayEvent {
  id: string;
  seq: number;
  day: number;
  kind: 'delay' | 'recovery' | 'p6';
  activityId: string; // OQ id (CPA-xxx / ACT-xxx)
  name: string;
  days: number; // + delay, - recovery
  cause: string;
  endBefore: number;
  endAfter: number;
  slipAfter: number;
  slipDelta: number; // days the TA end moved because of this event
  newlyCritical: string[];
  dropped: string[];
  becameNear: string[];
  pathBefore: string;
  pathAfter: string;
  switched: boolean;
  countedChange: boolean;
  costOMR: number;
  lines: ImpactLine[];
}

export interface ImpactLine {
  id: string;
  name: string;
  role: 'delayed' | 'knock-on';
  shiftDays: number;
  floatBefore: number;
  floatAfter: number;
  crewCostOMR: number;
}

export interface Assumptions {
  standingCostPerDay: number; // OMR per day of TA overrun
  standbyFactor: number; // share of a crew's daily cost paid while it stands by
}
const DEFAULT_ASSUMPTIONS: Assumptions = { standingCostPerDay: DELAY_COST_PER_DAY_OMR, standbyFactor: 0.4 };

interface State {
  delays: Record<string, number>; // injected own delay by P6 id
  recov: Record<string, number>; // recovered days by P6 id
  recovCost: number;
  events: DelayEvent[];
  seq: number;
  daily: { day: number; changes: number; note: string }[];
  changeCount: Record<string, number>;
  assumptions: Assumptions;
  script: number;
  lastDelayId: string | null;
}
const freshState = (): State => ({
  delays: {},
  recov: {},
  recovCost: 0,
  events: [],
  seq: 0,
  daily: cpDailyChanges.map((d) => ({ ...d })),
  changeCount: Object.fromEntries(criticalPathActivities.map((a) => [a.id, a.changeCount])),
  assumptions: { ...DEFAULT_ASSUMPTIONS },
  script: 0,
  lastDelayId: null,
});
let st: State = freshState();

// ------------------------------------------------------------------ computation
interface Run {
  res: CpmResult;
  chains: ReturnType<typeof rankChains>;
}
const remaining = (s: State) => (a: P6Activity) => Math.max(a.milestone ? 0 : 1, (BASE_REM.get(a.id) ?? 0) + (SEED_OWN.get(a.id) ?? 0) + (s.delays[a.id] ?? 0) - (s.recov[a.id] ?? 0));

function compute(s: State): Run {
  const acts = CPM_ACTS(remaining(s));
  const res = schedule(acts, STATUS_DAY);
  return { res, chains: rankChains(acts, res, END_ID, GATES) };
}
const PLAN = (() => {
  const acts = CPM_ACTS((a) => BASE_REM.get(a.id) ?? a.remDur);
  return schedule(acts, STATUS_DAY);
})();
const ANC = new Map(GATES.map((g) => [g, ancestorsOf(GRAPH, g)]));
const chainOf = (p6: string): string | undefined => GATES.find((g) => g === p6 || ANC.get(g)!.has(p6));
const dateOf = (day: number) => dayToDate(Math.round(day));

export interface LiveRow {
  id: string; // OQ id
  p6Id: string;
  name: string;
  chain: string; // stable chain name or 'Near-critical'
  gate?: string;
  path: 'CP1' | 'CP2' | 'CP3' | 'Near';
  owner: string;
  resource: string;
  costOMR: number;
  durationDays: number;
  remaining: number;
  ownDelay: number;
  recovered: number;
  planFinish: number;
  finish: number;
  shiftDays: number;
  floatDays: number;
  crit: Criticality;
  status: CPStatus;
  predecessors: string[];
  successors: string[];
  changeCount: number;
}

export interface Snapshot {
  rows: LiveRow[];
  endPlan: number;
  endNow: number;
  slipDays: number;
  endDate: string;
  planEndDate: string;
  chains: { gate: string; name: string; label: 'CP1' | 'CP2' | 'CP3'; arrival: number; floatDays: number }[];
  worstWindowOverrun: number;
  critCount: number;
  nearCount: number;
}

const LABELS = ['CP1', 'CP2', 'CP3'] as const;
const dailyCost = (r: { costOMR: number; durationDays: number }) => r.costOMR / Math.max(1, r.durationDays);

function snapshot(s: State, run: Run = compute(s)): Snapshot {
  const label = new Map(run.chains.map((c) => [c.gate, LABELS[c.rank]]));
  const rows: LiveRow[] = REPORTED.map((a) => {
    const tp = a.tpId!;
    const cpa = CP_META.get(tp);
    const sched = SCHED.get(tp);
    const gate = chainOf(a.id);
    const tf = Math.round(run.res.tf[a.id] * 1000) / 1000;
    const own = (SEED_OWN.get(a.id) ?? 0) + (s.delays[a.id] ?? 0) - (s.recov[a.id] ?? 0);
    const shift = run.res.ef[a.id] - PLAN.ef[a.id];
    const status: CPStatus = own > 0 ? 'delayed' : shift > 0.01 ? 'at-risk' : 'on-track';
    const dur = a.origDur || 1;
    const cost = cpa ? cpa.costOMR : Math.round((sched?.bluHours ?? 400) * 22);
    return {
      id: tp,
      p6Id: a.id,
      name: a.name,
      chain: gate ? CHAIN_NAMES[gate] : 'Near-critical work',
      gate,
      path: gate ? label.get(gate)! : 'Near',
      owner: cpa?.owner ?? sched?.contractor ?? '',
      resource: cpa?.resource ?? sched?.contractor ?? '',
      costOMR: cost,
      durationDays: dur,
      remaining: remaining(s)(a),
      ownDelay: own,
      recovered: s.recov[a.id] ?? 0,
      planFinish: PLAN.ef[a.id],
      finish: run.res.ef[a.id],
      shiftDays: shift,
      floatDays: tf,
      crit: criticalityOf(tf),
      status,
      predecessors: a.preds.map((p) => TP_OF.get(p.id) ?? p.id),
      successors: (SUCCS.get(a.id) ?? []).map((x) => TP_OF.get(x) ?? x),
      changeCount: (s.changeCount[tp] ?? 0),
    };
  });
  const endNow = run.res.ef[END_ID];
  const endPlan = PLAN.ef[END_ID];
  const worstWindowOverrun = Math.max(0, ...rows.filter((r) => r.path === 'Near').map((r) => -r.floatDays));
  return {
    rows,
    endPlan,
    endNow,
    slipDays: Math.round((endNow - endPlan) * 100) / 100,
    endDate: dateOf(endNow),
    planEndDate: dateOf(endPlan),
    chains: run.chains.map((c) => ({ gate: c.gate, name: CHAIN_NAMES[c.gate], label: LABELS[c.rank], arrival: c.arrival, floatDays: c.gateFloat })),
    worstWindowOverrun,
    critCount: rows.filter((r) => r.crit === 'critical').length,
    nearCount: rows.filter((r) => r.crit === 'near').length,
  };
}

// ------------------------------------------------------------------ reads used across the app
function asActivity(r: LiveRow): CriticalPathActivity {
  const meta = CP_META.get(r.id)!;
  return {
    id: r.id,
    name: r.name,
    path: r.path === 'Near' ? meta.path : r.path,
    status: r.status,
    changeCount: r.changeCount,
    plannedFinish: dateOf(r.planFinish),
    forecastFinish: dateOf(r.finish),
    owner: r.owner,
    predecessors: r.predecessors.filter((p) => p.startsWith('CPA-')),
    durationDays: r.durationDays,
    floatDays: Math.round(r.floatDays),
    resource: r.resource,
    costOMR: r.costOMR,
    logic: 'FS',
  };
}

export async function getCriticalPathActivities(): Promise<CriticalPathActivity[]> {
  return delay(snapshot(st).rows.filter((r) => r.id.startsWith('CPA-')).map(asActivity));
}

export async function getCpSnapshot(): Promise<Snapshot> {
  return delay(snapshot(st), 60);
}

export interface CpDay {
  day: number;
  changes: number;
  note: string;
}
export async function getCpDailyChanges(): Promise<CpDay[]> {
  return delay(st.daily.map((d) => ({ ...d })));
}

/** Record a change to the critical path itself (e.g. a P6 recalculation made new activities critical). */
export async function recordCpChange(note: string): Promise<void> {
  bump(note, 1);
  return delay(undefined, 60);
}
function bump(note: string, by: number) {
  st = { ...st, daily: st.daily.map((d, i) => (i === st.daily.length - 1 ? { ...d, changes: d.changes + by, note: d.note ? `${d.note}; ${note}` : note } : d)) };
}

export interface NearCritical {
  id: string;
  name: string;
  floatDays: number;
  driver: string;
  path: string;
  becameCritical?: boolean;
}
export async function getNearCritical(): Promise<NearCritical[]> {
  const rows = snapshot(st).rows.filter((r) => r.path === 'Near');
  return delay(
    nearCritical.map((n) => {
      const r = rows.find((x) => x.id === n.id);
      const f = r ? Math.round(r.floatDays) : n.floatDays;
      return { ...n, floatDays: f, becameCritical: f <= 0 };
    }),
    120
  );
}

export const getImpactAssumptions = () => ({ ...st.assumptions });
export function setImpactAssumptions(patch: Partial<Assumptions>) {
  st = { ...st, assumptions: { ...st.assumptions, ...patch } };
}
export const getDelayEvents = () => [...st.events];

// ------------------------------------------------------------------ delay, recovery, reset
export interface DelayInput {
  id: string; // OQ id
  days: number;
  cause: string;
}
export interface DelayResult {
  ok: boolean;
  error?: string;
  event?: DelayEvent;
  snapshot?: Snapshot;
  changedIds: string[];
}

function diffEvent(s0: State, s1: State, kind: DelayEvent['kind'], tp: string, days: number, cause: string, extraCost: number): DelayEvent {
  const r0 = compute(s0);
  const r1 = compute(s1);
  const a = snapshot(s0, r0);
  const b = snapshot(s1, r1);
  const before = new Map(a.rows.map((r) => [r.id, r]));
  const lines: ImpactLine[] = [];
  const newlyCritical: string[] = [];
  const dropped: string[] = [];
  const becameNear: string[] = [];
  for (const r of b.rows) {
    const o = before.get(r.id)!;
    const moved = r.finish - o.finish;
    if (Math.abs(moved) > 0.01) {
      lines.push({
        id: r.id,
        name: r.name,
        role: r.id === tp ? 'delayed' : 'knock-on',
        shiftDays: Math.round(moved * 10) / 10,
        floatBefore: Math.round(o.floatDays),
        floatAfter: Math.round(r.floatDays),
        crewCostOMR: moved > 0 ? Math.round(dailyCost(r) * moved * (r.id === tp ? 1 : 0.5) * s1.assumptions.standbyFactor) : 0,
      });
    }
    if (o.crit !== 'critical' && r.crit === 'critical') newlyCritical.push(r.id);
    if (o.crit === 'critical' && r.crit !== 'critical') dropped.push(r.id);
    if (o.crit === 'normal' && r.crit === 'near') becameNear.push(r.id);
  }
  if (!lines.some((l) => l.id === tp)) {
    const r = b.rows.find((x) => x.id === tp)!;
    lines.unshift({ id: tp, name: r.name, role: 'delayed', shiftDays: 0, floatBefore: Math.round(before.get(tp)!.floatDays), floatAfter: Math.round(r.floatDays), crewCostOMR: 0 });
  }
  lines.sort((x, y) => (x.role === y.role ? y.shiftDays - x.shiftDays : x.role === 'delayed' ? -1 : 1));
  const slipDelta = Math.max(0, b.slipDays - a.slipDays);
  const pathBefore = a.chains[0].gate;
  const pathAfter = b.chains[0].gate;
  const crew = lines.reduce((x, l) => x + l.crewCostOMR, 0);
  const standing = slipDelta * s1.assumptions.standingCostPerDay;
  const switched = pathBefore !== pathAfter;
  return {
    id: `CPE-${String(s1.seq).padStart(3, '0')}`,
    seq: s1.seq,
    day: STATUS_DAY,
    kind,
    activityId: tp,
    name: b.rows.find((x) => x.id === tp)!.name,
    days,
    cause,
    endBefore: a.endNow,
    endAfter: b.endNow,
    slipAfter: b.slipDays,
    slipDelta,
    newlyCritical,
    dropped,
    becameNear,
    pathBefore,
    pathAfter,
    switched,
    countedChange: kind !== 'recovery' ? newlyCritical.length > 0 || switched || slipDelta > 0.01 : false,
    costOMR: Math.round(crew + standing + (kind === 'recovery' ? extraCost : 0)),
    lines,
  };
}

export async function applyDelay(input: DelayInput): Promise<DelayResult> {
  const p6 = P6_OF.get(input.id);
  if (!p6 || !REPORTED.some((r) => r.id === p6)) return { ok: false, error: `${input.id} is not on the monitored network.`, changedIds: [] };
  if (!(input.days >= 1)) return { ok: false, error: 'Enter a delay of at least 1 day.', changedIds: [] };
  const s0 = st;
  const s1: State = { ...s0, delays: { ...s0.delays, [p6]: (s0.delays[p6] ?? 0) + input.days }, seq: s0.seq + 1, lastDelayId: input.id };
  const ev = diffEvent(s0, s1, 'delay', input.id, input.days, input.cause, 0);
  st = { ...s1, events: [ev, ...s0.events] };
  const touched = [...new Set([input.id, ...ev.newlyCritical, ...ev.lines.map((l) => l.id)])];
  st = { ...st, changeCount: { ...st.changeCount, ...Object.fromEntries(touched.map((id) => [id, (st.changeCount[id] ?? 0) + (id === input.id || ev.newlyCritical.includes(id) ? 1 : 0)])) } };
  if (ev.countedChange) {
    const bits = [
      ev.newlyCritical.length ? `${ev.newlyCritical.join(', ')} became critical` : '',
      ev.switched ? `driving path now ${CHAIN_NAMES[ev.pathAfter]}` : '',
      ev.endAfter > ev.endBefore ? `TA end +${Math.round((ev.endAfter - ev.endBefore) * 10) / 10} d` : '',
    ].filter(Boolean);
    bump(`${input.id} +${input.days} d (${input.cause}): ${bits.join(', ')}`, 1);
  }
  const changedIds = [...new Set([input.id, ...ev.newlyCritical, ...ev.dropped, ...ev.lines.map((l) => l.id)])];
  return delay({ ok: true, event: ev, snapshot: snapshot(st), changedIds }, 450);
}

export type RecoveryKind = 'night-crew' | 'resequence' | 'crash';
export const RECOVERY: Record<RecoveryKind, { label: string; days: number; costShare: number; minCost: number; blurb: string }> = {
  'night-crew': { label: 'Add night crew', days: 1, costShare: 0.18, minCost: 20_000, blurb: 'A second shift recovers 1 day on this activity.' },
  resequence: { label: 'Resequence / overlap', days: 1, costShare: 0.08, minCost: 12_000, blurb: 'Start the next activity in parallel to win back 1 day.' },
  crash: { label: 'Crash the activity', days: 2, costShare: 0.35, minCost: 45_000, blurb: 'Overtime and extra equipment recover 2 days.' },
};

export async function applyRecovery(id: string, kind: RecoveryKind): Promise<DelayResult> {
  const p6 = P6_OF.get(id);
  if (!p6) return { ok: false, error: 'Unknown activity', changedIds: [] };
  const spec = RECOVERY[kind];
  const row = snapshot(st).rows.find((r) => r.id === id)!;
  const room = Math.max(0, row.remaining - 1);
  const days = Math.min(spec.days, room);
  if (days < 1) return { ok: false, error: `${id} cannot be shortened further.`, changedIds: [] };
  const cost = Math.max(spec.minCost, Math.round(row.costOMR * spec.costShare));
  const s0 = st;
  const s1: State = { ...s0, recov: { ...s0.recov, [p6]: (s0.recov[p6] ?? 0) + days }, recovCost: s0.recovCost + cost, seq: s0.seq + 1 };
  const ev = diffEvent(s0, s1, 'recovery', id, -days, spec.label, cost);
  st = { ...s1, events: [ev, ...s0.events] };
  if (ev.pathBefore !== ev.pathAfter) bump(`${id} recovered ${days} d (${spec.label}): driving path now ${CHAIN_NAMES[ev.pathAfter]}`, 1);
  return delay({ ok: true, event: ev, snapshot: snapshot(st), changedIds: [id, ...ev.lines.map((l) => l.id)] }, 450);
}

/** Scripted delays for the demo button: each one shows a different thing the monitor does. */
export const DELAY_SCRIPT: (DelayInput & { note: string })[] = [
  { id: 'CPA-005', days: 2, cause: 'Crane conflict: 250 t crane held on the C-301 rotor lift (RSK-03)', note: 'CP2 slips, the driving path switches and the TA end moves' },
  { id: 'ACT-318', days: 2, cause: 'Laser alignment kit faulty (tool crib has no second kit)', note: 'A near-critical activity (float 1 d) becomes critical' },
  { id: 'ACT-231', days: 3, cause: 'Welder shortage on the night shift', note: 'Float 2 d is used up; the Unit 200 hand-back window overruns' },
  { id: 'CPA-006', days: 4, cause: 'Rotor journal damage found at inspection (discovery job)', note: 'CP3 takes over as the driving path' },
];
export async function applyScriptedDelay(): Promise<DelayResult & { script?: (typeof DELAY_SCRIPT)[number] }> {
  const step = DELAY_SCRIPT[st.script % DELAY_SCRIPT.length];
  st = { ...st, script: st.script + 1 };
  const r = await applyDelay(step);
  return { ...r, script: step };
}

export async function resetCpDemo(): Promise<void> {
  st = freshState();
  return delay(undefined, 120);
}

/** Dates and float written back from the P6 schedule (integration): P6's own delay on an activity becomes a delay here. */
export async function applyP6Schedule(updates: { id: string; forecastFinish: string; floatDays: number }[], cpNote: string | null): Promise<void> {
  const order = [...updates].sort((a, b) => a.forecastFinish.localeCompare(b.forecastFinish));
  for (const u of order) {
    const p6 = P6_OF.get(u.id);
    if (!p6 || !REPORTED.some((r) => r.id === p6)) continue;
    const now = snapshot(st).rows.find((r) => r.id === u.id);
    if (!now) continue;
    const extra = Math.round(dayNum(u.forecastFinish) - now.finish);
    if (extra >= 1) st = { ...st, delays: { ...st.delays, [p6]: (st.delays[p6] ?? 0) + extra }, changeCount: { ...st.changeCount, [u.id]: (st.changeCount[u.id] ?? 0) + 1 } };
  }
  if (cpNote) await recordCpChange(cpNote);
}
const dayNum = (iso: string) => Math.round((new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${dayToDate(1)}T00:00:00Z`).getTime()) / 86_400_000) + 1;
