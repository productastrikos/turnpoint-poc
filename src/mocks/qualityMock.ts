// Issues & safety log (X4, X23) and non-conformance reports (X26) with delay / rework capture (X25, X32).
import { STATUS_DATE, addDays } from './_gen';

export type IssueType = 'Near miss' | 'Unsafe condition' | 'Issue';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type IssueStatus = 'Open' | 'In progress' | 'Resolved' | 'Closed';

export interface Issue {
  id: string;
  type: IssueType;
  title: string;
  severity: Severity;
  area: string;
  owner: string;
  raisedAt: string;
  status: IssueStatus;
  hipo?: boolean; // high-potential
  linked?: string;
}

// [type, title, severity, area, owner, daysAgo, status, hipo?, linked?]
type IR = [IssueType, string, Severity, string, string, number, IssueStatus, boolean?, string?];

const ir: IR[] = [
  ['Near miss', 'Dropped object from scaffold level 3, no injury', 'High', 'Unit 100', 'L. D’Souza', 12, 'Closed', true],
  ['Near miss', 'Crane load swung toward barricade during E-204 trial lift', 'High', 'Unit 200', 'R. Fernandes', 8, 'Closed', true, 'RSK-03'],
  ['Near miss', 'Hot-work spark ignited cable tray debris', 'High', 'Unit 300', 'T. Said', 5, 'Closed', true],
  ['Near miss', 'Pinch point on bolt tensioner, hand protection added', 'Low', 'Unit 200', 'L. D’Souza', 11, 'Closed'],
  ['Near miss', 'Slip on wet grating, Unit 250 platform', 'Low', 'Unit 250', 'L. D’Souza', 10, 'Closed'],
  ['Near miss', 'Manlift basket tilt alarm triggered', 'Medium', 'Unit 100', 'M. Al-Balushi', 9, 'Closed'],
  ['Near miss', 'Unsecured scaffold board fell, area barricaded', 'Medium', 'Pipe Rack 4', 'M. Al-Balushi', 7, 'Closed'],
  ['Near miss', 'Gas detector alarm during R-101 purge, area evacuated (false alarm)', 'Medium', 'Unit 100', 'K. Rao', 6, 'Closed'],
  ['Near miss', 'Vehicle reversed without banksman near laydown area', 'Low', 'Pipe Rack 4', 'L. D’Souza', 6, 'Closed'],
  ['Near miss', 'Hydrojet hose whip arrested by restraint', 'Medium', 'Unit 200', 'R. Fernandes', 4, 'Closed'],
  ['Near miss', 'Lifting sling with damaged tag found in use', 'Medium', 'Unit 300', 'R. Fernandes', 3, 'Closed'],
  ['Near miss', 'Worker entered barricaded zone, stopped by supervisor', 'Low', 'Unit 220', 'L. D’Souza', 2, 'In progress'],
  ['Near miss', 'Excavation edge protection missing', 'Low', 'Flare System', 'M. Al-Balushi', 2, 'In progress'],
  ['Near miss', 'Heat stress symptoms, worker treated on site', 'Medium', 'Unit 300', 'L. D’Souza', 1, 'In progress'],
  ['Unsafe condition', 'Scaffold tag discrepancy: tag shows inspected, handrail missing', 'High', 'Unit 300', 'L. D’Souza', 3, 'Open'],
  ['Unsafe condition', 'No fire watch at hot-work location', 'Medium', 'Unit 220', 'L. D’Souza', 2, 'In progress'],
  ['Unsafe condition', 'Temporary power cable across walkway', 'Medium', 'Unit 300', 'T. Said', 2, 'Open'],
  ['Unsafe condition', 'Gas cylinders not chained', 'Low', 'Unit 200', 'L. D’Souza', 1, 'Open'],
  ['Unsafe condition', 'Spade installed that is not on the blind list', 'High', 'Unit 100', 'K. Rao', 1, 'Open'],
  ['Unsafe condition', 'Barricade removed from open manhole', 'Medium', 'Unit 250', 'L. D’Souza', 0, 'Open'],
  ['Issue', 'Catalyst disposal contractor late to mobilise', 'High', 'Unit 100', 'S. Kumar', 6, 'In progress', false, 'RSK-01'],
  ['Issue', 'Crane slot conflict E-204 vs C-301 on Day 17', 'Medium', 'Unit 200', 'M. Al-Balushi', 4, 'In progress', false, 'RSK-03'],
  ['Issue', 'Permit backlog in Inspection, night shift', 'High', 'Unit 200', 'Permit Office', 5, 'In progress', false, 'RSK-07'],
  ['Issue', 'Spiral wound gaskets held at customs', 'Medium', 'Unit 200', 'B. Al-Rawahi', 3, 'Resolved', false, 'RSK-05'],
  ['Issue', 'Insulation material shortage, Unit 200', 'Low', 'Unit 200', 'B. Al-Rawahi', 2, 'Open'],
  ['Issue', 'Night-shift lighting insufficient at T-251', 'Medium', 'Unit 250', 'T. Said', 2, 'In progress'],
  ['Issue', 'Nitrogen supply pressure drop during purge', 'Medium', 'Unit 100', 'K. Rao', 7, 'Resolved'],
  ['Issue', 'Scaffold access delay, T-201 Section B', 'Medium', 'Unit 200', 'M. Al-Balushi', 4, 'In progress'],
  ['Issue', 'Torque wrenches (600 Nm) short in tool crib', 'Low', 'Unit 200', 'R. Fernandes', 3, 'Resolved'],
  ['Issue', 'Weld procedure qualification pending for P91 repair', 'High', 'Unit 100', 'A. Hinai', 1, 'Open'],
  ['Issue', 'Temporary cooling water line leak', 'Low', 'Unit 300', 'T. Said', 6, 'Closed'],
  ['Issue', 'Camp transport delays of 40 minutes', 'Low', 'Pipe Rack 4', 'M. Al-Balushi', 5, 'Closed'],
  ['Issue', 'Vendor representative for K-301 delayed (visa)', 'Medium', 'Unit 300', 'R. Fernandes', 2, 'Open'],
  ['Issue', 'Hydrotest water availability for FL-401', 'Medium', 'Flare System', 'K. Rao', 1, 'Open'],
];

