// Manpower plan vs actual (attendance, G7), mobilisation series and resource histogram (R4, SOW dry run 10).
//
// PBC 03 #7: contractor mobilisation is tracked from the site attendance (badge / access-control) system. The real flow is
//   contractor submits the manpower list -> HSE induction -> badge issued -> badge-in at the gate = manpower on site.
// This file is the single in-memory store behind the Attendance, Mobilization and Discipline pages, so a swipe synced on
// one page moves the numbers on all of them. Everything here is simulated; `resetWorkforce()` restores the seed.
import { CONTRACTORS } from '../mocks/master';
import { HEADCOUNT_TODAY, MANHOURS_TODAY_ACTUAL, MANHOURS_TODAY_PLANNED } from '../mocks/progress';
import { scheduleActivities } from '../mocks/scheduleMock';
import { STATUS_DAY, pick, rng } from '../mocks/_gen';
import { delay } from './_util';

export interface AttRow {
  contractor: string;
  planDay: number;
  planNight: number;
  actDay: number;
  actNight: number;
  peak: number;
  discipline: string;
}

export interface CheckIn {
  at: string;
  who: string;
  contractor: string;
  shift: 'Day' | 'Night';
  gate: string;
  trade?: string;
  direction?: 'In' | 'Out';
  result?: 'Granted' | 'Denied';
  reason?: string;
  badge?: string;
  /** first badge-in of a person who went through induction: marks them "Mobilized" */
  firstEntry?: boolean;
  personId?: string;
  /** shown in the feed as a system line (shift change) rather than a person */
  system?: boolean;
}

type Shift = 'Day' | 'Night';
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const HPH = HEADCOUNT_TODAY.hoursPerHead;

// ---------------------------------------------------------------- seed data
// Day 14 attendance: the totals reconcile with HEADCOUNT_TODAY (1,130 / 480 planned, 1,058 / 455 actual).
const SEED_ROWS: AttRow[] = [
  { contractor: 'Galfar', planDay: 450, planNight: 200, actDay: 418, actNight: 188, peak: 820, discipline: 'Mechanical, Process, Rotating' },
  { contractor: 'Larsen & Toubro', planDay: 240, planNight: 100, actDay: 226, actNight: 96, peak: 410, discipline: 'Reactor, Exchangers, Heaters' },
  { contractor: 'Petrofac Services', planDay: 105, planNight: 35, actDay: 102, actNight: 33, peak: 160, discipline: 'Inspection, NDT' },
  { contractor: 'Zubair E&M', planDay: 150, planNight: 50, actDay: 139, actNight: 47, peak: 240, discipline: 'Electrical, Instrumentation' },
  { contractor: 'Sohar Industrial Services', planDay: 185, planNight: 95, actDay: 173, actNight: 91, peak: 330, discipline: 'Scaffold, Insulation, Civil, Waste' },
];

/** Trades per contractor and their share of the crew (shares sum to 1). */
export const TRADES: Record<string, [string, number][]> = {
  Galfar: [['Pipe fitters', 0.34], ['Welders', 0.26], ['Mechanical fitters', 0.18], ['Riggers', 0.14], ['Supervisors', 0.08]],
  'Larsen & Toubro': [['Welders', 0.3], ['Exchanger fitters', 0.28], ['Hydrojet operators', 0.2], ['Refractory crew', 0.14], ['Supervisors', 0.08]],
  'Petrofac Services': [['NDT technicians', 0.46], ['Inspectors', 0.34], ['PSV bench techs', 0.2]],
  'Zubair E&M': [['Electricians', 0.44], ['Instrument techs', 0.4], ['Supervisors', 0.16]],
  'Sohar Industrial Services': [['Scaffolders', 0.38], ['Insulators', 0.26], ['Painters / blasters', 0.16], ['General labour', 0.2]],
};

/** Largest-remainder split so the trade numbers add up exactly to the contractor total. */
function split(total: number, shares: number[]): number[] {
  const raw = shares.map((s) => s * total);
  const base = raw.map(Math.floor);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < total - sum(base); k++) base[order[k % order.length][1]]++;
  return base;
}

interface TradeCell {
  planDay: number;
  planNight: number;
  actDay: number;
  actNight: number;
}
type TradeMap = Record<string, Record<string, TradeCell>>;

function seedTrades(rows: AttRow[]): TradeMap {
  const out: TradeMap = {};
  for (const r of rows) {
    const t = TRADES[r.contractor];
    const shares = t.map((x) => x[1]);
    const pd = split(r.planDay, shares);
    const pn = split(r.planNight, shares);
    const ad = split(r.actDay, shares);
    const an = split(r.actNight, shares);
    out[r.contractor] = Object.fromEntries(t.map(([name], i) => [name, { planDay: pd[i], planNight: pn[i], actDay: ad[i], actNight: an[i] }]));
  }
  return out;
}

// ---------------------------------------------------------------- roster (the arrival batch)
export type PersonState = 'Not cleared' | 'Badged' | 'Mobilized';
export interface Person {
  id: string;
  name: string;
  contractor: string;
  trade: string;
  shift: Shift;
  induction: 'Done' | 'Pending';
  medical: 'Valid' | 'Expired' | 'Pending';
  training: 'Valid' | 'Expired' | 'Pending';
  badge: string | null;
  state: PersonState;
  firstEntry?: string;
  gate?: string;
  attempted?: boolean;
}

