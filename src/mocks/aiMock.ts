// Scripted outputs for the AI panel (risk prediction, schedule forecast, predictive critical path). SIMULATED: no model runs.
import { ACTUAL_TODAY, actualPctAt, plannedPctAt } from './progress';

export interface RiskPrediction {
  riskId: string;
  title: string;
  probability: number; // % that it causes schedule impact
  impactDays: number;
  impactOMR: number;
  path: string;
  trend: 'up' | 'down' | 'flat';
  drivers: string[];
}

export const riskPredictions: RiskPrediction[] = [
  { riskId: 'RSK-01', title: 'Catalyst disposal contractor delayed mobilisation', probability: 68, impactDays: 1.5, impactOMR: 154_000, path: 'CP1', trend: 'up', drivers: ['Contractor late 3 of last 3 call-offs', 'CPA-002 already at-risk'] },
  { riskId: 'RSK-02', title: 'Unplanned corrosion found on V-102 nozzles', probability: 54, impactDays: 1.0, impactOMR: 103_000, path: 'CP1', trend: 'up', drivers: ['DJ-014 open, awaiting metallurgy', 'Wall loss trend on adjacent line'] },
  { riskId: 'RSK-07', title: 'Permit backlog in Inspection discipline', probability: 47, impactDays: 0.5, impactOMR: 51_000, path: 'CP1', trend: 'flat', drivers: ['9 overdue hot-work permits', 'Night shift issuer added Day 12'] },
  { riskId: 'RSK-05', title: 'Long-lead gasket set delayed at customs', probability: 31, impactDays: 0.5, impactOMR: 51_000, path: 'CP2', trend: 'down', drivers: ['Air freight arranged', 'Customs hold released Day 14'] },
  { riskId: 'RSK-03', title: 'Crane availability conflict, E-204 vs C-301 lifts', probability: 26, impactDays: 1.0, impactOMR: 103_000, path: 'CP2', trend: 'down', drivers: ['Revised lift sequence agreed', 'Slot still contested on Day 17'] },
  { riskId: 'RSK-06', title: 'Scaffold interference with CP1 workfront access', probability: 22, impactDays: 0.5, impactOMR: 51_000, path: 'CP1', trend: 'flat', drivers: ['MOC-104 raised', 'Scaffold bay extension pending'] },
  { riskId: 'RSK-04', title: 'Extreme heat advisory, man-hour loss', probability: 18, impactDays: 0.5, impactOMR: 51_000, path: 'All', trend: 'flat', drivers: ['Work-rest cycle in place'] },
];

export const riskDrivers = [
  { label: 'Float erosion on CP1 activities', weight: 34 },
  { label: 'Open discovery jobs on critical equipment', weight: 24 },
  { label: 'Contractor on-time delivery history', weight: 18 },
  { label: 'Permit and isolation backlog', weight: 14 },
  { label: 'Weather and heat stop days', weight: 10 },
];

export const recommendations = [
  { id: 'REC-1', text: 'Pre-approve SCF-201 (R-101 tray 7 inspection) so the work starts on Day 17 instead of waiting for Day 19.', gain: 'recovers about 0.5 d on CP1' },
  { id: 'REC-2', text: 'Add a second night crew on CPA-003 internals inspection.', gain: 'recovers about 1.5 d on CP1 for OMR 86K' },
  { id: 'REC-3', text: 'Confirm the standby catalyst disposal contractor now (RSK-01 mitigation).', gain: 'cuts RSK-01 probability from 68% to about 25%' },
  { id: 'REC-4', text: 'Reserve the 250 t crane for Day 17 (E-204 bundle pull) ahead of C-301 rotor lift.', gain: 'removes the RSK-03 conflict' },
];

// ---- schedule forecast (X16) ----
// The remaining work follows the planned curve's shape, stretched so it ends on the forecast day and starting from
// today's actual: a slip shows as a flatter, longer tail rather than a stall.
const PLANNED_TODAY = plannedPctAt(14);
const forecastCurve = (endDay: number) => (day: number) => {
  if (day <= 14) return null;
  const tau = Math.min(32, 14 + ((day - 14) * (32 - 14)) / Math.max(1, endDay - 14));
  const frac = (plannedPctAt(tau) - PLANNED_TODAY) / (100 - PLANNED_TODAY);
  return Math.round((ACTUAL_TODAY + (100 - ACTUAL_TODAY) * frac) * 10) / 10;
};

