// QA/QC: heat exchanger inspection workflow (SOW dry run 15-24) and Inspection Test Plans (P9).
import { rng, addDays } from './_gen';
import { materialItems } from './materialsMock';

export const STAGES = [
  { id: 'pre', name: 'Pre-cleaning' },
  { id: 'post', name: 'Post-cleaning' },
  { id: 'ndt', name: 'NDT / ECT' },
  { id: 'repair', name: 'Repair / retube' },
  { id: 'hydro', name: 'Hydrotest' },
  { id: 'final', name: 'Final inspection' },
] as const;
export type StageId = (typeof STAGES)[number]['id'];

export type CellState = 'Not requested' | 'Requested' | 'Done' | 'Cleared' | 'Rework';

export interface Remark {
  at: string;
  by: string;
  text: string;
  state: CellState;
}

export interface Cell {
  state: CellState;
  reworkCount: number;
  reason?: string; // why a requested inspection is not done yet
  remarks: Remark[];
  signedBy?: string;
  signedAt?: string;
}

export interface Component {
  name: string;
  stages: Record<StageId, Cell>;
}

export type Subtype = 'Floating head' | 'Fixed tubesheet' | 'U-tube' | 'Kettle reboiler' | 'Air cooler' | 'Plate';

export const SUBTYPE_COMPONENTS: Record<Subtype, string[]> = {
  'Floating head': ['Shell', 'Channel', 'Floating head cover', 'Tube bundle', 'Tubesheet', 'Nozzles'],
  'Fixed tubesheet': ['Shell', 'Channel', 'Tube bundle', 'Tubesheet', 'Expansion joint'],
  'U-tube': ['Shell', 'Channel', 'Tube bundle (U-bends)', 'Tubesheet'],
  'Kettle reboiler': ['Shell', 'Channel', 'Tube bundle', 'Weir and baffles'],
  'Air cooler': ['Header boxes', 'Finned tube bundle', 'Fan and drive', 'Structure'],
  Plate: ['Plate pack', 'Frame and bolts', 'Gaskets'],
};

export interface Exchanger {
  id: string; // tag
  name: string;
  subtype: Subtype;
  area: string;
  contractor: string;
  jobId: string;
  components: Component[];
}

const REASONS = ['Awaiting hydro-jetting to finish', 'Scaffold access not ready', 'Inspector not available (night shift)', 'Permit not yet issued', 'Contractor not ready for inspection', 'Waiting for NDT crew'];
const REMARKS: Record<StageId, string[]> = {
  pre: ['Fouling heavy on tube side, light scale on shell side', 'As-found condition photographed, gasket faces intact', 'Bundle pulled, no mechanical damage on pulling eyes'],
  post: ['Tubes clear, 100% drift test passed', 'Residual deposits on 3 tubes, re-jetted', 'Shell side clean, baffles inspected'],
  ndt: ['ECT complete, 4 tubes with >40% wall loss', 'No indications on tubesheet welds (PT)', 'Thickness readings within allowance'],
  repair: ['4 tubes plugged, tubesheet face machined', 'Retube complete (40 tubes), rolled and seal welded', 'Weld repair on nozzle N3, PWHT done'],
  hydro: ['Shell side test 1.3 x design held 30 min, no leaks', 'Tube side test passed, gauge calibrated', 'Weep at floating head flange, re-torqued'],
  final: ['Box-up checklist complete, gaskets and studs verified', 'Insulation, nameplate and tag reinstated', 'Clearance given for box-up'],
};

const NAMES = ['Inspector A. Hinai', 'Inspector P. Menon', 'Inspector Petrofac NDT-3', 'QA/QC lead P. Menon'];

