// QA/QC: heat exchanger inspection workflow (SOW dry run 15-24) and Inspection Test Plans (P9).
import { rng } from './_gen';

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

export type PointType = 'H' | 'W' | 'R'; // hold, witness, review

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
