import { jobs } from '../mocks/jobsMock';
import type { Discipline, Job } from '../types';
import { DISCIPLINE_CONTRACTOR, PEOPLE } from '../mocks/master';
import { delay } from './_util';
import { logMessage, pushSapStatus, sendToSystems } from './integrationService';
import { sapWoForJob } from '../mocks/sapKeys';
import { unitOf } from '../mocks/master';
import type { SapItem } from '../types/execution';

let store: Job[] = [...jobs];
let seq = 0;

export async function getJobs(): Promise<Job[]> {
  return delay([...store]);
}

export const GATE_ROLES = [
  { gate: 1 as const, approver: PEOPLE.areaFocal, role: 'Area Ops Focal Point' },
  { gate: 2 as const, approver: PEOPLE.headAreaOps, role: 'Head of Area Ops' },
  { gate: 3 as const, approver: PEOPLE.vpAssetOps, role: 'VP Asset Ops' },
];

export function freshApprovals(): Job['approvals'] {
  return GATE_ROLES.map((g) => ({ ...g, status: 'pending' as const }));
}

function nextJobId(): string {
  seq += 1;
  return `J-${2300 + seq}`;
}

export interface NewJobInput {
  desc: string;
  discipline: Discipline;
  area: string;
  tag: string;
  requestedBy: string;
  costOMR: number;
  manhours: number;
  likelihood: Job['likelihood'];
  consequence: Job['consequence'];
  source: Job['source'];
  sapRef?: string;
  startDay?: number;
  durationDays?: number;
  plannedHours?: number;
  aiDuration?: Job['aiDuration'];
}

function buildJob(input: NewJobInput): Job {
  const job: Job = {
    id: nextJobId(),
    desc: input.desc,
    discipline: input.discipline,
    requestedBy: input.requestedBy,
    costOMR: input.costOMR,
    gate: 1,
    status: 'pending',
    phase: 'scoping',
    approvals: freshApprovals(),
    createdAt: new Date().toISOString().slice(0, 10),
    area: input.area,
    tag: input.tag,
    manhours: input.manhours,
    likelihood: input.likelihood,
    consequence: input.consequence,
    source: input.source,
    taClass: 'TA',
    sapRef: input.sapRef,
    startDay: input.startDay ?? 20,
    durationDays: input.durationDays ?? (input.plannedHours ? Math.max(1, Math.ceil(input.plannedHours / 24)) : Math.max(1, Math.round(input.manhours / 160))),
    inBaseline: false,
    contractor: DISCIPLINE_CONTRACTOR[input.discipline],
    plannedHours: input.plannedHours,
    aiDuration: input.aiDuration,
  };
  store = [job, ...store];
  return job;
}

/** Create a scope item at Gate 1. Used by the manual form. */
export async function createJob(input: NewJobInput): Promise<Job> {
  return delay(buildJob(input));
}

/** Create many scope items in one round trip (bulk upload, Excel import). */
export async function createJobs(inputs: NewJobInput[]): Promise<Job[]> {
  const jobs = inputs.map(buildJob);
  return delay(jobs, 400);
}

/** Import selected SAP notifications / work orders as scope items (checklist S3, SAP pull). */
export async function createJobsFromSap(items: SapItem[]): Promise<Job[]> {
  const created: Job[] = [];
  for (const it of items) {
    const job = buildJob({
      desc: it.description,
      discipline: it.discipline,
      area: it.area,
      tag: it.equipment,
      requestedBy: it.reportedBy,
      costOMR: it.estCostOMR,
      manhours: it.manhours,
      likelihood: it.priority <= 1 ? 4 : it.priority === 2 ? 3 : 2,
      consequence: it.priority <= 2 ? 4 : 3,
      source: it.kind === 'Work Order' ? 'SAP work order' : 'SAP notification',
      sapRef: it.number,
    });
    created.push(job);
  }
  return delay(created, 500);
}

