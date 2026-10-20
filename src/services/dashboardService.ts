import { budgetSummary, safetyStats, sCurve } from '../mocks/dashboardMock';
import { getTaEvent } from './portfolioService';
import { getCpDailyChanges } from './criticalPathService';
import { getDiscoveryJobs } from './discoveryService';
import { ACTUAL_TODAY, MANHOURS_TODAY_ACTUAL, MANHOURS_TODAY_PLANNED, PLANNED_TODAY, SPI } from '../mocks/progress';
import { STATUS_DATE, daysBetween, shortDate } from '../mocks/_gen';
import { delay } from './_util';
import type { KPI, SCurvePoint } from '../types';
import type { TaEvent } from '../types/platform';

const pct = (n: number) => `${n}%`;

function activeKpis(cpTotal: number, cpToday: number, openDiscovery: number): KPI[] {
  const gapMh = Math.round(((MANHOURS_TODAY_ACTUAL - MANHOURS_TODAY_PLANNED) / MANHOURS_TODAY_PLANNED) * 100);
  return [
    { label: 'TA Day', value: '14 / 32', delta: `forecast +2 d at SPI ${SPI.toFixed(2)}`, trend: 'down', tone: 'warn' },
    { label: 'Progress (man-hour)', value: pct(ACTUAL_TODAY), delta: `${ACTUAL_TODAY - PLANNED_TODAY} pts vs plan (${PLANNED_TODAY}%)`, trend: 'down', tone: 'warn' },
    { label: 'Man-hours (today)', value: MANHOURS_TODAY_ACTUAL.toLocaleString(), delta: `${gapMh}% vs plan ${MANHOURS_TODAY_PLANNED.toLocaleString()}`, trend: 'down', tone: 'warn' },
    { label: 'Open Permits', value: '132', delta: '+9 overdue', trend: 'up', tone: 'crit' },
    { label: 'Budget Committed', value: 'OMR 8.42M', delta: '71% of plan', trend: 'flat', tone: 'neutral' },
    { label: 'Safety — LTI', value: '0', delta: '212 days clean', trend: 'flat', tone: 'good' },
    { label: 'Open Discovery Jobs', value: String(openDiscovery), delta: '+2 this week', trend: 'up', tone: 'warn' },
    { label: 'Critical Path Changes', value: String(cpTotal), delta: `${cpToday} today`, trend: 'up', tone: 'crit' },
  ];
}

function completedKpis(ta: TaEvent): KPI[] {
  return [
    { label: 'TA Day', value: `${ta.durationDays} / ${ta.durationDays}`, delta: 'closed out', trend: 'flat', tone: 'good' },
    { label: 'Progress (man-hour)', value: '100%', delta: 'completed', trend: 'flat', tone: 'good' },
    { label: 'Man-hours (total)', value: ta.manhours.toLocaleString(), delta: '-2% vs plan', trend: 'down', tone: 'good' },
    { label: 'Open Permits', value: '0', delta: 'all closed', trend: 'flat', tone: 'good' },
    { label: 'Budget Committed', value: `OMR ${((ta.budgetOMR * 0.98) / 1e6).toFixed(2)}M`, delta: '98% of plan', trend: 'flat', tone: 'good' },
    { label: 'Safety — LTI', value: '0', delta: 'no lost-time injuries', trend: 'flat', tone: 'good' },
    { label: 'Open Discovery Jobs', value: '0', delta: '31 raised, all closed', trend: 'flat', tone: 'good' },
    { label: 'Critical Path Changes', value: '23', delta: 'over the TA', trend: 'flat', tone: 'neutral' },
  ];
}

function plannedKpis(ta: TaEvent): KPI[] {
  const toGo = daysBetween(STATUS_DATE, ta.startDate);
  const committed = Math.round(ta.budgetOMR * (ta.readinessPct / 100) * 0.55);
  return [
    { label: 'Starts in', value: `T-${toGo} d`, delta: shortDate(ta.startDate), trend: 'flat', tone: 'neutral' },
    { label: 'Overall readiness', value: pct(ta.readinessPct), delta: `${ta.prepMonths}-month preparation window`, trend: 'up', tone: ta.readinessPct >= 50 ? 'good' : 'warn' },
    { label: 'Planned man-hours', value: ta.manhours.toLocaleString(), delta: `${ta.durationDays} days`, trend: 'flat', tone: 'neutral' },
    { label: 'Open Permits', value: '—', delta: 'not yet applicable', trend: 'flat', tone: 'neutral' },
    { label: 'Budget Committed', value: `OMR ${(committed / 1e6).toFixed(2)}M`, delta: `of OMR ${(ta.budgetOMR / 1e6).toFixed(1)}M`, trend: 'up', tone: 'neutral' },
    { label: 'Safety — LTI', value: '—', delta: 'not yet applicable', trend: 'flat', tone: 'neutral' },
    { label: 'Scope items', value: ta.readinessPct > 25 ? '118' : '24', delta: ta.readinessPct > 25 ? 'frozen at T-3 m' : 'in scoping', trend: 'up', tone: 'neutral' },
    { label: 'Long-lead POs', value: ta.readinessPct > 25 ? '9 of 14' : '0 of 14', delta: 'on track', trend: 'flat', tone: 'good' },
  ];
}

export async function getKPIs(taId = 'STO-2026'): Promise<KPI[]> {
  const ta = await getTaEvent(taId);
  if (ta.status === 'completed') return delay(completedKpis(ta));
  if (ta.status === 'planned') return delay(plannedKpis(ta));
  const [days, dj] = await Promise.all([getCpDailyChanges(), getDiscoveryJobs()]);
  const total = days.reduce((s, d) => s + d.changes, 0);
  const open = dj.filter((d) => d.state === 'identified' || d.state === 'evaluating' || d.state === 'approved').length;
  return delay(activeKpis(total, days[days.length - 1].changes, open));
}

export async function getSCurve(taId = 'STO-2026'): Promise<SCurvePoint[]> {
  const ta = await getTaEvent(taId);
  if (ta.status === 'active') return delay(sCurve);
  const n = ta.durationDays;
  const smooth = (x: number) => x * x * (3 - 2 * x);
  const pts: SCurvePoint[] = Array.from({ length: n + 1 }, (_, day) => {
    const planned = Math.round(100 * smooth((day / n) ** 0.88));
    const actual = ta.status === 'completed' ? Math.min(100, Math.max(0, planned - Math.round(2 * Math.sin((day / n) * Math.PI)))) : NaN;
    return { day, planned, actual };
  });
  return delay(pts);
}

export async function getBudgetSummary(taId = 'STO-2026') {
  const ta = await getTaEvent(taId);
  if (ta.status === 'active') return delay(budgetSummary);
  if (ta.status === 'completed') return delay({ plannedOMR: ta.budgetOMR, committedOMR: Math.round(ta.budgetOMR * 0.98), actualOMR: Math.round(ta.budgetOMR * 0.976) });
  return delay({ plannedOMR: ta.budgetOMR, committedOMR: Math.round(ta.budgetOMR * (ta.readinessPct / 100) * 0.55), actualOMR: 0 });
}

export async function getSafetyStats() {
  return delay(safetyStats);
}