// [tag, name, subtype, area, contractor, jobId, progress, seed]
const defs: [string, string, Subtype, string, string, string, number, number][] = [
  ['E-204', 'Crude / residue exchanger', 'Floating head', 'Unit 200', 'Larsen & Toubro', 'J-2202', 1.6, 11],
  ['E-205', 'Crude / kerosene exchanger', 'Floating head', 'Unit 200', 'Larsen & Toubro', 'J-2202', 3.4, 12],
  ['E-101A', 'Reactor effluent exchanger A', 'U-tube', 'Unit 100', 'Larsen & Toubro', 'J-2201', 4.5, 13],
  ['E-101B', 'Reactor effluent exchanger B', 'U-tube', 'Unit 100', 'Larsen & Toubro', 'J-2201', 2.3, 14],
  ['E-103', 'Feed / effluent exchanger', 'Fixed tubesheet', 'Unit 100', 'Galfar', 'J-2201', 5.6, 15],
  ['E-301', 'Slurry steam generator', 'Fixed tubesheet', 'Unit 300', 'Galfar', 'J-2216', 0.7, 16],
  ['E-221', 'Sour water stripper reboiler', 'Kettle reboiler', 'Unit 220', 'Galfar', 'J-2217', 2.8, 17],
  ['AC-201', 'Overhead air cooler', 'Air cooler', 'Unit 200', 'Galfar', 'J-2213', 3.9, 18],
  ['E-241', 'Cooling water plate exchanger', 'Plate', 'Unit 220', 'Galfar', 'J-2217', 6, 19],
];

const emptyCell = (): Cell => ({ state: 'Not requested', reworkCount: 0, remarks: [] });

function build(): Exchanger[] {
  return defs.map(([id, name, subtype, area, contractor, jobId, progress, seed]) => {
    const r = rng(seed * 101);
    const comps: Component[] = SUBTYPE_COMPONENTS[subtype].map((cname) => {
      const stages = {} as Record<StageId, Cell>;
      STAGES.forEach((st, si) => {
        const cell = emptyCell();
        const who = NAMES[Math.floor(r() * NAMES.length)];
        const text = REMARKS[st.id][Math.floor(r() * REMARKS[st.id].length)];
        if (si + 1 <= Math.floor(progress)) {
          cell.state = 'Cleared';
          cell.signedBy = who;
          cell.signedAt = `2026-08-${String(8 + Math.min(7, si + Math.floor(r() * 3))).padStart(2, '0')}T${String(8 + Math.floor(r() * 9)).padStart(2, '0')}:20:00`;
          cell.remarks.push({ at: cell.signedAt, by: who, text, state: 'Cleared' });
          if (si === 4 && r() > 0.8) {
            cell.reworkCount = 1; // earlier hydrotest rework, now cleared
            cell.remarks.unshift({ at: '2026-08-12T10:05:00', by: who, text: 'Weep at flange, rework required', state: 'Rework' });
          }
        } else if (si === Math.floor(progress)) {
          const roll = r();
          if (roll < 0.34) {
            cell.state = 'Requested';
            cell.reason = REASONS[Math.floor(r() * REASONS.length)];
          } else if (roll < 0.66) {
            cell.state = 'Done';
            cell.remarks.push({ at: '2026-08-16T06:45:00', by: who, text, state: 'Done' });
          } else if (roll < 0.82 && si >= 2) {
            cell.state = 'Rework';
            cell.reworkCount = 1;
            cell.remarks.push({ at: '2026-08-15T14:10:00', by: who, text: si === 2 ? 'Indication found, repair required before clearance' : 'Defect found, rework raised', state: 'Rework' });
          } else {
            cell.state = 'Cleared';
            cell.signedBy = who;
            cell.signedAt = '2026-08-16T05:30:00';
            cell.remarks.push({ at: cell.signedAt, by: who, text, state: 'Cleared' });
          }
        }
        stages[st.id] = cell;
      });
      return { name: cname, stages };
    });
    return { id, name, subtype, area, contractor, jobId, components: comps };
  });
}

export const exchangers: Exchanger[] = build();

// ---------------- ITP (P9) ----------------

export type PointType = 'H' | 'W' | 'R' | 'S'; // hold, witness, review, surveillance

export interface ItpPoint {
  name: string;
  type: PointType;
  done: boolean;
}

export interface Itp {
  id: string;
  materialId: string;
  po: string;
  vendor: string;
  item: string;
  points: ItpPoint[];
  note?: string;
}

