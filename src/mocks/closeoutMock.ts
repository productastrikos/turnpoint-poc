// Close-out and continuous improvement data: lessons learned (I6, C1), post-TA work (C2), handover documents and archive (C6),
// milestones and event tracker (I3, I4), strategy document (I5).
import { addDays, STATUS_DATE } from './_gen';

// ---------------- lessons learned from the previous TA (STO-2024) ----------------
export type LessonStatus = 'Open' | 'In progress' | 'Closed';
export const LESSON_CATEGORIES = ['Planning', 'Scope', 'Procurement', 'Contractor management', 'HSE', 'Execution', 'Quality', 'Logistics', 'Digital reporting'] as const;
export type LessonCategory = (typeof LESSON_CATEGORIES)[number];

export interface Lesson {
  id: string;
  category: LessonCategory;
  lesson: string;
  recommendation: string;
  owner: string;
  due: string;
  status: LessonStatus;
  impact: 'High' | 'Medium' | 'Low';
  carried: boolean; // carried forward into the current TA plan
}

// [category, lesson, recommendation, owner, dueOffsetDays(from status date), status, impact, carried]
type LR = [LessonCategory, string, string, string, number, LessonStatus, Lesson['impact'], boolean];

const lr: LR[] = [
  ['Planning', 'Look-ahead was only built 2 weeks ahead; crane conflicts were found too late', 'Build the 4-week look-ahead from P6 and review crane and manlift slots weekly', 'M. Al-Balushi', -120, 'Closed', 'High', true],
  ['Planning', 'Baseline had no float on the reactor critical path', 'Review critical path logic at T-6 months with the contractor', 'M. Al-Balushi', -90, 'Closed', 'High', true],
  ['Scope', 'Scope grew 11% after freeze, mostly discovery work found at opening', 'Run risk-based scope challenge and hold a discovery contingency', 'A. Hinai', -60, 'In progress', 'High', true],
  ['Scope', '19% of scope items were duplicates raised from notifications and inspection findings', 'Duplicate detection at scope creation', 'M. Al-Balushi', -30, 'Closed', 'Medium', true],
  ['Scope', 'Mandatory fields were often empty, estimates arrived late', 'Enforce mandatory fields in the scope form', 'M. Al-Balushi', -45, 'Closed', 'Medium', true],
  ['Procurement', 'Two long-lead items arrived 9 days after need date', 'Order-by alerts from lead time and weekly expediting', 'B. Al-Rawahi', -75, 'Closed', 'High', true],
  ['Procurement', 'Gasket sizes were mis-specified in the MTO', 'Extract MTO from P&IDs and isometrics, not by hand', 'B. Al-Rawahi', 20, 'In progress', 'Medium', true],
  ['Procurement', 'Vendor ITP hold points missed, material rejected on site', 'Track ITP hold points from PO issuance', 'P. Menon', 10, 'Open', 'High', true],
  ['Contractor management', 'Contractor manpower reported in spreadsheets, 2 days late', 'Daily digital attendance, both shifts', 'S. Al-Harthy', -20, 'Closed', 'Medium', true],
  ['Contractor management', 'Contractor KPIs reviewed only at close-out', 'Weekly contractor scorecard during the TA', 'S. Al-Harthy', 15, 'In progress', 'Medium', true],
  ['HSE', 'Permit backlog on night shift delayed starts by up to 3 hours', 'Second permit issuer on night shift', 'L. D’Souza', -25, 'Closed', 'High', true],
  ['HSE', 'Blind list was kept on paper, one spade left in at start-up preparation', 'Digital blind list with verification', 'L. D’Souza', -40, 'Closed', 'High', true],
  ['HSE', 'Heat stress cases rose in weeks 3 and 4', 'Work-rest cycle and shaded rest areas from day 1', 'L. D’Souza', 5, 'In progress', 'Medium', true],
  ['Execution', 'Shift handover relied on verbal briefing, carry-over items were lost', 'Digital shift handover log with sign-off', 'Eng. K. Al-Siyabi', -35, 'Closed', 'High', true],
  ['Execution', 'Box-up certificates chased on paper, 14 re-inspections', 'Digital box-up workflow with Operations witness', 'Eng. K. Al-Siyabi', -15, 'Closed', 'Medium', true],
  ['Execution', 'Rework causes were not captured, so nothing was fixed', 'Capture cause for every delay and rework event', 'M. Al-Balushi', 12, 'Open', 'Medium', true],
  ['Execution', 'Critical path changed 23 times with no record of why', 'Log every critical path change with a reason', 'M. Al-Balushi', -10, 'Closed', 'High', true],
  ['Quality', 'Exchanger inspections tracked per bundle, not per component', 'Component-level inspection status', 'P. Menon', -5, 'Closed', 'Medium', true],
  ['Quality', 'NCR closure averaged 9 days', 'NCR ageing alerts and weekly closure review', 'P. Menon', 25, 'In progress', 'Low', false],
  ['Logistics', 'Laydown area flooded after rain, materials damaged', 'Raise laydown areas and cover critical materials', 'B. Al-Rawahi', -150, 'Closed', 'Low', false],
  ['Logistics', 'Camp transport delays cost 40 minutes per shift', 'Staggered shift start and extra buses', 'Eng. K. Al-Siyabi', -80, 'Closed', 'Low', false],
  ['Digital reporting', 'Daily report took 3 people 4 hours to compile', 'Auto-generated daily newsletter', 'Y. Al-Farsi', -50, 'Closed', 'Medium', true],
  ['Digital reporting', 'Photos and findings were on personal phones', 'Capture photos and findings in the field app', 'Y. Al-Farsi', 30, 'Open', 'Medium', true],
  ['Planning', 'Work packs were released with materials missing', 'Work pack readiness checklist before release', 'M. Al-Balushi', -55, 'Closed', 'High', true],
  ['HSE', 'Waste manifests were completed after loads left site', 'No dispatch without a manifest', 'L. D’Souza', 18, 'Open', 'Low', true],
  ['Scope', 'Non-TA work (routine maintenance) was loaded into the TA', 'Gate 1 screening to divert non-TA work', 'F. Al-Amri', -70, 'Closed', 'Medium', true],
  ['Execution', 'Start-up readiness was assessed in the last week', 'Walkdown, PSSR and start-up readiness boards from week 2', 'Eng. B. Al-Habsi', 8, 'In progress', 'High', true],
  ['Contractor management', 'Contractor twin roles were unclear, escalations went to the wrong person', 'Publish the twin organisation at mobilisation', 'S. Al-Harthy', -100, 'Closed', 'Medium', true],
];

