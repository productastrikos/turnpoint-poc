// Scope lifecycle: PRE-FREEZE (open worklist, three gates) -> FROZEN (baseline + signed certificate Rev A) -> POST-FREEZE
// (every change is a variation; each approved variation re-issues the certificate as Rev B, C ...).
// All state is in memory and resettable. Nothing here talks to a real SAP: the status pushes go to the stand-in console.
import {
  BASE_ESTIMATE,
  BUDGET_ENVELOPE,
  CERT_NUMBER,
  OPENING_VARIATIONS,
  SIGNATORIES,
  SIM_REQUESTS,
  VARIATION_HISTORY,
  variations as variationMirror,
  type SimRequest,
  type Variation,
  type VariationStatus,
} from '../mocks/scopeMock';
import { delay } from './_util';
import { demoDate, demoStamp, setClockPostFreeze } from './demoClock';
import {
  approveByVariation,
  approveMany,
  deferJob,
  divertMany,
  patchJob,
  peekJobs,
  createJob,
  registerJobHooks,
  resetJobs,
  setBaseline,
  setPostFreezeMode,
} from './jobsService';
import { pushSapStatus, sendToSystems } from './integrationService';
import { getScopeFindings, mergeFinding } from './duplicateService';
import { estimateNow } from './estimateService';
import { sapWoForJob } from '../mocks/sapKeys';
import { cpImpactDays, completeness, missingFields, riskScore } from './scopeModel';
import { deriveApprover } from './scfRules';
import { emitData } from '../app/dataEvents';
import { OMR_PER_USD, PEOPLE, unitOf } from '../mocks/master';
import type { Discipline, Job } from '../types';

// ================================================================ types

export type Stage = 'pre-freeze' | 'frozen';

export interface Signature {
  role: string;
  name: string;
  at: string;
  hash: string;
  /** Carried over from an earlier revision (the gate approvals do not change when a variation is approved). */
  carried?: boolean;
}

export interface BaselineItem {
  id: string;
  desc: string;
  tag: string;
  discipline: string;
  area: string;
  costOMR: number;
  manhours: number;
  risk: number;
}

export interface Baseline {
  items: BaselineItem[];
  costOMR: number;
  manhours: number;
  estimateOMR: number;
  frozenAt: string;
}

export interface DiffItem {
  id: string;
  desc: string;
  kind: 'added' | 'removed' | 'changed';
  costDelta: number;
  hoursDelta: number;
  before?: { costOMR: number; manhours: number };
  after?: { costOMR: number; manhours: number };
  variation?: string;
}

export interface ScopeDiff {
  added: DiffItem[];
  removed: DiffItem[];
  changed: DiffItem[];
  /** Net movement of the item list against the baseline. */
  totals: { items: number; costOMR: number; manhours: number };
}

export interface Certificate {
  revision: string;
  number: string;
  issuedAt: string;
  reason: string;
  variationIds: string[];
  signatures: Signature[];
  items: number;
  costOMR: number;
  manhours: number;
  estimateOMR: number;
  diff: ScopeDiff['totals'] & { added: number; removed: number; changed: number };
  pushedOrders: number;
  hash: string;
}

export interface ScopeState {
  version: number;
  stage: Stage;
  /** "Pre-freeze (open)", "Frozen (Rev A)" or "Post-freeze (Rev B)". */
  label: string;
  revision: string | null;
  baseline?: Baseline;
  certs: Certificate[];
  variations: Variation[];
  /** Pending variation per scope item, for the worklist chips. */
  openVarByJob: Record<string, Variation>;
}

// ================================================================ state

let stage: Stage = 'pre-freeze';
let baseline: Baseline | undefined;
let certs: Certificate[] = [];
let vars: Variation[] = OPENING_VARIATIONS.map((v) => ({ ...v }));
let varSeq = 130;
let pendingMeta: SimRequest | null = null;
let version = 0;
let snapshot: ScopeState = build();
const listeners = new Set<() => void>();

function labelOf(): string {
  if (stage === 'pre-freeze') return 'Pre-freeze (open)';
  return certs.length > 1 ? `Post-freeze (Rev ${certs[certs.length - 1].revision})` : 'Frozen (Rev A)';
}

function build(): ScopeState {
  const openVarByJob: Record<string, Variation> = {};
  vars.forEach((v) => {
    if (v.status === 'Pending' && v.jobId) openVarByJob[v.jobId] = v;
  });
  return { version, stage, label: labelOf(), revision: certs.length ? certs[certs.length - 1].revision : null, baseline, certs, variations: vars, openVarByJob };
}

function emit() {
  version += 1;
  // read-only consumers that import the seed array see the live list
  variationMirror.splice(0, variationMirror.length, ...vars.map((v) => ({ ...v })));
  snapshot = build();
  listeners.forEach((l) => l());
  emitData('scope');
}

