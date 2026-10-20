import type { CriticalPathActivity } from '../types';

type R = Omit<CriticalPathActivity, 'logic'> & { logic?: CriticalPathActivity['logic'] };

const raw: R[] = [
  { id: 'CPA-001', name: 'Reactor R-101 Head Removal', path: 'CP1', status: 'on-track', changeCount: 1, plannedFinish: '2026-08-19', forecastFinish: '2026-08-19', owner: 'M. Al-Balushi', predecessors: [], durationDays: 3, floatDays: -2, resource: 'L&T Reactor Crew A', costOMR: 38_000 },
  { id: 'CPA-002', name: 'Catalyst Unload & Screening', path: 'CP1', status: 'at-risk', changeCount: 3, plannedFinish: '2026-08-20', forecastFinish: '2026-08-21', owner: 'S. Kumar', predecessors: ['CPA-001'], durationDays: 2, floatDays: -2, resource: 'L&T Catalyst Crew', costOMR: 186_000 },
  { id: 'CPA-003', name: 'Internals Inspection — R-101', path: 'CP1', status: 'delayed', changeCount: 5, plannedFinish: '2026-08-21', forecastFinish: '2026-08-23', owner: 'A. Hinai', predecessors: ['CPA-002'], durationDays: 2, floatDays: -2, resource: 'Petrofac Inspection Team', costOMR: 145_000 },
  { id: 'CPA-004', name: 'Heat Exchanger E-204 Bundle Pull', path: 'CP2', status: 'on-track', changeCount: 0, plannedFinish: '2026-08-19', forecastFinish: '2026-08-19', owner: 'R. Fernandes', predecessors: [], durationDays: 2, floatDays: -1, resource: 'Galfar Rigging Crew 2', costOMR: 44_000 },
  { id: 'CPA-005', name: 'E-204 Retube', path: 'CP2', status: 'at-risk', changeCount: 2, plannedFinish: '2026-08-22', forecastFinish: '2026-08-23', owner: 'R. Fernandes', predecessors: ['CPA-004'], durationDays: 3, floatDays: -1, resource: 'L&T Exchanger Crew', costOMR: 166_000 },
  { id: 'CPA-006', name: 'Compressor C-301 Rotor Removal', path: 'CP3', status: 'on-track', changeCount: 1, plannedFinish: '2026-08-20', forecastFinish: '2026-08-20', owner: 'T. Said', predecessors: [], durationDays: 2, floatDays: 0, resource: 'Galfar Rotating Crew', costOMR: 52_000 },
  { id: 'CPA-007', name: 'C-301 Bearing Inspection', path: 'CP3', status: 'on-track', changeCount: 0, plannedFinish: '2026-08-21', forecastFinish: '2026-08-21', owner: 'T. Said', predecessors: ['CPA-006'], durationDays: 1, floatDays: 0, resource: 'Petrofac Inspection Team', costOMR: 36_000 },
  { id: 'CPA-008', name: 'Piping Tie-in — Line 14"-P-2201', path: 'CP1', status: 'delayed', changeCount: 4, plannedFinish: '2026-08-26', forecastFinish: '2026-08-28', owner: 'K. Rao', predecessors: ['CPA-003'], durationDays: 3, floatDays: -2, resource: 'Galfar Piping Crew 4', costOMR: 96_000 },
  { id: 'CPA-009', name: 'Reactor R-101 Box-up', path: 'CP1', status: 'on-track', changeCount: 0, plannedFinish: '2026-08-27', forecastFinish: '2026-08-29', owner: 'M. Al-Balushi', predecessors: ['CPA-008', 'CPA-011'], durationDays: 2, floatDays: -2, resource: 'L&T Reactor Crew A', costOMR: 61_000 },
  { id: 'CPA-010', name: 'System Leak Test — Train B', path: 'CP2', status: 'on-track', changeCount: 1, plannedFinish: '2026-08-28', forecastFinish: '2026-08-29', owner: 'R. Fernandes', predecessors: ['CPA-014'], durationDays: 2, floatDays: -1, resource: 'Galfar Commissioning', costOMR: 12_000 },
  { id: 'CPA-011', name: 'Reactor Internals Re-installation', path: 'CP1', status: 'on-track', changeCount: 0, plannedFinish: '2026-08-26', forecastFinish: '2026-08-28', owner: 'S. Kumar', predecessors: ['CPA-003'], durationDays: 3, floatDays: -2, resource: 'L&T Reactor Crew B', costOMR: 124_000 },
  { id: 'CPA-012', name: 'Catalyst Reload — R-101', path: 'CP1', status: 'on-track', changeCount: 0, plannedFinish: '2026-08-30', forecastFinish: '2026-09-01', owner: 'S. Kumar', predecessors: ['CPA-009'], durationDays: 3, floatDays: -2, resource: 'L&T Catalyst Crew', costOMR: 142_000 },
  { id: 'CPA-013', name: 'Reactor Leak Test & N2 Purge', path: 'CP1', status: 'on-track', changeCount: 0, plannedFinish: '2026-09-01', forecastFinish: '2026-09-03', owner: 'K. Rao', predecessors: ['CPA-012'], durationDays: 2, floatDays: -2, resource: 'Galfar Commissioning', costOMR: 28_000 },
  { id: 'CPA-014', name: 'E-204 Bundle Re-insertion & Box-up', path: 'CP2', status: 'on-track', changeCount: 0, plannedFinish: '2026-08-26', forecastFinish: '2026-08-27', owner: 'R. Fernandes', predecessors: ['CPA-005'], durationDays: 2, floatDays: -1, resource: 'Galfar Rigging Crew 2', costOMR: 39_000 },
  { id: 'CPA-015', name: 'C-301 Rotor Re-installation & Alignment', path: 'CP3', status: 'on-track', changeCount: 0, plannedFinish: '2026-08-27', forecastFinish: '2026-08-27', owner: 'T. Said', predecessors: ['CPA-007'], durationDays: 3, floatDays: 0, resource: 'Galfar Rotating Crew', costOMR: 58_000 },
  { id: 'CPA-016', name: 'C-301 Lube Oil Flush & Run-in', path: 'CP3', status: 'on-track', changeCount: 0, plannedFinish: '2026-08-31', forecastFinish: '2026-08-31', owner: 'T. Said', predecessors: ['CPA-015'], durationDays: 3, floatDays: 0, resource: 'Galfar Commissioning', costOMR: 22_000 },
];