export const lessons: Lesson[] = lr.map((l, i) => ({
  id: `LL-${String(i + 1).padStart(2, '0')}`,
  category: l[0],
  lesson: l[1],
  recommendation: l[2],
  owner: l[3],
  due: addDays(STATUS_DATE, l[4]),
  status: l[5],
  impact: l[6],
  carried: l[7],
}));

// ---------------- post-TA completion (C2) ----------------
export type PostStatus = 'Open' | 'In progress' | 'Complete';

export interface PostTaItem {
  id: string;
  area: string;
  discipline: string;
  description: string;
  contractor: string;
  status: PostStatus;
  dueDay: number; // post-TA day (TA end = 0)
  weight: number; // man-hours
}

// [area, discipline, description, contractor, status, dueDay, weight]
type PR = [string, string, string, string, PostStatus, number, number];
const pr: PR[] = [
  ['Unit 100', 'Civil', 'Remove temporary scaffold, reactor platform', 'Sohar Industrial Services', 'Open', 5, 420],
  ['Unit 100', 'Civil', 'Reinstate insulation on R-101 outlet line', 'Sohar Industrial Services', 'Open', 7, 360],
  ['Unit 100', 'Instrumentation', 'Remove temporary thermocouples and test leads', 'Zubair E&M', 'Open', 4, 90],
  ['Unit 100', 'Process', 'Final torque check on reactor flanges after heat-up', 'Galfar', 'Open', 3, 140],
  ['Unit 100', 'Inspection', 'Hot-bolting inspection, R-101 flanges at 350 °C', 'Petrofac Services', 'Open', 6, 80],
  ['Unit 200', 'Civil', 'Paint touch-up on T-201 platforms', 'Sohar Industrial Services', 'Open', 10, 260],
  ['Unit 200', 'Rotating Equipment', 'P-205 vibration baseline after start-up', 'Galfar', 'Open', 4, 40],
  ['Unit 200', 'Process', 'Remove temporary strainers, crude charge line', 'Galfar', 'Open', 3, 120],
  ['Unit 200', 'Inspection', 'Update inspection database with new thickness readings', 'Petrofac Services', 'In progress', 12, 180],
  ['Unit 220', 'Electrical', 'Re-energise heat tracing, final loop test', 'Zubair E&M', 'Open', 2, 70],
  ['Unit 220', 'Civil', 'Handrail and grating replacement (non-TA, deferred)', 'Sohar Industrial Services', 'Open', 14, 520],
  ['Unit 250', 'Instrumentation', 'Calibrate overhead pressure transmitters', 'Zubair E&M', 'In progress', 5, 160],
  ['Unit 250', 'Civil', 'Remove scaffold, T-251 platform level 3', 'Sohar Industrial Services', 'Open', 6, 300],
  ['Unit 300', 'Rotating Equipment', 'C-301 alignment check at operating temperature', 'Galfar', 'Open', 8, 90],
  ['Unit 300', 'Civil', 'Refractory dry-out record close-out, R-301', 'Sohar Industrial Services', 'Open', 9, 60],
  ['Unit 300', 'Electrical', 'MCC-3 thermography after load', 'Zubair E&M', 'Open', 7, 30],
  ['Flare System', 'Process', 'Remove temporary hydrotest connections, FL-401', 'Galfar', 'Open', 2, 80],
  ['Pipe Rack 4', 'Civil', 'Final support inspection, 40 replaced supports', 'Sohar Industrial Services', 'Open', 11, 150],
  ['Unit 100', 'Instrumentation', 'DCS I/O card as-built update', 'Zubair E&M', 'Complete', 1, 40],
  ['Unit 200', 'Civil', 'Remove laydown area 2 temporary fencing', 'Sohar Industrial Services', 'Complete', 1, 60],
];
export const postTaItems: PostTaItem[] = pr.map((p, i) => ({ id: `PT-${String(i + 1).padStart(2, '0')}`, area: p[0], discipline: p[1], description: p[2], contractor: p[3], status: p[4], dueDay: p[5], weight: p[6] }));

