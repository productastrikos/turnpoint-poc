// Execution-phase trackers: field checklists (X6), productivity (X7), box-up (X8), MC certificates (X12), blinding (X14),
// area handover (X27), shift log (X31), contractor KPIs (X29). All seeded and consistent with the shared master data.
import { STATUS_DATE } from './_gen';

// ---------------- field checklists (X6) ----------------
export interface ChecklistTemplate {
  id: string;
  name: string;
  items: string[];
}

export const checklistTemplates: ChecklistTemplate[] = [
  { id: 'TPL-1', name: 'Pre-job safety briefing', items: ['Scope and hazards explained to all crew', 'Permit to work valid and displayed', 'Isolation certificate verified at the point of work', 'PPE checked: helmet, glasses, gloves, FRC, harness', 'Emergency routes and assembly point briefed', 'Gas test within validity', 'Tools inspected and tagged', 'Housekeeping acceptable at the work front'] },
  { id: 'TPL-2', name: 'Confined space entry', items: ['Entry permit issued and signed', 'Atmosphere tested: O2, LEL, H2S, CO', 'Isolations and blinds verified', 'Ventilation running', 'Standby attendant in position', 'Rescue plan and equipment on site', 'Communication checked', 'Entrants briefed and logged'] },
  { id: 'TPL-3', name: 'Hot work', items: ['Hot work permit valid', 'Area cleared of flammables, 10 m radius', 'Fire watch assigned', 'Fire extinguisher at the work front', 'Gas test before and after', 'Sparks and slag contained with blankets', 'Welding equipment inspected', 'Post-work cool-down watch arranged'] },
  { id: 'TPL-4', name: 'Lifting operation', items: ['Lift plan approved', 'Crane certificate and load chart valid', 'Slings and shackles inspected and tagged', 'Ground bearing confirmed', 'Exclusion zone barricaded', 'Signaller and rigger competent', 'Weather within limits', 'Load weight verified'] },
  { id: 'TPL-5', name: 'Flange closure and bolt torquing', items: ['Flange faces inspected, no scoring', 'Gasket type and rating verified', 'Studs and nuts per specification', 'Lubricant applied per procedure', 'Torque sequence followed', 'Torque tool calibrated', 'Final torque recorded', 'Tag and QR scan completed'] },
  { id: 'TPL-6', name: 'Vessel internal inspection', items: ['Vessel cleaned and certified gas free', 'Scaffold inspected and green tagged', 'Lighting intrinsically safe', 'Internal surfaces visually inspected', 'Thickness readings taken', 'Defects marked and photographed', 'Findings reported to Inspection', 'Housekeeping before box-up'] },
];

export interface ChecklistSubmission {
  id: string;
  templateId: string;
  template: string;
  tag: string;
  area: string;
  by: string;
  at: string;
  passed: number;
  failed: number;
  na: number;
  photos: number;
  notes: string;
}

const subs: [string, string, string, string, string, number, number, number, number, string][] = [
  ['TPL-1', 'R-101', 'Unit 100', 'K. Rao', '06:10', 8, 0, 0, 2, ''],
  ['TPL-3', 'T-201', 'Unit 200', 'A. Hinai', '06:25', 7, 1, 0, 3, 'Fire blanket missing at level 2, replaced before work'],
  ['TPL-2', 'R-101', 'Unit 100', 'K. Rao', '06:40', 8, 0, 0, 4, ''],
  ['TPL-4', 'E-204', 'Unit 200', 'R. Fernandes', '07:05', 7, 1, 0, 2, 'Ground bearing marginal, mats added'],
  ['TPL-5', 'E-204', 'Unit 200', 'R. Fernandes', '07:30', 8, 0, 0, 1, ''],
  ['TPL-6', 'T-251', 'Unit 250', 'A. Hinai', '07:50', 8, 0, 0, 6, 'Packing bed height 40 mm short, NCR raised'],
  ['TPL-1', 'C-301', 'Unit 300', 'T. Said', '08:00', 8, 0, 0, 1, ''],
  ['TPL-3', 'F-101', 'Unit 100', 'K. Rao', '08:15', 8, 0, 0, 2, ''],
  ['TPL-5', 'FL-401', 'Flare System', 'K. Rao', '08:30', 7, 0, 1, 1, ''],
  ['TPL-4', 'C-301', 'Unit 300', 'T. Said', '08:45', 8, 0, 0, 3, ''],
];

