import { budgetLines, estimateTrend } from '../mocks/budgetMock';
import { JOB_BY_ID } from '../mocks/jobsMock';
import type { BudgetLine, Discipline } from '../types';
import { delay } from './_util';
import { listVariations } from './scopeService';
import { BASE_ESTIMATE, variations as seedVariations, type Variation } from '../mocks/scopeMock';

const WBS_FOR: Record<Discipline, string> = { Inspection: 'WBS-1000', 'Rotating Equipment': 'WBS-2000', Process: 'WBS-3000', Instrumentation: 'WBS-4000', Civil: 'WBS-5000', Electrical: 'WBS-6000' };
const REF_DISCIPLINE: Record<string, Discipline> = { 'SCF-203': 'Process', 'SCF-204': 'Inspection', 'SCF-202': 'Rotating Equipment', 'DJ-016': 'Rotating Equipment', 'DJ-018': 'Process' };

export const wbsForVariation = (v: Variation): string => WBS_FOR[JOB_BY_ID[v.ref]?.discipline ?? REF_DISCIPLINE[v.ref] ?? 'Process'];

function perWbs(list: Variation[]): Record<string, number> {
  const out: Record<string, number> = {};
  list.filter((v) => v.status === 'Approved').forEach((v) => (out[wbsForVariation(v)] = (out[wbsForVariation(v)] ?? 0) + v.costOMR));
  return out;
}
const SEED_PER_WBS = perWbs(seedVariations);

/** Budget lines. Variations approved after the seed data are incorporated into the planned budget of their Sub-WBS (checklist G10). */
export async function getBudgetLines(): Promise<BudgetLine[]> {
  const now = perWbs(await listVariations());
  return delay(budgetLines.map((l) => ({ ...l, plannedOMR: l.plannedOMR + ((now[l.id] ?? 0) - (SEED_PER_WBS[l.id] ?? 0)) })));
}

export const getEstimateTrend = () => delay(estimateTrend, 80);

export interface BudgetBridge {
  base: number;
  current: number;
  bySource: { source: string; value: number }[];
  perWbs: Record<string, number>;
  included: { v: Variation; wbs: string }[];
  pending: Variation[];
}

/** Base vs current estimate: every approved variation is already inside the current budget. */
export async function getBridge(): Promise<BudgetBridge> {
  const vars = await listVariations();
  const approved = vars.filter((v) => v.status === 'Approved');
  const total = approved.reduce((s, v) => s + v.costOMR, 0);
  const sources = ['Originator', 'SCF', 'Discovery job', 'MOC'] as const;
  return delay(
    {
      base: BASE_ESTIMATE,
      current: BASE_ESTIMATE + total,
      bySource: sources.map((s) => ({ source: s, value: approved.filter((v) => v.source === s).reduce((a, v) => a + v.costOMR, 0) })),
      perWbs: perWbs(vars),
      included: approved.map((v) => ({ v, wbs: wbsForVariation(v) })),
      pending: vars.filter((v) => v.status === 'Pending'),
    },
    150
  );
}
