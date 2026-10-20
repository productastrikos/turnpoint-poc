// Readiness data: (a) overall STO readiness components + gaps (G11), (b) per-system walkdown / PSSR / start-up readiness (X18-X20).

export type ReadyStage = 'walkdown' | 'pssr' | 'startup';

export const STAGE_ITEMS: Record<ReadyStage, string[]> = {
  walkdown: [
    'Mechanical work complete',
    'Scaffolding removed',
    'Insulation reinstated',
    'Temporary equipment removed',
    'Housekeeping complete',
    'Blinds and spades list verified',
    'Nameplates and tags in place',
    'Punch list A closed',
  ],
  pssr: [
    'Operating procedures updated',
    'HAZOP actions closed',
    'MOC closed or approved',
    'Safety systems tested (ESD, F&G)',
    'PSVs installed and certified',
    'Operator training complete',
    'Emergency response plan updated',
    'Walkdown sign-off done',
  ],
  startup: [
    'Utilities available',
    'Leak test passed',
    'Nitrogen purge complete',
    'Instruments calibrated, loops checked',
    'Catalyst / chemicals loaded',
    'Permit to start issued',
    'Operations accepted handover',
  ],
};

export interface ReadySystem {
  id: string;
  unit: string; // short unit name
  name: string;
  owner: string;
  items: Record<ReadyStage, boolean[]>;
}

// [id, unit, name, owner, maturity 0..1]
const defs: [string, string, string, string, number][] = [
  ['SYS-101', 'HCU', 'R-101 Reactor Section', 'A. Hinai', 0.35],
  ['SYS-102', 'HCU', 'F-101 Charge Heater', 'K. Rao', 0.65],
  ['SYS-103', 'HCU', 'K-101 Recycle Gas Compressor', 'R. Fernandes', 0.5],
  ['SYS-104', 'HCU', 'High Pressure Separation', 'K. Rao', 0.55],
  ['SYS-105', 'HCU', 'Fractionation Section', 'K. Rao', 0.7],
  ['SYS-106', 'HCU', 'HCU Utilities & Flare Tie-ins', 'T. Said', 0.8],
  ['SYS-201', 'CDU', 'Desalter', 'K. Rao', 0.9],
  ['SYS-202', 'CDU', 'T-201 Atmospheric Column', 'A. Hinai', 0.5],
  ['SYS-203', 'CDU', 'Crude Preheat Train (E-204)', 'R. Fernandes', 0.4],
  ['SYS-204', 'CDU', 'Crude Charge Pumps', 'R. Fernandes', 0.75],
  ['SYS-205', 'CDU', 'Overhead System', 'K. Rao', 0.85],
  ['SYS-221', 'SRU', 'Claus Train A (T-221)', 'K. Rao', 0.6],
  ['SYS-222', 'SRU', 'Tail Gas Treating', 'K. Rao', 0.8],
  ['SYS-223', 'SRU', 'Incinerator & Stack', 'S. Kumar', 0.95],
  ['SYS-251', 'VDU', 'T-251 Vacuum Column', 'A. Hinai', 0.7],
  ['SYS-252', 'VDU', 'Vacuum Ejector System', 'R. Fernandes', 0.9],
  ['SYS-253', 'VDU', 'Vacuum Heater', 'K. Rao', 0.6],
  ['SYS-301', 'FCC', 'R-301 Regenerator', 'A. Hinai', 0.45],
  ['SYS-302', 'FCC', 'C-301 Wet Gas Compressor', 'T. Said', 0.35],
  ['SYS-303', 'FCC', 'K-301 Main Air Blower', 'T. Said', 0.4],
  ['SYS-304', 'FCC', 'Main Fractionator', 'K. Rao', 0.7],
  ['SYS-305', 'FCC', 'Gas Concentration', 'K. Rao', 0.8],
  ['SYS-401', 'FLR', 'Flare Header FL-401', 'K. Rao', 0.55],
  ['SYS-402', 'FLR', 'Flare KO Drum', 'S. Kumar', 0.85],
  ['SYS-403', 'PR4', 'Pipe Rack 4 Interconnecting', 'M. Al-Balushi', 0.7],
];