export const checklistSubmissions: ChecklistSubmission[] = subs.map((s, i) => ({
  id: `FC-${String(i + 401)}`,
  templateId: s[0],
  template: checklistTemplates.find((t) => t.id === s[0])!.name,
  tag: s[1],
  area: s[2],
  by: s[3],
  at: `${STATUS_DATE}T${s[4]}:00`,
  passed: s[5],
  failed: s[6],
  na: s[7],
  photos: s[8],
  notes: s[9],
}));

// ---------------- productivity (X7) ----------------
export interface ProductivityRow {
  id: string;
  activity: string;
  discipline: string;
  contractor: string;
  unit: string;
  planned: number; // output per man-hour
  actual: number;
  qty: number;
  hours: number;
  flagged: boolean;
}

// [activity, discipline, contractor, unit, planned, actual, qty, hours]
const prod: [string, string, string, string, number, number, number, number][] = [
  ['Pipe installation, CS up to 14"', 'Process', 'Galfar', 'm / h', 0.42, 0.37, 1_480, 4_000],
  ['Welding, butt welds', 'Process', 'Galfar', 'inch-dia / h', 1.8, 1.55, 6_200, 4_000],
  ['Scaffold erection', 'Civil', 'Sohar Industrial Services', 'm³ / h', 2.4, 2.5, 11_800, 4_720],
  ['Insulation removal', 'Civil', 'Sohar Industrial Services', 'm² / h', 1.1, 1.18, 3_550, 3_010],
  ['Refractory lining', 'Civil', 'Sohar Industrial Services', 'kg / h', 38, 31, 41_000, 1_320],
  ['Flange breaking and closing', 'Process', 'Galfar', 'flanges / h', 0.55, 0.51, 720, 1_410],
  ['Bolt tensioning', 'Rotating Equipment', 'Larsen & Toubro', 'bolts / h', 6.5, 6.9, 5_100, 740],
  ['Tube bundle cleaning (hydro-jet)', 'Rotating Equipment', 'Larsen & Toubro', 'tubes / h', 22, 19.5, 5_800, 297],
  ['Tray removal and re-install', 'Inspection', 'Larsen & Toubro', 'trays / h', 0.30, 0.22, 64, 291],
  ['Control valve overhaul', 'Instrumentation', 'Zubair E&M', 'valves / h', 0.045, 0.047, 24, 510],
  ['Loop checking', 'Instrumentation', 'Zubair E&M', 'loops / h', 0.9, 0.84, 410, 488],
  ['Cable pulling', 'Electrical', 'Zubair E&M', 'm / h', 14, 15.2, 5_400, 355],
  ['NDT: UT thickness', 'Inspection', 'Petrofac Services', 'points / h', 16, 14.4, 3_900, 271],
  ['Catalyst unloading', 'Process', 'Larsen & Toubro', 't / h', 4.2, 3.6, 118, 33],
];

export const productivityRows: ProductivityRow[] = prod.map((p, i) => ({ id: `PR-${i + 1}`, activity: p[0], discipline: p[1], contractor: p[2], unit: p[3], planned: p[4], actual: p[5], qty: p[6], hours: p[7], flagged: false }));

// ---------------- box-up (X8) ----------------
export const BOXUP_STAGES = ['Checklist open', 'Inspection done', 'Operations witness', 'Certificate issued'];

export interface BoxUp {
  id: string;
  tag: string;
  item: string;
  area: string;
  contractor: string;
  stage: number;
  planned: string;
  items: number; // checklist items
  itemsDone: number;
  hold?: string;
}

