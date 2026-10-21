// Plan vs History check: validates a draft turnaround plan against the previous turnarounds (STO-2024 actuals, STO-2026 forecast)
// and against published industry practice, so planning mistakes are caught before the plan is approved.
// Rules are pure functions of (draft, history, other events) so they are deterministic and explainable.
import { PREVIOUS_TA as P } from '../mocks/taComparisonMock';
import { FORECAST_DAYS } from '../mocks/progress';
import { addDays, STATUS_DATE } from '../mocks/_gen';
import { getBudgetLines } from './budgetService';
import { getTaEvents, updateTaEvent } from './portfolioService';
import type { TaEvent, TaType } from '../types/platform';
import { delay } from './_util';

export type Severity = 'block' | 'warn' | 'pass';

export interface PlanDraft {
  taId: string;
  type: TaType;
  units: string[];
  startDate: string;
  durationDays: number;
  budgetOMR: number;
  manhours: number;
  contingencyPct: number;
  freezeDate: string;
}

export interface Finding {
  id: string;
  severity: Severity;
  rule: string;
  yours: string;
  history: string;
  why: string;
  basis: 'History' | 'Industry' | 'SOW' | 'Policy';
  /** bulk=false: a judgement call (for example moving the whole event) that "Apply all" must not do silently. */
  fix?: { label: string; patch: Partial<PlanDraft>; bulk?: boolean };
}

export interface History {
  y24: { units: number; plannedDays: number; actualDays: number; budget: number; finalCost: number; manhours: number };
  y26: { units: number; plannedDays: number; forecastDays: number; budget: number; forecastCost: number; manhours: number };
}

export interface Outcome {
  /** Days the man-hours need at the work density achieved in STO-2024 / STO-2026. */
  capacityDays: number;
  p50Days: number;
  p80Days: number;
  p50Cost: number;
  p80Cost: number;
  downtimeExposureOMR: number;
}

export interface Result {
  findings: Finding[];
  blocks: number;
  warns: number;
  passes: number;
  gate: 'ready' | 'review' | 'blocked';
  outcome: Outcome;
  derived: { mhPerDayPerUnit: number; omrPerMh: number; omrPerDay: number; mhPerDay: number };
}

