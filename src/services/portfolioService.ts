import { taEvents as seed } from '../mocks/portfolioMock';
import type { TaEvent } from '../types/platform';
import { delay } from './_util';

let taEvents: TaEvent[] = seed.map((t) => ({ ...t }));

export async function getTaEvents(): Promise<TaEvent[]> {
  return delay(taEvents.map((t) => ({ ...t })), 120);
}

export async function getTaEvent(id: string): Promise<TaEvent> {
  return delay({ ...(taEvents.find((t) => t.id === id) ?? taEvents[1]) }, 80);
}

export async function addTaEvent(input: Omit<TaEvent, 'id' | 'status' | 'readinessPct' | 'manhours' | 'prepMonths' | 'complexity' | 'note'> & { manhours?: number }): Promise<TaEvent> {
  const event: TaEvent = {
    ...input,
    id: `TA-${input.year}${taEvents.some((t) => t.id === `TA-${input.year}`) ? 'B' : ''}`,
    status: 'planned',
    readinessPct: 0,
    manhours: input.manhours ?? Math.round(input.budgetOMR / 28),
    prepMonths: input.type === 'Major STO' ? 36 : 24,
    complexity: input.type === 'Major STO' ? 'High' : 'Medium',
    note: 'Added in the demo',
  };
  taEvents = [...taEvents, event].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return delay({ ...event }, 150);
}

export async function updateTaEvent(id: string, patch: Partial<Pick<TaEvent, 'type' | 'units' | 'startDate' | 'durationDays' | 'budgetOMR' | 'manhours'>>): Promise<void> {
  taEvents = taEvents
    .map((t) => (t.id === id ? { ...t, ...patch, year: patch.startDate ? Number(patch.startDate.slice(0, 4)) : t.year } : t))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return delay(undefined, 60);
}

export interface PortfolioTotals {
  budgetOMR: number;
  durationDays: number;
  manhours: number;
  count: number;
}

export function totals(events: TaEvent[]): PortfolioTotals {
  return {
    budgetOMR: events.reduce((s, t) => s + t.budgetOMR, 0),
    durationDays: events.reduce((s, t) => s + t.durationDays, 0),
    manhours: events.reduce((s, t) => s + t.manhours, 0),
    count: events.length,
  };
}