const POINTS: [string, PointType][] = [
  ['Material certificate review', 'R'],
  ['Raw material inspection', 'W'],
  ['Dimensional and visual check', 'W'],
  ['NDT witness', 'H'],
  ['Pressure test / functional test', 'H'],
  ['Final inspection and release note', 'H'],
];

// [materialId, po, vendor, item, pointsDone]
const itpDefs: [string, string, string, string, number][] = [
  ['MTO-002', '4500079301', 'Sulzer Chemtech', 'Reactor internals tray set, R-101', 3],
  ['MTO-003', '4500079422', 'Siemens Energy', 'Rotor bearing kit, C-301', 6],
  ['MTO-006', '4500079655', 'Haldor Topsoe', 'Catalyst support grid', 6],
  ['MTO-009', '4500078840', 'Axens', 'Hydrocracking catalyst charge (HC-24)', 6],
  ['MTO-011', '4500079120', 'Koch-Glitsch', 'T-201 valve trays, Section B', 5],
  ['MTO-012', '4500079302', 'Sulzer Chemtech', 'T-251 structured packing', 2],
  ['MTO-014', '4500079423', 'Siemens Energy', 'K-301 rotor seal kit', 5],
  ['MTO-018', '4500079188', 'Emerson Process', 'Control valve trim sets (32)', 3],
  ['MTO-021', '4500080210', 'ABB Oman', 'MCC-3 protection relays', 6],
  ['MTO-022', '4500080188', 'John Crane', 'P-205 mechanical seals (API 682)', 6],
];

export const itps: Itp[] = itpDefs.map(([materialId, po, vendor, item, done], i) => ({
  id: `ITP-${String(i + 301)}`,
  materialId,
  po,
  vendor,
  item,
  points: POINTS.map(([name, type], k) => ({ name, type, done: k < done })),
  note: materialId === 'MTO-012' ? 'Hold point 4 (NDT witness) needs OQ inspector attendance at the vendor' : undefined,
}));

// ---------------- PO -> ITP -> acceptance pipeline (PBC 5 and 6) ----------------
// One record per purchase order. PO numbers and vendors match the material-tracking procurement lines (mocks/procurementMock.ts);
// the pipeline stages, owners and SLAs are defined here and used by the Workflow tab, the PO & ITP tab and the service.

export const DEMO_TODAY = '2026-08-16';

export type PoStageId = 'po' | 'itp-submit' | 'itp-review' | 'schedule' | 'fat' | 'receipt' | 'cert' | 'release';
export type OwnerKind = 'proc' | 'vendor' | 'oq' | 'insp' | 'site' | 'plan';

export interface PoStageDef {
  id: PoStageId | 'ncr';
  name: string;
  short: string;
  owner: string;
  ownerKind: OwnerKind;
  /** service level in days (0 = no clock) */
  sla: number;
  desc: string;
}

export const PO_STAGES: PoStageDef[] = [
  { id: 'po', name: 'PO issued', short: 'PO issued', owner: 'OQ Procurement', ownerKind: 'proc', sla: 1, desc: 'Purchase order released from SAP MM. The ITP request goes to the vendor.' },
  { id: 'itp-submit', name: 'Vendor submits ITP', short: 'Vendor ITP', owner: 'Vendor', ownerKind: 'vendor', sla: 5, desc: 'Vendor uploads the Inspection Test Plan (or a corrected revision) in the vendor portal.' },
  { id: 'itp-review', name: 'OQ reviews / approves ITP', short: 'ITP review', owner: 'OQ QA/QC', ownerKind: 'oq', sla: 3, desc: 'Comments, reject and resubmit until the ITP is approved.' },
  { id: 'schedule', name: 'Inspection points scheduled', short: 'Schedule H/W/R/S', owner: 'OQ QA/QC', ownerKind: 'oq', sla: 2, desc: 'Hold (H), Witness (W), Review (R) and Surveillance (S) points get dates.' },
  { id: 'fat', name: 'Vendor inspection / FAT', short: 'FAT + IRN', owner: 'Inspector', ownerKind: 'insp', sla: 21, desc: 'Points released at the vendor works. The inspection release note (IRN) ends the stage.' },
  { id: 'receipt', name: 'Receipt & site acceptance', short: 'Site receipt', owner: 'Site', ownerKind: 'site', sla: 3, desc: 'Goods received, site acceptance inspection against the PO and the IRN.' },
  { id: 'cert', name: 'Acceptance certificate issued', short: 'Certificate', owner: 'OQ QA/QC', ownerKind: 'oq', sla: 1, desc: 'Blocked while any hold/witness point or NCR is open.' },
  { id: 'release', name: 'Released to work pack / site', short: 'Released', owner: 'Planner', ownerKind: 'plan', sla: 0, desc: 'Material is cleared for the work pack and can be issued to the job.' },
];
export const NCR_STAGE: PoStageDef = { id: 'ncr', name: 'NCR / rework loop', short: 'NCR loop', owner: 'Vendor + OQ QA/QC', ownerKind: 'vendor', sla: 7, desc: 'Failed inspection: vendor reworks, OQ verifies and closes, then the PO returns to the stage that failed.' };