/** Open items that block a badge for this person. */
export const blockers = (p: Person): string[] => [
  ...(p.induction !== 'Done' ? ['HSE induction pending'] : []),
  ...(p.medical !== 'Valid' ? [p.medical === 'Expired' ? 'medical expired' : 'medical pending'] : []),
  ...(p.training !== 'Valid' ? [p.training === 'Expired' ? 'training expired' : 'training pending'] : []),
];

// [name, contractor, trade, shift, code]  code: M mobilized, B badged (awaiting first entry), I induction pending, E medical expired, T training expired
type R = [string, string, string, Shift, 'M' | 'B' | 'I' | 'E' | 'T'];
const ROSTER_SEED: R[] = [
  ['Imran Qureshi', 'Galfar', 'Welders', 'Day', 'M'],
  ['Suresh Babu', 'Galfar', 'Pipe fitters', 'Day', 'B'],
  ['Khalid Al-Siyabi', 'Galfar', 'Riggers', 'Day', 'B'],
  ['Joseph Mathew', 'Galfar', 'Welders', 'Night', 'B'],
  ['Pradeep Nair', 'Galfar', 'Mechanical fitters', 'Day', 'E'],
  ['Hamed Al-Farsi', 'Galfar', 'Pipe fitters', 'Night', 'B'],
  ['Rakesh Menon', 'Larsen & Toubro', 'Welders', 'Night', 'M'],
  ['Anil Kumar', 'Larsen & Toubro', 'Welders', 'Night', 'B'],
  ['Vijay Patil', 'Larsen & Toubro', 'Exchanger fitters', 'Day', 'B'],
  ['Mohan Raj', 'Larsen & Toubro', 'Hydrojet operators', 'Day', 'I'],
  ['Satish Gowda', 'Larsen & Toubro', 'Welders', 'Night', 'B'],
  ['Deepak Shetty', 'Larsen & Toubro', 'Refractory crew', 'Day', 'T'],
  ['Faisal Al-Abri', 'Petrofac Services', 'NDT technicians', 'Day', 'B'],
  ['Nikhil Joshi', 'Petrofac Services', 'Inspectors', 'Day', 'B'],
  ['Omar Al-Hinai', 'Petrofac Services', 'PSV bench techs', 'Day', 'M'],
  ['Tariq Mehmood', 'Petrofac Services', 'NDT technicians', 'Night', 'E'],
  ['Sanjay Iyer', 'Zubair E&M', 'Electricians', 'Day', 'B'],
  ['Yousuf Al-Rawahi', 'Zubair E&M', 'Instrument techs', 'Day', 'B'],
  ['Ravi Teja', 'Zubair E&M', 'Instrument techs', 'Day', 'M'],
  ['Gopal Krishnan', 'Zubair E&M', 'Electricians', 'Night', 'B'],
  ['Ahmed Saleem', 'Zubair E&M', 'Electricians', 'Day', 'T'],
  ['Thomas George', 'Zubair E&M', 'Supervisors', 'Day', 'B'],
  ['Salim Al-Kindi', 'Sohar Industrial Services', 'Scaffolders', 'Day', 'M'],
  ['Mubarak Al-Shukaili', 'Sohar Industrial Services', 'Scaffolders', 'Day', 'B'],
  ['Raju Thapa', 'Sohar Industrial Services', 'Insulators', 'Day', 'B'],
  ['Binod Gurung', 'Sohar Industrial Services', 'General labour', 'Night', 'B'],
  ['Kamal Hossain', 'Sohar Industrial Services', 'Painters / blasters', 'Day', 'I'],
  ['Naseer Ahmad', 'Sohar Industrial Services', 'Scaffolders', 'Night', 'B'],
  ['Dinesh Pillai', 'Sohar Industrial Services', 'Insulators', 'Day', 'B'],
];

function seedRoster(): Person[] {
  return ROSTER_SEED.map(([name, contractor, trade, shift, code], i) => {
    const cleared = code === 'M' || code === 'B';
    return {
      id: `MP-${String(i + 1).padStart(3, '0')}`,
      name,
      contractor,
      trade,
      shift,
      induction: code === 'I' ? 'Pending' : 'Done',
      medical: code === 'E' ? 'Expired' : 'Valid',
      training: code === 'T' ? 'Expired' : 'Valid',
      badge: cleared ? `B-${4100 + i}` : null,
      state: code === 'M' ? 'Mobilized' : cleared ? 'Badged' : 'Not cleared',
      firstEntry: code === 'M' ? `05:${String(41 + (i % 15)).padStart(2, '0')}` : undefined,
      gate: code === 'M' ? 'Gate 2' : undefined,
    } as Person;
  });
}

// Funnel targets at the start of the demo: planned (peak) -> manpower list submitted -> inducted -> badged. "On site today" is live.
const FUNNEL_TARGET: Record<string, { submitted: number; inducted: number; badged: number }> = {
  Galfar: { submitted: 812, inducted: 781, badged: 748 },
  'Larsen & Toubro': { submitted: 404, inducted: 381, badged: 362 },
  'Petrofac Services': { submitted: 160, inducted: 154, badged: 148 },
  'Zubair E&M': { submitted: 236, inducted: 226, badged: 213 },
  'Sohar Industrial Services': { submitted: 326, inducted: 311, badged: 296 },
};

