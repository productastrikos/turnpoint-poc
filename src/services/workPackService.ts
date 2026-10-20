import { workPacks, type PackStage, type ReadinessKey, type WorkPack } from '../mocks/workPackMock';
import { createCollection } from './_collection';
import { pushSapStatus, pushP6Progress } from './integrationService';

const store = createCollection<WorkPack>(workPacks);

export const listWorkPacks = () => store.list();

const NEXT: Partial<Record<PackStage, PackStage>> = { 'Ready for release': 'Released', Released: 'In progress', 'In progress': 'Complete' };
export const nextPackLabel = (p: WorkPack): string | null => {
  if (p.stage === 'Preparing') return null;
  return { 'Ready for release': 'Release work pack', Released: 'Start work', 'In progress': 'Mark complete', Complete: null }[p.stage] ?? null;
};

export const allReady = (p: WorkPack) => Object.values(p.ready).every(Boolean);

export async function advancePack(id: string): Promise<WorkPack> {
  const cur = (await store.get(id))!;
  const next = NEXT[cur.stage];
  if (!next) return cur;
  const updated = await store.update(id, { stage: next });
  if (next === 'Released' && cur.sapWo) pushSapStatus('Maintenance Order status', cur.sapWo, `${cur.id} released: order status REL, reservations confirmed`);
  if (next === 'In progress') pushP6Progress(cur.p6Id, `${cur.id} started: actual start written to P6`);
  if (next === 'Complete') pushSapStatus('Maintenance Order status', cur.sapWo ?? cur.jobId, `${cur.id} complete: technical completion confirmed`);
  return updated;
}

export async function toggleReady(id: string, key: ReadinessKey): Promise<WorkPack> {
  const cur = (await store.get(id))!;
  const ready = { ...cur.ready, [key]: !cur.ready[key] };
  let stage = cur.stage;
  if (stage === 'Preparing' || stage === 'Ready for release') stage = Object.values(ready).every(Boolean) ? 'Ready for release' : 'Preparing';
  return store.update(id, { ready, stage });
}
