// AI duplicate scope detection (checklist S9): the on-device model in src/ai/duplicateModel.ts run over the live
// worklist, on new items as they are typed, on Excel / bulk / SAP imports, and retrained on planner decisions.
import {
  buildDupModel,
  explainPair,
  matchAgainst,
  scanDocs,
  shortlist,
  textSimilarity,
  type Decision,
  type DupModel,
  type DupModelCard,
  type PairScore,
  type ScopeDoc,
} from '../ai/duplicateModel';
import { BULK_SAMPLE, EXCEL_SAMPLE, variations } from '../mocks/scopeMock';
import { SAP_PENDING } from '../mocks/integrationMock';
import { jobs as seedJobs } from '../mocks/jobsMock';
import { getJobs, mergeDuplicate } from './jobsService';
import { logMessage, sendToSystems } from './integrationService';
import { sapWoForJob } from '../mocks/sapKeys';
import { delay } from './_util';
import type { Job } from '../types';
import type { SapItem } from '../types/execution';

export type { PairScore, ScopeDoc } from '../ai/duplicateModel';

export const jobDoc = (j: Job): ScopeDoc => ({
  id: j.id,
  desc: j.desc,
  tag: j.tag,
  area: j.area,
  discipline: j.discipline,
  startDay: j.startDay,
  durationDays: j.durationDays,
  costOMR: j.costOMR,
  manhours: j.manhours,
  source: j.source,
});

export const sapDoc = (s: SapItem): ScopeDoc => ({
  id: s.number,
  desc: s.description,
  tag: s.equipment,
  area: s.area,
  discipline: s.discipline,
  costOMR: s.estCostOMR,
  manhours: s.manhours,
  source: s.kind === 'Work Order' ? 'SAP work order' : 'SAP notification',
});

// The plant's own vocabulary (worklist, SAP backlog, import samples) is part of the TF-IDF corpus.
const PLANT_CORPUS: ScopeDoc[] = [
  ...seedJobs.map(jobDoc),
  ...SAP_PENDING.map(sapDoc),
  ...[...BULK_SAMPLE, ...EXCEL_SAMPLE].map((r, i) => ({ id: `S${i}`, desc: r.desc, tag: r.tag, area: r.area, discipline: r.discipline })),
];

let model: DupModel | null = null;
let decisions: Decision[] = [];
let dismissed = new Set<string>();
const bundled = new Map<string, string>(); // finding key -> note

function getModel(): DupModel {
  if (!model) model = buildDupModel(PLANT_CORPUS, decisions);
  return model;
}

const pairKey = (a: string, b: string) => [a, b].sort().join('|');
const active = (jobs: Job[]) => jobs.filter((j) => j.status !== 'rejected');
const rankForKeep = (j: Job) => (j.status === 'approved' || j.inBaseline ? 10 : 0) + j.gate;

export interface ScopeFinding extends PairScore {
  key: string;
  keep: Job;
  drop: Job;
  saving: { omr: number; manhours: number; days: number };
  /** Extra evidence beyond the model, e.g. the work is already in scope through an approved variation. */
  evidence?: string;
  bundledNote?: string;
}

export interface ScanResult {
  findings: ScopeFinding[];
  scannedItems: number;
  scannedPairs: number;
  ms: number;
}

function toFinding(p: PairScore, byId: Record<string, Job>): ScopeFinding {
  const a = byId[p.a.id];
  const b = byId[p.b.id];
  const [keep, drop] = rankForKeep(a) > rankForKeep(b) || (rankForKeep(a) === rankForKeep(b) && a.createdAt <= b.createdAt) ? [a, b] : [b, a];
  const key = pairKey(a.id, b.id);
  const saving =
    p.kind === 'duplicate'
      ? { omr: Math.min(a.costOMR, b.costOMR), manhours: Math.round(drop.manhours * 0.8), days: 0 }
      : { omr: Math.min(15_000, Math.round((0.12 * Math.min(a.costOMR, b.costOMR)) / 500) * 500), manhours: Math.round(0.1 * Math.min(a.manhours, b.manhours)), days: 1 };
  let evidence: string | undefined;
  if (p.kind === 'duplicate') {
    const v = variations.find((x) => x.ref === keep.id && x.status === 'Approved' && textSimilarity(getModel(), x.title, drop.desc) > 0.35);
    if (v) evidence = `Already in scope: ${v.id} "${v.title}" was approved on ${keep.id} (${v.phase.toLowerCase()}).`;
  }
  return { ...p, key, keep, drop, saving, evidence, bundledNote: bundled.get(key) };
}

