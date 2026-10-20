import type { BudgetLine } from '../types';

// Totals reconcile with the Command Dashboard: planned OMR 11.80M, committed 8.42M, actual 6.91M.
export const budgetLines: BudgetLine[] = [
  { id: 'WBS-1000', subWbs: 'Inspection — Static Equipment', kind: 'variable', discipline: 'Inspection', plannedOMR: 1_450_000, committedOMR: 1_310_000, actualOMR: 1_180_000, forecastOMR: 1_490_000 },
  { id: 'WBS-2000', subWbs: 'Rotating Equipment Overhaul', kind: 'variable', discipline: 'Rotating Equipment', plannedOMR: 2_100_000, committedOMR: 1_960_000, actualOMR: 1_540_000, forecastOMR: 2_260_000 },
  { id: 'WBS-3000', subWbs: 'Process Systems Testing', kind: 'variable', discipline: 'Process', plannedOMR: 780_000, committedOMR: 640_000, actualOMR: 520_000, forecastOMR: 760_000 },
  { id: 'WBS-4000', subWbs: 'Instrumentation & Controls', kind: 'variable', discipline: 'Instrumentation', plannedOMR: 610_000, committedOMR: 590_000, actualOMR: 470_000, forecastOMR: 605_000 },
  { id: 'WBS-5000', subWbs: 'Civil & Scaffolding', kind: 'variable', discipline: 'Civil', plannedOMR: 940_000, committedOMR: 1_010_000, actualOMR: 880_000, forecastOMR: 1_080_000 },
  { id: 'WBS-6000', subWbs: 'Electrical Systems', kind: 'variable', discipline: 'Electrical', plannedOMR: 430_000, committedOMR: 390_000, actualOMR: 310_000, forecastOMR: 425_000 },
  { id: 'WBS-7000', subWbs: 'Materials & Spares (MTO call-offs)', kind: 'variable', discipline: 'Process', plannedOMR: 2_200_000, committedOMR: 1_000_000, actualOMR: 700_000, forecastOMR: 2_260_000 },
  { id: 'WBS-8100', subWbs: 'Cranes & Heavy Lifting (fixed logistics)', kind: 'fixed', discipline: 'Logistics', plannedOMR: 780_000, committedOMR: 500_000, actualOMR: 400_000, forecastOMR: 800_000 },
  { id: 'WBS-8200', subWbs: 'Mobilisation, Camp & Transport (fixed logistics)', kind: 'fixed', discipline: 'Logistics', plannedOMR: 1_150_000, committedOMR: 430_000, actualOMR: 390_000, forecastOMR: 1_150_000 },
  { id: 'WBS-8300', subWbs: 'Temporary Facilities & Utilities (fixed logistics)', kind: 'fixed', discipline: 'Logistics', plannedOMR: 560_000, committedOMR: 170_000, actualOMR: 140_000, forecastOMR: 570_000 },
  { id: 'WBS-8400', subWbs: 'TA PMO, Engineering & HSE Services (fixed)', kind: 'fixed', discipline: 'Logistics', plannedOMR: 800_000, committedOMR: 420_000, actualOMR: 380_000, forecastOMR: 810_000 },
];

/** Estimate trend: base (at scope freeze) -> current approved -> forecast, per month leading to the TA. */
export const estimateTrend: { label: string; base: number; current: number }[] = [
  { label: 'T-12m', base: 11_050_000, current: 11_050_000 },
  { label: 'T-9m', base: 11_050_000, current: 11_120_000 },
  { label: 'T-6m', base: 11_050_000, current: 11_230_000 },
  { label: 'T-3m (freeze)', base: 11_050_000, current: 11_410_000 },
  { label: 'T-1m', base: 11_050_000, current: 11_580_000 },
  { label: 'TA Day 14', base: 11_050_000, current: 11_800_000 },
];
