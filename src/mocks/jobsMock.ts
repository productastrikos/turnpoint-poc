import type { Job } from '../types';
import { DISCIPLINE_CONTRACTOR, PEOPLE } from './master';

type Src = Job['source'];

function approvals(gate: Job['gate'], status: Job['status']): Job['approvals'] {
  const chain: { gate: 1 | 2 | 3; approver: string; role: string }[] = [
    { gate: 1, approver: PEOPLE.areaFocal, role: 'Area Ops Focal Point' },
    { gate: 2, approver: PEOPLE.headAreaOps, role: 'Head of Area Ops' },
    { gate: 3, approver: PEOPLE.vpAssetOps, role: 'VP Asset Ops' },
  ];
  return chain.map((c) => {
    if (c.gate < gate) return { ...c, status: 'approved' as const, actedAt: '2026-05-20T09:00:00' };
    if (c.gate === gate) {
      if (status === 'approved') return { ...c, status: 'approved' as const, actedAt: '2026-05-28T10:00:00' };
      if (status === 'rejected') return { ...c, status: 'rejected' as const, actedAt: '2026-06-02T10:00:00', comment: 'Deferred — not TA critical' };
      return { ...c, status: 'pending' as const };
    }
    return { ...c, status: 'pending' as const };
  });
}

// [id, desc, discipline, requestedBy, costOMR, gate, status, phase, createdAt, area, tag, manhours, L, C, source, taClass, startDay, durationDays, inBaseline, sapRef?, contractor?]
type Row = [
  string, string, Job['discipline'], string, number, Job['gate'], Job['status'], Job['phase'], string,
  string, string, number, Job['likelihood'], Job['consequence'], Src, Job['taClass'], number, number, boolean, string?, string?
];