export type ItpStatus = 'Not submitted' | 'Submitted' | 'Under review' | 'Approved' | 'Rejected';

export interface PoPoint {
  id: string;
  name: string;
  type: PointType;
  where: 'Vendor works' | 'Site';
  done: boolean;
  doneAt?: string;
  by?: string;
  planned?: string;
}

export interface PoNcr {
  id: string;
  pointName: string;
  text: string;
  raisedAt: string;
  raisedBy: string;
  origin: 'fat' | 'receipt';
  status: 'Open' | 'Rework submitted' | 'Closed';
  closedAt?: string;
  closedBy?: string;
}

export interface PoEvent {
  at: string;
  by: string;
  text: string;
}

export interface ItpComment {
  at: string;
  by: string;
  text: string;
  kind: 'submitted' | 'comment' | 'approved' | 'rejected';
}

export interface PoRec {
  id: string; // PO number (same as material tracking)
  itpNo: string;
  materialId: string;
  vendor: string;
  item: string;
  jobId: string;
  area: string;
  poDate: string;
  valueOMR: number;
  requiredBy: string;
  stage: PoStageId;
  stageSince: string;
  itpStatus: ItpStatus;
  itpRev: string;
  itpSubmittedAt?: string;
  itpApprovedAt?: string;
  itpComments: ItpComment[];
  points: PoPoint[];
  irnNo?: string;
  ncrs: PoNcr[];
  receivedOn?: string;
  siteAcceptedOn?: string;
  cert?: { no: string; issuedAt: string; by: string; workPack: string };
  events: PoEvent[];
  demo?: boolean;
}

export const POINT_TEMPLATE: { name: string; type: PointType; where: PoPoint['where'] }[] = [
  { name: 'Material certificate review', type: 'R', where: 'Vendor works' },
  { name: 'Raw material inspection', type: 'W', where: 'Vendor works' },
  { name: 'In-process surveillance (fabrication)', type: 'S', where: 'Vendor works' },
  { name: 'Dimensional and visual check', type: 'W', where: 'Vendor works' },
  { name: 'NDT witness (RT/UT)', type: 'H', where: 'Vendor works' },
  { name: 'Pressure / functional test', type: 'H', where: 'Vendor works' },
  { name: 'Final inspection and release note', type: 'H', where: 'Vendor works' },
];

const INSPECTORS = ['A. Hinai', 'P. Menon', 'A. Hinai'];

export function buildPoints(po: string, done: number, scheduledFrom?: string): PoPoint[] {
  return POINT_TEMPLATE.map((t, i) => ({
    id: `${po}-P${i + 1}`,
    name: t.name,
    type: t.type,
    where: t.where,
    done: i < done,
    doneAt: i < done ? addDays(scheduledFrom ?? DEMO_TODAY, -(done - i) * 2) : undefined,
    by: i < done ? INSPECTORS[i % INSPECTORS.length] : undefined,
    planned: scheduledFrom ? (i < done ? addDays(scheduledFrom, -(done - i) * 2) : addDays(scheduledFrom, (i - done + 1) * 3)) : undefined,
  }));
}

