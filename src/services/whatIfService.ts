// Deterministic what-if schedule model (checklist X11). Simple, explainable rules, not a CPM engine.
import { addDays } from '../mocks/_gen';
import { createCollection } from './_collection';
import { delay } from './_util';

export interface DropOption {
  jobId: string;
  label: string;
  costOMR: number;
  manhours: number;
  recoversDays: number; // days recovered on the critical path if dropped (0 = off the critical path)
  note: string;
}

export interface AddOption {
  id: string;
  label: string;
  costOMR: number;
  manhours: number;
  addsDays: Record<'CP1' | 'CP2' | 'CP3', number>;
  note: string;
}

export const DROP_OPTIONS: DropOption[] = [
  { jobId: 'J-2224', label: 'Insulation renewal, Unit 200', costOMR: 71_000, manhours: 3800, recoversDays: 0, note: 'Off the critical path. Saves cost, not time.' },
  { jobId: 'J-2223', label: 'Pipe rack 4 support replacement', costOMR: 49_000, manhours: 1900, recoversDays: 0, note: 'Off the critical path. Integrity risk deferred to next TA.' },
  { jobId: 'J-2225', label: 'DCS I/O card replacement, Unit 100', costOMR: 42_000, manhours: 640, recoversDays: 0, note: 'Off the critical path.' },
  { jobId: 'J-2222', label: 'MCC-3 relay upgrade', costOMR: 38_000, manhours: 720, recoversDays: 0, note: 'Off the critical path.' },
  { jobId: 'J-2216', label: 'R-301 refractory repair (FCC)', costOMR: 168_000, manhours: 4600, recoversDays: 0, note: 'High risk to defer: erosion of cyclone zone.' },
  { jobId: 'J-2221', label: 'Flare header tie-in FL-401', costOMR: 84_000, manhours: 1700, recoversDays: 0.5, note: 'Frees the Galfar commissioning crew sooner (CP1 tail).' },
];

export const ADD_OPTIONS: AddOption[] = [
  { id: 'J-2230', label: 'Approve J-2230: R-101 outlet nozzle weld overlay', costOMR: 112_000, manhours: 1450, addsDays: { CP1: 2, CP2: 0, CP3: 0 }, note: 'On the reactor critical path.' },
  { id: 'SCF-202', label: 'Approve SCF-202: additional E-204 retube (40 tubes)', costOMR: 35_420, manhours: 480, addsDays: { CP1: 0, CP2: 1, CP3: 0 }, note: 'CP2 has float to the project end, so it does not move the finish.' },
];

export interface Scenario {
  drops: string[];
  adds: string[];
  crewsCP1: number; // extra crews 0-3
  crewsCP2: number;
  crewsCP3: number;
  overtimeCP1: boolean;
  startShift: number; // days to shift the start-up window (-3 .. +5)
}

export const BASELINE: Scenario = { drops: [], adds: [], crewsCP1: 0, crewsCP2: 0, crewsCP3: 0, overtimeCP1: false, startShift: 0 };

const CREW_GAIN = [0, 1.5, 2.5, 3.0]; // days recovered by 0..3 extra crews (diminishing returns)
const CREW_COST = { CP1: 86_400, CP2: 62_000, CP3: 62_000 };
const RESTART_BUFFER = 2; // days between last mechanical completion and TA end
const BASE_COST = 12_210_000;
const BASE_MH = 412_000;
const STANDING_PER_DAY = 102_800;

export interface WhatIfResult {
  pathEnd: Record<'CP1' | 'CP2' | 'CP3', string>;
  pathDays: Record<'CP1' | 'CP2' | 'CP3', number>; // days vs baseline forecast (negative = earlier)
  finish: string;
  deltaDays: number; // vs baseline forecast
  vsPlanDays: number; // vs contractual end 3 Sep
  drivingPath: 'CP1' | 'CP2' | 'CP3';
  costOMR: number;
  deltaCost: number;
  manhours: number;
  notes: string[];
}

