import { describeFlange, flanges, isCriticalFlange, reworkAfterTorque, type FlangeDetail } from '../mocks/flangesMock';
import type { Flange, FlangeStage } from '../types';
import { delay } from './_util';

let store: Flange[] = [...flanges];

export async function getFlanges(): Promise<Flange[]> {
  return delay([...store]);
}

export async function advanceStage(id: string): Promise<Flange> {
  store = store.map((f) => (f.id === id && f.stage < 6 ? { ...f, stage: (f.stage + 1) as FlangeStage, updatedAt: new Date().toISOString().slice(0, 10) } : f));
  return delay(store.find((f) => f.id === id)!);
}

export async function getFlangeDetail(id: string): Promise<FlangeDetail | null> {
  const f = store.find((x) => x.id === id);
  return delay(f ? describeFlange(f) : null);
}

export interface FlangeKpis {
  total: number;
  closed: number;
  leakTested: number;
  criticalOpen: number;
  reworkAfterTorque: number;
}

/** Dashboard numbers for the fleet (SOW 10.51.3.7), computed from the same store the table reads. */
export function flangeKpis(list: Flange[]): FlangeKpis {
  return {
    total: list.length,
    closed: list.filter((f) => f.stage === 6).length,
    leakTested: list.filter((f) => f.stage >= 5).length,
    criticalOpen: list.filter((f) => isCriticalFlange(f) && f.stage < 6).length,
    reworkAfterTorque: list.filter(reworkAfterTorque).length,
  };
}
