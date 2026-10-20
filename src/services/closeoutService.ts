import {
  DOC_STATUS_ORDER,
  eventRows,
  handoverDocs,
  lessons,
  postTaItems,
  strategySections,
  strategyVersions,
  taMilestones,
  type DocStatus,
  type HandoverDoc,
  type Lesson,
  type LessonStatus,
  type PostTaItem,
  type StrategyVersion,
  type TaEventRow,
  type TaMilestone,
} from '../mocks/closeoutMock';
import { createCollection } from './_collection';
import { delay } from './_util';

// ---------------------------------------------------------------- lessons learned
const lessonStore = createCollection<Lesson>(lessons);
export const listLessons = () => lessonStore.list();
const L_NEXT: Record<LessonStatus, LessonStatus | null> = { Open: 'In progress', 'In progress': 'Closed', Closed: null };
export const lessonActionLabel = (s: LessonStatus) => (s === 'Open' ? 'Start action' : s === 'In progress' ? 'Close action' : null);
export async function advanceLesson(id: string): Promise<Lesson> {
  const cur = (await lessonStore.get(id))!;
  const next = L_NEXT[cur.status];
  return next ? lessonStore.update(id, { status: next }) : cur;
}
export const toggleCarry = async (id: string) => lessonStore.update(id, (c) => ({ carried: !c.carried }));
export async function addLesson(input: Pick<Lesson, 'category' | 'lesson' | 'recommendation' | 'owner' | 'impact'>): Promise<Lesson> {
  return lessonStore.add({ ...input, id: `LL-${lessonStore.nextId('', 2)}`, due: '2026-10-29', status: 'Open', carried: true });
}

// ---------------------------------------------------------------- post-TA completion
const postStore = createCollection<PostTaItem>(postTaItems);
export const listPostTa = () => postStore.list();
export async function advancePostTa(id: string): Promise<PostTaItem> {
  const cur = (await postStore.get(id))!;
  const next = cur.status === 'Open' ? 'In progress' : cur.status === 'In progress' ? 'Complete' : 'Complete';
  return postStore.update(id, { status: next });
}

// ---------------------------------------------------------------- handover documents
const docStore = createCollection<HandoverDoc>(handoverDocs);
export const listDocs = () => docStore.list();
export const docActionLabel = (s: DocStatus) => ({ Missing: 'Request from contractor', Submitted: 'Review', Reviewed: 'Accept', Accepted: 'Archive', Archived: null })[s];
export async function advanceDoc(id: string): Promise<HandoverDoc> {
  const cur = (await docStore.get(id))!;
  const idx = DOC_STATUS_ORDER.indexOf(cur.status);
  if (idx >= DOC_STATUS_ORDER.length - 1) return cur;
  const next = DOC_STATUS_ORDER[idx + 1];
  return docStore.update(id, { status: next, received: next === 'Submitted' ? Math.max(1, cur.expected - 1) : cur.expected });
}

// ---------------------------------------------------------------- milestones & events
const msStore = createCollection<TaMilestone>(taMilestones);
export const listMilestones = () => msStore.list();
export async function completeMilestone(id: string): Promise<TaMilestone> {
  return msStore.update(id, { status: 'Done', actual: '2026-08-16' });
}
const evStore = createCollection<TaEventRow>(eventRows);
export const listEvents = () => evStore.list();
export async function advanceEvent(id: string): Promise<TaEventRow> {
  const cur = (await evStore.get(id))!;
  const next = cur.status === 'Planned' ? 'Done' : cur.status === 'Open' ? 'Escalated' : cur.status === 'Escalated' ? 'Done' : cur.status;
  return evStore.update(id, { status: next });
}
export async function addEvent(input: Pick<TaEventRow, 'kind' | 'title' | 'date' | 'owner' | 'note'>): Promise<TaEventRow> {
  return evStore.add({ ...input, id: `EV-${evStore.nextId('', 2)}`, status: input.kind === 'Issue' ? 'Open' : 'Planned' });
}

// ---------------------------------------------------------------- strategy
let versions: StrategyVersion[] = strategyVersions.map((v) => ({ ...v }));
export const getStrategy = () => delay({ sections: strategySections, versions: versions.map((v) => ({ ...v })) }, 120);
export async function approveStrategy(): Promise<StrategyVersion[]> {
  versions = versions.map((v) => (v.status === 'Draft' ? { ...v, status: 'Approved' as const, note: `${v.note}. Approved ${'2026-08-16'} by the steering committee` } : v));
  return delay(versions.map((v) => ({ ...v })), 150);
}
