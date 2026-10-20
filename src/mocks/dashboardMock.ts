import type { SCurvePoint } from '../types';
import { TA_DAYS } from './_gen';
import { actualPctAt, plannedPctAt } from './progress';

/** Active-TA S-curve (man-hour based). Day 14 is the status date. */
export function genSCurve(): SCurvePoint[] {
  const pts: SCurvePoint[] = [];
  for (let day = 0; day <= TA_DAYS; day++) {
    pts.push({ day, planned: plannedPctAt(day), actual: actualPctAt(day) });
  }
  return pts;
}

export const sCurve = genSCurve();

export const budgetSummary = {
  plannedOMR: 11_800_000,
  committedOMR: 8_420_000,
  actualOMR: 6_910_000,
};

export const safetyStats = {
  ltiDays: 212,
  nearMisses: 14,
  highPotential: 3,
  toolboxTalks: 96,
  hseObservations: 341,
};