export async function approveGate(jobId: string, by = 'You'): Promise<Job> {
  store = store.map((j) => {
    if (j.id !== jobId) return j;
    const approvals = j.approvals.map((a) =>
      a.gate === j.gate ? { ...a, status: 'approved' as const, approver: by, actedAt: new Date().toISOString() } : a
    );
    const nextGate = (j.gate < 3 ? j.gate + 1 : j.gate) as 1 | 2 | 3;
    const fullyApproved = j.gate === 3;
    return { ...j, approvals, gate: nextGate, status: fullyApproved ? 'approved' : 'pending' };
  });
  const updated = store.find((j) => j.id === jobId)!;
  if (updated.status === 'approved') {
    const order = sapWoForJob(updated)!;
    pushSapStatus('Maintenance Order status', order, `${updated.id} approved at Gate 3, order released`);
    sendToSystems({
      type: 'tp.order.upsert',
      order: {
        MaintenanceOrder: order,
        MaintenanceOrderDesc: updated.desc,
        Equipment: updated.tag,
        FunctionalLocation: `SOH-${unitOf(updated.area)}-${updated.tag.replace(/[^A-Z0-9]/gi, '')}`,
        SystemStatusText: 'REL',
        UserStatusText: 'APRV',
        PlannedCostOMR: updated.costOMR,
        MaintenanceNotification: updated.source === 'SAP notification' ? updated.sapRef : undefined,
        ZZ_TurnpointRef: updated.id,
      },
      note: `${updated.id} approved at Gate 3 (VP Asset Ops) in TURNPOINT: order released`,
    });
  }
  return delay(updated);
}

export async function rejectGate(jobId: string, by = 'You', comment = 'Rejected at gate review'): Promise<Job> {
  store = store.map((j) => {
    if (j.id !== jobId) return j;
    const approvals = j.approvals.map((a) =>
      a.gate === j.gate ? { ...a, status: 'rejected' as const, approver: by, actedAt: new Date().toISOString(), comment } : a
    );
    return { ...j, approvals, status: 'rejected' as const };
  });
  return delay(store.find((j) => j.id === jobId)!);
}

/** Gate 1 screening: divert a job to routine maintenance (Non-TA) or keep it as TA-dependent work. */
export async function setTaClass(jobId: string, taClass: Job['taClass']): Promise<Job> {
  store = store.map((j) => (j.id === jobId ? { ...j, taClass } : j));
  return delay(store.find((j) => j.id === jobId)!);
}

export async function mergeDuplicate(keepId: string, dropId: string): Promise<Job> {
  const drop = store.find((j) => j.id === dropId);
  store = store
    .map((j) => (j.id === keepId && drop ? { ...j, costOMR: Math.max(j.costOMR, drop.costOMR), manhours: j.manhours + Math.round(drop.manhours * 0.2) } : j))
    .filter((j) => j.id !== dropId);
  return delay(store.find((j) => j.id === keepId)!);
}

/** Field values changed in another system of record (e.g. a planned cost revised in SAP). */
export async function patchJob(jobId: string, patch: Partial<Pick<Job, 'costOMR' | 'manhours' | 'desc'>>): Promise<Job> {
  store = store.map((j) => (j.id === jobId ? { ...j, ...patch } : j));
  return delay(store.find((j) => j.id === jobId)!);
}

export async function deleteJob(jobId: string): Promise<void> {
  store = store.filter((j) => j.id !== jobId);
  return delay(undefined);
}

/** Defer a job to the next TA (e.g. result of risk-based scope optimisation or a scope challenge). */
export async function deferJob(jobId: string, comment = 'Deferred to next turnaround'): Promise<Job> {
  store = store.map((j) => {
    if (j.id !== jobId) return j;
    const approvals = j.approvals.map((a) => (a.gate === j.gate ? { ...a, status: 'rejected' as const, actedAt: new Date().toISOString(), comment } : a));
    return { ...j, approvals, status: 'rejected' as const };
  });
  return delay(store.find((j) => j.id === jobId)!);
}

/** Gate 1 screening outcome: not TA-dependent, divert to routine maintenance. */
export async function divertToMaintenance(jobId: string): Promise<Job> {
  store = store.map((j) => {
    if (j.id !== jobId) return j;
    const approvals = j.approvals.map((a) => (a.gate === 1 ? { ...a, status: 'rejected' as const, actedAt: new Date().toISOString(), comment: 'Diverted to routine maintenance' } : a));
    return { ...j, approvals, taClass: 'Non-TA' as const, status: 'rejected' as const };
  });
  const job = store.find((j) => j.id === jobId)!;
  if (job.sapRef) logMessage({ system: 'SAP', direction: 'Outbound', object: 'Maintenance Notification', key: job.sapRef, status: 'Delivered', latencyMs: 340, channel: 'OData V2 / OAuth 2.0 + mTLS', note: 'Returned to the routine maintenance backlog (not TA-dependent)' });
  return delay(job);
}
