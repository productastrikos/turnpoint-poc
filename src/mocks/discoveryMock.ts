import type { DiscoveryJob } from '../types';

export const discoveryJobs: DiscoveryJob[] = [
  { id: 'DJ-014', desc: 'Corrosion on V-102 nozzle N4', discipline: 'Inspection', foundBy: 'A. Hinai', area: 'Unit 200', state: 'evaluating', estCostOMR: 18_500, raisedAt: '2026-08-14', notes: 'Feeds into MOC-101; awaiting metallurgy report' },
  { id: 'DJ-015', desc: 'Cracked support bracket — Line 14"-P-2201', discipline: 'Civil', foundBy: 'K. Rao', area: 'Pipe Rack 4', state: 'identified', estCostOMR: 6_200, raisedAt: '2026-08-15', notes: '' },
  { id: 'DJ-016', desc: 'Worn coupling on P-305 spare', discipline: 'Rotating Equipment', foundBy: 'R. Fernandes', area: 'Unit 300', state: 'approved', estCostOMR: 4_100, raisedAt: '2026-08-12', notes: 'Merged into base scope job J-2231' },
  { id: 'DJ-017', desc: 'Instrument tubing degradation — QC-2201 loop', discipline: 'Instrumentation', foundBy: 'S. Kumar', area: 'Unit 220', state: 'evaluating', estCostOMR: 2_800, raisedAt: '2026-08-15', notes: '' },
  { id: 'DJ-018', desc: 'Missing insulation on E-204 outlet line', discipline: 'Process', foundBy: 'R. Fernandes', area: 'Unit 200', state: 'merged', estCostOMR: 3_400, raisedAt: '2026-08-10', notes: 'Merged into TA base scope' },
  { id: 'DJ-019', desc: 'Damaged cable tray near C-301', discipline: 'Electrical', foundBy: 'T. Said', area: 'Unit 300', state: 'rejected', estCostOMR: 1_900, raisedAt: '2026-08-11', notes: 'Deferred to next shutdown — non-critical' },
  { id: 'DJ-020', desc: 'Pitting on R-101 internals tray 7', discipline: 'Inspection', foundBy: 'A. Hinai', area: 'Unit 100', state: 'identified', estCostOMR: 24_000, raisedAt: '2026-08-16', notes: 'High priority — may impact CP1' },
];
