import { BASE_ESTIMATE, variations as seedVariations, type Variation, type VariationStatus } from '../mocks/scopeMock';
import { createCollection } from './_collection';
import { delay } from './_util';
import { getJobs } from './jobsService';
import { pushSapStatus, sendToSystems } from './integrationService';
import { sapWoForJob } from '../mocks/sapKeys';

// ---------------------------------------------------------------- variations (S7)
const varStore = createCollection<Variation>(seedVariations);
let varSeq = 130;

export const listVariations = () => varStore.list();

export async function decideVariation(id: string, status: Exclude<VariationStatus, 'Pending'>): Promise<Variation> {
  const v = await varStore.update(id, { status });
  if (status === 'Approved') pushSapStatus('Maintenance Order status', v.ref, `${v.id} approved: budget and order updated`);
  return v;
}

export async function createVariation(input: Pick<Variation, 'title' | 'ref' | 'type' | 'source' | 'originator' | 'costOMR' | 'manhours'>): Promise<Variation> {
  const v: Variation = { ...input, id: `VAR-${varSeq++}`, phase: 'Post-freeze', status: 'Pending', raisedAt: '2026-08-16' };
  return varStore.add(v);
}

export interface VariationSummary {
  approvedPre: number;
  approvedPost: number;
  approvedNet: number;
  approvedCount: number;
  pendingValue: number;
  pendingCount: number;
  base: number;
  current: number;
  frozen: number;
}

export function summarise(list: Variation[]): VariationSummary {
  const sum = (xs: Variation[]) => xs.reduce((s, v) => s + v.costOMR, 0);
  const ok = list.filter((v) => v.status === 'Approved');
  const pre = ok.filter((v) => v.phase === 'Pre-freeze');
  const post = ok.filter((v) => v.phase === 'Post-freeze');
  const pend = list.filter((v) => v.status === 'Pending');
  return {
    approvedPre: sum(pre),
    approvedPost: sum(post),
    approvedNet: sum(ok),
    approvedCount: ok.length,
    pendingValue: sum(pend),
    pendingCount: pend.length,
    base: BASE_ESTIMATE,
    frozen: BASE_ESTIMATE + sum(pre),
    current: BASE_ESTIMATE + sum(ok),
  };
}

// Duplicate detection (S9) lives in duplicateService.ts (on-device model).

// ---------------------------------------------------------------- challenge / defer / divert
let challenged: Record<string, 'Keep' | 'Defer'> = {};

export const getChallenges = () => delay({ ...challenged }, 80);

export async function decideChallenge(jobId: string, decision: 'Keep' | 'Defer'): Promise<void> {
  challenged = { ...challenged, [jobId]: decision };
  return delay(undefined, 120);
}

// ---------------------------------------------------------------- gate configuration (S3 / S5)
export interface GateConfig {
  gate: number;
  name: string;
  approver: string;
  criteria: string;
  slaHours: number;
  enabled: boolean;
  optional?: boolean;
}

let gateConfig: GateConfig[] = [
  { gate: 1, name: 'Area Operations Focal Point', approver: 'F. Al-Amri', criteria: 'Screen TA-dependent vs non-TA work; divert routine maintenance', slaHours: 48, enabled: true },
  { gate: 2, name: 'Head of Area Operations', approver: 'H. Al-Kindi', criteria: 'Risk assessment, risk ranking and operational criticality', slaHours: 72, enabled: true },
  { gate: 3, name: 'VP Asset Operations', approver: 'N. Al-Busaidi', criteria: 'Overall budget implications and strategic priorities', slaHours: 72, enabled: true },
  { gate: 4, name: 'Capital Projects Committee', approver: 'CPC Secretary', criteria: 'Items above OMR 250,000 (optional gate)', slaHours: 120, enabled: false, optional: true },
];

export const getGateConfig = () => delay(gateConfig.map((g) => ({ ...g })), 80);
export async function setGateEnabled(gate: number, enabled: boolean): Promise<GateConfig[]> {
  gateConfig = gateConfig.map((g) => (g.gate === gate ? { ...g, enabled } : g));
  return delay(gateConfig.map((g) => ({ ...g })), 100);
}
export async function setGateSla(gate: number, slaHours: number): Promise<GateConfig[]> {
  gateConfig = gateConfig.map((g) => (g.gate === gate ? { ...g, slaHours } : g));
  return delay(gateConfig.map((g) => ({ ...g })), 100);
}

// ---------------------------------------------------------------- freeze certificate (S8)
let revision = 'A';
let revisedAt = '2026-06-12T10:20:00';

export const getCertificate = () => delay({ revision, revisedAt }, 100);

export async function reissueCertificate(): Promise<{ revision: string; revisedAt: string; pushed: number }> {
  revision = String.fromCharCode(revision.charCodeAt(0) + 1);
  revisedAt = '2026-08-16T08:30:00';
  const jobs = await getJobs();
  const frozen = jobs.filter((j) => j.inBaseline || j.status === 'approved');
  pushSapStatus('Maintenance Order status', `${frozen.length} orders`, `Scope freeze revision ${revision}: user status SFRZ set on ${frozen.length} orders`);
  frozen.forEach((j) => {
    const order = sapWoForJob(j);
    if (order) sendToSystems({ type: 'tp.order.upsert', order: { MaintenanceOrder: order, UserStatusText: 'SFRZ' }, note: `Scope freeze certificate revision ${revision} issued in TURNPOINT` });
  });
  return delay({ revision, revisedAt, pushed: frozen.length }, 400);
}