export interface FunnelRow {
  contractor: string;
  planned: number;
  submitted: number;
  inducted: number;
  badged: number;
  onSite: number;
  /** people in the arrival batch who are not cleared yet */
  blocked: number;
  /** people with a badge who have not badged in yet */
  awaiting: number;
}

// ---------------------------------------------------------------- equipment
export interface EquipRow {
  id: string;
  contractor: string;
  item: string;
  plan: number;
  actual: number;
  /** P6 activities that need this equipment */
  p6Ids: string[];
}
const SEED_EQUIP: EquipRow[] = [
  { id: 'EM-01', contractor: 'Galfar', item: 'Cranes (250 t / 80 t / 50 t)', plan: 5, actual: 5, p6Ids: ['CDU-2010', 'FCC-2010'] },
  { id: 'EM-02', contractor: 'Galfar', item: 'Welding rigs', plan: 42, actual: 38, p6Ids: ['CDU-2040', 'FLR-2005'] },
  { id: 'EM-03', contractor: 'Larsen & Toubro', item: 'Hydrojet units', plan: 6, actual: 6, p6Ids: ['CDU-2005'] },
  { id: 'EM-04', contractor: 'Larsen & Toubro', item: 'Bolt tensioning sets', plan: 12, actual: 11, p6Ids: ['CDU-1020', 'CDU-1030'] },
  { id: 'EM-05', contractor: 'Petrofac Services', item: 'NDT / ECT rigs', plan: 8, actual: 8, p6Ids: ['CDU-1020'] },
  { id: 'EM-06', contractor: 'Zubair E&M', item: 'Loop calibrators', plan: 14, actual: 13, p6Ids: ['HCU-3020', 'HCU-3030'] },
  { id: 'EM-07', contractor: 'Sohar Industrial Services', item: 'Manlifts', plan: 16, actual: 14, p6Ids: ['FCC-1020', 'CDU-4010'] },
  { id: 'EM-08', contractor: 'Sohar Industrial Services', item: 'Vacuum trucks', plan: 4, actual: 4, p6Ids: ['HCU-1009'] },
];

// ---------------------------------------------------------------- attendance system (access control) connector
export interface Reader {
  id: string;
  name: string;
  lanes: number;
  status: 'Online' | 'Degraded';
  swipes: number;
  denied: number;
  last: string;
}
export interface Connector {
  system: string;
  protocol: string;
  status: 'Connected' | 'Syncing';
  lastSync: string;
  lastCount: number;
  syncs: number;
}

const SEED_READERS: Reader[] = [
  { id: 'Gate 2', name: 'Gate 2 · main contractor entrance', lanes: 8, status: 'Online', swipes: 1128, denied: 6, last: '05:58' },
  { id: 'Gate 3', name: 'Gate 3 · Unit 200/300 side entrance', lanes: 4, status: 'Online', swipes: 641, denied: 2, last: '05:56' },
  { id: 'Gate 5', name: 'Gate 5 · pipe rack 4 / flare entrance', lanes: 2, status: 'Degraded', swipes: 212, denied: 1, last: '05:52' },
  { id: 'Camp', name: 'Camp bus bay · boarding reader', lanes: 4, status: 'Online', swipes: 1490, denied: 0, last: '05:49' },
];
const GATES = ['Gate 2', 'Gate 3', 'Gate 5'];
const NAMES = ['M. Khan', 'S. Ali', 'R. Das', 'J. Thomas', 'A. Al-Balushi', 'P. Reddy', 'H. Al-Rashdi', 'V. Nair', 'K. Singh', 'T. Mathew', 'O. Al-Hinai', 'D. Silva'];

// ---------------------------------------------------------------- store
interface State {
  rows: AttRow[];
  trades: TradeMap;
  feed: CheckIn[];
  roster: Person[];
  base: Record<string, { submitted: number; inducted: number; badged: number }>;
  equipment: EquipRow[];
  readers: Reader[];
  connector: Connector;
  clock: number; // minutes since midnight
  shift: Shift;
  shiftChanges: number;
  seq: number;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function contribution(c: string, roster: Person[]) {
  const mine = roster.filter((p) => p.contractor === c);
  return { submitted: mine.length, inducted: mine.filter((p) => p.induction === 'Done').length, badged: mine.filter((p) => p.badge).length };
}

function initState(): State {
  const rows = SEED_ROWS.map((r) => ({ ...r }));
  const roster = seedRoster();
  const feed: CheckIn[] = Array.from({ length: 12 }, (_, i) => {
    const r = rng(300 + i);
    const c = pick(r, CONTRACTORS).name;
    return { at: `05:${String(58 - i * 2).padStart(2, '0')}`, who: NAMES[i % NAMES.length], contractor: c, shift: i % 4 === 0 ? ('Night' as const) : ('Day' as const), gate: pick(r, GATES), direction: 'In' as const, result: 'Granted' as const };
  });
  const base = Object.fromEntries(
    Object.entries(FUNNEL_TARGET).map(([c, t]) => {
      const k = contribution(c, roster);
      return [c, { submitted: t.submitted - k.submitted, inducted: t.inducted - k.inducted, badged: t.badged - k.badged }];
    })
  );
  return {
    rows,
    trades: seedTrades(rows),
    feed,
    roster,
    base,
    equipment: SEED_EQUIP.map((e) => ({ ...e })),
    readers: SEED_READERS.map((r) => ({ ...r })),
    connector: { system: 'Site access-control system (badge readers)', protocol: 'REST pull, 5-minute poll · CSV drop as fallback', status: 'Connected', lastSync: '05:55', lastCount: 0, syncs: 0 },
    clock: 6 * 60 + 10,
    shift: 'Day',
    shiftChanges: 0,
    seq: 0,
  };
}

let S = initState();
let version = 0;
const subs = new Set<() => void>();
function emit() {
  version++;
  subs.forEach((f) => f());
}
/** For useSyncExternalStore-style hooks: pages re-read the store whenever the version moves. */
export const subscribeWorkforce = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};
export const workforceVersion = () => version;