const rows: Row[] = [
  // ---- original eight (ids/descriptions preserved) ----
  ['J-2201', 'Reactor R-101 full internals inspection', 'Inspection', 'A. Hinai', 145_000, 3, 'approved', 'execution', '2026-05-04', 'Unit 100', 'R-101', 3400, 4, 5, 'Manual', 'TA', 5, 17, true, undefined, 'Larsen & Toubro'],
  ['J-2202', 'E-204 bundle pull and retube', 'Rotating Equipment', 'R. Fernandes', 210_000, 3, 'approved', 'execution', '2026-04-28', 'Unit 200', 'E-204', 2600, 3, 4, 'SAP work order', 'TA', 10, 11, true, '4000031187', 'Larsen & Toubro'],
  ['J-2203', 'C-301 rotor removal and bearing inspection', 'Rotating Equipment', 'T. Said', 88_000, 3, 'approved', 'execution', '2026-05-05', 'Unit 300', 'C-301', 1500, 3, 4, 'SAP work order', 'TA', 11, 9, true, '4000031204'],
  ['J-2204', 'Instrument loop QC-2201 recalibration', 'Instrumentation', 'S. Kumar', 32_000, 3, 'rejected', 'scoping', '2026-04-30', 'Unit 220', 'QC-2201', 420, 2, 3, 'Manual', 'TA', 12, 3, false],
  ['J-2205', 'Scaffold package — CP1 workfronts', 'Civil', 'M. Al-Balushi', 54_000, 3, 'approved', 'planning', '2026-05-03', 'Unit 100', 'R-101', 4800, 2, 3, 'Excel import', 'TA', 1, 28, true],
  ['J-2206', 'Temporary power distribution — Unit 300', 'Electrical', 'T. Said', 21_000, 3, 'approved', 'planning', '2026-04-25', 'Unit 300', 'MCC-3', 640, 2, 2, 'Manual', 'TA', 1, 30, true],
  ['J-2207', 'V-102 nozzle inspection extension', 'Inspection', 'A. Hinai', 18_500, 1, 'pending', 'scoping', '2026-08-14', 'Unit 200', 'V-102', 360, 4, 3, 'Manual', 'TA', 17, 3, false],
  ['J-2208', 'Process line leak test — Train B', 'Process', 'K. Rao', 12_000, 3, 'approved', 'execution', '2026-04-20', 'Unit 200', 'TL-B', 480, 3, 3, 'Manual', 'TA', 24, 3, true],
  // ---- baseline (frozen) scope ----
  ['J-2209', 'Catalyst unload and screening — R-101', 'Process', 'K. Rao', 186_000, 3, 'approved', 'execution', '2026-04-22', 'Unit 100', 'R-101', 5200, 4, 4, 'Manual', 'TA', 14, 5, true, undefined, 'Larsen & Toubro'],
  ['J-2210', 'Piping tie-in — line 14"-P-2201', 'Process', 'K. Rao', 96_000, 3, 'approved', 'execution', '2026-05-06', 'Unit 200', '14"-P-2201', 2100, 3, 4, 'SAP work order', 'TA', 18, 5, true, '4000031230'],
  ['J-2211', 'P-305 process water pump overhaul', 'Rotating Equipment', 'R. Fernandes', 29_000, 3, 'approved', 'execution', '2026-05-08', 'Unit 300', 'P-305', 560, 2, 3, 'SAP notification', 'TA', 9, 6, true, '100049102'],
  ['J-2212', 'F-101 charge heater tube inspection and decoking', 'Inspection', 'A. Hinai', 78_000, 3, 'approved', 'planning', '2026-04-29', 'Unit 100', 'F-101', 1900, 3, 4, 'SAP notification', 'TA', 6, 8, true, '100049221', 'Larsen & Toubro'],
  ['J-2213', 'T-201 atmospheric column trays inspection and repair', 'Inspection', 'A. Hinai', 132_000, 3, 'approved', 'planning', '2026-04-27', 'Unit 200', 'T-201', 3100, 3, 4, 'Excel import', 'TA', 4, 14, true, undefined, 'Larsen & Toubro'],
  ['J-2214', 'P-205 crude charge pump overhaul', 'Rotating Equipment', 'R. Fernandes', 46_000, 3, 'approved', 'planning', '2026-05-02', 'Unit 200', 'P-205', 820, 2, 3, 'SAP work order', 'TA', 8, 9, true, '4000031251'],
  ['J-2215', 'K-301 main air blower inspection', 'Rotating Equipment', 'T. Said', 64_000, 3, 'approved', 'planning', '2026-05-07', 'Unit 300', 'K-301', 1100, 3, 3, 'SAP work order', 'TA', 12, 7, true, '4000031266'],
  ['J-2216', 'R-301 regenerator refractory repair', 'Civil', 'M. Al-Balushi', 168_000, 3, 'approved', 'execution', '2026-04-24', 'Unit 300', 'R-301', 4600, 4, 4, 'Bulk upload', 'TA', 5, 18, true],
  ['J-2217', 'Claus reactor T-221 catalyst replacement', 'Process', 'K. Rao', 92_000, 3, 'approved', 'planning', '2026-05-09', 'Unit 220', 'T-221', 1800, 3, 3, 'Manual', 'TA', 7, 9, true],
  ['J-2218', 'T-251 vacuum column packing inspection', 'Inspection', 'A. Hinai', 74_000, 3, 'approved', 'planning', '2026-05-01', 'Unit 250', 'T-251', 1700, 3, 3, 'Excel import', 'TA', 9, 10, true, undefined, 'Larsen & Toubro'],
  ['J-2219', 'PSV recertification campaign — 84 valves', 'Instrumentation', 'S. Kumar', 58_000, 3, 'approved', 'planning', '2026-05-10', 'Flare System', 'RV-1104', 1260, 3, 4, 'SAP notification', 'TA', 6, 14, true, '100049310'],
  ['J-2220', 'Control valve overhaul package — 32 CVs', 'Instrumentation', 'S. Kumar', 61_000, 3, 'approved', 'planning', '2026-05-11', 'Unit 100', 'PV-3021', 1050, 2, 3, 'SAP work order', 'TA', 8, 10, true, '4000031290'],
  ['J-2221', 'Flare header tie-in FL-401', 'Process', 'K. Rao', 84_000, 3, 'approved', 'planning', '2026-05-12', 'Flare System', 'FL-401', 1700, 3, 4, 'Manual', 'TA', 16, 6, true],
  ['J-2222', 'MCC-3 motor protection relay upgrade', 'Electrical', 'T. Said', 38_000, 3, 'approved', 'planning', '2026-05-13', 'Unit 300', 'MCC-3', 720, 2, 3, 'Manual', 'TA', 10, 6, true],
  ['J-2223', 'Pipe rack 4 pipe support replacement — 40 supports', 'Civil', 'M. Al-Balushi', 49_000, 3, 'approved', 'planning', '2026-05-14', 'Pipe Rack 4', 'PR4-SUP', 1900, 2, 3, 'Bulk upload', 'TA', 6, 12, true],
  ['J-2224', 'Insulation renewal — Unit 200 (2,400 m²)', 'Civil', 'M. Al-Balushi', 71_000, 3, 'approved', 'planning', '2026-05-15', 'Unit 200', 'INS-200', 3800, 2, 2, 'Excel import', 'TA', 10, 14, true],
  ['J-2225', 'DCS I/O card replacement — Unit 100', 'Instrumentation', 'S. Kumar', 42_000, 3, 'approved', 'planning', '2026-05-16', 'Unit 100', 'DCS-100', 640, 2, 3, 'Manual', 'TA', 13, 5, true],
  // ---- post-freeze / in-flight requests (pending at each gate) ----
  ['J-2226', 'Replace corroded handrails and grating — Unit 220', 'Civil', 'M. Al-Balushi', 27_000, 1, 'pending', 'scoping', '2026-08-12', 'Unit 220', 'PLAT-220', 520, 2, 2, 'SAP notification', 'Non-TA', 20, 4, false, '100051877'],
  ['J-2227', 'C-301 lube oil console flushing', 'Rotating Equipment', 'T. Said', 22_000, 1, 'pending', 'scoping', '2026-08-13', 'Unit 300', 'C-301', 380, 2, 3, 'SAP work order', 'TA', 15, 3, false, '4000033019'],
  ['J-2228', 'Replace analyser house AC units — Unit 100', 'Electrical', 'T. Said', 9_500, 1, 'pending', 'scoping', '2026-08-15', 'Unit 100', 'AH-100', 120, 1, 2, 'Manual', 'Non-TA', 22, 2, false],
  ['J-2229', 'Replace T-201 overhead line spool (CUI found)', 'Process', 'K. Rao', 56_000, 2, 'pending', 'scoping', '2026-08-09', 'Unit 200', 'T-201', 940, 4, 4, 'SAP notification', 'TA', 19, 4, false, '100051702'],
  ['J-2230', 'R-101 outlet nozzle weld overlay repair', 'Inspection', 'A. Hinai', 112_000, 2, 'pending', 'scoping', '2026-08-15', 'Unit 100', 'R-101', 1450, 4, 5, 'Manual', 'TA', 19, 6, false],
  ['J-2231', 'Install permanent access platform at V-102', 'Civil', 'M. Al-Balushi', 43_000, 2, 'pending', 'scoping', '2026-08-10', 'Unit 200', 'V-102', 860, 2, 3, 'Manual', 'TA', 21, 5, false],
  ['J-2232', 'F-101 burner replacement — 12 burners', 'Process', 'K. Rao', 205_000, 3, 'pending', 'scoping', '2026-08-07', 'Unit 100', 'F-101', 2400, 3, 4, 'Manual', 'TA', 21, 7, false, undefined, 'Larsen & Toubro'],
  ['J-2233', 'DCS controller migration phase 2 — Unit 300', 'Instrumentation', 'S. Kumar', 148_000, 3, 'pending', 'scoping', '2026-08-05', 'Unit 300', 'DCS-300', 1750, 3, 4, 'Excel import', 'TA', 22, 7, false],
  ['J-2234', 'SRU incinerator stack replacement', 'Civil', 'M. Al-Balushi', 310_000, 2, 'rejected', 'scoping', '2026-07-30', 'Unit 220', 'ST-221', 5200, 2, 4, 'Manual', 'TA', 18, 12, false],
  // ---- the same work raised a second time through another channel (what the duplicate detector, S9, should catch) ----
  ['J-2235', 'R-101 outlet nozzle N2 — weld build-up repair (wall thinning found)', 'Process', 'K. Rao', 98_000, 1, 'pending', 'scoping', '2026-08-15', 'Unit 100', 'R-101', 1300, 4, 5, 'SAP notification', 'TA', 18, 6, false, '100051988'],
  ['J-2236', 'PSV batch 3 recertification — 24 relief valves, flare header', 'Instrumentation', 'S. Kumar', 61_000, 1, 'pending', 'scoping', '2026-08-14', 'Flare System', 'RV-1104', 500, 3, 4, 'Excel import', 'TA', 8, 6, false],
];

export const jobs: Job[] = rows.map((r) => ({
  id: r[0],
  desc: r[1],
  discipline: r[2],
  requestedBy: r[3],
  costOMR: r[4],
  gate: r[5],
  status: r[6],
  phase: r[7],
  approvals: approvals(r[5], r[6]),
  createdAt: r[8],
  area: r[9],
  tag: r[10],
  manhours: r[11],
  likelihood: r[12],
  consequence: r[13],
  source: r[14],
  taClass: r[15],
  startDay: r[16],
  durationDays: r[17],
  inBaseline: r[18],
  sapRef: r[19],
  contractor: r[20] ?? DISCIPLINE_CONTRACTOR[r[2]],
}));

export const JOB_BY_ID: Record<string, Job> = Object.fromEntries(jobs.map((j) => [j.id, j]));