// ---------------- handover documents (C6) ----------------
export type DocStatus = 'Missing' | 'Submitted' | 'Reviewed' | 'Accepted' | 'Archived';
export const DOC_STATUS_ORDER: DocStatus[] = ['Missing', 'Submitted', 'Reviewed', 'Accepted', 'Archived'];

export interface HandoverDoc {
  id: string;
  discipline: string;
  type: string;
  asset: string;
  expected: number;
  received: number;
  status: DocStatus;
  archivePath: string;
}

const docTypes: [string, string][] = [
  ['As-built drawings', 'Drawings'],
  ['Inspection reports', 'Inspection'],
  ['NDT reports', 'Inspection'],
  ['Material test certificates', 'Materials'],
  ['Calibration certificates', 'Instrumentation'],
  ['Test packs (hydro / leak)', 'Commissioning'],
  ['MC certificates', 'Commissioning'],
  ['Vendor data and manuals', 'Vendor'],
  ['ITP records', 'Quality'],
  ['Photographic records', 'Records'],
];
const assets = ['R-101', 'E-204', 'T-201', 'C-301', 'F-101', 'K-301', 'T-251', 'R-301'];
const disciplines = ['Inspection', 'Rotating Equipment', 'Process', 'Instrumentation', 'Civil', 'Electrical'];

export const handoverDocs: HandoverDoc[] = Array.from({ length: 36 }, (_, i) => {
  const t = docTypes[i % docTypes.length];
  const a = assets[(i * 3) % assets.length];
  const expected = 2 + ((i * 5) % 9);
  const status: DocStatus = i % 9 === 0 ? 'Missing' : i % 5 === 0 ? 'Submitted' : i % 3 === 0 ? 'Reviewed' : i % 2 === 0 ? 'Accepted' : 'Archived';
  const received = status === 'Missing' ? 0 : status === 'Submitted' ? Math.max(1, expected - 2) : expected;
  return { id: `DOC-${String(i + 1).padStart(3, '0')}`, discipline: disciplines[(i * 2) % disciplines.length], type: t[0], asset: a, expected, received, status, archivePath: `/Archive/STO-2026/${t[1]}/${a}` };
});

// ---------------- milestones and event tracker (I3, I4) ----------------
export type MsStatus = 'Done' | 'On track' | 'At risk' | 'Late';

export interface TaMilestone {
  id: string;
  name: string;
  phase: string;
  planned: string;
  forecast: string;
  actual?: string;
  owner: string;
  status: MsStatus;
}

