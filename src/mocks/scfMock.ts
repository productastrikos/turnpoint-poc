import type { SCF } from '../types';
import { deriveApprover } from '../services/scfRules';

const raw: Omit<SCF, 'approver'>[] = [
  { id: 'SCF-201', title: 'Extend R-101 internals inspection to tray 7', requestedBy: 'A. Hinai', department: 'Inspection', costUSD: 24_000, durationDays: 2, exceedsWindow: false, status: 'evaluating', justification: 'Pitting found during DJ-020 walkdown; requires tray-level inspection beyond base scope.', raisedAt: '2026-08-16' },
  { id: 'SCF-202', title: 'Additional E-204 retube — 40 tubes', requestedBy: 'R. Fernandes', department: 'Maintenance', costUSD: 92_000, durationDays: 3, exceedsWindow: false, status: 'evaluating', justification: 'Bundle inspection shows more tubes require replacement than originally scoped.', raisedAt: '2026-08-15' },
  { id: 'SCF-203', title: 'Replace catalyst support grid', requestedBy: 'K. Rao', department: 'Process', costUSD: 61_500, durationDays: 5, exceedsWindow: true, status: 'approved', justification: 'Grid found deformed; replacement required before catalyst reload, extends mechanical window.', raisedAt: '2026-08-11' },
  { id: 'SCF-204', title: 'Minor gasket set upsize — V-102', requestedBy: 'A. Hinai', department: 'Inspection', costUSD: 4_200, durationDays: 0.5, exceedsWindow: false, status: 'approved', justification: 'Gasket size correction identified during fit-up.', raisedAt: '2026-08-13' },
  { id: 'SCF-205', title: 'Add scope — C-301 coupling replacement', requestedBy: 'T. Said', department: 'Maintenance', costUSD: 15_800, durationDays: 1, exceedsWindow: false, status: 'rejected', justification: 'Coupling wear within acceptable tolerance per vendor spec — deferred.', raisedAt: '2026-08-09' },
  { id: 'SCF-207', kind: 'Additional work request', title: 'Additional hydro-jetting crew for E-205 bundle', requestedBy: 'R. Fernandes', department: 'Maintenance', costUSD: 18_000, durationDays: 2, exceedsWindow: false, status: 'evaluating', justification: 'Bundle fouling heavier than planned; second crew keeps E-205 on the CDU path.', raisedAt: '2026-08-16' },
  { id: 'SCF-206', title: 'Emergency instrument loop rework — QC-2201', requestedBy: 'S. Kumar', department: 'Engineering', costUSD: 79_000, durationDays: 4, exceedsWindow: false, status: 'evaluating', justification: 'Loop found non-compliant with updated safety instrumented function rating.', raisedAt: '2026-08-16' },
];

export const scfItems: SCF[] = raw.map((r) => ({ ...r, approver: deriveApprover(r.costUSD, r.exceedsWindow) }));
