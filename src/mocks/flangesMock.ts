import type { Flange } from '../types';

const areas = ['Unit 100', 'Unit 200', 'Unit 300', 'Pipe Rack 4', 'Flare System'];
const contractors = ['Galfar', 'Larsen & Toubro', 'Petrofac Services', 'Zubair E&M'];
const lines = ['6"-P-1104', '8"-P-2201', '14"-P-3305', '4"-P-1090', '10"-P-2277', '12"-P-3120'];

function seedFlanges(): Flange[] {
  const out: Flange[] = [];
  let n = 1;
  for (let i = 0; i < 42; i++) {
    const stage = [6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 0][i % 12] as Flange['stage'];
    out.push({
      id: `FLG-${String(n++).padStart(4, '0')}`,
      tagNo: `FL-${1000 + i}`,
      area: areas[i % areas.length],
      line: lines[i % lines.length],
      size: ['2"', '4"', '6"', '8"', '10"', '12"'][i % 6],
      rating: ['150#', '300#', '600#'][i % 3],
      contractor: contractors[i % contractors.length],
      stage,
      updatedAt: `2026-08-${String(10 + (i % 6)).padStart(2, '0')}`,
      qrCode: `QR-FLG-${String(n).padStart(4, '0')}`,
    });
  }
  return out;
}

export const flanges: Flange[] = seedFlanges();

// ---------------- per-flange detail (SOW 10.51.3): specification, QA/QC, history, audit trail ----------------
// Derived deterministically from the flange record, so the same flange always shows the same numbers.

export interface FlangeDetail {
  critical: boolean;
  boltSpec: string;
  gasket: string;
  torqueNm: number;
  tighteningPattern: string;
  inspection: { face: string; bolts: string; gasket: string };
  signOffs: { step: string; by: string; done: boolean }[];
  previousTa: string[];
  audit: { at: string; who: string; action: string }[];
  reworkAfterTorque: boolean;
  workOrder: string;
  p6Id: string;
}

const SIZE_IDX = ['2"', '4"', '6"', '8"', '10"', '12"'];
const num = (id: string) => Number(id.replace(/\D/g, '')) || 1;

export function isCriticalFlange(f: Flange): boolean {
  return f.rating === '600#' || f.area === 'Flare System';
}

export function reworkAfterTorque(f: Flange): boolean {
  return f.stage >= 4 && num(f.id) % 9 === 0;
}

export function describeFlange(f: Flange): FlangeDetail {
  const si = Math.max(0, SIZE_IDX.indexOf(f.size));
  const boltDia = f.rating === '150#' ? '5/8"' : f.rating === '300#' ? '3/4"' : '7/8"';
  const count = [4, 8, 8, 8, 12, 12][si];
  const base = f.rating === '150#' ? 90 : f.rating === '300#' ? 160 : 285;
  const torqueNm = Math.round((base * (1 + si * 0.18)) / 5) * 5;
  const n = num(f.id);
  const gasket = f.rating === '600#' ? 'Ring joint R-type, soft iron' : 'Spiral wound SS316L / flexible graphite';
  const faceFindings = ['Face clean, no damage', 'Light corrosion, linished', 'Minor scratches within tolerance'];
  const stages = ['Break planned', 'Opened and tagged', 'Cleaned and inspected', 'Assembled with new gasket', 'Torqued and sequence verified', 'Leak tested', 'Closed, ready for handover'];
  const who = [f.contractor, f.contractor, f.contractor, f.contractor, `${f.contractor} (sub-contractor)`, 'MMC QA/QC', 'OQ QA/QC'];
  const day = Number(f.updatedAt.slice(8, 10));
  const audit = stages.slice(0, f.stage + 1).map((a, i) => ({
    at: `2026-08-${String(Math.max(3, day - (f.stage - i))).padStart(2, '0')} ${String(7 + ((n + i) % 8)).padStart(2, '0')}:${['05', '20', '40', '55'][(n + i) % 4]}`,
    who: who[i],
    action: a,
  }));
  return {
    critical: isCriticalFlange(f),
    boltSpec: `${count} x ${boltDia} stud bolts B7 / nuts 2H`,
    gasket,
    torqueNm,
    tighteningPattern: count > 8 ? 'Star pattern, 4 passes (30 / 60 / 100 / 100 %)' : 'Cross pattern, 4 passes (30 / 60 / 100 / 100 %)',
    inspection: {
      face: faceFindings[n % 3],
      bolts: n % 4 === 0 ? 'Replaced (corroded threads)' : 'Reused, serviceable',
      gasket: 'New gasket fitted, previous gasket discarded',
    },
    signOffs: [
      { step: 'Opening inspection by MMC', by: f.contractor, done: f.stage >= 2 },
      { step: 'OQ verification of findings (SCF if needed)', by: 'OQ Quality Team', done: f.stage >= 3 },
      { step: 'Torque / tension by sub-contractor, validated by MMC', by: 'MMC QA/QC', done: f.stage >= 4 },
      { step: 'Leak test witnessed and approved by OQ', by: 'OQ QA/QC', done: f.stage >= 6 },
    ],
    previousTa: [
      'STO-2024: gasket replaced, bolts reused',
      n % 3 === 0 ? 'STO-2024: flange face linished (light pitting)' : 'STO-2024: face in good condition',
      'STO-2024: leak test passed at 1.1 x design pressure',
    ],
    audit,
    reworkAfterTorque: reworkAfterTorque(f),
    workOrder: `4000031${String(200 + (n % 60)).padStart(3, '0')}`,
    p6Id: `${f.area === 'Unit 100' ? 'HCU' : f.area === 'Unit 200' ? 'CDU' : f.area === 'Unit 300' ? 'FCC' : f.area === 'Flare System' ? 'FLR' : 'PR4'}-${3000 + (n % 90) * 10}`,
  };
}
