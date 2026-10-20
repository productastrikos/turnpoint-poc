import { materialItems, WEEKS_PER_MONTH, classifyLead } from '../mocks/materialsMock';
import type { MaterialItem } from '../types';
import { createCollection } from './_collection';
import { pushSapStatus } from './integrationService';

const store = createCollection<MaterialItem>(materialItems);

export const getMaterials = () => store.list();

const NEXT: Record<MaterialItem['prStatus'], MaterialItem['prStatus'] | null> = { 'not-raised': 'raised', raised: 'po-issued', 'po-issued': 'delivered', delivered: null };
export const prActionLabel = (s: MaterialItem['prStatus']) => ({ 'not-raised': 'Raise PR', raised: 'Issue PO', 'po-issued': 'Mark delivered', delivered: null })[s];

/** Move a material line one step along PR -> PO -> delivered. Raising a PR creates a requisition in SAP MM (simulated). */
export async function advancePr(id: string): Promise<MaterialItem> {
  const cur = (await store.get(id))!;
  const next = NEXT[cur.prStatus];
  if (!next) return cur;
  const updated = await store.update(id, { prStatus: next });
  if (next === 'raised') pushSapStatus('Purchase Requisition', `PR-${cur.id.slice(4)}`, `${cur.id} ${cur.description}: requisition created in SAP MM`);
  if (next === 'po-issued') pushSapStatus('Purchase Order', `PO-${cur.id.slice(4)}`, `${cur.id}: purchase order issued, delivery ${cur.leadWeeks} weeks`);
  return updated;
}

export const monthsOf = (weeks: number) => Math.round((weeks / WEEKS_PER_MONTH) * 10) / 10;

let extraSeq = 27;

/** Add MTO lines produced by the P&ID / isometric analyzer (checklist G8). */
export async function addMaterials(lines: { description: string; leadWeeks: number; estCostOMR: number; area: string; qty: number; uom: string }[]): Promise<MaterialItem[]> {
  const out: MaterialItem[] = [];
  for (const l of lines) {
    const item: MaterialItem = {
      id: `MTO-${String(extraSeq++).padStart(3, '0')}`,
      description: l.description,
      leadWeeks: l.leadWeeks,
      leadTime: classifyLead(l.leadWeeks),
      prStatus: 'not-raised',
      requiredBy: '2026-09-02',
      area: l.area,
      jobId: 'J-2210',
      qty: l.qty,
      uom: l.uom,
      estCostOMR: l.estCostOMR,
    };
    out.push(item);
  }
  return Promise.all(out.map((i) => store.add(i)));
}