export const issues: Issue[] = ir.map((r, i) => ({
  id: `ISS-${String(i + 101).padStart(3, '0')}`,
  type: r[0],
  title: r[1],
  severity: r[2],
  area: r[3],
  owner: r[4],
  raisedAt: addDays(STATUS_DATE, -r[5]),
  status: r[6],
  hipo: r[7],
  linked: r[8],
}));

// ---------------- NCR ----------------

export type NcrStatus = 'Open' | 'Under review' | 'Disposition agreed' | 'Closed';
export type Disposition = 'Pending' | 'Use as is' | 'Repair' | 'Rework' | 'Reject';
export type RootCause = 'Workmanship' | 'Material defect' | 'Procedure not followed' | 'Design / drawing error' | 'Inspection gap' | 'Tool / equipment';

export interface Ncr {
  id: string;
  title: string;
  discipline: string;
  area: string;
  tag: string;
  severity: 'Minor' | 'Major' | 'Critical';
  rootCause: RootCause;
  disposition: Disposition;
  status: NcrStatus;
  raisedAt: string;
  owner: string;
  contractor: string;
}

// [title, discipline, area, tag, severity, rootCause, disposition, status, daysAgo, owner, contractor]
type NR = [string, string, string, string, Ncr['severity'], RootCause, Disposition, NcrStatus, number, string, string];

