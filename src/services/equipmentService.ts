import { equipmentItems } from '../mocks/equipmentMock';
import type { Equipment, EquipmentStatus } from '../types';
import { delay } from './_util';

let store: Equipment[] = [...equipmentItems];

export async function getEquipment(): Promise<Equipment[]> {
  return delay([...store]);
}

const NEXT: Record<EquipmentStatus, EquipmentStatus | null> = {
  removed: 'in-repair',
  'in-repair': 'ready',
  ready: 'installed',
  installed: null,
};

export async function advanceEquipment(id: string, by = 'You'): Promise<Equipment> {
  store = store.map((e) => {
    if (e.id !== id) return e;
    const next = NEXT[e.status];
    if (!next) return e;
    const at = new Date().toISOString().slice(0, 10);
    return { ...e, status: next, updatedAt: at, history: [...e.history, { status: next, at, by }] };
  });
  return delay(store.find((e) => e.id === id)!);
}