// [tag, item, area, contractor, stage, plannedDay, items, itemsDone, hold]
const bu: [string, string, string, string, number, number, number, number, string?][] = [
  ['R-101', 'Manway 1 (top)', 'Unit 100', 'Larsen & Toubro', 3, 13, 12, 12],
  ['R-101', 'Manway 2', 'Unit 100', 'Larsen & Toubro', 1, 14, 12, 12, 'Operations witness not yet scheduled'],
  ['R-101', 'Manway 3 (outlet)', 'Unit 100', 'Larsen & Toubro', 0, 25, 12, 4],
  ['E-204', 'Channel cover', 'Unit 200', 'Larsen & Toubro', 3, 12, 10, 10],
  ['E-204', 'Floating head cover', 'Unit 200', 'Larsen & Toubro', 0, 24, 10, 0],
  ['T-201', 'Manway level 1', 'Unit 200', 'Larsen & Toubro', 0, 21, 9, 0],
  ['T-201', 'Manway level 2', 'Unit 200', 'Larsen & Toubro', 0, 21, 9, 0],
  ['V-102', 'Manway', 'Unit 200', 'Galfar', 1, 18, 8, 8],
  ['C-301', 'Casing (upper half)', 'Unit 300', 'Galfar', 0, 26, 14, 2],
  ['F-101', 'Header box 1', 'Unit 100', 'Larsen & Toubro', 2, 15, 8, 8],
  ['F-101', 'Header box 2', 'Unit 100', 'Larsen & Toubro', 2, 15, 8, 8],
  ['F-101', 'Burner access doors', 'Unit 100', 'Larsen & Toubro', 0, 29, 6, 0],
  ['T-251', 'Manway', 'Unit 250', 'Larsen & Toubro', 0, 19, 8, 3],
  ['T-221', 'Reactor manway', 'Unit 220', 'Galfar', 1, 17, 8, 8],
  ['E-221', 'Shell cover', 'Unit 220', 'Galfar', 3, 11, 8, 8],
  ['R-301', 'Regenerator manway', 'Unit 300', 'Sohar Industrial Services', 0, 23, 10, 1],
  ['K-301', 'Blower casing', 'Unit 300', 'Galfar', 0, 25, 12, 0],
  ['AC-201', 'Header boxes', 'Unit 200', 'Galfar', 2, 16, 6, 6],
  ['P-205', 'Pump casing', 'Unit 200', 'Galfar', 3, 14, 6, 6],
  ['E-103', 'Channel cover', 'Unit 100', 'Larsen & Toubro', 1, 17, 10, 10],
];

export const boxups: BoxUp[] = bu.map((b, i) => ({ id: `BU-${i + 101}`, tag: b[0], item: b[1], area: b[2], contractor: b[3], stage: b[4], planned: `D${b[5]}`, items: b[6], itemsDone: b[7], hold: b[8] }));

// ---------------- blinding (X14) ----------------
export interface Blind {
  id: string;
  line: string;
  equipment: string;
  area: string;
  kind: 'Spade' | 'Spectacle blind' | 'Blind flange';
  size: string;
  rating: string;
  status: 'Planned' | 'Installed' | 'Removed';
  verified: boolean;
  plannedDay: number;
}

const blindLines: [string, string, string, string, string, string][] = [
  ['14"-P-2201', 'R-101 outlet', 'Unit 100', 'Spectacle blind', '14"', '300#'],
  ['8"-P-1104', 'F-101 feed', 'Unit 100', 'Spade', '8"', '300#'],
  ['6"-P-1090', 'K-101 suction', 'Unit 100', 'Spade', '6"', '600#'],
  ['10"-P-2277', 'E-204 shell inlet', 'Unit 200', 'Spade', '10"', '300#'],
  ['12"-P-2210', 'E-204 tube outlet', 'Unit 200', 'Spectacle blind', '12"', '300#'],
  ['24"-P-2001', 'T-201 overhead', 'Unit 200', 'Spectacle blind', '24"', '150#'],
  ['8"-P-2204', 'V-102 outlet', 'Unit 200', 'Spade', '8"', '300#'],
  ['4"-P-2306', 'P-205 discharge', 'Unit 200', 'Blind flange', '4"', '300#'],
  ['12"-P-3120', 'C-301 suction', 'Unit 300', 'Spectacle blind', '12"', '300#'],
  ['14"-P-3305', 'R-301 flue gas', 'Unit 300', 'Spade', '14"', '150#'],
  ['6"-P-3188', 'K-301 discharge', 'Unit 300', 'Spade', '6"', '300#'],
  ['4"-P-2204', 'T-221 acid gas', 'Unit 220', 'Spade', '4"', '150#'],
  ['8"-P-2511', 'T-251 bottoms', 'Unit 250', 'Spade', '8"', '300#'],
  ['14"-FL-401', 'Flare header tie-in', 'Flare System', 'Spectacle blind', '14"', '150#'],
  ['10"-P-4020', 'Pipe rack 4 interconnect', 'Pipe Rack 4', 'Spade', '10"', '300#'],
];

