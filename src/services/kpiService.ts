// KPI scorecard (G9) and man-hour progress analytics (X15, SOW dry run 9, 26-29). Derived from the shared schedule and progress curves.
import { scheduleActivities, plannedPct as actPlannedPct } from '../mocks/scheduleMock';
import { JOB_BY_ID } from '../mocks/jobsMock';
import { ACTUAL_TODAY, PLANNED_TODAY, SPI, TOTAL_MANHOURS, actualPctAt, plannedPctAt } from '../mocks/progress';
import { HEADCOUNT_TODAY } from '../mocks/progress';
import { STATUS_DAY, TA_DAYS, rng } from '../mocks/_gen';
import { lossEvents } from '../mocks/qualityMock';
import { delay } from './_util';
import { unitOf } from '../mocks/master';
import { overallProductivity } from './executionService';

export interface Kpi {
  id: string;
  name: string;
  value: string;
  target: string;
  tone: 'good' | 'warn' | 'crit';
  trend: number[];
  note: string;
  sow: string;
}

function trend(seed: number, end: number, start: number, n = 14): number[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => Math.round((start + ((end - start) * i) / (n - 1) + (r() - 0.5) * Math.abs(end - start) * 0.25) * 100) / 100).map((v, i, a) => (i === a.length - 1 ? end : v));
}

export async function getScorecard(): Promise<Kpi[]> {
  const reworkH = lossEvents.filter((l) => l.kind === 'Rework').reduce((a, l) => a + l.hours, 0);
  const prodIndex = await overallProductivity();
  const attendance = (HEADCOUNT_TODAY.actualDay + HEADCOUNT_TODAY.actualNight) / (HEADCOUNT_TODAY.plannedDay + HEADCOUNT_TODAY.plannedNight);
  const list: Kpi[] = [
    { id: 'spi', name: 'Schedule adherence (SPI)', value: SPI.toFixed(2), target: '≥ 0.95', tone: 'warn', trend: trend(1, SPI, 1.0), note: `${ACTUAL_TODAY}% actual vs ${PLANNED_TODAY}% planned`, sow: '17.2' },
    { id: 'cpi', name: 'Cost performance (CPI)', value: '0.97', target: '≥ 0.95', tone: 'good', trend: trend(2, 0.97, 1.01), note: 'Budget ÷ forecast at completion', sow: '17.3' },
    { id: 'trif', name: 'Safety: TRIF', value: '0.42', target: '< 0.50', tone: 'good', trend: trend(3, 0.42, 0.2), note: '0 lost-time injuries, 212 days clean', sow: '17.4' },
    { id: 'sif', name: 'Safety: SIF / HiPo events', value: '3', target: '0', tone: 'crit', trend: [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3], note: 'High-potential near misses, all closed', sow: '17.4' },
    { id: 'scope', name: 'Scope growth', value: '+6.8%', target: '≤ 5%', tone: 'warn', trend: trend(5, 6.8, 3.2), note: '15 approved variations vs base estimate', sow: '17.5' },
    { id: 'prod', name: 'Productivity index', value: prodIndex.toFixed(2), target: '≥ 0.95', tone: prodIndex >= 0.95 ? 'good' : 'warn', trend: trend(6, Math.round(prodIndex * 100) / 100, 0.99), note: 'Earned man-hours ÷ actual man-hours', sow: '17.6' },
    { id: 'digital', name: 'Digital adoption rate', value: '84%', target: '≥ 80%', tone: 'good', trend: trend(7, 84, 52), note: '1,402 of 1,670 registered users active this week', sow: '17.7' },
    { id: 'att', name: 'Manpower attendance', value: `${(attendance * 100).toFixed(1)}%`, target: '≥ 95%', tone: 'warn', trend: trend(8, attendance * 100, 97), note: `${HEADCOUNT_TODAY.actualDay + HEADCOUNT_TODAY.actualNight} of ${HEADCOUNT_TODAY.plannedDay + HEADCOUNT_TODAY.plannedNight} planned heads`, sow: '17.12' },
    { id: 'rework', name: 'Rework (% of man-hours)', value: `${((reworkH / 181_280) * 100).toFixed(2)}%`, target: '< 1.0%', tone: 'good', trend: trend(9, (reworkH / 181_280) * 100, 0.05), note: `${reworkH} rework hours captured`, sow: '17.9' },
    { id: 'ftr', name: 'First-time-right inspections', value: '91%', target: '≥ 90%', tone: 'good', trend: trend(10, 91, 94), note: 'Inspections cleared without rework', sow: '17.9' },
    { id: 'cost', name: 'Planned vs actual cost', value: 'OMR 6.91M', target: 'of 11.80M', tone: 'good', trend: trend(11, 6.91, 0.9), note: '58.6% spent at 44% progress: front-loaded logistics', sow: '17.10' },
    { id: 'mh', name: 'Planned vs actual man-hours', value: '181,280', target: 'plan 193,640', tone: 'warn', trend: trend(12, 181.3, 20), note: 'Cumulative to Day 14', sow: '17.12' },
  ];
  return delay(list, 150);
}

// ---------------- man-hour S-curves ----------------

export interface ScurveScope {
  id: string;
  label: string;
}