export const getScopeState = (): ScopeState => snapshot;
export function subscribeScope(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const money = (n: number) => `${n >= 0 ? '+' : '-'}OMR ${Math.abs(n).toLocaleString()}`;
const hours = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n).toLocaleString()} h`;

/** Short, stable-looking digest for signatures and certificates (not cryptographic: this is a simulation). */
function hash8(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const nameOf = (role: string) => SIGNATORIES.find((s) => s.role === role)?.name ?? role;
const GATE_APPROVER_ROLE = ['Area Operations Focal Point', 'Head of Area Operations', 'VP Asset Operations'];

// ================================================================ variations

export const listVariations = () => delay(vars.map((v) => ({ ...v })), 120);

interface VariationInput {
  title: string;
  ref: string;
  type: Variation['type'];
  source: Variation['source'];
  originator: string;
  costOMR: number;
  manhours: number;
  reason?: string;
  cpDays?: number;
  cpNote?: string;
  jobId?: string;
}

function routeApprover(costOMR: number, cpDays: number): string {
  if (stage === 'pre-freeze') return 'Head of Area Operations';
  return deriveApprover(Math.abs(costOMR) / OMR_PER_USD, cpDays >= 3);
}

function addVariation(input: VariationInput): Variation {
  const cpDays = input.cpDays ?? 0;
  const v: Variation = {
    ...input,
    id: `VAR-${varSeq++}`,
    phase: stage === 'pre-freeze' ? 'Pre-freeze' : 'Post-freeze',
    status: 'Pending',
    raisedAt: demoDate(),
    cpDays,
    approver: routeApprover(input.costOMR, cpDays),
  };
  vars = [v, ...vars];
  emit();
  return v;
}

/** Raise a variation by hand (the dialog on the Variations tab). Before the freeze it is a pre-freeze scope movement. */
export async function createVariation(input: VariationInput): Promise<Variation> {
  return delay(addVariation(input), 150);
}

export interface DecisionResult {
  variation: Variation;
  certificate?: Certificate;
  /** Sentence naming what changed, for the toast. */
  effect: string;
}

export async function decideVariation(id: string, status: Exclude<VariationStatus, 'Pending'>, by = 'You (Demo User)'): Promise<DecisionResult> {
  const cur = vars.find((v) => v.id === id);
  if (!cur) throw new Error(`Unknown variation ${id}`);
  const role = cur.approver ?? 'Head of Area Operations';
  const decidedBy = `${nameOf(role)} (${role}), recorded by ${by}`;
  const decidedAt = demoStamp();
  const post = cur.phase === 'Post-freeze';
  let effect = '';
  let jobsChanged = false;

  if (status === 'Rejected') {
    if (cur.type === 'Addition' && cur.jobId) {
      await deferJob(cur.jobId, `Variation ${cur.id} rejected`);
      jobsChanged = true;
    }
    vars = vars.map((v) => (v.id === id ? { ...v, status, decidedBy, decidedAt } : v));
    effect = `${cur.id} rejected. ${cur.type === 'Addition' && cur.jobId ? `${cur.jobId} stays out of the scope. ` : ''}The baseline is unchanged.`;
    emit();
    if (jobsChanged) emitData('scope');
    return delay({ variation: vars.find((v) => v.id === id)!, effect }, 200);
  }

  // ---- approved
  let touched: Job | undefined;
  if (post && cur.jobId) {
    const job = peekJobs().find((j) => j.id === cur.jobId);
    if (cur.type === 'Addition') {
      touched = approveByVariation(cur.jobId, role, `Approved through variation ${cur.id}`);
      effect = `${cur.jobId} is now in scope`;
    } else if (cur.type === 'Change' && job) {
      touched = await patchJob(cur.jobId, { costOMR: Math.max(0, job.costOMR + cur.costOMR), manhours: Math.max(0, job.manhours + cur.manhours) });
      effect = `${cur.jobId} updated to OMR ${touched.costOMR.toLocaleString()} and ${touched.manhours.toLocaleString()} h`;
    } else if (cur.type === 'Deletion' && job) {
      touched = await deferJob(cur.jobId, `Removed from scope by variation ${cur.id}`);
      effect = `${cur.jobId} removed from scope`;
    }
    jobsChanged = true;
  } else {
    effect = `${money(cur.costOMR)} is now in the programme estimate`;
  }

  vars = vars.map((v) => (v.id === id ? { ...v, status, decidedBy, decidedAt } : v));
  let certificate: Certificate | undefined;
  if (post) {
    certificate = await issueRevision(`Variation ${cur.id}: ${cur.title}`, [cur.id], touched);
    vars = vars.map((v) => (v.id === id ? { ...v, revision: certificate!.revision } : v));
  } else {
    pushSapStatus('Maintenance Order status', cur.ref, `${cur.id} approved before the freeze: programme estimate updated`);
  }
  emit();
  if (jobsChanged) emitData('scope');
  return delay({ variation: vars.find((v) => v.id === id)!, certificate, effect }, 250);
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
  // ---- pre-freeze vs post-freeze
  pendingPre: number;
  pendingPost: number;
  pendingPreCount: number;
  pendingPostCount: number;
  approvedPreCount: number;
  approvedPostCount: number;
  rejectedCount: number;
  /** Scope movement before the freeze as a share of the base estimate. */
  preGrowthPct: number;
  /** Scope creep since the freeze as a share of the frozen estimate. */
  creepPct: number;
  /** Everything against the base estimate. */
  totalGrowthPct: number;
  cpDaysApproved: number;
}

export function summarise(list: Variation[]): VariationSummary {
  const sum = (xs: Variation[]) => xs.reduce((s, v) => s + v.costOMR, 0);
  const ok = list.filter((v) => v.status === 'Approved');
  const pre = ok.filter((v) => v.phase === 'Pre-freeze');
  const post = ok.filter((v) => v.phase === 'Post-freeze');
  const pend = list.filter((v) => v.status === 'Pending');
  const pendPre = pend.filter((v) => v.phase === 'Pre-freeze');
  const pendPost = pend.filter((v) => v.phase === 'Post-freeze');
  const frozen = BASE_ESTIMATE + sum(pre);
  return {
    approvedPre: sum(pre),
    approvedPost: sum(post),
    approvedNet: sum(ok),
    approvedCount: ok.length,
    pendingValue: sum(pend),
    pendingCount: pend.length,
    base: BASE_ESTIMATE,
    frozen,
    current: BASE_ESTIMATE + sum(ok),
    pendingPre: sum(pendPre),
    pendingPost: sum(pendPost),
    pendingPreCount: pendPre.length,
    pendingPostCount: pendPost.length,
    approvedPreCount: pre.length,
    approvedPostCount: post.length,
    rejectedCount: list.filter((v) => v.status === 'Rejected').length,
    preGrowthPct: (sum(pre) / BASE_ESTIMATE) * 100,
    creepPct: (sum(post) / frozen) * 100,
    totalGrowthPct: (sum(ok) / BASE_ESTIMATE) * 100,
    cpDaysApproved: post.reduce((s, v) => s + (v.cpDays ?? 0), 0),
  };
}

// Duplicate detection (S9) lives in duplicateService.ts (on-device model).

// ================================================================ challenge / defer / divert
let challenged: Record<string, 'Keep' | 'Defer'> = {};

export const getChallenges = () => delay({ ...challenged }, 80);

export async function decideChallenge(jobId: string, decision: 'Keep' | 'Defer'): Promise<void> {
  challenged = { ...challenged, [jobId]: decision };
  return delay(undefined, 120);
}

// ================================================================ gate configuration (S3 / S5)
export interface GateConfig {
  gate: number;
  name: string;
  approver: string;
  criteria: string;
  slaHours: number;
  enabled: boolean;
  optional?: boolean;
}

const defaultGateConfig = (): GateConfig[] => [
  { gate: 1, name: 'Area Operations Focal Point', approver: 'F. Al-Amri', criteria: 'Screen TA-dependent vs non-TA work; divert routine maintenance', slaHours: 48, enabled: true },
  { gate: 2, name: 'Head of Area Operations', approver: 'H. Al-Kindi', criteria: 'Risk assessment, risk ranking and operational criticality', slaHours: 72, enabled: true },
  { gate: 3, name: 'VP Asset Operations', approver: 'N. Al-Busaidi', criteria: 'Overall budget implications and strategic priorities', slaHours: 72, enabled: true },
  { gate: 4, name: 'Capital Projects Committee', approver: 'CPC Secretary', criteria: 'Items above OMR 250,000 (optional gate)', slaHours: 120, enabled: false, optional: true },
];
let gateConfig = defaultGateConfig();

export const getGateConfig = () => delay(gateConfig.map((g) => ({ ...g })), 80);
export async function setGateEnabled(gate: number, enabled: boolean): Promise<GateConfig[]> {
  gateConfig = gateConfig.map((g) => (g.gate === gate ? { ...g, enabled } : g));
  return delay(gateConfig.map((g) => ({ ...g })), 100);
}
export async function setGateSla(gate: number, slaHours: number): Promise<GateConfig[]> {
  gateConfig = gateConfig.map((g) => (g.gate === gate ? { ...g, slaHours } : g));
  return delay(gateConfig.map((g) => ({ ...g })), 100);
}

// ================================================================ baseline diff

const inScope = (j: Job) => j.status === 'approved' && j.taClass === 'TA';

/** Baseline against the current approved list: what was added, removed or changed since the freeze. */
export function computeDiff(jobs: Job[], base: Baseline | undefined, list: Variation[] = vars): ScopeDiff {
  const empty: ScopeDiff = { added: [], removed: [], changed: [], totals: { items: 0, costOMR: 0, manhours: 0 } };
  if (!base) return empty;
  const baseById = new Map(base.items.map((b) => [b.id, b]));
  const now = jobs.filter(inScope);
  const nowById = new Map(now.map((j) => [j.id, j]));
  const varFor = (id: string) => list.find((v) => v.jobId === id && v.status === 'Approved')?.id;
  const added: DiffItem[] = now
    .filter((j) => !baseById.has(j.id))
    .map((j) => ({ id: j.id, desc: j.desc, kind: 'added' as const, costDelta: j.costOMR, hoursDelta: j.manhours, after: { costOMR: j.costOMR, manhours: j.manhours }, variation: varFor(j.id) }));
  const removed: DiffItem[] = base.items
    .filter((b) => !nowById.has(b.id))
    .map((b) => ({ id: b.id, desc: b.desc, kind: 'removed' as const, costDelta: -b.costOMR, hoursDelta: -b.manhours, before: { costOMR: b.costOMR, manhours: b.manhours }, variation: varFor(b.id) }));
  const changed: DiffItem[] = now
    .filter((j) => {
      const b = baseById.get(j.id);
      return b && (b.costOMR !== j.costOMR || b.manhours !== j.manhours);
    })
    .map((j) => {
      const b = baseById.get(j.id)!;
      return { id: j.id, desc: j.desc, kind: 'changed' as const, costDelta: j.costOMR - b.costOMR, hoursDelta: j.manhours - b.manhours, before: { costOMR: b.costOMR, manhours: b.manhours }, after: { costOMR: j.costOMR, manhours: j.manhours }, variation: varFor(j.id) };
    });
  const all = [...added, ...removed, ...changed];
  return { added, removed, changed, totals: { items: added.length - removed.length, costOMR: all.reduce((s, d) => s + d.costDelta, 0), manhours: all.reduce((s, d) => s + d.hoursDelta, 0) } };
}

// ================================================================ readiness to freeze

export interface ReadinessCheck {
  id: 'gates' | 'fields' | 'duplicates' | 'variations' | 'budget';
  label: string;
  ok: boolean;
  detail: string;
  /** What to do about it. */
  fix: string;
}

export interface FreezeReadiness {
  ok: boolean;
  checks: ReadinessCheck[];
  /** One line naming what blocks the freeze. */
  blockers: string;
  projectedEstimate: number;
}

export async function getFreezeReadiness(): Promise<FreezeReadiness> {
  const jobs = peekJobs();
  const live = jobs.filter((j) => j.status !== 'rejected');
  const pending = jobs.filter((j) => j.status === 'pending');
  const at = (g: number) => pending.filter((j) => j.gate === g).length;
  const incomplete = live.filter((j) => completeness(j) < 100);
  const scan = await getScopeFindings();
  const dups = scan.findings.filter((f) => f.kind === 'duplicate');
  const preOpen = vars.filter((v) => v.phase === 'Pre-freeze' && v.status === 'Pending');
  const projected = BASE_ESTIMATE + vars.filter((v) => v.phase === 'Pre-freeze' && v.status !== 'Rejected').reduce((s, v) => s + v.costOMR, 0);

  const checks: ReadinessCheck[] = [
    {
      id: 'gates',
      label: 'All three approval gates cleared',
      ok: pending.length === 0,
      detail: pending.length ? `${pending.length} item${pending.length === 1 ? '' : 's'} still waiting: Gate 1 ${at(1)}, Gate 2 ${at(2)}, Gate 3 ${at(3)}` : `All ${live.length} active items have cleared gates 1, 2 and 3`,
      fix: 'Approve all at each gate, or use Fast-forward demo',
    },
    {
      id: 'fields',
      label: 'Mandatory fields complete',
      ok: incomplete.length === 0,
      detail: incomplete.length ? `${incomplete.map((j) => `${j.id} (${missingFields(j).join(', ')})`).slice(0, 2).join('; ')}${incomplete.length > 2 ? ` and ${incomplete.length - 2} more` : ''}` : 'Every active item has description, tag, estimate, man-hours, risk and originator',
      fix: 'Use the AI budget estimate on the item without a cost',
    },
    {
      id: 'duplicates',
      label: 'No open duplicate scope',
      ok: dups.length === 0,
      detail: dups.length ? `${dups.length} suspected duplicate pair${dups.length === 1 ? '' : 's'} (${dups.slice(0, 2).map((d) => `${d.keep.id} / ${d.drop.id}`).join(', ')})` : 'No duplicate pairs left in the worklist',
      fix: 'Merge or dismiss them in the duplicate panel on the Worklist tab',
    },
    {
      id: 'variations',
      label: 'Pre-freeze variations decided',
      ok: preOpen.length === 0,
      detail: preOpen.length ? `${preOpen.length} scope movement${preOpen.length === 1 ? '' : 's'} raised before the freeze are still pending (${money(preOpen.reduce((s, v) => s + v.costOMR, 0))})` : 'Every variation raised before the freeze has been decided',
      fix: 'Approve or reject them on the Variations tab',
    },
    {
      id: 'budget',
      label: 'Budget within the approved envelope',
      ok: projected <= BUDGET_ENVELOPE,
      detail: `Projected estimate OMR ${(projected / 1e6).toFixed(2)}M against an envelope of OMR ${(BUDGET_ENVELOPE / 1e6).toFixed(2)}M (${projected <= BUDGET_ENVELOPE ? `headroom OMR ${Math.round((BUDGET_ENVELOPE - projected) / 1000)}K` : `over by OMR ${Math.round((projected - BUDGET_ENVELOPE) / 1000)}K`})`,
      fix: 'Reject or defer a variation to get back under the envelope',
    },
  ];
  const failing = checks.filter((c) => !c.ok);
  return {
    ok: failing.length === 0,
    checks,
    projectedEstimate: projected,
    blockers: failing.length
      ? failing
          .map((c) => (c.id === 'gates' ? `${pending.length} items pending at the gates` : c.id === 'fields' ? `${incomplete.length} with missing fields` : c.id === 'duplicates' ? `${dups.length} open duplicate${dups.length === 1 ? '' : 's'}` : c.id === 'variations' ? `${preOpen.length} variations undecided` : 'over budget envelope'))
          .join(' · ')
      : '',
  };
}

// ================================================================ bulk approvals (demo accelerators)

export interface BulkGateResult {
  approved: number;
  diverted: number;
  held: { id: string; reason: string }[];
}

/** Approve every item waiting at one gate. Non-TA items are diverted at gate 1; suspected duplicates and incomplete items are held back. */
export async function approveAllAtGate(gate: 1 | 2 | 3, by = 'You (Demo User)'): Promise<BulkGateResult> {
  const waiting = peekJobs().filter((j) => j.status === 'pending' && j.gate === gate);
  const scan = await getScopeFindings();
  const dupDrop = new Set(scan.findings.filter((f) => f.kind === 'duplicate').map((f) => f.drop.id));
  const held: BulkGateResult['held'] = [];
  const divert: string[] = [];
  const go: string[] = [];
  for (const j of waiting) {
    if (gate === 1 && j.taClass === 'Non-TA') divert.push(j.id);
    else if (dupDrop.has(j.id)) held.push({ id: j.id, reason: 'suspected duplicate' });
    else if (completeness(j) < 100) held.push({ id: j.id, reason: `missing ${missingFields(j).join(', ').toLowerCase()}` });
    else go.push(j.id);
  }
  if (divert.length) await divertMany(divert);
  if (go.length) await approveMany(go, by);
  emit();
  return { approved: go.length, diverted: divert.length, held };
}

export interface FastForwardResult {
  estimated: number;
  merged: number;
  approved: number;
  diverted: number;
  variationsApproved: number;
}

/** Everything a live demo would take minutes to click through, in a couple of seconds. */
export async function fastForwardDemo(by = 'You (Demo User)'): Promise<FastForwardResult> {
  const out: FastForwardResult = { estimated: 0, merged: 0, approved: 0, diverted: 0, variationsApproved: 0 };
  const approvedBefore = peekJobs().filter((j) => j.status === 'approved').length;
  // 1. items without a budget get the AI estimate
  for (const j of peekJobs().filter((x) => x.status !== 'rejected' && x.costOMR === 0)) {
    const e = estimateNow({ desc: j.desc, discipline: j.discipline, tag: j.tag, area: j.area, manhours: j.manhours, likelihood: j.likelihood, consequence: j.consequence });
    await patchJob(j.id, { costOMR: e.estimateOMR });
    out.estimated += 1;
  }
  // 2. duplicates are merged
  for (let guard = 0; guard < 6; guard++) {
    const f = (await getScopeFindings()).findings.find((x) => x.kind === 'duplicate');
    if (!f) break;
    await mergeFinding(f);
    out.merged += 1;
  }
  // 3. the three gates in order
  for (const g of [1, 2, 3] as const) {
    const r = await approveAllAtGate(g, by);
    out.diverted += r.diverted;
  }
  out.approved = peekJobs().filter((j) => j.status === 'approved').length - approvedBefore;
  // 4. scope movements raised before the freeze
  for (const v of vars.filter((x) => x.phase === 'Pre-freeze' && x.status === 'Pending')) {
    await decideVariation(v.id, 'Approved', by);
    out.variationsApproved += 1;
  }
  emit();
  return out;
}

// ================================================================ freeze + certificate

function signatures(roles: string[], skew = 0): Signature[] {
  return roles.map((role, i) => {
    const at = demoStamp(skew + i);
    const name = nameOf(role);
    return { role, name, at, hash: hash8(`${role}|${name}|${at}|${CERT_NUMBER}`) };
  });
}

function pushFreezeStatus(label: string, jobsToPush: Job[], note: string) {
  pushSapStatus('Maintenance Order status', `${jobsToPush.length} order${jobsToPush.length === 1 ? '' : 's'}`, note);
  jobsToPush.forEach((j) => {
    const order = sapWoForJob(j);
    if (!order) return;
    sendToSystems({
      type: 'tp.order.upsert',
      order: { MaintenanceOrder: order, MaintenanceOrderDesc: j.desc, Equipment: j.tag, FunctionalLocation: `SOH-${unitOf(j.area)}-${j.tag.replace(/[^A-Z0-9]/gi, '')}`, SystemStatusText: 'REL', UserStatusText: 'SFRZ', PlannedCostOMR: j.costOMR, ZZ_TurnpointRef: j.id },
      note: `${label}: user status SFRZ`,
    });
  });
}

const snapshotOf = (j: Job): BaselineItem => ({ id: j.id, desc: j.desc, tag: j.tag, discipline: j.discipline, area: j.area, costOMR: j.costOMR, manhours: j.manhours, risk: riskScore(j) });

export class NotReadyError extends Error {}

/** Freeze the scope: snapshot the baseline, sign and issue certificate Rev A, push SFRZ to SAP. */
export async function freezeScope(): Promise<Certificate> {
  if (stage === 'frozen') throw new Error('The scope is already frozen');
  const ready = await getFreezeReadiness();
  if (!ready.ok) throw new NotReadyError(ready.blockers);
  const jobs = peekJobs().filter(inScope);
  const frozenAt = demoStamp();
  const est = BASE_ESTIMATE + vars.filter((v) => v.status === 'Approved').reduce((s, v) => s + v.costOMR, 0);
  baseline = { items: jobs.map(snapshotOf), costOMR: jobs.reduce((s, j) => s + j.costOMR, 0), manhours: jobs.reduce((s, j) => s + j.manhours, 0), estimateOMR: est, frozenAt };
  setBaseline(jobs.map((j) => j.id));
  const sigs = signatures([...GATE_APPROVER_ROLE, 'TA Event Manager', 'Head of Turnaround Services']);
  const body = `${CERT_NUMBER}|A|${baseline.items.map((i) => `${i.id}:${i.costOMR}:${i.manhours}`).join(',')}`;
  const cert: Certificate = {
    revision: 'A',
    number: CERT_NUMBER,
    issuedAt: sigs[sigs.length - 1].at,
    reason: 'Scope freeze: approved baseline',
    variationIds: [],
    signatures: sigs,
    items: jobs.length,
    costOMR: baseline.costOMR,
    manhours: baseline.manhours,
    estimateOMR: est,
    diff: { items: 0, costOMR: 0, manhours: 0, added: 0, removed: 0, changed: 0 },
    pushedOrders: jobs.length,
    hash: hash8(body),
  };
  certs = [cert];
  stage = 'frozen';
  setClockPostFreeze(true);
  setPostFreezeMode(true);
  pushFreezeStatus('Scope freeze Rev A', jobs, `Scope freeze revision A: user status SFRZ set on ${jobs.length} orders`);
  emit();
  return delay(cert, 200);
}

/** Issue the next certificate revision after an approved post-freeze variation. */
async function issueRevision(reason: string, variationIds: string[], touched?: Job): Promise<Certificate> {
  const prev = certs[certs.length - 1];
  const revision = String.fromCharCode(prev.revision.charCodeAt(0) + 1);
  const jobs = peekJobs();
  const diff = computeDiff(jobs, baseline);
  const now = jobs.filter(inScope);
  const approver = variationIds.length === 1 ? vars.find((v) => v.id === variationIds[0])?.approver : undefined;
  const roles = Array.from(new Set([...(approver ? [approver] : []), 'TA Event Manager', 'Head of Turnaround Services']));
  const fresh = signatures(roles);
  const carried = prev.signatures.filter((s) => GATE_APPROVER_ROLE.includes(s.role)).map((s) => ({ ...s, carried: true }));
  const est = BASE_ESTIMATE + vars.filter((v) => v.status === 'Approved').reduce((s, v) => s + v.costOMR, 0);
  const pushed = touched ? [touched] : [];
  if (touched) {
    if (touched.status === 'approved') pushFreezeStatus(`Scope freeze Rev ${revision}`, pushed, `Scope freeze revision ${revision}: ${reason}. SFRZ set on ${touched.id}`);
    else {
      const order = sapWoForJob(touched);
      pushSapStatus('Maintenance Order status', order ?? touched.id, `Scope freeze revision ${revision}: ${touched.id} removed from the frozen scope (${reason})`);
      if (order) sendToSystems({ type: 'tp.order.upsert', order: { MaintenanceOrder: order, SystemStatusText: 'TECO', UserStatusText: 'DEFR' }, note: `Scope freeze revision ${revision}: removed by variation` });
    }
  } else {
    pushSapStatus('Maintenance Order status', `Rev ${revision}`, `Scope freeze revision ${revision}: ${reason}`);
  }
  const cert: Certificate = {
    revision,
    number: CERT_NUMBER,
    issuedAt: fresh[fresh.length - 1].at,
    reason,
    variationIds,
    signatures: [...carried, ...fresh],
    items: now.length,
    costOMR: now.reduce((s, j) => s + j.costOMR, 0),
    manhours: now.reduce((s, j) => s + j.manhours, 0),
    estimateOMR: est,
    diff: { ...diff.totals, added: diff.added.length, removed: diff.removed.length, changed: diff.changed.length },
    pushedOrders: pushed.length,
    hash: hash8(`${CERT_NUMBER}|${revision}|${now.map((j) => `${j.id}:${j.costOMR}:${j.manhours}`).join(',')}`),
  };
  certs = [...certs, cert];
  return cert;
}

// ================================================================ post-freeze: raising changes

/** Variation for an item that was created after the freeze (called by jobsService for every such item). */
function onCreatedPostFreeze(job: Job) {
  const meta = pendingMeta;
  pendingMeta = null;
  const cp = meta?.cpDays ?? cpImpactDays(job);
  addVariation({
    title: meta?.title ?? `${job.id} ${job.desc}`,
    ref: meta?.ref ?? job.id,
    type: 'Addition',
    source: meta?.source ?? (job.source.startsWith('SAP') ? 'Originator' : 'Originator'),
    originator: meta?.originator ?? job.requestedBy,
    costOMR: job.costOMR,
    manhours: job.manhours,
    reason: meta?.reason ?? 'Raised after the scope freeze',
    cpDays: cp,
    cpNote: meta?.cpNote ?? (cp ? `${job.tag} is on a critical path: about +${cp} day${cp === 1 ? '' : 's'}` : 'Off the critical path: absorbed in float'),
    jobId: job.id,
  });
}
registerJobHooks({ onCreatedPostFreeze });

export async function requestChange(jobId: string, to: { costOMR: number; manhours: number }, reason: string, originator = PEOPLE.planner): Promise<Variation> {
  const job = peekJobs().find((j) => j.id === jobId);
  if (!job) throw new Error(`Unknown item ${jobId}`);
  const cp = cpImpactDays({ ...job, durationDays: Math.max(1, Math.round(job.durationDays * 0.4)) });
  const v = addVariation({
    title: `${job.id} ${job.desc}: change`,
    ref: job.id,
    type: 'Change',
    source: 'Originator',
    originator,
    costOMR: to.costOMR - job.costOMR,
    manhours: to.manhours - job.manhours,
    reason,
    cpDays: cp,
    cpNote: cp ? `${job.tag} is on a critical path: about +${cp} day${cp === 1 ? '' : 's'}` : 'Off the critical path: absorbed in float',
    jobId,
  });
  return delay(v, 150);
}

export async function requestRemoval(jobId: string, reason: string, originator = PEOPLE.planner): Promise<Variation> {
  const job = peekJobs().find((j) => j.id === jobId);
  if (!job) throw new Error(`Unknown item ${jobId}`);
  const v = addVariation({
    title: `${job.id} ${job.desc}: remove from scope`,
    ref: job.id,
    type: 'Deletion',
    source: 'Originator',
    originator,
    costOMR: -job.costOMR,
    manhours: -job.manhours,
    reason,
    cpDays: 0,
    cpNote: 'No critical-path effect expected',
    jobId,
  });
  return delay(v, 150);
}

/**
 * Take an item out of the scope. Before the freeze (or for an item that is not in the baseline) it is simply deferred;
 * once the scope is frozen, removing a baseline item needs a deletion variation.
 */
export async function removeFromScope(jobId: string, reason: string): Promise<{ variation?: Variation; job?: Job }> {
  const job = peekJobs().find((j) => j.id === jobId);
  if (stage === 'frozen' && job?.inBaseline) return { variation: await requestRemoval(jobId, reason) };
  const updated = await deferJob(jobId, reason);
  emit();
  return { job: updated };
}

export interface SimResult {
  variation: Variation;
  job?: Job;
}

/** One click: a realistic post-freeze request (an SCF, a discovery job, a change or a deferral). */
export async function simulatePostFreezeRequest(): Promise<SimResult> {
  if (stage !== 'frozen') throw new Error('Freeze the scope first');
  const used = new Set(vars.map((v) => v.ref));
  const jobs = peekJobs();
  const ok = (r: SimRequest) => {
    if (used.has(r.ref)) return false;
    if (r.targetJobId) {
      const t = jobs.find((j) => j.id === r.targetJobId);
      return Boolean(t && t.status === 'approved' && t.inBaseline && !vars.some((v) => v.jobId === t.id && v.status === 'Pending'));
    }
    return true;
  };
  const req: SimRequest = SIM_REQUESTS.find(ok) ?? genericRequest(varSeq);
  if (req.newJob) {
    pendingMeta = req;
    const job = await createJob({
      desc: req.newJob.desc,
      discipline: req.newJob.discipline as Discipline,
      area: req.newJob.area,
      tag: req.newJob.tag,
      requestedBy: req.originator,
      costOMR: req.costOMR,
      manhours: req.manhours,
      likelihood: req.newJob.likelihood,
      consequence: req.newJob.consequence,
      source: 'Manual',
      durationDays: req.newJob.durationDays,
    });
    pendingMeta = null;
    return { variation: vars.find((v) => v.jobId === job.id)!, job };
  }
  const v = addVariation({
    title: req.title,
    ref: req.ref,
    type: req.type,
    source: req.source,
    originator: req.originator,
    costOMR: req.costOMR,
    manhours: req.manhours,
    reason: req.reason,
    cpDays: req.cpDays,
    cpNote: req.cpNote,
    jobId: req.targetJobId,
  });
  return delay({ variation: v }, 200);
}

function genericRequest(seed: number): SimRequest {
  const n = seed;
  return {
    ref: `SCF-${n}`,
    title: `SCF-${n} Additional scaffold and insulation work, Unit 200`,
    type: 'Addition',
    source: 'SCF',
    originator: PEOPLE.process,
    costOMR: 9_000 + (n % 7) * 1_300,
    manhours: 120 + (n % 5) * 20,
    cpDays: 0,
    cpNote: 'Off the critical path: absorbed in float',
    reason: 'Further work found during the walkdown.',
    newJob: { desc: `Additional scaffold and insulation work (SCF-${n})`, discipline: 'Civil', area: 'Unit 200', tag: 'INS-200', likelihood: 2, consequence: 2, durationDays: 2 },
  };
}

// ================================================================ AI budget estimate

/** Accept an AI (or manual) estimate on a scope item. */
export async function applyBudgetEstimate(jobId: string, costOMR: number): Promise<Job> {
  const job = await patchJob(jobId, { costOMR });
  emit();
  return job;
}

// ================================================================ demo controls

/** Back to the opening state: pre-freeze, nothing approved beyond the first eight items. */
export function resetScopeDemo() {
  resetJobs();
  stage = 'pre-freeze';
  baseline = undefined;
  certs = [];
  vars = OPENING_VARIATIONS.map((v) => ({ ...v }));
  varSeq = 130;
  pendingMeta = null;
  challenged = {};
  gateConfig = defaultGateConfig();
  setClockPostFreeze(false);
  setPostFreezeMode(false);
  emit();
}

/** The mid-turnaround picture the rest of the app was built around: frozen, with a history of post-freeze variations. */
export async function loadMidTaState(): Promise<void> {
  if (stage === 'pre-freeze') {
    await fastForwardDemo();
    await freezeScope();
  }
  if (certs.length > 1) return;
  const history = VARIATION_HISTORY.filter((v) => v.phase === 'Post-freeze').map((v) => ({ ...v, approver: v.costOMR > 150_000 ? 'Head of Turnaround Services' : 'TA Event Manager', reason: 'Loaded from the variation history' }));
  vars = [...history, ...vars];
  const cert = await issueRevision(`Post-freeze variations to date (${history.filter((v) => v.status === 'Approved').length} approved)`, history.filter((v) => v.status === 'Approved').map((v) => v.id));
  vars = vars.map((v) => (cert.variationIds.includes(v.id) ? { ...v, revision: cert.revision, decidedBy: `${nameOf(v.approver ?? '')} (${v.approver})`, decidedAt: `${v.raisedAt}T09:30:00` } : v));
  emit();
}

export { hours as formatHours, money as formatMoney };
