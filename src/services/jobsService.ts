import { openingJobs } from '../mocks/jobsMock';
import type { Discipline, Job } from '../types';
import { DISCIPLINE_CONTRACTOR, PEOPLE } from '../mocks/master';
import { delay } from './_util';
import { demoStamp } from './demoClock';
import { expectAck, logMessage, pushSapStatus, sendToSystems } from './integrationService';
import { sapWoForJob } from '../mocks/sapKeys';
import { unitOf } from '../mocks/master';
import type { SapItem } from '../types/execution';

// The live scope starts PRE-FREEZE (see openingJobs): eight items approved, the rest waiting at gate 1, 2 or 3.
let store: Job[] = openingJobs();
let seq = 0;
/** After the scope freeze a new item is not a plain gate-1 request: it enters as a variation awaiting approval. */
let postFreeze = false;

interface JobHooks {
  /** Called synchronously for every item created after the freeze, so the scope service can raise its variation. */
  onCreatedPostFreeze?: (job: Job) => void;
}
let hooks: JobHooks = {};
export function registerJobHooks(h: JobHooks) {
  hooks = h;
}
export function setPostFreezeMode(v: boolean) {
  postFreeze = v;
}

/** Back to the opening (pre-freeze) worklist. */
export function resetJobs() {
  store = openingJobs();
  seq = 0;
  postFreeze = false;
}

/** Synchronous read for services that already hold the data (the scope service computes readiness from it). */
export const peekJobs = (): Job[] => store;

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
    createdAt: demoStamp().slice(0, 10),
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
  if (postFreeze) {
    // screened on arrival; the only thing missing is the variation approval (change control), which acts as the last gate
    job.gate = 3;
    job.approvals = job.approvals.map((a) => (a.gate < 3 ? { ...a, status: 'approved' as const, actedAt: demoStamp(), comment: 'Screened on raise (post-freeze)' } : a));
  }
  store = [job, ...store];
  if (postFreeze) hooks.onCreatedPostFreeze?.(job);
  return job;
}

/**
 * Tell SAP about scope items just created in OQ: it opens one maintenance order per item and acknowledges the batch.
 * Items that came from SAP already exist there, so they are left out.
 */
function announceToSap(created: Job[], channel: string) {
  const mine = created.filter((j) => !j.source.startsWith('SAP'));
  if (!mine.length) return;
  const batch = `B${Date.now().toString(36).toUpperCase()}${mine.length}`;
  const items = mine.map((j) => ({ ref: j.id, desc: j.desc, tag: j.tag, area: j.area, discipline: j.discipline, costOMR: j.costOMR, manhours: j.manhours, likelihood: j.likelihood, consequence: j.consequence, order: sapWoForJob(j)! }));
  logMessage({
    system: 'SAP',
    direction: 'Outbound',
    object: 'Maintenance Order',
    key: items.length === 1 ? items[0].order : `${items.length} orders`,
    status: 'Delivered',
    latencyMs: 310 + items.length * 6,
    channel: 'OData V2 (API_MAINTENANCEORDER) via SAP Integration Suite',
    note: `${channel}: ${items.length} new scope item${items.length === 1 ? '' : 's'} sent to SAP (${items.map((i) => `${i.ref} to order ${i.order}`).slice(0, 3).join(', ')}${items.length > 3 ? ' ...' : ''}). Waiting for SAP to confirm.`,
    request: JSON.stringify({ batch, channel, d: { results: items.slice(0, 5).map((i) => ({ MaintenanceOrder: i.order, MaintenanceOrderDesc: i.desc, Equipment: i.tag, PlannedCostOMR: i.costOMR, ZZ_TurnpointRef: i.ref })) } }, null, 2),
  });
  expectAck(batch, items.length, channel);
  sendToSystems({ type: 'tp.scope.created', batch, channel, items });
}

/** Create a scope item at Gate 1. Used by the manual form. */
export async function createJob(input: NewJobInput): Promise<Job> {
  const job = buildJob(input);
  announceToSap([job], 'Manual entry');
  return delay(job);
}

/** Create many scope items in one round trip (bulk upload, Excel import). */
export async function createJobs(inputs: NewJobInput[]): Promise<Job[]> {
  const jobs = inputs.map(buildJob);
  const channel = inputs[0]?.source === 'Excel import' ? 'Excel import' : inputs[0]?.source === 'Bulk upload' ? 'Bulk upload' : 'Manual entry';
  announceToSap(jobs, channel);
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

function pushReleased(updated: Job) {
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
    note: `${updated.id} approved at Gate 3 (VP Asset Ops) in OQ: order released`,
  });
}

/** A gate 1 or gate 2 approval in OQ moves the SAP order's user status (GT1, GT2), so SAP always shows where the item stands. */
function pushGate(job: Job, gate: 1 | 2) {
  const order = sapWoForJob(job);
  if (!order) return;
  sendToSystems({
    type: 'tp.order.upsert',
    order: { MaintenanceOrder: order, MaintenanceOrderDesc: job.desc, Equipment: job.tag, PlannedCostOMR: job.costOMR, UserStatusText: gate === 1 ? 'GT1' : 'GT2', ZZ_TurnpointRef: job.id },
    note: `${job.id} cleared gate ${gate} (${GATE_ROLES[gate - 1].role}) in OQ`,
  });
}