// Forecasts and float are CPM-consistent with the P6 schedule (same network as /ext/p6): a delay carries to the
// successors, and every activity on a late path shows that path's negative float, as P6 reports it.
export const criticalPathActivities: CriticalPathActivity[] = raw.map((r) => ({ logic: 'FS', ...r }));

/** Daily critical-path change log (X3 / X30): how many times the critical path itself changed each TA day. */
export const cpDailyChanges: { day: number; changes: number; note: string }[] = [
  { day: 1, changes: 0, note: 'Baseline CP set at TA start' },
  { day: 2, changes: 1, note: 'Shutdown sequence re-ordered (flare header isolation moved earlier)' },
  { day: 3, changes: 0, note: '' },
  { day: 4, changes: 2, note: 'Scaffold access delay moved T-201 tray work onto CP' },
  { day: 5, changes: 1, note: 'R-101 depressurisation 4h late' },
  { day: 6, changes: 0, note: '' },
  { day: 7, changes: 1, note: 'Heater F-101 decoke resequenced off CP' },
  { day: 8, changes: 3, note: 'Crane conflict E-204 / C-301 — lift schedule re-sequenced (RSK-03)' },
  { day: 9, changes: 1, note: '' },
  { day: 10, changes: 0, note: '' },
  { day: 11, changes: 2, note: 'Catalyst disposal contractor late (RSK-01) — CPA-002 at-risk' },
  { day: 12, changes: 1, note: '' },
  { day: 13, changes: 2, note: 'Internals pitting found (DJ-020) — CPA-003 +2 days' },
  { day: 14, changes: 4, note: 'Tie-in 14"-P-2201 spool rework — CPA-008 +2 days' },
];

/** Near-critical activities the live monitor watches (X21). float in days. */
export const nearCritical: { id: string; name: string; floatDays: number; driver: string; path: string }[] = [
  { id: 'ACT-231', name: 'T-201 Tray Repair — Section B', floatDays: 2, driver: 'Welder availability (night shift)', path: 'Near-CP1' },
  { id: 'ACT-244', name: 'F-101 Burner Block Refractory Cure', floatDays: 3, driver: 'Refractory cure time', path: 'Near-CP1' },
  { id: 'ACT-318', name: 'K-301 Blower Casing Alignment', floatDays: 1, driver: 'Alignment tool availability', path: 'Near-CP3' },
  { id: 'ACT-352', name: 'FL-401 Flare Header Hydrotest', floatDays: 2, driver: 'Test water supply', path: 'Near-CP2' },
  { id: 'ACT-367', name: 'PSV Recertification — Batch 3', floatDays: 4, driver: 'Bench availability', path: 'Near-CP2' },
];
