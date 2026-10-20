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

export const variations: Variation[] = vr.map((r, i) => ({
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
export const SIGNATORIES = [
  { role: 'Area Operations Focal Point', name: 'F. Al-Amri', at: '2026-06-09T08:41:00', hash: '7f3a9c41' },
  { role: 'Head of Area Operations', name: 'H. Al-Kindi', at: '2026-06-10T14:12:00', hash: 'b82e0d17' },
  { role: 'VP Asset Operations', name: 'N. Al-Busaidi', at: '2026-06-11T16:30:00', hash: '1c9d55ae' },
  { role: 'TA Event Manager', name: 'S. Al-Harthy', at: '2026-06-12T09:05:00', hash: 'e4417b02' },
  { role: 'Head of Turnaround Services', name: 'Dr. Y. Al-Lawati', at: '2026-06-12T10:20:00', hash: '09fd3c68' },
];