export function resetWorkforce() {
  S = initState();
  auto = { on: false, everySec: 15, runs: 0 };
  emit();
}

// ---------------------------------------------------------------- automatic sync (PBC 7: "the same can be automated")
// A scheduled poll of the attendance system. In production it is a server job (5-minute poll); the demo runs it from the
// Attendance page every few seconds so it can be watched. The switch and interval survive leaving the page.
let auto = { on: false, everySec: 15, runs: 0 };
export const getAutoSync = () => ({ ...auto });
export function setAutoSync(on: boolean, everySec: number = auto.everySec) {
  auto = { ...auto, on, everySec };
  emit();
}
export function noteAutoRun() {
  auto = { ...auto, runs: auto.runs + 1 };
  emit();
}

// ---------------------------------------------------------------- core mutations
function setRow(contractor: string, patch: (r: AttRow) => AttRow) {
  S.rows = S.rows.map((r) => (r.contractor === contractor ? patch(r) : r));
}

function tradeGap(c: string, trade: string, shift: Shift, extra = 0) {
  const t = S.trades[c][trade];
  return shift === 'Day' ? t.planDay - t.actDay - extra : t.planNight - t.actNight - extra;
}

/** The trade with the biggest shortfall on a shift, so new heads go where the plan is short. */
function pickTrade(c: string, shift: Shift, alloc: Record<string, number> = {}): string {
  const names = Object.keys(S.trades[c]);
  return names.reduce((best, n) => (tradeGap(c, n, shift, alloc[n] ?? 0) > tradeGap(c, best, shift, alloc[best] ?? 0) ? n : best), names[0]);
}

/** Add heads on site. A contractor can run slightly over plan (cap: plan + 8 day / + 6 night, as before). Returns heads added. */
function addHeads(c: string, shift: Shift, n: number, preferTrade?: string): number {
  let added = 0;
  for (let i = 0; i < n; i++) {
    const row = S.rows.find((r) => r.contractor === c)!;
    const cap = shift === 'Day' ? row.planDay + 8 : row.planNight + 6;
    if ((shift === 'Day' ? row.actDay : row.actNight) >= cap) break;
    const trade = preferTrade && i === 0 ? preferTrade : pickTrade(c, shift);
    const cell = S.trades[c][trade];
    S.trades = { ...S.trades, [c]: { ...S.trades[c], [trade]: shift === 'Day' ? { ...cell, actDay: cell.actDay + 1 } : { ...cell, actNight: cell.actNight + 1 } } };
    setRow(c, (r) => (shift === 'Day' ? { ...r, actDay: r.actDay + 1 } : { ...r, actNight: r.actNight + 1 }));
    added++;
  }
  return added;
}

function pushFeed(...ev: CheckIn[]) {
  S.feed = [...ev, ...S.feed].slice(0, 40);
}
function bumpReader(gate: string, denied: boolean, at: string) {
  S.readers = S.readers.map((r) => (r.id === gate ? { ...r, swipes: r.swipes + 1, denied: r.denied + (denied ? 1 : 0), last: at } : r));
}

// ---------------------------------------------------------------- readers: totals and snapshots
export function totals(list: AttRow[] = S.rows) {
  const planDay = sum(list.map((r) => r.planDay));
  const planNight = sum(list.map((r) => r.planNight));
  const actDay = sum(list.map((r) => r.actDay));
  const actNight = sum(list.map((r) => r.actNight));
  return { planDay, planNight, actDay, actNight, plan: planDay + planNight, actual: actDay + actNight, planMh: Math.round((planDay + planNight) * HPH), actualMh: Math.round((actDay + actNight) * HPH) };
}

export async function getAttendance(): Promise<{ rows: AttRow[]; feed: CheckIn[]; totals: ReturnType<typeof totals> }> {
  return delay({ rows: S.rows.map((r) => ({ ...r })), feed: [...S.feed], totals: totals() }, 150);
}

export const attendanceRows = (): AttRow[] => S.rows.map((r) => ({ ...r }));
export const attendanceFeed = (): CheckIn[] => [...S.feed];
export const getRoster = (): Person[] => S.roster.map((p) => ({ ...p }));
export const getReaders = (): Reader[] => S.readers.map((r) => ({ ...r }));
export const getConnector = (): Connector => ({ ...S.connector });
export const currentShift = () => S.shift;
export const listEquipment = (): EquipRow[] => S.equipment.map((e) => ({ ...e }));