const nr: NR[] = [
  ['Weld undercut exceeds 0.5 mm on 14"-P-2201 tie-in', 'Process', 'Unit 200', '14"-P-2201', 'Major', 'Workmanship', 'Repair', 'Disposition agreed', 3, 'K. Rao', 'Galfar'],
  ['E-204 tubesheet face gasket seat pitting', 'Rotating Equipment', 'Unit 200', 'E-204', 'Major', 'Material defect', 'Repair', 'Under review', 2, 'R. Fernandes', 'Larsen & Toubro'],
  ['T-201 tray support ring out of tolerance', 'Inspection', 'Unit 200', 'T-201', 'Major', 'Design / drawing error', 'Rework', 'Under review', 4, 'A. Hinai', 'Larsen & Toubro'],
  ['Incorrect stud material (B7 used, B16 specified)', 'Process', 'Unit 100', 'R-101', 'Critical', 'Procedure not followed', 'Reject', 'Disposition agreed', 5, 'K. Rao', 'Galfar'],
  ['Hydrotest gauge calibration certificate expired', 'Inspection', 'Flare System', 'FL-401', 'Minor', 'Inspection gap', 'Use as is', 'Closed', 6, 'A. Hinai', 'Petrofac Services'],
  ['Pipe support baseplate grout voids', 'Civil', 'Pipe Rack 4', 'PR4-SUP', 'Minor', 'Workmanship', 'Rework', 'Open', 1, 'M. Al-Balushi', 'Sohar Industrial Services'],
  ['Refractory thickness below spec, cyclone zone', 'Civil', 'Unit 300', 'R-301', 'Major', 'Workmanship', 'Rework', 'Under review', 3, 'M. Al-Balushi', 'Sohar Industrial Services'],
  ['Loop check failed, PV-3021 stroke time', 'Instrumentation', 'Unit 100', 'PV-3021', 'Minor', 'Tool / equipment', 'Repair', 'Disposition agreed', 2, 'S. Kumar', 'Zubair E&M'],
  ['PSV set pressure drift after bench test', 'Instrumentation', 'Flare System', 'RV-1104', 'Major', 'Material defect', 'Repair', 'Open', 1, 'S. Kumar', 'Zubair E&M'],
  ['Cable gland not rated for Zone 1', 'Electrical', 'Unit 300', 'MCC-3', 'Major', 'Procedure not followed', 'Rework', 'Under review', 2, 'T. Said', 'Zubair E&M'],
  ['Blind flange gasket wrong rating (150# vs 300#)', 'Process', 'Unit 220', 'T-221', 'Major', 'Procedure not followed', 'Rework', 'Closed', 7, 'K. Rao', 'Galfar'],
  ['K-301 coupling alignment outside tolerance', 'Rotating Equipment', 'Unit 300', 'K-301', 'Minor', 'Tool / equipment', 'Rework', 'Open', 1, 'T. Said', 'Galfar'],
  ['Missing material test certificate for spool S-14', 'Process', 'Unit 200', '14"-P-2201', 'Minor', 'Inspection gap', 'Use as is', 'Closed', 8, 'A. Hinai', 'Galfar'],
  ['F-101 refractory cure curve deviated', 'Civil', 'Unit 100', 'F-101', 'Major', 'Procedure not followed', 'Repair', 'Under review', 2, 'M. Al-Balushi', 'Sohar Industrial Services'],
  ['T-251 packing bed height short by 40 mm', 'Inspection', 'Unit 250', 'T-251', 'Minor', 'Workmanship', 'Rework', 'Disposition agreed', 3, 'A. Hinai', 'Larsen & Toubro'],
  ['Weld repair on P91 line without approved WPS', 'Process', 'Unit 100', 'P91-LINE', 'Critical', 'Procedure not followed', 'Reject', 'Under review', 1, 'A. Hinai', 'Galfar'],
  ['Insulation cladding screws wrong material', 'Civil', 'Unit 200', 'INS-200', 'Minor', 'Material defect', 'Use as is', 'Closed', 6, 'M. Al-Balushi', 'Sohar Industrial Services'],
  ['Flange face scored during bundle pull', 'Rotating Equipment', 'Unit 200', 'E-204', 'Major', 'Workmanship', 'Repair', 'Disposition agreed', 4, 'R. Fernandes', 'Larsen & Toubro'],
  ['Instrument tubing bend radius under spec', 'Instrumentation', 'Unit 220', 'QC-2201', 'Minor', 'Workmanship', 'Rework', 'Closed', 9, 'S. Kumar', 'Zubair E&M'],
  ['Scaffold tie spacing exceeds design, R-101 access', 'Civil', 'Unit 100', 'R-101', 'Major', 'Design / drawing error', 'Rework', 'Closed', 10, 'M. Al-Balushi', 'Sohar Industrial Services'],
  ['Nitrogen purge record incomplete', 'Process', 'Unit 100', 'R-101', 'Minor', 'Inspection gap', 'Use as is', 'Open', 0, 'K. Rao', 'Galfar'],
  ['Wet gas compressor C-301 seal oil filter contamination', 'Rotating Equipment', 'Unit 300', 'C-301', 'Major', 'Material defect', 'Repair', 'Open', 0, 'T. Said', 'Galfar'],
];

