// Scope & worklist support data: variations (S7), import samples (S3), freeze certificate (S8). Duplicates (S9) are detected live by src/ai/duplicateModel.ts.
import { OMR_PER_USD } from './master';

export type VariationType = 'Addition' | 'Deletion' | 'Change';
export type VariationSource = 'SCF' | 'Discovery job' | 'Originator' | 'MOC';
export type VariationStatus = 'Approved' | 'Pending' | 'Rejected';

export interface Variation {
  id: string;
  title: string;
  ref: string; // SCF / DJ / job id
  type: VariationType;
  source: VariationSource;
  originator: string;
  phase: 'Pre-freeze' | 'Post-freeze';
  costOMR: number; // signed
  manhours: number; // signed
  status: VariationStatus;
  raisedAt: string;
  /** Scope item this variation adds, changes or removes (post-freeze variations raised from the worklist). */
  jobId?: string;
  /** Critical-path impact in days (positive = the path gets longer). */
  cpDays?: number;
  cpNote?: string;
  /** Role that has to decide it. */
  approver?: string;
  reason?: string;
  decidedBy?: string;
  decidedAt?: string;
  /** Freeze certificate revision issued when this variation was approved. */
  revision?: string;
}

const scf = (usd: number) => Math.round(usd * OMR_PER_USD);

// [title, ref, type, source, originator, phase, costOMR, manhours, status, raisedAt]
type VR = [string, string, VariationType, VariationSource, string, Variation['phase'], number, number, VariationStatus, string];

const vr: VR[] = [
  // ---- approved before the freeze: +OMR 360,000 ----
  ['T-251 packing replacement (was inspection only)', 'J-2218', 'Change', 'Originator', 'A. Hinai', 'Pre-freeze', 74_000, 700, 'Approved', '2026-03-04'],
  ['Add P-205 mechanical seal replacement', 'J-2214', 'Addition', 'Originator', 'R. Fernandes', 'Pre-freeze', 46_000, 320, 'Approved', '2026-03-18'],
  ['Add MCC-3 relay upgrade', 'J-2222', 'Addition', 'Originator', 'T. Said', 'Pre-freeze', 38_000, 720, 'Approved', '2026-03-25'],
  ['Extend insulation renewal, Unit 200 (+800 m²)', 'J-2224', 'Change', 'Originator', 'M. Al-Balushi', 'Pre-freeze', 52_000, 1100, 'Approved', '2026-04-02'],
  ['Add PSV recertification batch 3 (24 valves)', 'J-2219', 'Addition', 'Originator', 'S. Kumar', 'Pre-freeze', 61_000, 500, 'Approved', '2026-04-15'],
  ['Replace K-301 coupling guard and seals', 'J-2215', 'Addition', 'Originator', 'T. Said', 'Pre-freeze', 29_000, 260, 'Approved', '2026-04-22'],
  ['Add control valve overhaul, batch 2', 'J-2220', 'Addition', 'Originator', 'S. Kumar', 'Pre-freeze', 36_000, 530, 'Approved', '2026-05-06'],
  ['Add DCS I/O card replacement, Unit 100', 'J-2225', 'Addition', 'Originator', 'S. Kumar', 'Pre-freeze', 24_000, 320, 'Approved', '2026-05-27'],
  // ---- approved after the freeze (12 Jun): +OMR 390,000 ----
  ['SCF-203 Replace catalyst support grid', 'SCF-203', 'Addition', 'SCF', 'K. Rao', 'Post-freeze', scf(61_500), 420, 'Approved', '2026-08-11'],
  ['SCF-204 Minor gasket set upsize, V-102', 'SCF-204', 'Change', 'SCF', 'A. Hinai', 'Post-freeze', scf(4_200), 24, 'Approved', '2026-08-13'],
  ['DJ-016 Worn coupling on P-305 spare', 'DJ-016', 'Addition', 'Discovery job', 'R. Fernandes', 'Post-freeze', 4_100, 40, 'Approved', '2026-08-12'],
  ['DJ-018 Missing insulation, E-204 outlet line', 'DJ-018', 'Addition', 'Discovery job', 'R. Fernandes', 'Post-freeze', 3_400, 36, 'Approved', '2026-08-10'],
  ['R-301 refractory extension, cyclone zone (+18 m²)', 'J-2216', 'Change', 'Originator', 'M. Al-Balushi', 'Post-freeze', 214_205, 900, 'Approved', '2026-07-08'],
  ['F-101 tube replacement, 6 tubes (found at decoking)', 'J-2212', 'Addition', 'Discovery job', 'A. Hinai', 'Post-freeze', 161_000, 520, 'Approved', '2026-08-07'],
  // ---- pending ----
  ['J-2230 R-101 outlet nozzle weld overlay', 'J-2230', 'Addition', 'Discovery job', 'A. Hinai', 'Post-freeze', 112_000, 1450, 'Pending', '2026-08-15'],
  ['J-2229 T-201 overhead line spool (CUI found)', 'J-2229', 'Addition', 'Originator', 'K. Rao', 'Post-freeze', 56_000, 940, 'Pending', '2026-08-09'],
  ['SCF-202 Additional E-204 retube, 40 tubes', 'SCF-202', 'Addition', 'SCF', 'R. Fernandes', 'Post-freeze', scf(92_000), 480, 'Pending', '2026-08-15'],
  // ---- rejected ----
  ['J-2234 SRU incinerator stack replacement', 'J-2234', 'Addition', 'Originator', 'M. Al-Balushi', 'Post-freeze', 310_000, 5200, 'Rejected', '2026-07-30'],
  ['SCF-205 C-301 coupling replacement', 'SCF-205', 'Addition', 'SCF', 'T. Said', 'Post-freeze', scf(15_800), 120, 'Rejected', '2026-08-09'],
  ['J-2204 Instrument loop QC-2201 recalibration', 'J-2204', 'Addition', 'Originator', 'S. Kumar', 'Post-freeze', 32_000, 420, 'Rejected', '2026-07-30'],
  // ---- deletions (descoped) ----
  ['Defer Unit 250 ejector overhaul to next TA', 'J-2209', 'Deletion', 'Originator', 'K. Rao', 'Post-freeze', -18_000, -160, 'Approved', '2026-07-20'],
];