export const DOWNTIME_OMR_PER_DAY = 100_000; // DEMO_GUIDE: "every day of delay costs roughly OMR 100K+"
const MONTH = 30.44;
const months = (a: string, b: string) => (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000 / MONTH;
const M = (n: number) => `OMR ${(n / 1e6).toFixed(2)}M`;
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

// Approximate Ramadan windows (+/- 1 day, moon sighting). Output drops and shifts change; do not mobilise peak crews across them.
const RAMADAN: [string, string][] = ['2027-02-08', '2028-01-28', '2029-01-16', '2030-01-05', '2030-12-26', '2031-12-15', '2032-12-04', '2033-11-23', '2034-11-12', '2035-11-01'].map((s) => [s, addDays(s, 29)]);

export const defaultExtras = (e: Pick<TaEvent, 'startDate' | 'type'>) => ({
  contingencyPct: 12,
  freezeDate: addDays(e.startDate, -Math.round((e.type === 'Major STO' ? 9 : 6) * MONTH)),
});

// Seeded so the demo has something to catch: the 2027 plan was drafted with thin contingency and a late freeze.
const SEED_EXTRAS: Record<string, { contingencyPct: number; freezeDate: string }> = { 'TA-2027': { contingencyPct: 6, freezeDate: '2027-06-30' } };

export function evaluate(d: PlanDraft, h: History, others: TaEvent[]): Result {
  const f: Finding[] = [];
  const add = (x: Finding) => f.push(x);
  const major = d.type === 'Major STO';
  const units = Math.max(1, d.units.length);
  const end = addDays(d.startDate, d.durationDays);

  const dens24 = h.y24.manhours / h.y24.actualDays / h.y24.units;
  const dens26 = h.y26.manhours / h.y26.forecastDays / h.y26.units;
  const dMin = Math.min(dens24, dens26);
  const dMax = Math.max(dens24, dens26);
  const cpm24 = h.y24.finalCost / h.y24.manhours;
  const cpm26 = h.y26.forecastCost / h.y26.manhours;
  const cMin = Math.min(cpm24, cpm26);
  const cMax = Math.max(cpm24, cpm26);
  const od24 = h.y24.actualDays / h.y24.plannedDays - 1;
  const od26 = h.y26.forecastDays / h.y26.plannedDays - 1;
  const oc24 = h.y24.finalCost / h.y24.budget - 1;
  const oc26 = h.y26.forecastCost / h.y26.budget - 1;

  const mhPerDay = d.manhours / d.durationDays;
  const dens = mhPerDay / units;
  const omrPerMh = d.budgetOMR / d.manhours;

  // 1. start date not in the past
  const lead = months(STATUS_DATE, d.startDate);
  if (lead < 0) add({ id: 'past', severity: 'block', rule: 'Start date is in the future', yours: d.startDate, history: `Today is ${STATUS_DATE}`, why: 'A plan cannot start before the date it is approved.', basis: 'Policy' });

  // 2. preparation lead time (SOW 13: T-36 months high complexity, T-24 medium)
  const need = major ? 36 : 24;
  if (lead >= 0) {
    const sev: Severity = lead >= need ? 'pass' : lead >= need / 2 ? 'warn' : 'block';
    add({
      id: 'lead', severity: sev, rule: 'Preparation lead time', yours: `${lead.toFixed(1)} months to start`, history: `T-${need} months required (SOW 13, ${major ? 'major' : 'minor'} TA)`,
      why: 'Long-lead materials, contractor award and work-pack readiness are sized on this lead time. Late planning is the root cause of most scope and schedule slippage.', basis: 'SOW',
      fix: sev === 'pass' ? undefined : { label: `Move start to ${addDays(STATUS_DATE, Math.ceil(need * MONTH))}`, patch: { startDate: addDays(STATUS_DATE, Math.ceil(need * MONTH)) }, bulk: false },
    });
  }

  // 3. scope freeze
  const target = major ? 9 : 6;
  const fm = months(d.freezeDate, d.startDate);
  {
    const sev: Severity = fm >= target ? 'pass' : fm >= target / 2 ? 'warn' : 'block';
    add({
      id: 'freeze', severity: sev, rule: 'Scope freeze before start', yours: fm < 0 ? 'After start' : `${fm.toFixed(1)} months before start`, history: `Typical freeze about ${target} months before shutdown (published turnaround benchmarks); STO-2024 grew ${P.scopeGrowthPostFreezePct}% after freeze`,
      why: 'Scope added after freeze is the largest driver of cost and duration growth. Industry average growth after freeze is about 19%, top quartile about 7%.', basis: 'Industry',
      fix: sev === 'pass' ? undefined : { label: `Freeze by ${addDays(d.startDate, -Math.round(target * MONTH))}`, patch: { freezeDate: addDays(d.startDate, -Math.round(target * MONTH)) } },
    });
  }

  // 4. duration vs man-hour capacity at the productivity achieved before
  {
    const over = dens / dMax - 1;
    const under = dens / dMin - 1;
    const mid = (dMin + dMax) / 2;
    const sugDays = Math.ceil(d.manhours / units / mid);
    let sev: Severity = 'pass';
    let why = 'Man-hours per day per unit are inside the range achieved in STO-2024 and STO-2026.';
    if (over > 0.25) { sev = 'block'; why = 'Far more work per day per unit than any previous turnaround achieved. Expect congestion, permit queues and a longer real duration.'; }
    else if (over > 0.1) { sev = 'warn'; why = 'More work per day per unit than previously achieved. The duration is probably optimistic or the man-hours are over-stated.'; }
    else if (under < -0.25) { sev = 'warn'; why = 'Much less work per day per unit than before. Either the duration is padded or scope is missing from the man-hours.'; }
    add({
      id: 'density', severity: sev, rule: 'Duration vs man-hours (work density)', yours: `${Math.round(dens).toLocaleString()} MH/day/unit (${d.manhours.toLocaleString()} MH, ${d.durationDays} d, ${units} units)`,
      history: `${Math.round(dMin).toLocaleString()} to ${Math.round(dMax).toLocaleString()} MH/day/unit achieved (2026 forecast to 2024 actual)`, why, basis: 'History',
      fix: sev === 'pass' ? undefined : { label: `Set duration to ${sugDays} days`, patch: { durationDays: sugDays } },
    });
  }

  // 5. cost per man-hour consistency
  {
    const r = omrPerMh / cMax - 1;
    const l = omrPerMh / cMin - 1;
    const sev: Severity = r > 0.3 || l < -0.3 ? 'block' : r > 0.15 || l < -0.15 ? 'warn' : 'pass';
    const midC = (cMin + cMax) / 2;
    add({
      id: 'cpmh', severity: sev, rule: 'Budget vs man-hours consistency', yours: `OMR ${omrPerMh.toFixed(1)} per man-hour`, history: `OMR ${cMin.toFixed(1)} to ${cMax.toFixed(1)} per man-hour (2026 forecast to 2024 actual)`,
      why: sev === 'pass' ? 'Budget and hours tie to each other the way they did in previous turnarounds.' : 'Budget and man-hours do not agree with each other. One of them is likely mistyped or a cost element (materials, contractor mark-up) is missing.', basis: 'History',
      fix: sev === 'pass' ? undefined : { label: `Set budget to ${M(Math.round((midC * d.manhours) / 1e4) * 1e4)}`, patch: { budgetOMR: Math.round((midC * d.manhours) / 1e4) * 1e4 } },
    });
  }

  // 6. contingency vs history and estimate maturity (AACE 18R-97: less-defined estimate = wider range)
  {
    const frozen = d.freezeDate <= STATUS_DATE;
    const klass = frozen ? 'Class 3 (scope frozen)' : 'Class 4 (scope not yet frozen)';
    const base = frozen ? 10 : 15;
    const worst = Math.ceil(Math.max(oc24, oc26) * 100);
    const needPct = Math.max(base, worst);
    const sev: Severity = d.contingencyPct >= needPct ? 'pass' : d.contingencyPct >= needPct / 2 ? 'warn' : 'block';
    add({
      id: 'cont', severity: sev, rule: 'Contingency adequacy', yours: `${d.contingencyPct}% (${M((d.budgetOMR * d.contingencyPct) / 100)})`, history: `${needPct}% needed: ${klass} policy ${base}%, worst previous overrun ${worst}% (STO-2024 ${pct(oc24 * 100)})`,
      why: 'Industry turnaround estimates vary about -27% to +43% against a claimed +/-10%. A thin contingency turns normal discovery work into a budget overrun.', basis: 'Industry',
      fix: sev === 'pass' ? undefined : { label: `Set contingency to ${needPct}%`, patch: { contingencyPct: needPct } },
    });
  }

  // 7. unit re-entry interval
  {
    const prior = others.filter((e) => e.id !== d.taId && e.startDate < d.startDate);
    const msgs: string[] = [];
    let sev: Severity = 'pass';
    let gapTxt = '';
    for (const u of d.units) {
      const last = prior.filter((e) => e.units.includes(u)).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
      if (!last) continue;
      const yrs = months(last.startDate, d.startDate) / 12;
      if (yrs < 2 && d.type !== 'Catalyst Change') { sev = 'warn'; msgs.push(`${u} last in ${last.id} (${yrs.toFixed(1)} y ago)`); }
      else if (yrs > 5) { sev = 'warn'; msgs.push(`${u} last in ${last.id} (${yrs.toFixed(1)} y ago, overdue)`); }
    }
    gapTxt = msgs.length ? msgs.join('; ') : 'All units within a 2 to 5 year interval';
    add({
      id: 'interval', severity: sev, rule: 'Unit re-entry interval', yours: gapTxt, history: 'Typical full-inspection cycle 4 years; under 2 years needs an RBI or catalyst justification',
      why: 'Opening a unit again too soon wastes downtime; leaving it too long breaches inspection and insurer intervals.', basis: 'Industry',
    });
  }

  // 8. clash with other events (shared contractors and shutdown crews)
  {
    const clash = others.filter((e) => e.id !== d.taId && e.startDate < addDays(end, 90) && addDays(e.startDate, e.durationDays) > addDays(d.startDate, -90));
    const hard = clash.some((e) => e.startDate < end && addDays(e.startDate, e.durationDays) > d.startDate);
    add({
      id: 'clash', severity: clash.length === 0 ? 'pass' : hard ? 'block' : 'warn', rule: 'Overlap with other turnarounds', yours: `${d.startDate} to ${end}`,
      history: clash.length ? clash.map((e) => `${e.id} ${e.startDate} +${e.durationDays} d`).join('; ') : 'No other event within 90 days',
      why: 'Events less than 90 days apart compete for the same contractors, inspectors and shutdown permit staff.', basis: 'Policy',
    });
  }

  // 9. season and Ramadan
  {
    const inHeat = (iso: string) => { const m = Number(iso.slice(5, 7)); return m >= 6 && m <= 9; };
    let heatDays = 0;
    for (let i = 0; i < d.durationDays; i++) if (inHeat(addDays(d.startDate, i))) heatDays++;
    const ram = RAMADAN.find(([a, b]) => a < end && b > d.startDate);
    add({
      id: 'season', severity: heatDays > 0 || ram ? 'warn' : 'pass', rule: 'Season and Ramadan', yours: heatDays ? `${heatDays} days in Jun-Sep heat` : ram ? `Overlaps Ramadan (${ram[0]} to ${ram[1]})` : 'No heat or Ramadan overlap',
      history: 'STO-2024 lesson: heat stress and permit delays raised incident risk in weeks 3 and 4',
      why: 'Outdoor productivity drops in summer heat and during Ramadan. Plan a work-rest cycle, night shifts and a productivity allowance, or move the window.', basis: 'History',
    });
  }

  // expected outcome if this plan performs like history
  const avgD = (od24 + od26) / 2;
  const maxD = Math.max(od24, od26);
  const avgC = (oc24 + oc26) / 2;
  const maxC = Math.max(oc24, oc26);
  const outcome: Outcome = {
    capacityDays: Math.ceil(d.manhours / units / ((dMin + dMax) / 2)),
    p50Days: Math.round(d.durationDays * (1 + avgD)),
    p80Days: Math.ceil(d.durationDays * (1 + maxD)),
    p50Cost: Math.round(d.budgetOMR * (1 + avgC)),
    p80Cost: Math.round(d.budgetOMR * (1 + maxC)),
    downtimeExposureOMR: Math.ceil(d.durationDays * (1 + maxD) - d.durationDays) * DOWNTIME_OMR_PER_DAY,
  };

  const blocks = f.filter((x) => x.severity === 'block').length;
  const warns = f.filter((x) => x.severity === 'warn').length;
  return {
    findings: f.sort((a, b) => ({ block: 0, warn: 1, pass: 2 })[a.severity] - { block: 0, warn: 1, pass: 2 }[b.severity]),
    blocks, warns, passes: f.length - blocks - warns, gate: blocks ? 'blocked' : warns ? 'review' : 'ready', outcome,
    derived: { mhPerDayPerUnit: dens, omrPerMh, omrPerDay: d.budgetOMR / d.durationDays, mhPerDay },
  };
}

// ---------------- service (in-memory, resets with the demo) ----------------
export interface ReviewEntry { at: string; taId: string; by: string; gate: Result['gate']; blocks: number; warns: number; override?: string; summary: string }
const drafts = new Map<string, PlanDraft>();
const log: ReviewEntry[] = [];

/** Applies every bulk fix, re-checking between passes because one fix (a later start) can change another. */
export function applyFixes(d: PlanDraft, h: History, others: TaEvent[]): PlanDraft {
  let cur = d;
  for (let i = 0; i < 3; i++) {
    const fixes = evaluate(cur, h, others).findings.filter((f) => f.severity !== 'pass' && f.fix && f.fix.bulk !== false);
    if (!fixes.length) break;
    cur = fixes.reduce((acc, f) => ({ ...acc, ...f.fix!.patch }), cur);
  }
  return cur;
}

export const COMPARATORS = {
  y24: { id: 'STO-2024', label: 'STO-2024 actual' },
  y26: { id: 'STO-2026', label: 'STO-2026 forecast' },
} as const;

export async function getHistory(): Promise<History> {
  const lines = await getBudgetLines();
  const forecastCost = lines.reduce((s, l) => s + l.forecastOMR, 0);
  const events = await getTaEvents();
  const e24 = events.find((e) => e.id === 'STO-2024');
  const e26 = events.find((e) => e.id === 'STO-2026');
  return {
    y24: { units: 2, plannedDays: P.plannedDays, actualDays: P.actualDays, budget: P.budgetOMR, finalCost: P.finalOMR, manhours: P.manhoursActual },
    y26: { units: e26?.units.length ?? 5, plannedDays: e26?.durationDays ?? 32, forecastDays: FORECAST_DAYS, budget: e26?.budgetOMR ?? 11_800_000, forecastCost, manhours: e26?.manhours ?? 412_000 },
    ...(e24 ? {} : {}),
  };
}

export async function getDraft(taId: string): Promise<{ draft: PlanDraft; events: TaEvent[] }> {
  const events = await getTaEvents();
  const e = events.find((x) => x.id === taId) ?? events.find((x) => x.status === 'planned') ?? events[0];
  const saved = drafts.get(e.id);
  const draft: PlanDraft = saved ?? { taId: e.id, type: e.type, units: e.units, startDate: e.startDate, durationDays: e.durationDays, budgetOMR: e.budgetOMR, manhours: e.manhours, ...(SEED_EXTRAS[e.id] ?? defaultExtras(e)) };
  return delay({ draft: { ...draft, units: [...draft.units] }, events }, 100);
}

export function keepDraft(d: PlanDraft) { drafts.set(d.taId, { ...d, units: [...d.units] }); }
export function resetDraft(taId: string) { drafts.delete(taId); }
export const getReviewLog = () => [...log].reverse();

/** Record the review and write the plan back to the portfolio. Blocks need a written override reason. */
export async function submitPlan(d: PlanDraft, r: Result, by: string, override?: string): Promise<ReviewEntry> {
  if (r.blocks > 0 && (!override || override.trim().length < 15)) throw new Error('A written justification of at least 15 characters is required to submit with blocking findings');
  await updateTaEvent(d.taId, { type: d.type, units: d.units, startDate: d.startDate, durationDays: d.durationDays, budgetOMR: d.budgetOMR, manhours: d.manhours });
  keepDraft(d);
  const entry: ReviewEntry = {
    at: new Date().toISOString(), taId: d.taId, by, gate: r.gate, blocks: r.blocks, warns: r.warns, override: override?.trim() || undefined,
    summary: `${d.durationDays} d, ${M(d.budgetOMR)}, ${d.manhours.toLocaleString()} MH, contingency ${d.contingencyPct}%`,
  };
  log.push(entry);
  return delay(entry, 150);
}