export const FORECAST_DAYS = Array.from({ length: 40 }, (_, i) => i);
/** Progress curve from today's actual to 100 % at a given (possibly fractional) finish day: the band edges and P50 line. */
export const progressForecast = (endDay: number) => FORECAST_DAYS.map((d) => (d === 14 ? ACTUAL_TODAY : forecastCurve(endDay)(d)));

export const forecast = {
  planned: FORECAST_DAYS.map(plannedPctAt),
  actual: FORECAST_DAYS.map((d) => (d <= 14 ? actualPctAt(d) : null)),
  p50: FORECAST_DAYS.map((d) => (d === 14 ? ACTUAL_TODAY : forecastCurve(34)(d))),
  p10: FORECAST_DAYS.map((d) => (d === 14 ? ACTUAL_TODAY : forecastCurve(33)(d))), // optimistic
  p90: FORECAST_DAYS.map((d) => (d === 14 ? ACTUAL_TODAY : forecastCurve(36)(d))), // pessimistic
};

export const forecastByUnit = [
  { unit: 'Unit 100 · HCU', planned: '2026-09-01', forecast: '2026-09-03', conf: 'P80 3-5 Sep', note: 'R-101 internals and tie-in drive the slip' },
  { unit: 'Unit 200 · CDU', planned: '2026-08-28', forecast: '2026-08-29', conf: 'P80 28-31 Aug', note: 'E-204 retube +1 d (SCF-202)' },
  { unit: 'Unit 220 · SRU', planned: '2026-08-26', forecast: '2026-08-26', conf: 'P80 26-27 Aug', note: 'On plan' },
  { unit: 'Unit 250 · VDU', planned: '2026-08-27', forecast: '2026-08-28', conf: 'P80 27-29 Aug', note: 'Packing inspection ahead by 1 d, install behind' },
  { unit: 'Unit 300 · FCC', planned: '2026-08-31', forecast: '2026-08-31', conf: 'P80 31 Aug-2 Sep', note: 'C-301 on plan, K-301 alignment near critical' },
  { unit: 'Flare & PR4', planned: '2026-08-27', forecast: '2026-08-27', conf: 'P80 27-28 Aug', note: 'On plan' },
];

// ---- predictive critical path (X17) ----
export interface PredictedCritical {
  id: string;
  p6Id: string;
  name: string;
  probability: number; // % chance it becomes critical within 7 days
  floatNow: number;
  expectedDay: number;
  driver: string;
  mitigation: string;
}

export const predictedCritical: PredictedCritical[] = [
  { id: 'ACT-318', p6Id: 'FCC-2010', name: 'K-301 Blower Casing Alignment', probability: 82, floatNow: 1, expectedDay: 16, driver: 'Alignment tool shared with C-301, progress 30% vs 55% planned', mitigation: 'Release the second laser alignment kit from the tool crib' },
  { id: 'ACT-231', p6Id: 'CDU-1020', name: 'T-201 Tray Repair, Section B', probability: 76, floatNow: 2, expectedDay: 17, driver: 'Night-shift welder shortfall (6 of 24), 40% vs 62% planned', mitigation: 'Bring 6 welders from the Unit 200 scaffolding release' },
  { id: 'ACT-244', p6Id: 'HCU-2020', name: 'F-101 Burner Block Refractory Cure', probability: 41, floatNow: 3, expectedDay: 19, driver: 'Cure curve deviation (NCR-214)', mitigation: 'Extend dry-out hold, re-plan lighting-up sequence' },
  { id: 'ACT-352', p6Id: 'FLR-2010', name: 'FL-401 Flare Header Hydrotest', probability: 38, floatNow: 2, expectedDay: 19, driver: 'Test water supply uncertain', mitigation: 'Pre-fill header from the fire-water ring main' },
  { id: 'ACT-367', p6Id: 'FLR-1020', name: 'PSV Recertification, Batch 3', probability: 24, floatNow: 4, expectedDay: 21, driver: 'Bench availability', mitigation: 'Book the vendor bench for Day 15-18' },
  { id: 'ACT-502', p6Id: 'FCC-1020', name: 'R-301 refractory lining, cyclone zone', probability: 19, floatNow: 5, expectedDay: 22, driver: 'NCR-207 thickness rework', mitigation: 'Add a second mixing crew' },
];
