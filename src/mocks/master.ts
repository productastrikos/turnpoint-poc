// Shared master data — the "who / where / which contractor" every page agrees on.
// Context: OQ Refineries & Petrochemical Industries (OQ RPI), Sohar Refinery, Sultanate of Oman.
import type { Discipline } from '../types';

export const SITE = 'Sohar Refinery';
export const ACTIVE_TA_ID = 'STO-2026';

export const DISCIPLINES: Discipline[] = ['Inspection', 'Rotating Equipment', 'Process', 'Instrumentation', 'Civil', 'Electrical'];

/** Plant areas. `id` strings are the same ones the original mocks used ("Unit 100" ...). */
export interface AreaDef {
  id: string;
  unit: string; // process unit short name
  name: string;
}

export const AREAS: AreaDef[] = [
  { id: 'Unit 100', unit: 'HCU', name: 'Hydrocracker Unit' },
  { id: 'Unit 200', unit: 'CDU', name: 'Crude Distillation Unit' },
  { id: 'Unit 220', unit: 'SRU', name: 'Sulphur Recovery Unit' },
  { id: 'Unit 250', unit: 'VDU', name: 'Vacuum Distillation Unit' },
  { id: 'Unit 300', unit: 'FCC', name: 'Fluid Catalytic Cracker' },
  { id: 'Pipe Rack 4', unit: 'PR4', name: 'Pipe Rack 4 (Interconnecting)' },
  { id: 'Flare System', unit: 'FLR', name: 'Flare & Relief System' },
];

export const AREA_IDS = AREAS.map((a) => a.id);
export const PROCESS_AREA_IDS = ['Unit 100', 'Unit 200', 'Unit 220', 'Unit 250', 'Unit 300'];

export function areaLabel(id: string): string {
  const a = AREAS.find((x) => x.id === id);
  return a ? `${id} · ${a.unit}` : id;
}

export function unitOf(id: string): string {
  return AREAS.find((x) => x.id === id)?.unit ?? id;
}

export interface ContractorDef {
  id: string;
  name: string;
  scope: string;
  role: 'MMC' | 'Specialist' | 'Support';
  manpowerPlan: number; // peak planned headcount
}

export const CONTRACTORS: ContractorDef[] = [
  { id: 'GAL', name: 'Galfar', scope: 'Main Mechanical Contractor — piping, static & rotating', role: 'MMC', manpowerPlan: 820 },
  { id: 'LNT', name: 'Larsen & Toubro', scope: 'Reactor, heat exchanger & heater works', role: 'Specialist', manpowerPlan: 410 },
  { id: 'PSL', name: 'Petrofac Services', scope: 'Inspection, NDT & integrity services', role: 'Specialist', manpowerPlan: 160 },
  { id: 'ZEM', name: 'Zubair E&M', scope: 'Electrical, instrumentation & controls', role: 'Specialist', manpowerPlan: 240 },
  { id: 'SIS', name: 'Sohar Industrial Services', scope: 'Scaffolding, insulation, painting & waste', role: 'Support', manpowerPlan: 330 },
];

export const CONTRACTOR_NAMES = CONTRACTORS.map((c) => c.name);

/** Discipline -> default executing contractor, so a job on any page resolves to the same contractor. */
export const DISCIPLINE_CONTRACTOR: Record<Discipline, string> = {
  Inspection: 'Petrofac Services',
  'Rotating Equipment': 'Galfar',
  Process: 'Galfar',
  Instrumentation: 'Zubair E&M',
  Civil: 'Sohar Industrial Services',
  Electrical: 'Zubair E&M',
};

export const PEOPLE = {
  taManager: 'S. Al-Harthy',
  headTaServices: 'Dr. Y. Al-Lawati',
  areaFocal: 'F. Al-Amri',
  headAreaOps: 'H. Al-Kindi',
  vpAssetOps: 'N. Al-Busaidi',
  planner: 'M. Al-Balushi',
  inspection: 'A. Hinai',
  rotating: 'R. Fernandes',
  process: 'K. Rao',
  instr: 'S. Kumar',
  electrical: 'T. Said',
  hse: 'L. D’Souza',
  procurement: 'B. Al-Rawahi',
  qaqc: 'P. Menon',
  permit: 'Permit Office',
};

export const OWNERS = [PEOPLE.inspection, PEOPLE.rotating, PEOPLE.process, PEOPLE.instr, PEOPLE.electrical, PEOPLE.planner];

export const OMR_PER_USD = 0.385;

/** Equipment tags used across pages (scope items, work packs, MC certificates, box-up, blinding ...). */
export const KEY_EQUIPMENT: { tag: string; desc: string; area: string; discipline: Discipline }[] = [
  { tag: 'R-101', desc: 'Hydrocracker Reactor', area: 'Unit 100', discipline: 'Inspection' },
  { tag: 'V-102', desc: 'Overhead Receiver Drum', area: 'Unit 200', discipline: 'Inspection' },
  { tag: 'F-101', desc: 'Charge Heater', area: 'Unit 100', discipline: 'Process' },
  { tag: 'E-204', desc: 'Crude/Residue Exchanger', area: 'Unit 200', discipline: 'Rotating Equipment' },
  { tag: 'T-201', desc: 'Atmospheric Column', area: 'Unit 200', discipline: 'Inspection' },
  { tag: 'P-205', desc: 'Crude Charge Pump', area: 'Unit 200', discipline: 'Rotating Equipment' },
  { tag: 'T-221', desc: 'Claus Reactor Train A', area: 'Unit 220', discipline: 'Process' },
  { tag: 'T-251', desc: 'Vacuum Column', area: 'Unit 250', discipline: 'Inspection' },
  { tag: 'C-301', desc: 'Wet Gas Compressor', area: 'Unit 300', discipline: 'Rotating Equipment' },
  { tag: 'R-301', desc: 'FCC Regenerator', area: 'Unit 300', discipline: 'Inspection' },
  { tag: 'K-301', desc: 'Main Air Blower', area: 'Unit 300', discipline: 'Rotating Equipment' },
  { tag: 'FL-401', desc: 'Flare Header Tie-in', area: 'Flare System', discipline: 'Process' },
];
