import type { MaterialItem } from '../types';
import { getMaterials } from './materialsService';
import { addDays, STATUS_DATE, daysBetween } from '../mocks/_gen';
import { delay } from './_util';

export interface FlowStep {
  id: string;
  name: string;
  role: string;
  enabled: boolean;
  optional?: boolean;
  note: string;
}

let flow: FlowStep[] = [
  { id: 'planner', name: 'Planner review', role: 'M. Al-Balushi (Planning)', enabled: true, note: 'Check quantities against the work pack scope' },
  { id: 'eng', name: 'Engineering approval', role: 'Discipline engineer', enabled: true, note: 'Confirm specification, rating and material grade' },
  { id: 'proc', name: 'Procurement release', role: 'B. Al-Rawahi (Procurement)', enabled: true, note: 'Confirm vendor, price basis and lead time' },
  { id: 'budget', name: 'Budget holder approval', role: 'TA Event Manager', enabled: false, optional: true, note: 'Lines above OMR 100,000' },
];

// approved steps per line (seeded: lines already on order are fully approved)
const approved: Record<string, string[]> = {};
const seeded = new Set<string>();

async function ensureSeed(items: MaterialItem[]) {
  for (const m of items) {
    if (seeded.has(m.id)) continue;
    seeded.add(m.id);
    if (m.prStatus !== 'not-raised') approved[m.id] = ['planner', 'eng', 'proc', 'budget'];
    else approved[m.id] = m.id === 'MTO-007' ? ['planner', 'eng'] : m.id === 'MTO-024' ? ['planner'] : m.id === 'MTO-025' ? [] : ['planner', 'eng', 'proc'];
  }
}

export interface BomLine {
  item: MaterialItem;
  orderBy: string;
  daysToOrder: number; // negative = overdue
  alert: 'overdue' | 'due-soon' | 'ok' | 'ordered';
  approvedSteps: string[];
  nextStep: FlowStep | null;
  status: string;
}

export const getFlow = () => delay(flow.map((f) => ({ ...f })), 60);
export async function setStepEnabled(id: string, enabled: boolean): Promise<FlowStep[]> {
  flow = flow.map((f) => (f.id === id ? { ...f, enabled } : f));
  return delay(flow.map((f) => ({ ...f })), 80);
}
export async function moveStep(id: string, dir: -1 | 1): Promise<FlowStep[]> {
  const i = flow.findIndex((f) => f.id === id);
  const j = i + dir;
  if (i >= 0 && j >= 0 && j < flow.length) {
    const next = [...flow];
    [next[i], next[j]] = [next[j], next[i]];
    flow = next;
  }
  return delay(flow.map((f) => ({ ...f })), 80);
}

export async function getBom(): Promise<BomLine[]> {
  const items = await getMaterials();
  await ensureSeed(items);
  const active = flow.filter((f) => f.enabled);
  return items.map((item) => {
    const orderBy = addDays(item.requiredBy, -item.leadWeeks * 7);
    const daysToOrder = daysBetween(STATUS_DATE, orderBy);
    const steps = approved[item.id] ?? [];
    const nextStep = active.find((f) => !steps.includes(f.id) && !(f.id === 'budget' && item.estCostOMR <= 100_000)) ?? null;
    const ordered = item.prStatus !== 'not-raised';
    const alert: BomLine['alert'] = ordered ? 'ordered' : daysToOrder < 0 ? 'overdue' : daysToOrder <= 14 ? 'due-soon' : 'ok';
    return { item, orderBy, daysToOrder, alert, approvedSteps: steps, nextStep, status: ordered ? 'On order' : nextStep ? `Awaiting ${nextStep.name}` : 'Approved, ready to order' };
  });
}

export async function approveStep(itemId: string): Promise<void> {
  const lines = await getBom();
  const l = lines.find((x) => x.item.id === itemId);
  if (l?.nextStep) approved[itemId] = [...(approved[itemId] ?? []), l.nextStep.id];
  return delay(undefined, 100);
}
