import { preTaSeed, type PreTaRow, type PreTaSlug } from '../mocks/preTaMock';
import { createCollection } from './_collection';
import { pushSapStatus } from './integrationService';

const store = createCollection<PreTaRow>(preTaSeed);

export async function listPreTa(slug: PreTaSlug): Promise<PreTaRow[]> {
  return (await store.list()).filter((r) => r.slug === slug);
}

/** Loaders must be stable function references (the tracker page depends on them), so build one per slug. */
export const preTaLoaders = Object.fromEntries((['scaffold', 'isolation', 'insulation', 'weld', 'rigging', 'tools', 'bagging-tagging', 'heavy-equipment', 'prefab', 'waste', 'equipment-inspection'] as PreTaSlug[]).map((s) => [s, () => listPreTa(s)])) as Record<PreTaSlug, () => Promise<PreTaRow[]>>;

/** Metrics that move when a row reaches a new stage (e.g. all joints welded when the weld stage is reached). */
function metricsFor(row: PreTaRow, next: number): Record<string, number | string> {
  const m = { ...row.metrics };
  switch (row.slug) {
    case 'insulation':
      if (next >= 2) m.removed = m.total;
      if (next === 3) m.reinstalled = Math.round(Number(m.total) * 0.5);
      if (next >= 4) m.reinstalled = m.total;
      break;
    case 'weld':
      if (next >= 2) m.welded = m.joints;
      if (next >= 3) m.ndtPassed = Number(m.joints) - Number(m.repairs);
      break;
    case 'bagging-tagging':
      if (next >= 2) m.bagged = m.items;
      if (next >= 3) m.tagged = m.items;
      break;
    case 'scaffold':
      m.tag = next >= 2 ? 'Green' : next === 1 ? 'Red (not inspected)' : '—';
      break;
    case 'equipment-inspection':
      if (next === 2) {
        m.result = 'Passed';
        m.cert = `CRT-${String(30000 + Math.floor(Math.random() * 60000))}`;
        m.validDays = 180;
      }
      break;
    default:
  }
  return m;
}

export async function advancePreTa(id: string, lastStage: number): Promise<PreTaRow> {
  const row = (await store.get(id))!;
  if (row.stage >= lastStage) return row;
  const next = row.stage + 1;
  const updated = await store.update(id, { stage: next, metrics: metricsFor(row, next) });
  if (row.slug === 'isolation' && next === 2) pushSapStatus('Maintenance Order status', row.ref, `${row.ref} isolation applied: order may proceed to execution`);
  return updated;
}

export async function createPreTa(row: Omit<PreTaRow, 'id'>): Promise<PreTaRow> {
  const created: PreTaRow = { ...row, id: `${row.slug.slice(0, 3).toUpperCase()}-${store.nextId('', 3)}` };
  return store.add(created);
}