/** Approve the gate an item is waiting at. Synchronous core shared by the single and the bulk path. */
function approveOne(jobId: string, by: string): Job | undefined {
  const cur = store.find((j) => j.id === jobId);
  if (!cur || cur.status !== 'pending') return cur;
  const approvals = cur.approvals.map((a) => (a.gate === cur.gate ? { ...a, status: 'approved' as const, approver: by, actedAt: demoStamp() } : a));
  const nextGate = (cur.gate < 3 ? cur.gate + 1 : cur.gate) as 1 | 2 | 3;
  const fullyApproved = cur.gate === 3;
  const updated: Job = { ...cur, approvals, gate: nextGate, status: fullyApproved ? 'approved' : 'pending' };
  store = store.map((j) => (j.id === jobId ? updated : j));
  if (updated.status === 'approved') pushReleased(updated);
  else pushGate(updated, cur.gate as 1 | 2);
  return updated;
}

export async function approveGate(jobId: string, by = 'You'): Promise<Job> {
  const updated = approveOne(jobId, by);
  return delay(updated!);
}

/** Approve the current gate of many items in one round trip ("approve all at this gate"). */
export async function approveMany(jobIds: string[], by = 'You'): Promise<Job[]> {
  const out = jobIds.map((id) => approveOne(id, by)).filter((j): j is Job => Boolean(j));
  const withOrder = out.filter((j) => sapWoForJob(j));
  if (withOrder.length > 1) {
    logMessage({ system: 'SAP', direction: 'Outbound', object: 'Maintenance Order status', key: `${withOrder.length} orders`, status: 'Delivered', latencyMs: 380 + withOrder.length * 8, channel: 'OData V2 $batch (API_MAINTENANCEORDER) via SAP Integration Suite', note: `Bulk approval in OQ: user status updated on ${withOrder.length} SAP orders in one batch` });
    window.dispatchEvent(new CustomEvent('oq:sap-dock', { detail: { open: true } })); // show SAP beside OQ so the updates can be seen arriving
  }
  return delay(out, 350);
}

/** Final approval by change control (a post-freeze variation): every gate is signed in one decision. */
export function approveByVariation(jobId: string, by: string, comment: string): Job | undefined {
  const cur = store.find((j) => j.id === jobId);
  if (!cur) return undefined;
  const approvals = cur.approvals.map((a) => (a.status === 'approved' ? a : { ...a, status: 'approved' as const, approver: by, actedAt: demoStamp(), comment }));
  const updated: Job = { ...cur, approvals, gate: 3, status: 'approved' };
  store = store.map((j) => (j.id === jobId ? updated : j));
  return updated;
}

/** Items that were approved when the scope froze are the baseline; clearing it puts the scope back to pre-freeze. */
export function setBaseline(ids: string[] | null) {
  const set = new Set(ids ?? []);
  store = store.map((j) => (j.inBaseline === set.has(j.id) ? j : { ...j, inBaseline: set.has(j.id) }));
}

export async function rejectGate(jobId: string, by = 'You', comment = 'Rejected at gate review'): Promise<Job> {
  store = store.map((j) => {
    if (j.id !== jobId) return j;
    const approvals = j.approvals.map((a) =>
      a.gate === j.gate ? { ...a, status: 'rejected' as const, approver: by, actedAt: demoStamp(), comment } : a
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
    const approvals = j.approvals.map((a) => (a.gate === j.gate ? { ...a, status: 'rejected' as const, actedAt: demoStamp(), comment } : a));
    return { ...j, approvals, status: 'rejected' as const };
  });
  return delay(store.find((j) => j.id === jobId)!);
}

/** Gate 1 screening outcome: not TA-dependent, divert to routine maintenance. */
export async function divertToMaintenance(jobId: string): Promise<Job> {
  store = store.map((j) => {
    if (j.id !== jobId) return j;
    const approvals = j.approvals.map((a) => (a.gate === 1 ? { ...a, status: 'rejected' as const, actedAt: demoStamp(), comment: 'Diverted to routine maintenance' } : a));
    return { ...j, approvals, taClass: 'Non-TA' as const, status: 'rejected' as const };
  });
  const job = store.find((j) => j.id === jobId)!;
  if (job.sapRef) logMessage({ system: 'SAP', direction: 'Outbound', object: 'Maintenance Notification', key: job.sapRef, status: 'Delivered', latencyMs: 340, channel: 'OData V2 / OAuth 2.0 + mTLS', note: 'Returned to the routine maintenance backlog (not TA-dependent)' });
  return delay(job);
}

/** Divert many Non-TA items at once (gate 1 bulk approve). */
export async function divertMany(jobIds: string[]): Promise<void> {
  for (const id of jobIds) await divertToMaintenance(id);
}