export const taMilestones: TaMilestone[] = [
  { id: 'M-01', name: 'TA strategy approved', phase: 'Initiation', planned: '2025-09-15', forecast: '2025-09-15', actual: '2025-09-12', owner: 'S. Al-Harthy', status: 'Done' },
  { id: 'M-02', name: 'TA organisation set up', phase: 'Initiation', planned: '2025-10-30', forecast: '2025-10-30', actual: '2025-11-04', owner: 'S. Al-Harthy', status: 'Done' },
  { id: 'M-03', name: 'Scope identification complete', phase: 'Scoping', planned: '2026-02-27', forecast: '2026-02-27', actual: '2026-03-02', owner: 'A. Hinai', status: 'Done' },
  { id: 'M-04', name: 'Long-lead material POs placed', phase: 'Planning', planned: '2026-04-15', forecast: '2026-04-15', actual: '2026-04-30', owner: 'B. Al-Rawahi', status: 'Done' },
  { id: 'M-05', name: 'Scope freeze certificate', phase: 'Scoping', planned: '2026-06-12', forecast: '2026-06-12', actual: '2026-06-12', owner: 'M. Al-Balushi', status: 'Done' },
  { id: 'M-06', name: 'Contractor mobilisation complete', phase: 'Pre-TA', planned: '2026-07-27', forecast: '2026-07-27', actual: '2026-07-29', owner: 'Eng. K. Al-Siyabi', status: 'Done' },
  { id: 'M-07', name: 'Shutdown start (Day 1)', phase: 'Execution', planned: '2026-08-03', forecast: '2026-08-03', actual: '2026-08-03', owner: 'S. Al-Harthy', status: 'Done' },
  { id: 'M-08', name: 'Units hydrocarbon free and isolated', phase: 'Execution', planned: '2026-08-06', forecast: '2026-08-06', actual: '2026-08-06', owner: 'K. Rao', status: 'Done' },
  { id: 'M-09', name: 'Reactor R-101 opened', phase: 'Execution', planned: '2026-08-14', forecast: '2026-08-14', actual: '2026-08-14', owner: 'A. Hinai', status: 'Done' },
  { id: 'M-10', name: 'Reactor R-101 box-up', phase: 'Execution', planned: '2026-08-27', forecast: '2026-08-27', owner: 'M. Al-Balushi', status: 'At risk' },
  { id: 'M-11', name: 'Mechanical completion, all units', phase: 'Execution', planned: '2026-09-01', forecast: '2026-09-03', owner: 'Eng. K. Al-Siyabi', status: 'Late' },
  { id: 'M-12', name: 'PSSR sign-off, all systems', phase: 'Execution', planned: '2026-09-02', forecast: '2026-09-04', owner: 'Eng. B. Al-Habsi', status: 'At risk' },
  { id: 'M-13', name: 'Start-up (feed in)', phase: 'Execution', planned: '2026-09-03', forecast: '2026-09-05', owner: 'S. Al-Harthy', status: 'Late' },
  { id: 'M-14', name: 'Handover of area documentation', phase: 'Close-Out', planned: '2026-10-15', forecast: '2026-10-15', owner: 'Y. Al-Farsi', status: 'On track' },
  { id: 'M-15', name: 'Lessons-learned workshop', phase: 'Close-Out', planned: '2026-10-29', forecast: '2026-10-29', owner: 'S. Al-Harthy', status: 'On track' },
  { id: 'M-16', name: 'Close-out report issued', phase: 'Close-Out', planned: '2026-11-30', forecast: '2026-11-30', owner: 'F. Al-Mamari', status: 'On track' },
];

export type EventKind = 'Event' | 'Milestone' | 'Issue';
export type EventStatus = 'Planned' | 'Done' | 'Open' | 'Escalated';

export interface TaEventRow {
  id: string;
  kind: EventKind;
  title: string;
  date: string;
  owner: string;
  status: EventStatus;
  note: string;
}