export const blinds: Blind[] = Array.from({ length: 30 }, (_, i) => {
  const b = blindLines[i % blindLines.length];
  const second = i >= blindLines.length;
  const status: Blind['status'] = i % 7 === 0 ? 'Planned' : i % 5 === 0 ? 'Removed' : 'Installed';
  return { id: `BL-${String(i + 1).padStart(3, '0')}`, line: second ? `${b[0]} (B)` : b[0], equipment: b[1], area: b[2], kind: b[3] as Blind['kind'], size: b[4], rating: b[5], status, verified: status !== 'Planned' && i % 4 !== 0, plannedDay: 1 + (i % 12) };
});

// ---------------- MC certificates (X12) ----------------
export const MC_STAGES = ['Draft', 'Contractor signed', 'Inspection verified', 'Operations accepted', 'Issued'];

export interface McCert {
  id: string;
  system: string;
  area: string;
  contractor: string;
  stage: number;
  punchA: number;
  punchB: number;
  plannedDay: number;
}

const mcSystems: [string, string, string, number, number, number, number][] = [
  ['R-101 Reactor Section', 'Unit 100', 'Larsen & Toubro', 0, 14, 22, 27],
  ['F-101 Charge Heater', 'Unit 100', 'Larsen & Toubro', 1, 6, 15, 26],
  ['K-101 Recycle Gas Compressor', 'Unit 100', 'Galfar', 0, 9, 18, 28],
  ['Desalter', 'Unit 200', 'Galfar', 4, 0, 4, 12],
  ['T-201 Atmospheric Column', 'Unit 200', 'Larsen & Toubro', 1, 7, 12, 26],
  ['Crude Preheat Train (E-204)', 'Unit 200', 'Larsen & Toubro', 0, 11, 17, 27],
  ['Crude Charge Pumps', 'Unit 200', 'Galfar', 3, 1, 6, 24],
  ['Overhead System', 'Unit 200', 'Galfar', 4, 0, 3, 22],
  ['Claus Train A (T-221)', 'Unit 220', 'Galfar', 2, 3, 8, 25],
  ['Tail Gas Treating', 'Unit 220', 'Galfar', 3, 1, 5, 24],
  ['Incinerator & Stack', 'Unit 220', 'Sohar Industrial Services', 4, 0, 2, 18],
  ['T-251 Vacuum Column', 'Unit 250', 'Larsen & Toubro', 2, 4, 9, 25],
  ['Vacuum Ejector System', 'Unit 250', 'Galfar', 4, 0, 3, 20],
  ['R-301 Regenerator', 'Unit 300', 'Sohar Industrial Services', 0, 16, 24, 28],
  ['C-301 Wet Gas Compressor', 'Unit 300', 'Galfar', 0, 10, 14, 28],
  ['K-301 Main Air Blower', 'Unit 300', 'Galfar', 1, 8, 12, 27],
  ['Main Fractionator', 'Unit 300', 'Galfar', 2, 3, 10, 25],
  ['Flare Header FL-401', 'Flare System', 'Galfar', 1, 5, 9, 26],
  ['Flare KO Drum', 'Flare System', 'Galfar', 3, 1, 3, 23],
  ['Pipe Rack 4 Interconnecting', 'Pipe Rack 4', 'Sohar Industrial Services', 2, 2, 12, 25],
];

export const mcCerts: McCert[] = mcSystems.map((m, i) => ({ id: `MCC-${String(i + 101)}`, system: m[0], area: m[1], contractor: m[2], stage: m[3], punchA: m[4], punchB: m[5], plannedDay: m[6] }));

// ---------------- area handover (X27) ----------------
export const HANDOVER_STAGES = ['Work in progress', 'Completion declared', 'Walkdown and punch', 'Punch A cleared', 'Handover signed', 'Accepted by Operations'];

export interface Handover {
  id: string;
  area: string;
  package: string;
  contractor: string;
  stage: number;
  punchOpen: number;
  plannedDay: number;
}