const flags = (n: number, closed: number) => Array.from({ length: n }, (_, i) => i < closed);

export const readySystems: ReadySystem[] = defs.map(([id, unit, name, owner, m]) => ({
  id,
  unit,
  name,
  owner,
  items: {
    walkdown: flags(STAGE_ITEMS.walkdown.length, Math.round(m * 8)),
    pssr: flags(STAGE_ITEMS.pssr.length, Math.round(Math.max(0, m - 0.25) * 8)),
    startup: flags(STAGE_ITEMS.startup.length, Math.round(Math.max(0, m - 0.45) * 7)),
  },
}));

// ---------------- overall STO readiness (G11) ----------------

export interface ReadyComponent {
  id: string;
  name: string;
  weight: number;
  score: number; // 0-100
  stage: string;
  link: string;
}

export const readyComponents: ReadyComponent[] = [
  { id: 'scope', name: 'Scoping & worklist frozen', weight: 15, score: 100, stage: 'Scoping', link: '/scope?tab=freeze' },
  { id: 'plan', name: 'Planning & scheduling', weight: 15, score: 92, stage: 'Planning', link: '/lookahead' },
  { id: 'contract', name: 'Contracting & mobilisation', weight: 15, score: 96, stage: 'Planning', link: '/mobilization' },
  { id: 'materials', name: 'Materials & procurement', weight: 20, score: 78, stage: 'Planning', link: '/material-tracking' },
  { id: 'permits', name: 'Permits & isolation', weight: 10, score: 80, stage: 'Pre-TA', link: '/pre-ta/isolation' },
  { id: 'hse', name: 'HSE & compliance', weight: 10, score: 88, stage: 'Pre-TA', link: '/issues' },
  { id: 'resources', name: 'Resources: manpower, tools, equipment', weight: 10, score: 88, stage: 'Pre-TA', link: '/attendance' },
  { id: 'startup', name: 'Start-up readiness (systems)', weight: 5, score: 55, stage: 'Execution', link: '/readiness-board?tab=startup' },
];

export interface ReadyGap {
  id: string;
  component: string; // ReadyComponent id
  title: string;
  owner: string;
  due: string;
  lift: number; // points added to the component when closed
  closed: boolean;
}

export const readyGaps: ReadyGap[] = [
  { id: 'GAP-01', component: 'materials', title: 'MTO-009 hydrocracking catalyst: confirm vessel ETA, ships 4 days before need date', owner: 'B. Al-Rawahi', due: '2026-08-18', lift: 6, closed: false },
  { id: 'GAP-02', component: 'materials', title: 'MTO-010 F-101 burners: PO not yet issued (27-week lead)', owner: 'B. Al-Rawahi', due: '2026-08-17', lift: 5, closed: false },
  { id: 'GAP-03', component: 'materials', title: 'MTO-025 BMS modules not raised', owner: 'B. Al-Rawahi', due: '2026-08-19', lift: 4, closed: false },
  { id: 'GAP-04', component: 'permits', title: '9 hot-work permits overdue for renewal, Unit 200', owner: 'Permit Office', due: '2026-08-17', lift: 8, closed: false },
  { id: 'GAP-05', component: 'permits', title: '3 isolation certificates pending, Unit 300', owner: 'T. Said', due: '2026-08-17', lift: 5, closed: false },
  { id: 'GAP-06', component: 'plan', title: 'Lookahead: crane slot conflict E-204 vs C-301 lifts (Day 17)', owner: 'M. Al-Balushi', due: '2026-08-18', lift: 4, closed: false },
  { id: 'GAP-07', component: 'hse', title: 'Scaffold tag discrepancy, Unit 300 (3 days old)', owner: 'L. D’Souza', due: '2026-08-17', lift: 6, closed: false },
  { id: 'GAP-08', component: 'resources', title: 'Night-shift welder shortfall (6 of 24)', owner: 'Galfar', due: '2026-08-18', lift: 7, closed: false },
  { id: 'GAP-09', component: 'startup', title: 'Catalyst loading crew not yet confirmed for R-101 reload', owner: 'L&T', due: '2026-08-24', lift: 10, closed: false },
];
