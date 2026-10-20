// Final figures of the previous turnaround (Minor TA 2024, CDU / VDU), used by Close-Out > Compare with previous TA.
// Illustrative seeded history: OQ's real STO-2024 close-out data is not digitised, so these numbers are a documented
// stand-in that matches the lessons already recorded for that event (for example 19% duplicates, 11% scope growth).
export const PREVIOUS_TA = {
  id: 'STO-2024',
  name: 'Minor TA 2024: CDU / VDU inspection shutdown',
  units: 'CDU, VDU',
  plannedDays: 21,
  actualDays: 25,
  budgetOMR: 5_200_000,
  finalOMR: 5_710_000,
  manhoursActual: 156_400,
  scopeGrowthPostFreezePct: 11,
  duplicateSharePct: 19,
  cpChanges: 31,
  ncrs: 41,
  nearMisses: 9,
  reworkSharePct: 3.4,
} as const;

/** Man-hours worked by STO-2026 at the Day 14 data date (same base the Close-Out report uses for rates). */
export const CURRENT_MANHOURS_TO_DATE = 181_280;