/** People physically on site right now = the shift that is currently in. */
export function onSiteNow() {
  const t = totals();
  const planNow = S.shift === 'Day' ? t.planDay : t.planNight;
  const actNow = S.shift === 'Day' ? t.actDay : t.actNight;
  return { shift: S.shift, plan: planNow, actual: actNow, clock: hhmm(S.clock), shiftChanges: S.shiftChanges };
}

export interface TradeRow {
  contractor: string;
  trade: string;
  planDay: number;
  planNight: number;
  actDay: number;
  actNight: number;
}
export function tradeBreakdown(contractor?: string): TradeRow[] {
  return Object.entries(S.trades)
    .filter(([c]) => !contractor || c === contractor)
    .flatMap(([c, ts]) => Object.entries(ts).map(([trade, v]) => ({ contractor: c, trade, ...v })));
}

export function funnel(): FunnelRow[] {
  return S.rows.map((r) => {
    const k = contribution(r.contractor, S.roster);
    const b = S.base[r.contractor];
    const mine = S.roster.filter((p) => p.contractor === r.contractor);
    return {
      contractor: r.contractor,
      planned: r.peak,
      submitted: b.submitted + k.submitted,
      inducted: b.inducted + k.inducted,
      badged: b.badged + k.badged,
      onSite: r.actDay + r.actNight,
      blocked: mine.filter((p) => p.state === 'Not cleared').length,
      awaiting: mine.filter((p) => p.state === 'Badged').length,
    };
  });
}

export function funnelTotal(rows: FunnelRow[] = funnel()): FunnelRow {
  const f = (k: keyof FunnelRow) => sum(rows.map((r) => r[k] as number));
  return { contractor: 'All contractors', planned: f('planned'), submitted: f('submitted'), inducted: f('inducted'), badged: f('badged'), onSite: f('onSite'), blocked: f('blocked'), awaiting: f('awaiting') };
}

// ---------------------------------------------------------------- readiness and shortfall alerts
export interface Readiness {
  contractor: string;
  manpowerPct: number;
  equipmentPct: number;
  clearedPct: number;
  readiness: number;
  gapHeads: number;
}

export function readiness(): Readiness[] {
  const fun = funnel();
  return S.rows.map((r) => {
    const plan = r.planDay + r.planNight;
    const act = r.actDay + r.actNight;
    const eq = S.equipment.filter((e) => e.contractor === r.contractor);
    const manpowerPct = Math.min(100, (act / plan) * 100);
    const equipmentPct = eq.length ? Math.min(100, (sum(eq.map((e) => Math.min(e.actual, e.plan))) / sum(eq.map((e) => e.plan))) * 100) : 100;
    const f = fun.find((x) => x.contractor === r.contractor)!;
    const clearedPct = Math.min(100, (f.badged / f.submitted) * 100);
    return { contractor: r.contractor, manpowerPct, equipmentPct, clearedPct, readiness: Math.round(0.5 * manpowerPct + 0.3 * equipmentPct + 0.2 * clearedPct), gapHeads: Math.max(0, plan - act) };
  });
}

export interface RiskActivity {
  p6Id: string;
  name: string;
  startDay: number;
  endDay: number;
  pct: number;
  cp?: string;
}
export interface ShortfallAlert {
  id: string;
  kind: 'Manpower' | 'Equipment';
  contractor: string;
  severity: 'warn' | 'crit';
  title: string;
  detail: string;
  gap: number;
  gapPct: number;
  /** man-hours per day not being worked because of the gap */
  mhPerDay: number;
  costPerDayOMR: number;
  slipDays: number;
  activity?: RiskActivity;
  /** contractors can not see cost */
  discipline?: string;
}

const RISK_FIELDS = (a: (typeof scheduleActivities)[number]): RiskActivity => ({ p6Id: a.p6Id, name: a.name, startDay: a.startDay, endDay: a.endDay, pct: a.pct, cp: a.cp });

function activityAtRisk(contractor: string, shift?: Shift): (typeof scheduleActivities)[number] | undefined {
  const live = scheduleActivities.filter((a) => a.contractor === contractor && a.pct < 100 && a.startDay <= STATUS_DAY + 3 && a.endDay >= STATUS_DAY);
  const pref = shift === 'Night' ? live.filter((a) => a.calendar === '12h Night' || a.calendar === '7-day') : live;
  const pool = pref.length ? pref : live;
  return [...pool].sort((a, b) => b.bluHours * (1 - b.pct / 100) - a.bluHours * (1 - a.pct / 100))[0];
}