/** Everything that ever happened to the scope: eight movements before the freeze, then the post-freeze changes. Used by "Load mid-TA state". */
export const VARIATION_HISTORY: Variation[] = vr.map((r, i) => ({
  id: `VAR-${String(i + 101)}`,
  title: r[0],
  ref: r[1],
  type: r[2],
  source: r[3],
  originator: r[4],
  phase: r[5],
  costOMR: r[6],
  manhours: r[7],
  status: r[8],
  raisedAt: r[9],
}));

const PRE_REASONS = [
  'Inspection at the last TA found the packing fouled; replacement is cheaper now than a forced outage.',
  'Seal leaking since June; same exchanger window as the P-205 overhaul.',
  'Relay model obsolete; vendor support ends 2027.',
  'Insulation survey found a larger area of CUI than the original estimate.',
  'Batch 3 valves are due for recertification in this cycle.',
  'Coupling guard cracked at the last walkdown (HSE finding).',
  'Second batch of control valves failed the stroke test.',
  'Card failures trending up; replace while the unit is down.',
];

/**
 * Opening state of the demo: the eight pre-freeze scope movements are RAISED but not yet decided.
 * Approving them (live) is part of the demo. The post-freeze history only appears when "Load mid-TA state" is used.
 */
export const OPENING_VARIATIONS: Variation[] = VARIATION_HISTORY.filter((v) => v.phase === 'Pre-freeze').map((v, i) => ({
  ...v,
  status: 'Pending' as const,
  approver: 'Head of Area Operations',
  reason: PRE_REASONS[i],
}));

/**
 * Live mirror of the variation list, kept in step by scopeService. Read-only consumers that import the seed
 * (duplicate detection, budget bridge baseline) see the current state at call time. The budget service takes its
 * baseline from this array when it loads, i.e. the opening state.
 */
export const variations: Variation[] = OPENING_VARIATIONS.map((v) => ({ ...v }));

export const FREEZE_DATE = '2026-06-12';
export const BASE_ESTIMATE = 11_050_000;

// ---------------- import samples (S3) ----------------
export interface ImportRow {
  desc: string;
  discipline: string;
  area: string;
  tag: string;
  costOMR: number;
  manhours: number;
  likelihood: number;
  consequence: number;
}