export const eventRows: TaEventRow[] = [
  { id: 'EV-01', kind: 'Event', title: 'Steering committee, pre-shutdown review', date: '2026-07-24', owner: 'S. Al-Harthy', status: 'Done', note: 'Go decision for shutdown on 3 Aug' },
  { id: 'EV-02', kind: 'Event', title: 'Weekly TA coordination meeting', date: '2026-08-10', owner: 'Eng. K. Al-Siyabi', status: 'Done', note: 'Crane slots re-sequenced' },
  { id: 'EV-03', kind: 'Milestone', title: 'Reactor R-101 opened', date: '2026-08-14', owner: 'A. Hinai', status: 'Done', note: 'Pitting found on tray 7, DJ-020' },
  { id: 'EV-04', kind: 'Issue', title: 'Catalyst disposal contractor late', date: '2026-08-10', owner: 'S. Kumar', status: 'Escalated', note: 'RSK-01, standby contractor engaged' },
  { id: 'EV-05', kind: 'Issue', title: 'Crane slot conflict, Day 17', date: '2026-08-12', owner: 'M. Al-Balushi', status: 'Open', note: 'RSK-03' },
  { id: 'EV-06', kind: 'Event', title: 'Mid-TA steering committee', date: '2026-08-18', owner: 'S. Al-Harthy', status: 'Planned', note: 'Forecast +2 days, SCF decisions' },
  { id: 'EV-07', kind: 'Event', title: 'Regulator inspection visit', date: '2026-08-20', owner: 'L. D’Souza', status: 'Planned', note: 'Pressure equipment' },
  { id: 'EV-08', kind: 'Milestone', title: 'Reactor R-101 box-up', date: '2026-08-27', owner: 'M. Al-Balushi', status: 'Planned', note: '' },
  { id: 'EV-09', kind: 'Event', title: 'PSSR review board', date: '2026-09-01', owner: 'Eng. B. Al-Habsi', status: 'Planned', note: '' },
  { id: 'EV-10', kind: 'Issue', title: 'Night-shift welder shortfall', date: '2026-08-14', owner: 'Galfar', status: 'Open', note: '6 of 24 missing' },
];

// ---------------- strategy document (I5) ----------------
export interface StrategySection {
  id: string;
  title: string;
  body: string;
  kpi?: string;
}

export const strategySections: StrategySection[] = [
  { id: 's1', title: '1. Objectives', body: 'Deliver the Major STO 2026 safely (zero lost-time injuries), within 32 days and OMR 11.8M, restoring the HCU, CDU, SRU, VDU and FCC to reliable operation for the next 5-year run.', kpi: 'Schedule adherence, CPI, TRIF' },
  { id: 's2', title: '2. Scope philosophy', body: 'Risk-based scope: only work that cannot be done online enters the TA. Every item passes three gates (Area Ops Focal Point, Head of Area Ops, VP Asset Ops) and is frozen at T-7 weeks. Post-freeze changes are tracked as variations and approved through the SCF process.', kpi: 'Scope growth %' },
  { id: 's3', title: '3. Schedule strategy', body: 'Three critical paths (reactor, E-204 / Train B, compressor C-301) are monitored daily in P6 and the platform. A 4-week look-ahead is reviewed every Monday. Float is protected on CP1 with a dedicated second shift crew.', kpi: 'SPI, CP change count' },
  { id: 's4', title: '4. Contracting and procurement', body: 'A Main Mechanical Contractor (Galfar) with four specialist contractors. Long-lead materials (more than 6 months) are ordered at T-23 months, medium and short lead at T-15. Weekly expediting with order-by alerts.', kpi: 'Long-lead on-time %' },
  { id: 's5', title: '5. HSE strategy', body: 'No simultaneous operations on the same equipment, digital permit-to-work, blind list verification, heat-stress work-rest cycles, and a daily HSE observation target of 300.', kpi: 'TRIF, HiPo, observations closed %' },
  { id: 's6', title: '6. Quality and integrity', body: 'Inspection test plans from PO issuance, component-level inspection with hold and witness points, NCR closure within 5 days, and digital sign-off on every box-up.', kpi: 'First-time-right %, open NCRs' },
  { id: 's7', title: '7. Organisation and governance', body: 'A TA Office led by the TA Event Manager, twin organisations at each contractor, a steering committee every two weeks, and daily coordination at 06:30 and 17:30 with shift handover through the digital log.', kpi: 'Handover completeness' },
  { id: 's8', title: '8. Readiness gates', body: 'Gate G1 at T-34 months (resources), partial G2 at T-23 / T-15 (materials and the planning team), G2 at T-15, G3 at T-6 (call-off), and a final value at T-1, per the budgeting and gating timeline.', kpi: 'Overall readiness %' },
];

export interface StrategyVersion {
  v: string;
  date: string;
  author: string;
  status: 'Approved' | 'Draft';
  note: string;
}

export const strategyVersions: StrategyVersion[] = [
  { v: 'v0.9', date: '2025-08-20', author: 'M. Al-Balushi', status: 'Approved', note: 'First full draft' },
  { v: 'v1.0', date: '2025-09-12', author: 'S. Al-Harthy', status: 'Approved', note: 'Approved by steering committee' },
  { v: 'v1.1', date: '2026-02-10', author: 'S. Al-Harthy', status: 'Approved', note: 'Contracting strategy updated after tender' },
  { v: 'v1.2', date: '2026-08-12', author: 'M. Al-Balushi', status: 'Draft', note: 'Adds the digital shift log and mid-TA readiness boards, awaiting approval' },
];