export function shortfallAlerts(): ShortfallAlert[] {
  const out: ShortfallAlert[] = [];
  for (const r of S.rows) {
    const gapDay = r.planDay - r.actDay;
    const gapNight = r.planNight - r.actNight;
    const gap = gapDay + gapNight;
    const plan = r.planDay + r.planNight;
    if (gap / plan >= 0.04) {
      const worst: Shift = gapNight / r.planNight > gapDay / r.planDay ? 'Night' : 'Day';
      const act = activityAtRisk(r.contractor, worst);
      const remaining = act ? Math.max(1, act.endDay - STATUS_DAY + 1) : 1;
      const mh = Math.round(gap * HPH);
      out.push({
        id: `AL-MP-${r.contractor}`,
        kind: 'Manpower',
        contractor: r.contractor,
        severity: gap / plan >= 0.1 ? 'crit' : 'warn',
        title: `${r.contractor}: ${gap} heads short of plan`,
        detail: `Day ${r.actDay}/${r.planDay}, Night ${r.actNight}/${r.planNight}. Biggest gap on ${worst} shift.`,
        gap,
        gapPct: (gap / plan) * 100,
        mhPerDay: mh,
        costPerDayOMR: Math.round(mh * 14.5),
        slipDays: Math.round(((gap / plan) * remaining) * 10) / 10,
        activity: act && RISK_FIELDS(act),
        discipline: act?.discipline,
      });
    }
  }
  for (const e of S.equipment) {
    const gap = e.plan - e.actual;
    if (gap > 0 && gap / e.plan >= 0.07) {
      const acts = e.p6Ids.map((id) => scheduleActivities.find((a) => a.p6Id === id)).filter((a): a is (typeof scheduleActivities)[number] => Boolean(a));
      const act = [...acts].sort((a, b) => b.bluHours * (1 - b.pct / 100) - a.bluHours * (1 - a.pct / 100))[0];
      const remaining = act ? Math.max(1, act.endDay - STATUS_DAY + 1) : 1;
      const mh = Math.round((gap / e.plan) * (act?.bluHours ?? 400) * 0.12);
      out.push({
        id: `AL-EQ-${e.id}`,
        kind: 'Equipment',
        contractor: e.contractor,
        severity: gap / e.plan >= 0.1 ? 'crit' : 'warn',
        title: `${e.contractor}: ${gap} ${e.item.replace(/ \(.*\)/, '').toLowerCase()} not on site`,
        detail: `${e.actual} of ${e.plan} mobilised. Needed by ${e.p6Ids.join(', ')}.`,
        gap,
        gapPct: (gap / e.plan) * 100,
        mhPerDay: mh,
        costPerDayOMR: Math.round(mh * 14.5),
        slipDays: Math.round(((gap / e.plan) * remaining * 1.5) * 10) / 10,
        activity: act && RISK_FIELDS(act),
        discipline: act?.discipline,
      });
    }
  }
  return out.sort((a, b) => (a.severity === b.severity ? b.gapPct - a.gapPct : a.severity === 'crit' ? -1 : 1));
}

// ---------------------------------------------------------------- attendance system sync (simulated)
/**
 * Builds the day's pending badge swipes the way the access-control system would return them: first-entry swipes of
 * people who were inducted and badged, denied attempts of people who are not cleared, and returning workers.
 * Nothing is applied yet: the UI applies them one by one with `applySwipe` so the feed can animate.
 */
export function pullSwipes(): CheckIn[] {
  S.connector = { ...S.connector, status: 'Syncing' };
  emit();
  let t = S.clock;
  const next = () => hhmm(t++);
  const gateOf = (i: number) => GATES[i % GATES.length];
  const arrivals: CheckIn[] = S.roster
    .filter((p) => p.state === 'Badged')
    .map((p, i) => ({ at: '', who: p.name, contractor: p.contractor, trade: p.trade, shift: p.shift, gate: gateOf(i), direction: 'In' as const, result: 'Granted' as const, firstEntry: true, badge: p.badge ?? undefined, personId: p.id }));
  const denied: CheckIn[] = S.roster
    .filter((p) => p.state === 'Not cleared' && !p.attempted)
    .slice(0, 2)
    .map((p, i) => ({ at: '', who: p.name, contractor: p.contractor, trade: p.trade, shift: p.shift, gate: gateOf(i + 1), direction: 'In' as const, result: 'Denied' as const, reason: blockers(p).join(', '), badge: p.badge ?? undefined, personId: p.id }));
  // returning workers who are still short against plan
  const alloc: Record<string, number> = {};
  const returning: CheckIn[] = [];
  const sumAlloc = (c: string, s: Shift) => alloc[`${c}|${s}`] ?? 0;
  for (let i = 0; i < 6; i++) {
    let best: { c: string; s: Shift; gap: number } | undefined;
    for (const r of S.rows)
      for (const s of ['Day', 'Night'] as Shift[]) {
        const gap = (s === 'Day' ? r.planDay - r.actDay : r.planNight - r.actNight) - sumAlloc(r.contractor, s);
        if (gap > 0 && (!best || gap > best.gap)) best = { c: r.contractor, s, gap };
      }
    if (!best) break;
    alloc[`${best.c}|${best.s}`] = sumAlloc(best.c, best.s) + 1;
    const tradeAlloc: Record<string, number> = {};
    for (const e of returning) if (e.contractor === best.c && e.shift === best.s && e.trade) tradeAlloc[e.trade] = (tradeAlloc[e.trade] ?? 0) + 1;
    returning.push({ at: '', who: `${NAMES[(S.seq + i) % NAMES.length]} (returning)`, contractor: best.c, trade: pickTrade(best.c, best.s, tradeAlloc), shift: best.s, gate: gateOf(i), direction: 'In', result: 'Granted', badge: `B-${3000 + ((S.seq + i) * 7) % 900}` });
  }
  S.seq += 6;
  // interleave: a denied attempt after the 2nd and 5th swipe so the feed reads like a real gate
  const merged: CheckIn[] = [];
  const pool = [...arrivals, ...returning];
  pool.forEach((e, i) => {
    merged.push(e);
    if (i === 1 && denied[0]) merged.push(denied[0]);
    if (i === 4 && denied[1]) merged.push(denied[1]);
  });
  if (pool.length <= 1) merged.push(...denied.filter((d) => !merged.includes(d)));
  return merged.map((e) => ({ ...e, at: next() }));
}