export const BULK_SAMPLE: ImportRow[] = [
  { desc: 'Replace gearbox oil on P-205 and P-305', discipline: 'Rotating Equipment', area: 'Unit 200', tag: 'P-205', costOMR: 6_200, manhours: 90, likelihood: 2, consequence: 2 },
  { desc: 'Calibrate 24 pressure transmitters, Unit 250', discipline: 'Instrumentation', area: 'Unit 250', tag: 'PT-2501', costOMR: 8_900, manhours: 160, likelihood: 2, consequence: 3 },
  { desc: 'Paint steel structure, Pipe Rack 4 (1,200 m²)', discipline: 'Civil', area: 'Pipe Rack 4', tag: 'PR4-STR', costOMR: 24_000, manhours: 520, likelihood: 1, consequence: 2 },
  { desc: 'Inspect and re-certify 14 lifting beams', discipline: 'Inspection', area: 'Unit 300', tag: 'LB-300', costOMR: 5_400, manhours: 80, likelihood: 3, consequence: 3 },
  { desc: 'Replace emergency shower flow switches', discipline: 'Electrical', area: 'Unit 100', tag: 'ES-100', costOMR: 3_100, manhours: 48, likelihood: 2, consequence: 3 },
  { desc: 'Clean and inspect cooling water exchanger E-241', discipline: 'Process', area: 'Unit 220', tag: 'E-241', costOMR: 14_800, manhours: 210, likelihood: 3, consequence: 3 },
];

export const EXCEL_SAMPLE: (ImportRow & { problem?: string })[] = [
  { desc: 'Replace expansion bellows EJ-2 on FCC flue gas line', discipline: 'Inspection', area: 'Unit 300', tag: 'EJ-2', costOMR: 41_000, manhours: 620, likelihood: 4, consequence: 4 },
  { desc: 'Overhaul 6 cooling tower fan gearboxes', discipline: 'Rotating Equipment', area: 'Unit 200', tag: 'CT-FG', costOMR: 26_500, manhours: 340, likelihood: 3, consequence: 3 },
  { desc: 'Repair damaged cable ladder, substation 3', discipline: 'Electrical', area: 'Unit 300', tag: '', costOMR: 4_700, manhours: 60, likelihood: 2, consequence: 2, problem: 'Equipment tag missing' },
  { desc: 'Re-lag steam tracing, Unit 250', discipline: 'Civil', area: 'Unit 250', tag: 'ST-250', costOMR: 0, manhours: 140, likelihood: 2, consequence: 2, problem: 'Cost estimate missing' },
  { desc: 'Hydrotest new 6" bypass line around E-204', discipline: 'Process', area: 'Unit 200', tag: 'BP-204', costOMR: 7_300, manhours: 110, likelihood: 3, consequence: 3 },
  { desc: 'E-204 exchanger retubing (bundle to be pulled)', discipline: 'Rotating Equipment', area: 'Unit 200', tag: 'E-204', costOMR: 198_000, manhours: 2_400, likelihood: 3, consequence: 4 },
];


// ---------------- freeze certificate (S8) ----------------
/** Approved budget envelope for the programme. The freeze readiness check compares the projected estimate to it. */
export const BUDGET_ENVELOPE = 11_600_000;
export const CERT_NUMBER = 'TFC-STO2026-001';

/** Who signs the freeze certificate, in signing order. The first three are the approval gates. */
export const SIGNATORIES = [
  { role: 'Area Operations Focal Point', name: 'F. Al-Amri' },
  { role: 'Head of Area Operations', name: 'H. Al-Kindi' },
  { role: 'VP Asset Operations', name: 'N. Al-Busaidi' },
  { role: 'TA Event Manager', name: 'S. Al-Harthy' },
  { role: 'Head of Turnaround Services', name: 'Dr. Y. Al-Lawati' },
];

// ---------------- post-freeze requests the demo can generate (one click) ----------------
export interface SimRequest {
  ref: string;
  title: string;
  type: VariationType;
  source: VariationSource;
  originator: string;
  /** Signed. For a Change this is the delta on the existing item. */
  costOMR: number;
  manhours: number;
  cpDays: number;
  cpNote: string;
  reason: string;
  /** Addition: the new scope item that is created (pending the variation). */
  newJob?: { desc: string; discipline: string; area: string; tag: string; likelihood: 1 | 2 | 3 | 4 | 5; consequence: 1 | 2 | 3 | 4 | 5; durationDays: number };
  /** Change / Deletion: the baseline item it acts on. */
  targetJobId?: string;
}

