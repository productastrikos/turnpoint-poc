import { assessDuration, durationModelCard, type DurationAssessment, type DurationInput, type ModelCard } from '../ai/durationModel';
import { delay } from './_util';

/** AI duration check for a work order being created. Runs the in-browser model; the call is async so a real service can replace it. */
export async function checkDuration(input: DurationInput): Promise<DurationAssessment | null> {
  return delay(assessDuration(input), 120);
}

export const getDurationModelCard = (): Promise<ModelCard> => delay(durationModelCard(), 40);

export interface DurationExample {
  label: string;
  hint: string;
  desc: string;
  discipline: string;
  area: string;
  tag: string;
  plannedHours: number;
  manhours: number;
  costOMR: number;
}

/** One-click cases for the demo: three under-estimates the model should catch and one honest estimate it should accept. */
export const DURATION_EXAMPLES: DurationExample[] = [
  { label: 'P-205 pump overhaul', hint: 'high vibration', desc: 'P-205 crude charge pump: mechanical seal and bearing overhaul', discipline: 'Rotating Equipment', area: 'Unit 200', tag: 'P-205', plannedHours: 8, manhours: 64, costOMR: 46_000 },
  { label: 'R-101 nozzle weld repair', hint: 'wall loss', desc: 'R-101 outlet nozzle weld overlay repair, wall loss found', discipline: 'Inspection', area: 'Unit 100', tag: 'R-101', plannedHours: 20, manhours: 220, costOMR: 112_000 },
  { label: 'E-204 bundle cleaning', hint: 'fouled', desc: 'E-204 tube bundle pull and hydro-jet cleaning', discipline: 'Rotating Equipment', area: 'Unit 200', tag: 'E-204', plannedHours: 14, manhours: 120, costOMR: 38_000 },
  { label: 'QC-2201 recalibration', hint: 'honest estimate', desc: 'Instrument loop QC-2201 recalibration', discipline: 'Instrumentation', area: 'Unit 220', tag: 'QC-2201', plannedHours: 4, manhours: 16, costOMR: 3_200 },
];