interface SeedDef {
  mto: string;
  po: string;
  vendor: string;
  item: string;
  itpNo: string;
  stage: PoStageId;
  stageSince: string;
  poDate: string;
  itp: ItpStatus;
  rev?: string;
  submitted?: string;
  approved?: string;
  done?: number;
  scheduled?: boolean;
  received?: string;
  siteAccepted?: string;
  cert?: { no: string; at: string; by: string };
  comments?: ItpComment[];
  ncr?: { point: string; text: string; origin: 'fat' | 'receipt'; at: string };
  overdueHold?: boolean;
}

const QA_LEAD = 'P. Menon (QA/QC lead)';

const seeds: SeedDef[] = [
  { mto: 'MTO-014', po: '4500079423', vendor: 'Siemens Energy', item: 'K-301 rotor seal kit', itpNo: 'ITP-307', stage: 'po', stageSince: '2026-08-16', poDate: '2026-08-16', itp: 'Not submitted' },
  {
    mto: 'MTO-006', po: '4500079655', vendor: 'Haldor Topsoe', item: 'Catalyst support grid', itpNo: 'ITP-303', stage: 'itp-submit', stageSince: '2026-08-13', poDate: '2026-07-30', itp: 'Rejected', rev: 'A', submitted: '2026-08-11',
    comments: [
      { at: '2026-08-11T09:30', by: 'Haldor Topsoe (vendor)', text: 'ITP Rev A submitted via vendor portal.', kind: 'submitted' },
      { at: '2026-08-13T14:05', by: QA_LEAD, text: 'Add an NDT hold point on the grid weld seams and require EN 10204 3.2 material certificates. Resubmit as Rev B.', kind: 'rejected' },
    ],
  },
  { mto: 'MTO-018', po: '4500079188', vendor: 'Emerson Process', item: 'Control valve trim sets (32)', itpNo: 'ITP-308', stage: 'itp-review', stageSince: '2026-08-11', poDate: '2026-07-28', itp: 'Under review', rev: 'A', submitted: '2026-08-11', comments: [{ at: '2026-08-11T10:10', by: 'Emerson Process (vendor)', text: 'ITP Rev A submitted via vendor portal.', kind: 'submitted' }] },
  { mto: 'MTO-009', po: '4500078840', vendor: 'Axens', item: 'Hydrocracking catalyst charge (HC-24)', itpNo: 'ITP-304', stage: 'schedule', stageSince: '2026-08-15', poDate: '2026-07-20', itp: 'Approved', rev: 'A', submitted: '2026-08-12', approved: '2026-08-15' },
  { mto: 'MTO-002', po: '4500079301', vendor: 'Sulzer Chemtech', item: 'Reactor internals tray set, R-101', itpNo: 'ITP-301', stage: 'fat', stageSince: '2026-08-06', poDate: '2026-07-10', itp: 'Approved', rev: 'A', submitted: '2026-08-02', approved: '2026-08-04', done: 3, scheduled: true },
  { mto: 'MTO-012', po: '4500079302', vendor: 'Sulzer Chemtech', item: 'T-251 structured packing', itpNo: 'ITP-306', stage: 'fat', stageSince: '2026-08-06', poDate: '2026-07-10', itp: 'Approved', rev: 'A', submitted: '2026-08-03', approved: '2026-08-06', done: 4, scheduled: true, overdueHold: true },
  {
    mto: 'MTO-011', po: '4500079120', vendor: 'Koch-Glitsch', item: 'T-201 valve trays, Section B', itpNo: 'ITP-305', stage: 'fat', stageSince: '2026-08-03', poDate: '2026-07-05', itp: 'Approved', rev: 'A', submitted: '2026-08-01', approved: '2026-08-03', done: 4, scheduled: true,
    ncr: { point: 'NDT witness (RT/UT)', text: 'RT film shows lack of fusion on 3 tray support welds. Weld repair and re-shoot required before the hold point can be released.', origin: 'fat', at: '2026-08-15T11:20' },
  },
  { mto: 'MTO-003', po: '4500079422', vendor: 'Siemens Energy', item: 'Rotor bearing kit, C-301', itpNo: 'ITP-302', stage: 'receipt', stageSince: '2026-08-14', poDate: '2026-06-20', itp: 'Approved', rev: 'A', submitted: '2026-07-31', approved: '2026-08-01', done: 7, scheduled: true },
  { mto: 'MTO-005', po: '4500080012', vendor: 'Emerson Process', item: 'Instrument loop transmitters (QC-2201)', itpNo: 'ITP-311', stage: 'receipt', stageSince: '2026-08-09', poDate: '2026-06-28', itp: 'Approved', rev: 'A', submitted: '2026-07-20', approved: '2026-07-22', done: 7, scheduled: true, received: '2026-08-09' },
  { mto: 'MTO-021', po: '4500080210', vendor: 'ABB Oman', item: 'MCC-3 protection relays', itpNo: 'ITP-309', stage: 'cert', stageSince: '2026-08-15', poDate: '2026-06-15', itp: 'Approved', rev: 'A', submitted: '2026-07-05', approved: '2026-07-07', done: 7, scheduled: true, received: '2026-08-12', siteAccepted: '2026-08-15' },
  { mto: 'MTO-022', po: '4500080188', vendor: 'John Crane', item: 'P-205 mechanical seals (API 682)', itpNo: 'ITP-310', stage: 'release', stageSince: '2026-08-14', poDate: '2026-06-12', itp: 'Approved', rev: 'A', submitted: '2026-07-01', approved: '2026-07-04', done: 7, scheduled: true, received: '2026-08-12', siteAccepted: '2026-08-13', cert: { no: 'AC-2026-0004', at: '2026-08-14T10:40', by: 'A. Hinai' } },
  { mto: 'MTO-013', po: '4500080288', vendor: 'Axens', item: 'Claus reactor catalyst', itpNo: 'ITP-312', stage: 'release', stageSince: '2026-08-12', poDate: '2026-06-08', itp: 'Approved', rev: 'A', submitted: '2026-06-30', approved: '2026-07-02', done: 7, scheduled: true, received: '2026-08-11', siteAccepted: '2026-08-11', cert: { no: 'AC-2026-0003', at: '2026-08-12T09:15', by: 'A. Hinai' } },
  { mto: 'MTO-001', po: '4500081120', vendor: 'Sohar Gasket Co', item: 'Spiral wound gaskets, 8" 300# (40)', itpNo: 'ITP-313', stage: 'release', stageSince: '2026-08-12', poDate: '2026-06-02', itp: 'Approved', rev: 'A', submitted: '2026-06-24', approved: '2026-06-26', done: 7, scheduled: true, received: '2026-08-12', siteAccepted: '2026-08-12', cert: { no: 'AC-2026-0002', at: '2026-08-12T15:30', by: 'P. Menon' } },
];