const ho: [string, string, string, number, number, number][] = [
  ['Unit 200', 'Desalter and crude charge', 'Galfar', 5, 0, 12],
  ['Unit 200', 'Overhead system', 'Galfar', 4, 0, 22],
  ['Unit 200', 'Atmospheric column internals', 'Larsen & Toubro', 1, 7, 26],
  ['Unit 200', 'Preheat train exchangers', 'Larsen & Toubro', 0, 11, 27],
  ['Unit 220', 'Incinerator and stack', 'Sohar Industrial Services', 4, 0, 18],
  ['Unit 220', 'Claus train A', 'Galfar', 2, 3, 25],
  ['Unit 220', 'Tail gas treating', 'Galfar', 3, 1, 24],
  ['Unit 250', 'Vacuum ejectors', 'Galfar', 5, 0, 20],
  ['Unit 250', 'Vacuum column', 'Larsen & Toubro', 2, 4, 25],
  ['Unit 100', 'Reactor section', 'Larsen & Toubro', 0, 14, 27],
  ['Unit 100', 'Charge heater', 'Larsen & Toubro', 1, 6, 26],
  ['Unit 100', 'Recycle gas compressor', 'Galfar', 0, 9, 28],
  ['Unit 300', 'Regenerator', 'Sohar Industrial Services', 0, 16, 28],
  ['Unit 300', 'Wet gas compressor', 'Galfar', 0, 10, 28],
  ['Unit 300', 'Main air blower', 'Galfar', 1, 8, 27],
  ['Flare System', 'Flare header and KO drum', 'Galfar', 2, 3, 25],
  ['Pipe Rack 4', 'Interconnecting piping', 'Sohar Industrial Services', 2, 2, 25],
];

export const handovers: Handover[] = ho.map((h, i) => ({ id: `HO-${i + 101}`, area: h[0], package: h[1], contractor: h[2], stage: h[3], punchOpen: h[4], plannedDay: h[5] }));

export const MILESTONES = ['Handover by Ops', 'Blinding', 'Opening', 'Cleaning', 'Inspection', 'Repair', 'Box-up', 'Leak test', 'Re-instatement'] as const;
export type MilestoneId = (typeof MILESTONES)[number];
export type MsState = 'Done' | 'In progress' | 'Not started';

export interface AssetMilestones {
  id: string; // tag
  name: string;
  area: string;
  stateByMilestone: Record<MilestoneId, MsState>;
}

const msDefs: [string, string, string, number][] = [
  ['R-101', 'Hydrocracker reactor', 'Unit 100', 3.4],
  ['F-101', 'Charge heater', 'Unit 100', 4.5],
  ['E-204', 'Crude/residue exchanger', 'Unit 200', 4.1],
  ['T-201', 'Atmospheric column', 'Unit 200', 3.8],
  ['V-102', 'Overhead receiver', 'Unit 200', 5.2],
  ['P-205', 'Crude charge pump', 'Unit 200', 6.4],
  ['T-221', 'Claus reactor', 'Unit 220', 4.0],
  ['T-251', 'Vacuum column', 'Unit 250', 4.6],
  ['R-301', 'FCC regenerator', 'Unit 300', 3.2],
  ['C-301', 'Wet gas compressor', 'Unit 300', 3.0],
  ['K-301', 'Main air blower', 'Unit 300', 3.6],
];

export const assetMilestones: AssetMilestones[] = msDefs.map(([id, name, area, progress]) => ({
  id,
  name,
  area,
  stateByMilestone: Object.fromEntries(MILESTONES.map((m, i) => [m, i + 1 <= Math.floor(progress) ? 'Done' : i === Math.floor(progress) ? 'In progress' : 'Not started'])) as Record<MilestoneId, MsState>,
}));

// ---------------- shift log (X31) ----------------
export interface ShiftEntry {
  id: string;
  day: number;
  shift: 'Day' | 'Night';
  outgoing: string;
  incoming: string;
  completed: string[];
  inProgress: string[];
  issues: string[];
  safety: string[];
  carryOver: number;
  signedOut: boolean;
  takenOver: boolean;
  onSite: { galfar: number; lnt: number };
}