export const SIM_REQUESTS: SimRequest[] = [
  {
    ref: 'SCF-203', title: 'SCF-203 Replace catalyst support grid, R-101', type: 'Addition', source: 'SCF', originator: 'K. Rao',
    costOMR: scf(61_500), manhours: 420, cpDays: 2, cpNote: 'R-101 reload (CP1) cannot start until the grid is replaced: +2 days',
    reason: 'Support grid found cracked and deformed during the internals inspection. The reload cannot start without it.',
    newJob: { desc: 'Replace catalyst support grid, R-101 (SCF-203)', discipline: 'Process', area: 'Unit 100', tag: 'R-101', likelihood: 4, consequence: 4, durationDays: 3 },
  },
  {
    ref: 'SCF-202', title: 'SCF-202 Additional E-204 retube, 40 tubes', type: 'Addition', source: 'SCF', originator: 'R. Fernandes',
    costOMR: scf(92_000), manhours: 480, cpDays: 3, cpNote: 'E-204 retube (CP2) extends by 3 days and exceeds the mechanical window',
    reason: 'Hydro-test after the bundle pull showed leaks on a further 40 tubes. Retubing is cheaper than plugging.',
    newJob: { desc: 'Additional E-204 retube, 40 tubes (SCF-202)', discipline: 'Rotating Equipment', area: 'Unit 200', tag: 'E-204', likelihood: 3, consequence: 4, durationDays: 4 },
  },
  {
    ref: 'DJ-016', title: 'DJ-016 Worn coupling on P-305 spare', type: 'Addition', source: 'Discovery job', originator: 'R. Fernandes',
    costOMR: 4_100, manhours: 40, cpDays: 0, cpNote: 'Off the critical path: absorbed in float',
    reason: 'Found while draining lube oil: coupling hub worn beyond limits. The spare must be healthy for the next run.',
    newJob: { desc: 'Replace worn coupling on P-305 spare (DJ-016)', discipline: 'Rotating Equipment', area: 'Unit 300', tag: 'P-305', likelihood: 2, consequence: 2, durationDays: 1 },
  },
  {
    ref: 'J-2216', title: 'R-301 refractory extension, cyclone zone (+18 m2)', type: 'Change', source: 'Originator', originator: 'M. Al-Balushi',
    costOMR: 38_000, manhours: 260, cpDays: 1, cpNote: 'Extra refractory cure time on R-301: +1 day',
    reason: 'Inspection after demolition found damage extending 18 m2 beyond the planned repair area.',
    targetJobId: 'J-2216',
  },
  {
    ref: 'J-2223', title: 'Defer pipe-rack 4 support replacement to next TA', type: 'Deletion', source: 'Originator', originator: 'K. Rao',
    costOMR: -49_000, manhours: -1_900, cpDays: 0, cpNote: 'No critical-path effect; frees scaffold and crane capacity',
    reason: 'Supports re-assessed as fit for service by Inspection (remaining life above 4 years). Release the money and hours.',
    targetJobId: 'J-2223',
  },
  {
    ref: 'DJ-018', title: 'DJ-018 Missing insulation, E-204 outlet line', type: 'Addition', source: 'Discovery job', originator: 'R. Fernandes',
    costOMR: 3_400, manhours: 36, cpDays: 0, cpNote: 'Off the critical path: absorbed in float',
    reason: 'Insulation missing on a hot line next to the walkway (burn hazard). Fix while the scaffold is up.',
    newJob: { desc: 'Reinstate insulation, E-204 outlet line (DJ-018)', discipline: 'Civil', area: 'Unit 200', tag: 'E-204', likelihood: 2, consequence: 3, durationDays: 1 },
  },
  {
    ref: 'J-2212', title: 'F-101 tube replacement, 6 tubes (found at decoking)', type: 'Change', source: 'Discovery job', originator: 'A. Hinai',
    costOMR: 161_000, manhours: 520, cpDays: 2, cpNote: 'Heater F-101 tube replacement on CP1: +2 days',
    reason: 'Decoking revealed six tubes below minimum wall. Replacement is required for a safe 4-year run.',
    targetJobId: 'J-2212',
  },
];

