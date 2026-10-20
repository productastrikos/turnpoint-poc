// Links from each critical / near-critical activity to the records that bear on its risk: discovery jobs and NCRs on
// the same equipment, risk-register entries, crew, and constraints the field has reported. In production these links
// come from the equipment / functional-location keys shared by P6, SAP and TURNPOINT; here they are seeded.
// The prediction service reads the linked records LIVE (a closed NCR or a mitigated risk stops counting).

export interface ActivityContext {
  crew: string;
  contractor: string;
  /** Discovery jobs whose finding affects this activity. */
  dj?: string[];
  /** NCRs on the same equipment that block this activity (matched by tag + title words). */
  ncr?: { tag: string; title: string }[];
  /** Risk-register entries that act on this activity (count while open or mitigating). */
  risks?: string[];
  /** Constraints reported from the field (count while present). */
  constraints?: string[];
  /** Crew-specific shortfall in %, when the field reports one (else the contractor's attendance gap is used). */
  shortfall?: number;
  /** Times re-planned (near-critical activities; critical-path activities carry their own live count). */
  volatility?: number;
  /** SCFs that, while still being evaluated, hold this activity. */
  scf?: string[];
}

export const ACTIVITY_CONTEXT: Record<string, ActivityContext> = {
  // ---- CP1 · R-101 reactor (Unit 100) ----
  'CPA-001': { crew: 'L&T Reactor Crew A', contractor: 'Larsen & Toubro', risks: ['RSK-06'] },
  'CPA-002': { crew: 'L&T Catalyst Crew', contractor: 'Larsen & Toubro', risks: ['RSK-01'] },
  'CPA-003': { crew: 'Petrofac Inspection Team', contractor: 'Petrofac Services', dj: ['DJ-020'], risks: ['RSK-07'], scf: ['SCF-201'] },
  'CPA-008': { crew: 'Galfar Piping Crew 4', contractor: 'Galfar', dj: ['DJ-015'], ncr: [{ tag: '14"-P-2201', title: 'undercut' }] },
  'CPA-011': { crew: 'L&T Reactor Crew B', contractor: 'Larsen & Toubro', dj: ['DJ-020'] },
  'CPA-009': { crew: 'L&T Reactor Crew A', contractor: 'Larsen & Toubro', ncr: [{ tag: 'R-101', title: 'stud material' }] },
  'CPA-012': { crew: 'L&T Catalyst Crew', contractor: 'Larsen & Toubro' },
  'CPA-013': { crew: 'Galfar Commissioning', contractor: 'Galfar', ncr: [{ tag: 'R-101', title: 'purge record' }] },
  // ---- CP2 · E-204 exchanger (Unit 200) ----
  'CPA-004': { crew: 'Galfar Rigging Crew 2', contractor: 'Galfar', risks: ['RSK-03'] },
  'CPA-005': { crew: 'L&T Exchanger Crew', contractor: 'Larsen & Toubro', ncr: [{ tag: 'E-204', title: 'gasket seat' }, { tag: 'E-204', title: 'scored' }], scf: ['SCF-202'] },
  'CPA-014': { crew: 'Galfar Rigging Crew 2', contractor: 'Galfar', risks: ['RSK-05'] },
  'CPA-010': { crew: 'Galfar Commissioning', contractor: 'Galfar' },
  // ---- CP3 · C-301 compressor (Unit 300) ----
  'CPA-006': { crew: 'Galfar Rotating Crew', contractor: 'Galfar', risks: ['RSK-03'] },
  'CPA-007': { crew: 'Petrofac Inspection Team', contractor: 'Petrofac Services', ncr: [{ tag: 'C-301', title: 'seal oil' }] },
  'CPA-015': { crew: 'Galfar Rotating Crew', contractor: 'Galfar', risks: ['RSK-08'] },
  'CPA-016': { crew: 'Galfar Commissioning', contractor: 'Galfar' },
  // ---- near-critical (watched by the live monitor) ----
  'ACT-231': { crew: 'L&T Column Crew (night welders)', contractor: 'Larsen & Toubro', ncr: [{ tag: 'T-201', title: 'support ring' }], shortfall: 25, volatility: 3, constraints: ['Night-shift welders 18 of 24'] },
  'ACT-244': { crew: 'SIS Refractory Crew', contractor: 'Sohar Industrial Services', ncr: [{ tag: 'F-101', title: 'cure curve' }], volatility: 1 },
  'ACT-318': { crew: 'Galfar Rotating Crew', contractor: 'Galfar', ncr: [{ tag: 'K-301', title: 'alignment' }], volatility: 2, constraints: ['Laser alignment kit shared with C-301'] },
  'ACT-352': { crew: 'Galfar Commissioning', contractor: 'Galfar', volatility: 1, constraints: ['Hydrotest water supply not confirmed'] },
  'ACT-367': { crew: 'Zubair E&M Valve Shop', contractor: 'Zubair E&M', ncr: [{ tag: 'RV-1104', title: 'set pressure' }], volatility: 1, constraints: ['Vendor test bench not booked'] },
};

/** Concrete actions the model can cost by re-simulating with the change applied. */
export interface Mitigation {
  id: string;
  title: string;
  owner: string;
  costOMR: number;
  /** Activity -> change to its inputs. */
  effects: Record<string, { ownDelay?: number; shortfall?: number; remaining?: number; findings?: number; constraints?: number; reliability?: number; behindFactor?: number }>;
}

export const MITIGATIONS: Mitigation[] = [
  { id: 'MIT-1', title: 'Add a second night crew on CPA-003, R-101 internals inspection', owner: 'S. Al-Harthy', costOMR: 86_000, effects: { 'CPA-003': { ownDelay: -1, shortfall: 0, remaining: -1 } } },
  { id: 'MIT-2', title: 'Pre-approve SCF-201 so the R-101 tray 7 inspection runs inside the CPA-003 window', owner: 'Dr. Y. Al-Lawati', costOMR: 9_240, effects: { 'CPA-003': { findings: -1, constraints: -1 }, 'CPA-011': { findings: -1 } } },
  { id: 'MIT-3', title: 'Confirm the standby catalyst disposal contractor now (RSK-01)', owner: 'S. Kumar', costOMR: 18_000, effects: { 'CPA-002': { constraints: -1, reliability: 0.97 } } },
  { id: 'MIT-4', title: 'Reserve the 250 t crane for Day 17 (E-204 bundle pull) ahead of the C-301 rotor lift', owner: 'R. Fernandes', costOMR: 0, effects: { 'CPA-004': { constraints: -1 }, 'CPA-006': { constraints: -1 } } },
  { id: 'MIT-5', title: 'Release the second laser alignment kit from the tool crib to K-301 (ACT-318)', owner: 'T. Said', costOMR: 0, effects: { 'ACT-318': { constraints: -1, behindFactor: 0.5 } } },
  { id: 'MIT-6', title: 'Move 6 welders from the Unit 200 scaffold release to the T-201 night shift (ACT-231)', owner: 'M. Al-Balushi', costOMR: 6_000, effects: { 'ACT-231': { shortfall: 0, constraints: -1, behindFactor: 0.6 } } },
];

/** Standing cost of one day of turnaround extension (crews, rentals, lost production margin share). */
export const DELAY_COST_PER_DAY_OMR = 103_000;