/** Scan the live worklist: pairs with at least one open (pending) item, duplicates first. */
export async function getScopeFindings(): Promise<ScanResult> {
  const jobs = active(await getJobs());
  const byId = Object.fromEntries(jobs.map((j) => [j.id, j]));
  const open = new Set(jobs.filter((j) => j.status === 'pending').map((j) => j.id));
  const t0 = performance.now();
  const m = getModel();
  const docs = jobs.map(jobDoc);
  const pairs = scanDocs(m, docs, (a, b) => open.has(a.id) || open.has(b.id));
  const findings = shortlist(pairs, (id) => open.has(id))
    .map((p) => toFinding(p, byId))
    .filter((f) => !dismissed.has(f.key));
  const n = docs.length;
  return delay({ findings, scannedItems: n, scannedPairs: (n * (n - 1)) / 2, ms: Math.max(1, Math.round(performance.now() - t0)) }, 60);
}

/** As-you-type check of a new request against the live worklist. */
export async function checkCandidate(input: Omit<ScopeDoc, 'id'>): Promise<PairScore[]> {
  if (input.desc.trim().length < 8) return [];
  const jobs = active(await getJobs());
  return matchAgainst(getModel(), { ...input, id: 'NEW' }, jobs.map(jobDoc), 2);
}

/** Best match per row for an import preview (Excel, bulk upload, SAP pull). Keyed by row id. */
export async function checkRows(rows: ScopeDoc[]): Promise<Record<string, PairScore | undefined>> {
  const jobs = active(await getJobs()).map(jobDoc);
  const m = getModel();
  return delay(Object.fromEntries(rows.map((r) => [r.id, matchAgainst(m, r, jobs, 1)[0]])), 120);
}

export const checkSapItems = (items: SapItem[]) => checkRows(items.map(sapDoc));

function learn(f: ScopeFinding, label: 0 | 1) {
  decisions = [...decisions, { a: f.a, b: f.b, label }];
  model = buildDupModel(PLANT_CORPUS, decisions); // retrains in about a tenth of a second
}

export async function mergeFinding(f: ScopeFinding): Promise<void> {
  await mergeDuplicate(f.keep.id, f.drop.id);
  learn(f, 1);
  const sapRef = f.drop.sapRef;
  logMessage({
    system: 'SAP',
    direction: 'Outbound',
    object: 'Maintenance Notification',
    key: sapRef ?? f.drop.id,
    status: 'Delivered',
    latencyMs: 380,
    channel: 'OData V2 / OAuth 2.0 + mTLS',
    note: `${f.drop.id} merged into ${f.keep.id} (AI duplicate check, ${Math.round(f.probability * 100)}%)${sapRef ? ', duplicate notification closed' : ''}`,
  });
  const note = `Duplicate of ${f.keep.id} (merged in TURNPOINT, AI duplicate check ${Math.round(f.probability * 100)}%)`;
  if (f.drop.source === 'SAP notification' && sapRef) sendToSystems({ type: 'tp.notification.update', MaintenanceNotification: sapRef, phase: 'Completed', ref: f.keep.id, note });
  else if (sapWoForJob(f.drop)) sendToSystems({ type: 'tp.order.upsert', order: { MaintenanceOrder: sapWoForJob(f.drop)!, SystemStatusText: 'TECO', UserStatusText: 'DUPL' }, note });
}

export async function markNotDuplicate(f: ScopeFinding): Promise<void> {
  learn(f, 0);
  dismissed = new Set([...dismissed, f.key]);
  return delay(undefined, 120);
}

export async function bundleFinding(f: ScopeFinding): Promise<void> {
  bundled.set(f.key, `Bundled ${f.a.id} + ${f.b.id}: one scaffold, isolation and permit`);
  return delay(undefined, 150);
}

export async function dismissFinding(f: ScopeFinding): Promise<void> {
  dismissed = new Set([...dismissed, f.key]);
  return delay(undefined, 80);
}

export function getDupModelCard(): DupModelCard {
  return getModel().card;
}

export function explainFinding(p: PairScore) {
  return explainPair(getModel(), p);
}