// ---------------- illustrative history for the AI budget estimate ----------------
export interface PastJob {
  id: string;
  ta: string;
  desc: string;
  tag: string;
  discipline: string;
  costOMR: number;
  manhours: number;
}

/** Completed jobs from earlier turnarounds. Illustrative until OQ's cost history (SAP PM actuals) is loaded. */
export const PAST_JOBS: PastJob[] = [
  { id: 'J-1187', ta: 'TA 2022', desc: 'E-104 bundle pull and retube', tag: 'E-104', discipline: 'Rotating Equipment', costOMR: 176_000, manhours: 2_150 },
  { id: 'J-1192', ta: 'TA 2022', desc: 'Replace expansion bellows EJ-1 on flue gas line', tag: 'EJ-1', discipline: 'Inspection', costOMR: 36_500, manhours: 540 },
  { id: 'J-1204', ta: 'TA 2022', desc: 'Re-lag steam tracing and insulation, Unit 100', tag: 'ST-110', discipline: 'Civil', costOMR: 9_800, manhours: 380 },
  { id: 'J-1211', ta: 'TA 2022', desc: 'P-105 charge pump overhaul', tag: 'P-105', discipline: 'Rotating Equipment', costOMR: 41_000, manhours: 760 },
  { id: 'J-1219', ta: 'TA 2022', desc: 'PSV recertification campaign, 60 valves', tag: 'RV-1001', discipline: 'Instrumentation', costOMR: 44_000, manhours: 930 },
  { id: 'J-1226', ta: 'TA 2022', desc: 'Control valve overhaul package, 20 CVs', tag: 'PV-2010', discipline: 'Instrumentation', costOMR: 38_500, manhours: 720 },
  { id: 'J-1233', ta: 'TA 2022', desc: 'Insulation renewal, Unit 100 (1,600 m2)', tag: 'INS-100', discipline: 'Civil', costOMR: 47_000, manhours: 2_500 },
  { id: 'J-1241', ta: 'TA 2022', desc: 'Hydrotest 4" bypass line around E-104', tag: 'BP-104', discipline: 'Process', costOMR: 6_100, manhours: 92 },
  { id: 'J-2101', ta: 'TA 2024', desc: 'Cooling tower fan gearbox overhaul, 4 units', tag: 'CT-FG', discipline: 'Rotating Equipment', costOMR: 19_800, manhours: 260 },
  { id: 'J-2108', ta: 'TA 2024', desc: 'T-101 column trays inspection and repair', tag: 'T-101', discipline: 'Inspection', costOMR: 118_000, manhours: 2_800 },
  { id: 'J-2113', ta: 'TA 2024', desc: 'Calibrate 30 pressure transmitters', tag: 'PT-1001', discipline: 'Instrumentation', costOMR: 10_400, manhours: 190 },
  { id: 'J-2119', ta: 'TA 2024', desc: 'Scaffold package for heater F-101 workfronts', tag: 'F-101', discipline: 'Civil', costOMR: 39_000, manhours: 3_900 },
  { id: 'J-2124', ta: 'TA 2024', desc: 'Replace cable ladder and trays, substation 2', tag: 'SS-2', discipline: 'Electrical', costOMR: 6_900, manhours: 110 },
  { id: 'J-2131', ta: 'TA 2024', desc: 'Reactor R-201 internals inspection and nozzle repair', tag: 'R-201', discipline: 'Inspection', costOMR: 128_000, manhours: 3_000 },
  { id: 'J-2137', ta: 'TA 2024', desc: 'Compressor K-201 bearing replacement and alignment', tag: 'K-201', discipline: 'Rotating Equipment', costOMR: 72_000, manhours: 1_250 },
  { id: 'J-2142', ta: 'TA 2024', desc: 'Clean and inspect cooling water exchanger E-141', tag: 'E-141', discipline: 'Process', costOMR: 13_500, manhours: 190 },
  { id: 'J-2148', ta: 'TA 2024', desc: 'Furnace burner replacement, 8 burners', tag: 'F-201', discipline: 'Process', costOMR: 124_000, manhours: 1_500 },
  { id: 'J-2155', ta: 'TA 2024', desc: 'Replace pipe supports and repaint pipe rack 2', tag: 'PR2-SUP', discipline: 'Civil', costOMR: 31_000, manhours: 1_300 },
];
