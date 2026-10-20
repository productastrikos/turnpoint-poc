import { issues, ncrs, lossEvents, type Issue, type IssueStatus, type Ncr, type NcrStatus, type LossEvent } from '../mocks/qualityMock';
import { STATUS_DATE, daysBetween } from '../mocks/_gen';
import { createCollection } from './_collection';

// ---------------------------------------------------------------- issues & safety
const issueStore = createCollection<Issue>(issues);
let issSeq = 135;
let ncrSeq = 222;
let losSeq = 125;

export const listIssues = () => issueStore.list();

const ISSUE_NEXT: Record<IssueStatus, IssueStatus | null> = { Open: 'In progress', 'In progress': 'Resolved', Resolved: 'Closed', Closed: null };
export const issueNextLabel = (s: IssueStatus) => (ISSUE_NEXT[s] ? `Mark ${ISSUE_NEXT[s]!.toLowerCase()}` : null);

export async function advanceIssue(id: string): Promise<Issue> {
  const cur = (await issueStore.get(id))!;
  const next = ISSUE_NEXT[cur.status];
  return next ? issueStore.update(id, { status: next }) : cur;
}

export async function createIssue(input: Pick<Issue, 'type' | 'title' | 'severity' | 'area' | 'owner'>): Promise<Issue> {
  const issue: Issue = { ...input, id: `ISS-${issSeq++}`, raisedAt: STATUS_DATE, status: 'Open', hipo: input.type === 'Near miss' && input.severity === 'High' };
  return issueStore.add(issue);
}

export const issueAge = (i: Issue) => daysBetween(i.raisedAt, STATUS_DATE);

// ---------------------------------------------------------------- NCR
const ncrStore = createCollection<Ncr>(ncrs);

export const listNcrs = () => ncrStore.list();

const NCR_NEXT: Record<NcrStatus, NcrStatus | null> = { Open: 'Under review', 'Under review': 'Disposition agreed', 'Disposition agreed': 'Closed', Closed: null };
export const ncrNextLabel = (s: NcrStatus) => (NCR_NEXT[s] ? (s === 'Under review' ? 'Agree disposition' : s === 'Open' ? 'Start review' : 'Close NCR') : null);

export async function advanceNcr(id: string): Promise<Ncr> {
  const cur = (await ncrStore.get(id))!;
  const next = NCR_NEXT[cur.status];
  if (!next) return cur;
  const patch: Partial<Ncr> = { status: next };
  if (next === 'Disposition agreed' && cur.disposition === 'Pending') patch.disposition = 'Repair';
  return ncrStore.update(id, patch);
}

export async function createNcr(input: Pick<Ncr, 'title' | 'discipline' | 'area' | 'tag' | 'severity' | 'rootCause' | 'owner' | 'contractor'>): Promise<Ncr> {
  const n: Ncr = { ...input, id: `NCR-${ncrSeq++}`, disposition: 'Pending', status: 'Open', raisedAt: STATUS_DATE };
  return ncrStore.add(n);
}

// ---------------------------------------------------------------- delay & rework
const lossStore = createCollection<LossEvent>(lossEvents);

export const listLosses = () => lossStore.list();

export async function createLoss(input: Omit<LossEvent, 'id' | 'costOMR'>): Promise<LossEvent> {
  const ev: LossEvent = { ...input, id: `LOS-${losSeq++}`, costOMR: Math.round(input.hours * 14.5) };
  return lossStore.add(ev);
}
