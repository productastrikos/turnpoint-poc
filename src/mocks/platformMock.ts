// Platform roadmap (D1) and illustrative load-test evidence (D2-D4). Illustrative only.
import { rng, float } from './_gen';

export interface RoadmapPhase {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  kind: 'platform' | 'ta' | 'integration';
  deliverable: string;
}

export const roadmap: RoadmapPhase[] = [
  { id: 'P0', name: 'Mobilisation and governance', start: '2026-11-01', end: '2026-12-15', progress: 0, kind: 'platform', deliverable: 'Project charter, steering committee, RACI, environments' },
  { id: 'P1', name: 'Requirements and solution design', start: '2026-12-01', end: '2027-03-15', progress: 0, kind: 'platform', deliverable: 'Functional design for all 97 checklist items, data model' },
  { id: 'P2', name: 'Core build: scope, planning, execution', start: '2027-01-10', end: '2027-07-31', progress: 0, kind: 'platform', deliverable: 'Scope and worklist, work packs, critical path, dashboards' },
  { id: 'P3', name: 'SAP S/4HANA integration (PM, MM, PS)', start: '2027-02-15', end: '2027-08-31', progress: 0, kind: 'integration', deliverable: 'Bi-directional notifications, orders, materials, cost' },
  { id: 'P4', name: 'Primavera P6 integration (v24.21 UAT)', start: '2027-02-15', end: '2027-07-31', progress: 0, kind: 'integration', deliverable: 'XER and REST two-way sync, ALU / RLU, activity IDs' },
  { id: 'P5', name: 'Mobile offline app and SIM connectivity', start: '2027-04-01', end: '2027-08-31', progress: 0, kind: 'platform', deliverable: 'Offline-first mobile app, sync engine, barcode / QR / GPS' },
  { id: 'P6', name: 'UAT, dry run (SOW 16) and load test', start: '2027-07-15', end: '2027-09-20', progress: 0, kind: 'platform', deliverable: '34 dry-run scenarios, 1,500+ user load test, response-time evidence' },
  { id: 'TA1', name: 'TA-2027 Minor TA (FCC & SRU): pilot', start: '2027-10-04', end: '2027-10-22', progress: 0, kind: 'ta', deliverable: 'First live use of the platform on a real turnaround' },
  { id: 'P7', name: 'Hypercare and lessons learned', start: '2027-10-04', end: '2028-01-31', progress: 0, kind: 'platform', deliverable: 'Stabilisation, pilot lessons digitised, backlog' },
  { id: 'P8', name: 'Enhancements: AI forecasting, readiness', start: '2028-01-15', end: '2028-06-30', progress: 0, kind: 'platform', deliverable: 'AI schedule forecast, risk prediction, close-out report' },
  { id: 'TA2', name: 'STO-2028 Major STO: platform roll-out', start: '2028-09-05', end: '2028-10-09', progress: 0, kind: 'ta', deliverable: 'Full platform roll-out on a major turnaround' },
  { id: 'P9', name: 'Roll-out support and close-out', start: '2028-07-01', end: '2028-12-15', progress: 0, kind: 'platform', deliverable: 'Training of OQ and contractors, handover, final acceptance' },
];

export const roadmapMilestones = [
  { date: '2026-11-01', label: 'Contract award' },
  { date: '2027-09-20', label: 'Dry run passed' },
  { date: '2027-10-04', label: 'Pilot go-live' },
  { date: '2028-09-05', label: 'STO-2028 go-live' },
  { date: '2028-12-15', label: 'Final acceptance' },
];

// ---- illustrative load test ----
export const LOAD_TARGET_USERS = 1500;
export const SLA_MS = 1000;

export interface LoadPoint {
  minute: number;
  users: number;
  p50: number;
  p95: number;
  p99: number;
  rps: number;
  errPct: number;
}

export function loadSeries(): LoadPoint[] {
  const r = rng(77);
  const out: LoadPoint[] = [];
  for (let m = 0; m <= 40; m++) {
    const users = m <= 28 ? Math.round(1640 * Math.min(1, m / 28) ** 1.1) : m <= 36 ? 1640 : Math.round(1640 * (1 - (m - 36) / 6));
    const load = users / 1640;
    const p50 = Math.round(180 + load ** 3 * 230 + r() * 14);
    const p95 = Math.round(310 + load ** 3 * 440 + r() * 24);
    const p99 = Math.round(520 + load ** 3 * 780 + r() * 40);
    out.push({ minute: m, users, p50, p95, p99, rps: Math.round(users * 0.26 + r() * 6), errPct: float(r, 0, load > 0.9 ? 0.07 : 0.02, 2) });
  }
  return out;
}

export const loadTransactions = [
  { name: 'Sign in (AD SSO)', p50: 214, p95: 388, p99: 612, err: 0.02, rps: 38 },
  { name: 'Command dashboard load', p50: 305, p95: 612, p99: 941, err: 0.04, rps: 71 },
  { name: 'Open scope worklist (1,184 orders)', p50: 342, p95: 704, p99: 988, err: 0.03, rps: 52 },
  { name: 'Approve scope gate', p50: 188, p95: 341, p99: 560, err: 0.01, rps: 24 },
  { name: 'Critical path view', p50: 398, p95: 781, p99: 1_120, err: 0.06, rps: 44 },
  { name: 'Save field progress (mobile sync)', p50: 164, p95: 312, p99: 498, err: 0.02, rps: 96 },
  { name: 'Generate daily newsletter', p50: 612, p95: 892, p99: 1_480, err: 0.08, rps: 6 },
];