export const ncrs: Ncr[] = nr.map((r, i) => ({
  id: `NCR-${String(i + 201).padStart(3, '0')}`,
  title: r[0],
  discipline: r[1],
  area: r[2],
  tag: r[3],
  severity: r[4],
  rootCause: r[5],
  disposition: r[6],
  status: r[7],
  raisedAt: addDays(STATUS_DATE, -r[8]),
  owner: r[9],
  contractor: r[10],
}));

// ---------------- delay & rework capture ----------------

export type LossKind = 'Rework' | 'Delay';
export const LOSS_CAUSES = [
  'Late material delivery',
  'Permit / isolation delay',
  'Crane / equipment unavailable',
  'Scaffold access delay',
  'Weld defect / NDT failure',
  'Drawing / design change',
  'Manpower shortfall',
  'Weather / heat stop',
  'Discovery work',
  'Inspection hold point wait',
] as const;
export type LossCause = (typeof LOSS_CAUSES)[number];

export interface LossEvent {
  id: string;
  kind: LossKind;
  day: number; // TA day
  activity: string;
  p6Id: string;
  discipline: string;
  contractor: string;
  cause: LossCause;
  hours: number;
  costOMR: number;
  reportedBy: string;
  note: string;
}

// [kind, day, activity, p6Id, discipline, contractor, cause, hours, reportedBy, note]
type LR = [LossKind, number, string, string, string, string, LossCause, number, string, string];

