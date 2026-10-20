// Manpower plan vs actual (attendance, G7), mobilisation series and resource histogram (R4, SOW dry run 10).
import { CONTRACTORS } from '../mocks/master';
import { HEADCOUNT_TODAY, MANHOURS_TODAY_ACTUAL, MANHOURS_TODAY_PLANNED } from '../mocks/progress';
import { pick, rng } from '../mocks/_gen';
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

// Day 14 attendance: the totals reconcile with HEADCOUNT_TODAY (1,130 / 480 planned, 1,058 / 455 actual).
let rows: AttRow[] = [
  { contractor: 'Galfar', planDay: 450, planNight: 200, actDay: 418, actNight: 188, peak: 820, discipline: 'Mechanical, Process, Rotating' },
  { contractor: 'Larsen & Toubro', planDay: 240, planNight: 100, actDay: 226, actNight: 96, peak: 410, discipline: 'Reactor, Exchangers, Heaters' },
  { contractor: 'Petrofac Services', planDay: 105, planNight: 35, actDay: 102, actNight: 33, peak: 160, discipline: 'Inspection, NDT' },
  { contractor: 'Zubair E&M', planDay: 150, planNight: 50, actDay: 139, actNight: 47, peak: 240, discipline: 'Electrical, Instrumentation' },
  { contractor: 'Sohar Industrial Services', planDay: 185, planNight: 95, actDay: 173, actNight: 91, peak: 330, discipline: 'Scaffold, Insulation, Civil, Waste' },
];

export interface CheckIn {
  at: string;
  who: string;
  contractor: string;
  shift: 'Day' | 'Night';
  gate: string;
}

const NAMES = ['M. Khan', 'S. Ali', 'R. Das', 'J. Thomas', 'A. Al-Balushi', 'P. Reddy', 'H. Al-Rashdi', 'V. Nair', 'K. Singh', 'T. Mathew', 'O. Al-Hinai', 'D. Silva'];
let feed: CheckIn[] = Array.from({ length: 12 }, (_, i) => {
  const r = rng(300 + i);
  const c = pick(r, CONTRACTORS).name;
  return { at: `05:${String(58 - i * 2).padStart(2, '0')}`, who: NAMES[i % NAMES.length], contractor: c, shift: i % 4 === 0 ? 'Night' : 'Day', gate: pick(r, ['Gate 2', 'Gate 3', 'Gate 5']) };
});

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function totals(list: AttRow[] = rows) {
  const planDay = sum(list.map((r) => r.planDay));
  const planNight = sum(list.map((r) => r.planNight));
  const actDay = sum(list.map((r) => r.actDay));
  const actNight = sum(list.map((r) => r.actNight));
  const h = HEADCOUNT_TODAY.hoursPerHead;
  return { planDay, planNight, actDay, actNight, plan: planDay + planNight, actual: actDay + actNight, planMh: Math.round((planDay + planNight) * h), actualMh: Math.round((actDay + actNight) * h) };
}

export async function getAttendance(): Promise<{ rows: AttRow[]; feed: CheckIn[]; totals: ReturnType<typeof totals> }> {
  return delay({ rows: rows.map((r) => ({ ...r })), feed: [...feed], totals: totals() }, 150);
}

/** Simulated badge check-ins at the gate (the real feed would come from the access-control system). */
export async function checkIn(contractor: string, shift: 'Day' | 'Night', n: number): Promise<CheckIn[]> {
  rows = rows.map((r) => (r.contractor === contractor ? { ...r, actDay: shift === 'Day' ? Math.min(r.planDay + 8, r.actDay + n) : r.actDay, actNight: shift === 'Night' ? Math.min(r.planNight + 6, r.actNight + n) : r.actNight } : r));
  const made: CheckIn[] = Array.from({ length: Math.min(n, 4) }, (_, i) => ({ at: `06:${String(10 + i).padStart(2, '0')}`, who: NAMES[(feed.length + i) % NAMES.length], contractor, shift, gate: 'Gate 2' }));
  feed = [...made, ...feed].slice(0, 20);
  return delay(made, 200);
}

// ---------------- series for the mobilisation plan ----------------
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

export function manpowerSeries(): DaySeries[] {
  const factor = HEADCOUNT_TODAY.actualDay + HEADCOUNT_TODAY.actualNight;
  const f14 = factor / (HEADCOUNT_TODAY.plannedDay + HEADCOUNT_TODAY.plannedNight);
  return Array.from({ length: 61 }, (_, i) => {
    const day = i - 28;
    const plan = Math.round(PEAK * profile(day));
    const wobble = 0.03 * Math.sin(day * 1.7);
    return { day, plan, actual: day <= 14 ? Math.round(plan * (day === 14 ? f14 : Math.min(1, f14 + 0.012 + wobble))) : null };
  });
}

export async function getMobilisation() {
  const series = manpowerSeries();
  // resource histogram, days 1-14: labour hours (BLU vs ALU) and non-labour (equipment days)
  const hist = series
    .filter((s) => s.day >= 1 && s.day <= 14)
    .map((s) => ({ day: s.day, bluH: Math.round(s.plan * HEADCOUNT_TODAY.hoursPerHead), aluH: Math.round((s.actual ?? 0) * HEADCOUNT_TODAY.hoursPerHead), bluE: Math.round(18 + s.plan / 60), aluE: Math.round((18 + s.plan / 60) * (s.actual! / s.plan) * 1.02) }));
  return delay({ series, hist, today: { plan: MANHOURS_TODAY_PLANNED, actual: MANHOURS_TODAY_ACTUAL } }, 150);
}

export const EQUIPMENT_PLAN = [
  { contractor: 'Galfar', item: 'Cranes (250 t / 80 t / 50 t)', plan: 5, actual: 5 },
  { contractor: 'Galfar', item: 'Welding rigs', plan: 42, actual: 38 },
  { contractor: 'Larsen & Toubro', item: 'Hydrojet units', plan: 6, actual: 6 },
  { contractor: 'Larsen & Toubro', item: 'Bolt tensioning sets', plan: 12, actual: 11 },
  { contractor: 'Petrofac Services', item: 'NDT / ECT rigs', plan: 8, actual: 8 },
  { contractor: 'Zubair E&M', item: 'Loop calibrators', plan: 14, actual: 13 },
  { contractor: 'Sohar Industrial Services', item: 'Manlifts', plan: 16, actual: 14 },
  { contractor: 'Sohar Industrial Services', item: 'Vacuum trucks', plan: 4, actual: 4 },
];
