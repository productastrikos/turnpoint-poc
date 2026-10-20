import { procLines, type ProcLine } from '../mocks/procurementMock';
import { createCollection } from './_collection';
import { getMaterials } from './materialsService';
import { addDays, daysBetween } from '../mocks/_gen';
import type { MaterialItem } from '../types';
import { pushSapStatus } from './integrationService';

const store = createCollection<ProcLine>(procLines);

export interface TrackedLine {
  id: string;
  item: MaterialItem;
  line: ProcLine;
  ship: ProcLine['ship'];
  marginDays: number | null; // need date minus ETA (negative = late)
  late: boolean;
}

export async function getTracked(): Promise<TrackedLine[]> {
  const [items, lines] = await Promise.all([getMaterials(), store.list()]);
  return items.map((item) => {
    const line = lines.find((l) => l.id === item.id) ?? { id: item.id, vendor: 'To be awarded', ship: 'Not requested' as const, expedited: false };
    // keep shipment status coherent with the MTO tracker (PR/PO actions taken there)
    let ship = line.ship;
    if (item.prStatus === 'delivered') ship = 'Received';
    else if (item.prStatus === 'po-issued' && (ship === 'Not requested' || ship === 'PR raised')) ship = 'In production';
    else if (item.prStatus === 'raised' && ship === 'Not requested') ship = 'PR raised';
    const eta = line.eta ?? (item.prStatus === 'po-issued' ? addDays(item.requiredBy, -2) : undefined);
    const marginDays = eta && ship !== 'Received' ? daysBetween(eta, item.requiredBy) : null;
    return { id: item.id, item, line: { ...line, eta }, ship, marginDays, late: marginDays !== null && marginDays < 0 };
  });
}

export async function expedite(id: string): Promise<void> {
  const cur = (await store.get(id))!;
  const eta = cur.eta ? addDays(cur.eta, -2) : cur.eta;
  await store.update(id, { expedited: true, eta });
  pushSapStatus('Purchase Order', cur.po ?? id, `${id}: vendor ${cur.vendor} asked to expedite (air freight / priority production slot)`);
}

export async function markReceived(id: string): Promise<void> {
  await store.update(id, { ship: 'Received', receivedOn: '2026-08-16' });
}

export function vendorStats(rows: TrackedLine[]) {
  const by: Record<string, TrackedLine[]> = {};
  rows.forEach((r) => (by[r.line.vendor] ??= []).push(r));
  return Object.entries(by)
    .map(([vendor, list]) => {
      const open = list.filter((l) => l.ship !== 'Received' && l.ship !== 'Not requested' && l.ship !== 'PR raised');
      const late = open.filter((l) => l.late);
      return { vendor, lines: list.length, open: open.length, late: late.length, worst: Math.max(0, ...late.map((l) => -(l.marginDays ?? 0))), value: list.reduce((s, l) => s + l.item.estCostOMR, 0), expedited: list.filter((l) => l.line.expedited).length };
    })
    .sort((a, b) => b.late - a.late || b.value - a.value);
}