export const shiftEntries: ShiftEntry[] = [
  { id: 'SH-0', day: 14, shift: 'Night', outgoing: 'Z. Al-Hajri', incoming: 'A. Al-Ghafri', completed: ['T-201 Section B bottom tray welds 40% complete', 'E-204 shell-side hydro-jetting 70%', 'R-101 manway cleaning finished'], inProgress: ['K-301 casing alignment 30%', 'PSV batch 3 bench testing'], issues: ['Night welder shortfall (6 of 24)', 'Hot-work permit HW-2231 expired, re-issued 05:40'], safety: ['Heat stress case treated on site, no lost time'], carryOver: 11, signedOut: true, takenOver: true, onSite: { galfar: 418, lnt: 226 } },
  { id: 'SH-1', day: 14, shift: 'Day', outgoing: 'A. Al-Ghafri', incoming: 'Z. Al-Hajri', completed: [], inProgress: ['E-204 retube preparation', 'F-101 refractory cure, hold 4 h'], issues: ['Crane slot Day 17 still contested'], safety: [], carryOver: 9, signedOut: false, takenOver: false, onSite: { galfar: 418, lnt: 226 } },
  { id: 'SH-2', day: 13, shift: 'Night', outgoing: 'Z. Al-Hajri', incoming: 'A. Al-Ghafri', completed: ['T-221 catalyst unloading complete', 'Pipe supports 24 of 40 replaced'], inProgress: ['T-201 tray repair Section B', 'DCS I/O card replacement'], issues: ['Nitrogen supply pressure drop 02:10, restored'], safety: ['Gas detector alarm during R-101 purge, false alarm'], carryOver: 12, signedOut: true, takenOver: true, onSite: { galfar: 405, lnt: 214 } },
  { id: 'SH-3', day: 13, shift: 'Day', outgoing: 'A. Al-Ghafri', incoming: 'Z. Al-Hajri', completed: ['Control valve batch 1 returned to Unit 100', 'P-305 overhaul complete'], inProgress: ['R-101 internals pitting survey, tray 7 (DJ-020)'], issues: ['Pitting found on tray 7, discovery job DJ-020 raised'], safety: [], carryOver: 10, signedOut: true, takenOver: true, onSite: { galfar: 421, lnt: 230 } },
  { id: 'SH-4', day: 12, shift: 'Night', outgoing: 'Z. Al-Hajri', incoming: 'A. Al-Ghafri', completed: ['F-101 decoking complete'], inProgress: ['E-204 bundle cleaning'], issues: [], safety: [], carryOver: 8, signedOut: true, takenOver: true, onSite: { galfar: 398, lnt: 209 } },
  { id: 'SH-5', day: 12, shift: 'Day', outgoing: 'A. Al-Ghafri', incoming: 'Z. Al-Hajri', completed: ['PSV batches 1 and 2 recertified'], inProgress: ['Insulation removal Unit 200 80%'], issues: ['Crane conflict E-204 vs C-301 (RSK-03)'], safety: [], carryOver: 9, signedOut: true, takenOver: true, onSite: { galfar: 415, lnt: 222 } },
];

// ---------------- contractor KPI (X29) ----------------
export interface ContractorKpi {
  contractor: string;
  trif: number;
  spi: number;
  ncrOpen: number;
  ftr: number; // first-time-right %
  productivity: number;
  attendance: number;
  rework: number; // % of hours
  hseObs: number; // observations closed %
  invoicesOnTime: number;
}

export const contractorKpis: ContractorKpi[] = [
  { contractor: 'Galfar', trif: 0.38, spi: 0.95, ncrOpen: 5, ftr: 90, productivity: 0.92, attendance: 93.2, rework: 0.52, hseObs: 94, invoicesOnTime: 96 },
  { contractor: 'Larsen & Toubro', trif: 0.41, spi: 0.9, ncrOpen: 5, ftr: 88, productivity: 0.9, attendance: 94.7, rework: 0.61, hseObs: 91, invoicesOnTime: 92 },
  { contractor: 'Petrofac Services', trif: 0.0, spi: 1.0, ncrOpen: 1, ftr: 96, productivity: 0.97, attendance: 96.4, rework: 0.12, hseObs: 98, invoicesOnTime: 98 },
  { contractor: 'Zubair E&M', trif: 0.28, spi: 0.97, ncrOpen: 3, ftr: 92, productivity: 1.0, attendance: 93.0, rework: 0.2, hseObs: 95, invoicesOnTime: 94 },
  { contractor: 'Sohar Industrial Services', trif: 0.55, spi: 0.93, ncrOpen: 3, ftr: 86, productivity: 0.98, attendance: 94.3, rework: 0.7, hseObs: 87, invoicesOnTime: 90 },
];