/** Applies one swipe to the store: heads on site, first-entry mobilisation, reader counters and the feed. */
export function applySwipe(ev: CheckIn) {
  S.clock = Math.max(S.clock, Number(ev.at.slice(0, 2)) * 60 + Number(ev.at.slice(3)) + 1);
  if (ev.result === 'Denied') {
    S.roster = S.roster.map((p) => (p.id === ev.personId ? { ...p, attempted: true } : p));
  } else {
    addHeads(ev.contractor, ev.shift, 1, ev.trade);
    if (ev.personId) S.roster = S.roster.map((p) => (p.id === ev.personId ? { ...p, state: 'Mobilized', firstEntry: ev.at, gate: ev.gate } : p));
  }
  bumpReader(ev.gate, ev.result === 'Denied', ev.at);
  pushFeed(ev);
  emit();
}

export function finishSync(count: number) {
  S.connector = { ...S.connector, status: 'Connected', lastSync: hhmm(S.clock), lastCount: count, syncs: S.connector.syncs + 1 };
  emit();
}

/** HSE completes the missing induction / medical / training and issues the badge: next sync lets them in. */
export function clearPerson(id: string): Person | undefined {
  const p = S.roster.find((x) => x.id === id);
  if (!p) return undefined;
  const done: Person = { ...p, induction: 'Done', medical: 'Valid', training: 'Valid', badge: p.badge ?? `B-${4500 + S.seq++}`, state: 'Badged' };
  S.roster = S.roster.map((x) => (x.id === id ? done : x));
  emit();
  return done;
}

/** Day shift badges out, night shift badges in (or the reverse). */
export function shiftChange() {
  const from = S.shift;
  const to: Shift = from === 'Day' ? 'Night' : 'Day';
  const t = totals();
  const out = from === 'Day' ? t.actDay : t.actNight;
  const inn = to === 'Day' ? t.actDay : t.actNight;
  const planIn = to === 'Day' ? t.planDay : t.planNight;
  S.clock = to === 'Night' ? 18 * 60 : 6 * 60;
  S.shift = to;
  S.shiftChanges++;
  const at = hhmm(S.clock);
  const samples: CheckIn[] = S.rows.slice(0, 3).map((r, i) => ({ at: hhmm(S.clock + 2 + i), who: `${r.contractor} ${to.toLowerCase()} crew`, contractor: r.contractor, shift: to, gate: GATES[i % GATES.length], direction: 'In', result: 'Granted', reason: `${to === 'Day' ? r.actDay : r.actNight} badge-ins` }));
  pushFeed({ at, who: `Shift change: ${from} shift badged out (${out.toLocaleString()}), ${to} shift in (${inn.toLocaleString()})`, contractor: 'All contractors', shift: to, gate: 'All gates', system: true }, ...samples);
  S.clock += 6;
  emit();
  return { from, to, out, inn, planIn, short: Math.max(0, planIn - inn) };
}

// ---------------------------------------------------------------- simulated contractor actions
/** Simple badge check-ins at the gate (kept for the original "Simulate check-ins" control). */
export async function checkIn(contractor: string, shift: Shift, n: number): Promise<CheckIn[]> {
  const added = addHeads(contractor, shift, n);
  const made: CheckIn[] = Array.from({ length: Math.min(added || n, 4) }, (_, i) => ({ at: hhmm(S.clock + i), who: NAMES[(S.feed.length + i) % NAMES.length], contractor, shift, gate: 'Gate 2', direction: 'In', result: 'Granted' }));
  S.clock += 4;
  pushFeed(...made);
  emit();
  return delay(made, 200);
}

export interface MobilizeResult {
  contractor: string;
  added: number;
  day: number;
  night: number;
  readinessBefore: number;
  readinessAfter: number;
  clearedAlerts: string[];
  remainingGap: number;
}

/** A contractor brings a crew on site: heads go to the shift/trades that are short, readiness and alerts follow. */
export function mobilizeCrew(contractor: string, n: number): MobilizeResult {
  const before = readiness().find((r) => r.contractor === contractor)!.readiness;
  const alertsBefore = shortfallAlerts().filter((a) => a.contractor === contractor).map((a) => a.id);
  let day = 0;
  let night = 0;
  for (let i = 0; i < n; i++) {
    const row = S.rows.find((r) => r.contractor === contractor)!;
    const s: Shift = row.planDay - row.actDay >= (row.planNight - row.actNight) * 2.2 ? 'Day' : row.planNight - row.actNight > 0 ? 'Night' : 'Day';
    if (!addHeads(contractor, s, 1)) break;
    if (s === 'Day') day++;
    else night++;
  }
  const added = day + night;
  if (added) {
    pushFeed({ at: hhmm(S.clock), who: `Crew of ${added} badged in (${day} day, ${night} night)`, contractor, shift: night > day ? 'Night' : 'Day', gate: 'Gate 2', direction: 'In', result: 'Granted', system: true });
    S.clock += 3;
  }
  emit();
  const after = readiness().find((r) => r.contractor === contractor)!.readiness;
  const alertsAfter = shortfallAlerts().filter((a) => a.contractor === contractor).map((a) => a.id);
  const row = S.rows.find((r) => r.contractor === contractor)!;
  return { contractor, added, day, night, readinessBefore: before, readinessAfter: after, clearedAlerts: alertsBefore.filter((id) => !alertsAfter.includes(id)), remainingGap: Math.max(0, row.planDay + row.planNight - row.actDay - row.actNight) };
}