const TAGS = Array.from(new Set(scheduleActivities.map((a) => JOB_BY_ID[a.jobId]?.tag).filter((t): t is string => Boolean(t)))).sort();
export const SCURVE_SCOPES: ScurveScope[] = [
  { id: 'all', label: 'Overall project' },
  ...['Unit 100', 'Unit 200', 'Unit 220', 'Unit 250', 'Unit 300'].map((u) => ({ id: `unit:${u}`, label: `${u} · ${unitOf(u)}` })),
  ...['R-101', 'E-204', 'T-201', 'C-301', 'F-101', 'K-301', 'R-301', 'T-251', 'T-221'].filter((t) => TAGS.includes(t)).map((t) => ({ id: `eq:${t}`, label: `Equipment ${t}` })),
];

export interface Curve {
  day: number[];
  planned: number[];
  actual: (number | null)[];
  forecast: (number | null)[];
  blu: number;
  plannedToday: number;
  actualToday: number;
}

export async function getScurve(scopeId: string): Promise<Curve> {
  const days = Array.from({ length: TA_DAYS + 1 }, (_, i) => i);
  if (scopeId === 'all') {
    const forecast = days.map((d) => (d < STATUS_DAY ? null : Math.min(100, Math.round(ACTUAL_TODAY + ((100 - ACTUAL_TODAY) * (d - STATUS_DAY)) / (34 - STATUS_DAY)))));
    return delay({ day: days, planned: days.map(plannedPctAt), actual: days.map((d) => (d <= STATUS_DAY ? actualPctAt(d) : null)), forecast, blu: TOTAL_MANHOURS, plannedToday: PLANNED_TODAY, actualToday: ACTUAL_TODAY }, 120);
  }
  const acts = scheduleActivities.filter((a) => {
    const job = JOB_BY_ID[a.jobId];
    if (scopeId.startsWith('unit:')) return a.area === scopeId.slice(5);
    return job?.tag === scopeId.slice(3);
  });
  const blu = acts.reduce((s, a) => s + a.bluHours, 0) || 1;
  const planAt = (d: number) => Math.round((acts.reduce((s, a) => s + a.bluHours * (d < a.startDay ? 0 : d >= a.endDay ? 1 : (d - a.startDay + 1) / (a.endDay - a.startDay + 1)), 0) / blu) * 100);
  const planned = days.map(planAt);
  const actualToday = Math.round((acts.reduce((s, a) => s + a.bluHours * (a.pct / 100), 0) / blu) * 100);
  const plannedToday = planAt(STATUS_DAY);
  const ratio = plannedToday > 0 ? actualToday / plannedToday : 1;
  const actual = days.map((d) => (d <= STATUS_DAY ? Math.round(planAt(d) * (d === STATUS_DAY ? ratio : 1 - (1 - ratio) * (d / STATUS_DAY) ** 1.5)) : null));
  const forecast = days.map((d) => (d < STATUS_DAY ? null : Math.min(100, Math.round(actualToday + ((100 - actualToday) * (d - STATUS_DAY)) / Math.max(1, (acts.reduce((m, a) => Math.max(m, a.endDay), 0) + 1 - STATUS_DAY))))));
  return delay({ day: days, planned, actual, forecast, blu, plannedToday, actualToday }, 120);
}

// ---------------- progress by level ----------------

export interface ProgressRow {
  key: string;
  level: 'Unit' | 'Asset';
  label: string;
  planned: number;
  actual: number;
  blu: number;
  activities: number;
}

export async function getProgressByLevel(): Promise<ProgressRow[]> {
  const rows: ProgressRow[] = [];
  const units = ['Unit 100', 'Unit 200', 'Unit 220', 'Unit 250', 'Unit 300', 'Flare System', 'Pipe Rack 4'];
  const pct = (list: typeof scheduleActivities, f: (a: (typeof scheduleActivities)[number]) => number) => {
    const blu = list.reduce((s, a) => s + a.bluHours, 0) || 1;
    return Math.round((list.reduce((s, a) => s + a.bluHours * f(a), 0) / blu) * 100) / 100;
  };
  for (const u of units) {
    const ua = scheduleActivities.filter((a) => a.area === u);
    if (!ua.length) continue;
    rows.push({ key: u, level: 'Unit', label: `${u} · ${unitOf(u)}`, planned: pct(ua, (a) => actPlannedPct(a, STATUS_DAY)), actual: pct(ua, (a) => a.pct), blu: ua.reduce((s, a) => s + a.bluHours, 0), activities: ua.length });
    const tags = Array.from(new Set(ua.map((a) => JOB_BY_ID[a.jobId]?.tag ?? a.jobId)));
    for (const t of tags) {
      const ta = ua.filter((a) => (JOB_BY_ID[a.jobId]?.tag ?? a.jobId) === t);
      rows.push({ key: `${u}:${t}`, level: 'Asset', label: t, planned: pct(ta, (a) => actPlannedPct(a, STATUS_DAY)), actual: pct(ta, (a) => a.pct), blu: ta.reduce((s, a) => s + a.bluHours, 0), activities: ta.length });
    }
  }
  return delay(rows, 120);
}