export function compute(s: Scenario): WhatIfResult {
  const notes: string[] = [];
  const delta: Record<'CP1' | 'CP2' | 'CP3', number> = { CP1: 0, CP2: 0, CP3: 0 };
  let cost = BASE_COST;
  let mh = BASE_MH;

  for (const d of DROP_OPTIONS.filter((x) => s.drops.includes(x.jobId))) {
    cost -= d.costOMR;
    mh -= d.manhours;
    delta.CP1 -= d.recoversDays;
    notes.push(`Drop ${d.jobId}: saves OMR ${d.costOMR.toLocaleString()}${d.recoversDays ? `, recovers ${d.recoversDays} d on CP1` : ', no schedule gain'}.`);
  }
  for (const a of ADD_OPTIONS.filter((x) => s.adds.includes(x.id))) {
    cost += a.costOMR;
    mh += a.manhours;
    (['CP1', 'CP2', 'CP3'] as const).forEach((p) => (delta[p] += a.addsDays[p]));
    notes.push(`Add ${a.id}: +OMR ${a.costOMR.toLocaleString()}, +${Object.values(a.addsDays).reduce((x, y) => x + y, 0)} d on the critical path.`);
  }
  (['CP1', 'CP2', 'CP3'] as const).forEach((p) => {
    const n = p === 'CP1' ? s.crewsCP1 : p === 'CP2' ? s.crewsCP2 : s.crewsCP3;
    if (n > 0) {
      delta[p] -= CREW_GAIN[n];
      cost += CREW_COST[p] * n;
      notes.push(`${n} extra crew${n > 1 ? 's' : ''} on ${p}: ${CREW_GAIN[n]} d recovered for OMR ${(CREW_COST[p] * n).toLocaleString()}.`);
    }
  });
  if (s.overtimeCP1) {
    delta.CP1 -= 0.9;
    cost += 38_000;
    notes.push('Overtime on CP1: +10% productivity, 0.9 d recovered for OMR 38,000.');
  }

  const off = { CP1: 0 + delta.CP1, CP2: -6 + delta.CP2, CP3: -3 + delta.CP3 }; // days relative to the contractual end, 3 Sep
  const pathEnd = { CP1: addDays('2026-09-03', Math.ceil(off.CP1 - 1e-9)), CP2: addDays('2026-09-03', Math.ceil(off.CP2 - 1e-9)), CP3: addDays('2026-09-03', Math.ceil(off.CP3 - 1e-9)) };
  const drivingPath = (Object.entries(off).sort((a, b) => b[1] - a[1])[0][0]) as 'CP1' | 'CP2' | 'CP3';
  const finishOffset = off[drivingPath] + RESTART_BUFFER + s.startShift; // days vs 3 Sep
  const finish = addDays('2026-09-03', Math.ceil(finishOffset - 1e-9));
  const deltaDays = Math.round((finishOffset - RESTART_BUFFER) * 10) / 10; // vs the baseline forecast (5 Sep)
  const vsPlanDays = Math.ceil(finishOffset - 1e-9);
  cost += Math.round(deltaDays * STANDING_PER_DAY);
  if (deltaDays !== 0) notes.push(`Standing costs (site overheads, supervision, hire) move with the end date: ${deltaDays > 0 ? '+' : '-'}OMR ${Math.abs(Math.round(deltaDays * STANDING_PER_DAY)).toLocaleString()} for ${Math.abs(deltaDays)} d.`);
  if (s.startShift !== 0) notes.push(`Start-up window shifted ${s.startShift > 0 ? '+' : ''}${s.startShift} d: standing costs move with the end date.`);
  if (drivingPath !== 'CP1') notes.push(`${drivingPath} now drives the finish. Extra CP1 effort beyond this point recovers nothing.`);

  return {
    pathEnd,
    pathDays: { CP1: Math.round(delta.CP1 * 10) / 10, CP2: Math.round(delta.CP2 * 10) / 10, CP3: Math.round(delta.CP3 * 10) / 10 },
    finish,
    deltaDays,
    vsPlanDays,
    drivingPath,
    costOMR: Math.round(cost),
    deltaCost: Math.round(cost - BASE_COST),
    manhours: mh,
    notes,
  };
}

export async function runWhatIf(s: Scenario): Promise<WhatIfResult> {
  return delay(compute(s), 160);
}

export interface SavedScenario {
  id: string;
  name: string;
  scenario: Scenario;
  result: WhatIfResult;
}

const saved = createCollection<SavedScenario>([]);
let n = 1;

export const listSaved = () => saved.list();
export async function saveScenario(name: string, scenario: Scenario): Promise<SavedScenario> {
  return saved.add({ id: `SCN-${n++}`, name: name || `Scenario ${n - 1}`, scenario, result: compute(scenario) });
}
export const deleteSaved = (id: string) => saved.remove(id);