const lr: LR[] = [
  ['Delay', 3, 'R-101 scaffold, internal and external', 'HCU-1006', 'Civil', 'Sohar Industrial Services', 'Late material delivery', 96, 'M. Al-Balushi', 'Scaffold fittings held at port'],
  ['Delay', 4, 'T-201 trays removal, Section A', 'CDU-1010', 'Inspection', 'Larsen & Toubro', 'Scaffold access delay', 62, 'A. Hinai', ''],
  ['Rework', 5, 'F-101 tube inspection and decoking', 'HCU-2010', 'Inspection', 'Larsen & Toubro', 'Inspection hold point wait', 18, 'A. Hinai', ''],
  ['Delay', 5, 'R-301 refractory demolition', 'FCC-1010', 'Civil', 'Sohar Industrial Services', 'Permit / isolation delay', 44, 'M. Al-Balushi', 'Isolation certificate re-issued'],
  ['Delay', 6, 'PSV recertification, batches 1 & 2', 'FLR-1010', 'Instrumentation', 'Zubair E&M', 'Manpower shortfall', 36, 'S. Kumar', ''],
  ['Rework', 7, 'T-221 catalyst unloading', 'SRU-1010', 'Process', 'Galfar', 'Weld defect / NDT failure', 24, 'K. Rao', 'Manway weld repair'],
  ['Delay', 8, 'Control valve overhaul, batch 1', 'HCU-3010', 'Instrumentation', 'Zubair E&M', 'Late material delivery', 54, 'S. Kumar', 'Trim sets late'],
  ['Delay', 8, 'E-204 and C-301 lifts', 'CDU-2010', 'Rotating Equipment', 'Galfar', 'Crane / equipment unavailable', 110, 'R. Fernandes', 'Crane conflict (RSK-03)'],
  ['Rework', 9, 'P-205 pump strip and inspection', 'CDU-3010', 'Rotating Equipment', 'Galfar', 'Drawing / design change', 30, 'R. Fernandes', ''],
  ['Delay', 9, 'T-251 packing removal and inspection', 'VDU-1010', 'Inspection', 'Larsen & Toubro', 'Weather / heat stop', 48, 'A. Hinai', 'Heat advisory, work-rest cycle'],
  ['Delay', 10, 'R-101 manway opening and ventilation', 'HCU-1008', 'Process', 'Galfar', 'Permit / isolation delay', 40, 'K. Rao', ''],
  ['Rework', 10, 'Pipe support replacement', 'PR4-1010', 'Civil', 'Sohar Industrial Services', 'Weld defect / NDT failure', 52, 'M. Al-Balushi', 'NDT failure on 6 supports'],
  ['Delay', 11, 'R-101 pre-inspection cleaning', 'HCU-1009', 'Process', 'Galfar', 'Discovery work', 70, 'K. Rao', 'Additional cleaning, DJ-018'],
  ['Delay', 11, 'Catalyst disposal mobilisation', 'HCU-1020', 'Process', 'Larsen & Toubro', 'Late material delivery', 88, 'S. Kumar', 'RSK-01'],
  ['Rework', 12, 'T-201 Tray Repair, Section B', 'CDU-1020', 'Inspection', 'Larsen & Toubro', 'Weld defect / NDT failure', 46, 'A. Hinai', ''],
  ['Delay', 12, 'K-301 blower casing alignment', 'FCC-2010', 'Rotating Equipment', 'Galfar', 'Crane / equipment unavailable', 28, 'T. Said', 'Alignment tool shared'],
  ['Delay', 12, 'Insulation removal, Unit 200', 'CDU-4010', 'Civil', 'Sohar Industrial Services', 'Scaffold access delay', 58, 'M. Al-Balushi', ''],
  ['Rework', 13, 'Piping spool fit-up 14"-P-2201', 'CDU-2040', 'Process', 'Galfar', 'Drawing / design change', 64, 'K. Rao', 'Spool re-cut after as-built survey'],
  ['Delay', 13, 'Internals pitting, R-101 tray 7', 'HCU-1030', 'Inspection', 'Larsen & Toubro', 'Discovery work', 96, 'A. Hinai', 'DJ-020'],
  ['Delay', 13, 'DCS I/O card replacement', 'HCU-3030', 'Instrumentation', 'Zubair E&M', 'Inspection hold point wait', 20, 'S. Kumar', ''],
  ['Rework', 14, 'F-101 burner block refractory', 'HCU-2020', 'Civil', 'Sohar Industrial Services', 'Drawing / design change', 34, 'M. Al-Balushi', 'NCR-214'],
  ['Delay', 14, 'Night shift welding, T-201', 'CDU-1020', 'Inspection', 'Larsen & Toubro', 'Manpower shortfall', 72, 'A. Hinai', '6 of 24 welders missing'],
  ['Delay', 14, 'PSV recertification, batch 3', 'FLR-1020', 'Instrumentation', 'Zubair E&M', 'Permit / isolation delay', 26, 'S. Kumar', ''],
  ['Rework', 14, 'Hydrotest FL-401', 'FLR-2010', 'Process', 'Galfar', 'Late material delivery', 12, 'K. Rao', 'Test water supply'],
];

export const lossEvents: LossEvent[] = lr.map((r, i) => ({
  id: `LOS-${String(i + 101).padStart(3, '0')}`,
  kind: r[0],
  day: r[1],
  activity: r[2],
  p6Id: r[3],
  discipline: r[4],
  contractor: r[5],
  cause: r[6],
  hours: r[7],
  costOMR: Math.round(r[7] * 14.5),
  reportedBy: r[8],
  note: r[9],
}));