export function mobilizeEquipment(id: string): { item: EquipRow; added: number } | undefined {
  const e = S.equipment.find((x) => x.id === id);
  if (!e) return undefined;
  const added = Math.min(e.plan - e.actual, Math.max(1, Math.ceil((e.plan - e.actual) * 0.5)));
  if (added <= 0) return { item: { ...e }, added: 0 };
  S.equipment = S.equipment.map((x) => (x.id === id ? { ...x, actual: x.actual + added } : x));
  emit();
  return { item: { ...S.equipment.find((x) => x.id === id)! }, added };
}

// ---------------------------------------------------------------- series for the mobilisation plan
const KEYS: [number, number][] = [[-28, 0.05], [-14, 0.25], [0, 0.45], [5, 0.8], [9, 0.95], [12, 0.88], [14, 0.8214], [18, 0.9], [24, 0.96], [28, 0.7], [32, 0.35], [36, 0.05]];
const PEAK = CONTRACTORS.reduce((s, c) => s + c.manpowerPlan, 0);

function profile(d: number): number {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [d0, v0] = KEYS[i];
    const [d1, v1] = KEYS[i + 1];
    if (d >= d0 && d <= d1) return v0 + ((v1 - v0) * (d - d0)) / (d1 - d0);
  }
  return d < KEYS[0][0] ? KEYS[0][1] : KEYS[KEYS.length - 1][1];
}

export interface DaySeries {
  day: number;
  plan: number;
  actual: number | null;
}

/** Planned vs actual heads per day, T-28 to D32. History is fixed; today (D14) follows the live attendance numbers. */
export function manpowerSeries(): DaySeries[] {
  const f0 = (HEADCOUNT_TODAY.actualDay + HEADCOUNT_TODAY.actualNight) / (HEADCOUNT_TODAY.plannedDay + HEADCOUNT_TODAY.plannedNight);
  const t = totals();
  return Array.from({ length: 61 }, (_, i) => {
    const day = i - 28;
    const plan = Math.round(PEAK * profile(day));
    const wobble = 0.03 * Math.sin(day * 1.7);
    return { day, plan, actual: day < STATUS_DAY ? Math.round(plan * Math.min(1, f0 + 0.012 + wobble)) : day === STATUS_DAY ? t.actual : null };
  });
}

export interface WeekBucket {
  label: string;
  from: number;
  to: number;
  phase: 'Pre-TA' | 'TA';
  plan: number;
  actual: number | null;
}
const WEEKS: [string, number, number][] = [['T-4w', -28, -22], ['T-3w', -21, -15], ['T-2w', -14, -8], ['T-1w', -7, 0], ['D1-7', 1, 7], ['D8-14', 8, 14], ['D15-21', 15, 21], ['D22-28', 22, 28], ['D29-32', 29, 32]];

/** Weekly average heads, plan vs actual, over the Pre-TA weeks and the TA days (the mobilisation histogram). */
export function mobilizationWeeks(): WeekBucket[] {
  const s = manpowerSeries();
  return WEEKS.map(([label, from, to]) => {
    const days = s.filter((d) => d.day >= from && d.day <= to);
    const act = days.filter((d) => d.actual !== null);
    return {
      label,
      from,
      to,
      phase: to <= 0 ? 'Pre-TA' : 'TA',
      plan: Math.round(sum(days.map((d) => d.plan)) / days.length),
      actual: act.length ? Math.round(sum(act.map((d) => d.actual as number)) / act.length) : null,
    };
  });
}

/** Cumulative mobilisation S-curve: % of the total planned man-days (T-28 to D32) delivered so far. */
export function mobilizationSCurve(): { day: number; plan: number; actual: number | null }[] {
  const s = manpowerSeries();
  const total = sum(s.map((d) => d.plan));
  let p = 0;
  let a = 0;
  return s.map((d) => {
    p += d.plan;
    if (d.actual !== null) a += d.actual;
    return { day: d.day, plan: (p / total) * 100, actual: d.actual !== null ? (a / total) * 100 : null };
  });
}

export async function getMobilisation() {
  const series = manpowerSeries();
  // resource histogram, days 1-14: labour hours (BLU vs ALU) and non-labour (equipment days)
  const hist = series
    .filter((s) => s.day >= 1 && s.day <= 14)
    .map((s) => ({ day: s.day, bluH: Math.round(s.plan * HPH), aluH: Math.round((s.actual ?? 0) * HPH), bluE: Math.round(18 + s.plan / 60), aluE: Math.round((18 + s.plan / 60) * (s.actual! / s.plan) * 1.02) }));
  return delay({ series, hist, today: { plan: MANHOURS_TODAY_PLANNED, actual: MANHOURS_TODAY_ACTUAL } }, 150);
}