function seedPo(d: SeedDef): PoRec {
  const mat = materialItems.find((m) => m.id === d.mto);
  let points = buildPoints(d.po, d.done ?? 0, d.scheduled ? DEMO_TODAY : undefined);
  if (d.overdueHold) points = points.map((p) => (p.type === 'H' && !p.done && p.name.startsWith('NDT') ? { ...p, planned: '2026-08-14' } : p));
  const events: PoEvent[] = [{ at: `${d.poDate}T08:00`, by: 'OQ Procurement', text: `PO ${d.po} issued to ${d.vendor} (SAP MM)` }];
  if (d.submitted) events.push({ at: `${d.submitted}T10:00`, by: `${d.vendor} (vendor)`, text: 'ITP Rev A submitted via vendor portal' });
  if (d.itp === 'Rejected') events.push({ at: '2026-08-13T14:05', by: QA_LEAD, text: 'ITP Rev A rejected with comments, returned to vendor' });
  if (d.approved) events.push({ at: `${d.approved}T11:00`, by: QA_LEAD, text: `ITP Rev ${d.rev ?? 'A'} approved` });
  if (d.scheduled) events.push({ at: `${d.approved ?? d.stageSince}T15:00`, by: QA_LEAD, text: 'Inspection points scheduled (H/W/R/S)' });
  if ((d.done ?? 0) > 0 && d.done !== 7) events.push({ at: `${addDays(DEMO_TODAY, -1)}T07:30`, by: 'A. Hinai', text: `${d.done} of ${points.length} inspection points released at the vendor works` });
  if (d.done === 7) events.push({ at: `${d.stageSince}T12:00`, by: 'A. Hinai', text: `Final inspection passed, inspection release note IRN-2026-${d.po.slice(-4)} issued` });
  if (d.received) events.push({ at: `${d.received}T09:00`, by: 'Site stores', text: 'Material received at site' });
  if (d.siteAccepted) events.push({ at: `${d.siteAccepted}T13:00`, by: 'Site QC', text: 'Site acceptance inspection passed' });
  const ncrs: PoNcr[] = d.ncr
    ? [{ id: `NCR-${d.po.slice(-4)}-1`, pointName: d.ncr.point, text: d.ncr.text, raisedAt: d.ncr.at, raisedBy: 'A. Hinai', origin: d.ncr.origin, status: 'Open' }]
    : [];
  if (d.ncr) events.push({ at: d.ncr.at, by: 'A. Hinai', text: `NCR-${d.po.slice(-4)}-1 raised: ${d.ncr.point}` });
  if (d.cert) events.push({ at: d.cert.at, by: d.cert.by, text: `Acceptance certificate ${d.cert.no} issued, released to work pack` });
  events.sort((a, b) => b.at.localeCompare(a.at));
  const comments: ItpComment[] =
    d.comments ??
    (d.submitted
      ? [
          { at: `${d.submitted}T10:00`, by: `${d.vendor} (vendor)`, text: 'ITP Rev A submitted via vendor portal.', kind: 'submitted' },
          ...(d.approved ? [{ at: `${d.approved}T11:00`, by: QA_LEAD, text: 'Approved without comments.', kind: 'approved' as const }] : []),
        ]
      : []);
  return {
    id: d.po,
    itpNo: d.itpNo,
    materialId: d.mto,
    vendor: d.vendor,
    item: d.item,
    jobId: mat?.jobId ?? 'J-2201',
    area: mat?.area ?? 'Unit 100',
    poDate: d.poDate,
    valueOMR: mat?.estCostOMR ?? 20_000,
    requiredBy: mat?.requiredBy ?? '2026-08-25',
    stage: d.stage,
    stageSince: d.stageSince,
    itpStatus: d.itp,
    itpRev: d.rev ?? 'A',
    itpSubmittedAt: d.submitted,
    itpApprovedAt: d.approved,
    itpComments: comments,
    points,
    irnNo: d.done === 7 ? `IRN-2026-${d.po.slice(-4)}` : undefined,
    ncrs,
    receivedOn: d.received,
    siteAcceptedOn: d.siteAccepted,
    cert: d.cert ? { no: d.cert.no, issuedAt: d.cert.at, by: d.cert.by, workPack: `WP-${(mat?.jobId ?? 'J-2201').slice(2)}` } : undefined,
    events,
  };
}

export const poSeed: PoRec[] = seeds.map(seedPo);

/** PR-raised material lines (no PO yet) that "Issue new PO (demo)" turns into POs, so a new PO traces back to material tracking. */
export const DEMO_PO_POOL: { mto: string; vendor: string; item: string }[] = [
  { mto: 'MTO-004', vendor: 'Heat Transfer Industries', item: 'E-204 tube bundle (40 tubes)' },
  { mto: 'MTO-008', vendor: 'Emerson Process', item: 'Relief valves, flare header spare (6)' },
  { mto: 'MTO-010', vendor: 'John Zink Hamworthy', item: 'F-101 low-NOx burners (12)' },
  { mto: 'MTO-019', vendor: 'ABB Oman', item: 'DCS I/O cards (96)' },
];
