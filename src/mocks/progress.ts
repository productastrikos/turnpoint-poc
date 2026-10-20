// Single definition of the planned / actual progress curves (man-hour based) and the day-14 headline numbers.
// The dashboard, KPIs page, executive summary, P6 recalculation and close-out all read these so numbers agree.
import { STATUS_DAY, TA_DAYS } from './_gen';

export const TOTAL_MANHOURS = 412_000;

const smooth = (x: number) => x * x * (3 - 2 * x);

/** Planned cumulative progress % for a TA day (0..32), man-hour weighted. */
export function plannedPctAt(day: number): number {
  const t = Math.max(0, Math.min(1, day / TA_DAYS));
  return Math.round(100 * smooth(t ** 0.88));
}

/** Actual cumulative progress % up to the status day; NaN afterwards. Lags the plan by 3 points at the status date. */
export function actualPctAt(day: number): number {
  if (day > STATUS_DAY) return NaN;
  const lag = Math.round(3 * (day / STATUS_DAY) ** 1.4);
  return Math.max(0, plannedPctAt(day) - lag);
}

export const PLANNED_TODAY = plannedPctAt(STATUS_DAY); // 47
export const ACTUAL_TODAY = actualPctAt(STATUS_DAY); // 44
export const SPI = Math.round((ACTUAL_TODAY / PLANNED_TODAY) * 100) / 100; // 0.94
/** Forecast TA duration at the current performance, in days. */
export const FORECAST_DAYS = Math.round(TA_DAYS / SPI);

// Manpower on the status day (attendance page reads the same numbers)
export const HEADCOUNT_TODAY = {
  plannedDay: 1130,
  plannedNight: 480,
  actualDay: 1058,
  actualNight: 455,
  hoursPerHead: 10.5,
};
export const MANHOURS_TODAY_PLANNED = Math.round((HEADCOUNT_TODAY.plannedDay + HEADCOUNT_TODAY.plannedNight) * HEADCOUNT_TODAY.hoursPerHead);
export const MANHOURS_TODAY_ACTUAL = Math.round((HEADCOUNT_TODAY.actualDay + HEADCOUNT_TODAY.actualNight) * HEADCOUNT_TODAY.hoursPerHead);
