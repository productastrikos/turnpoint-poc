import { riskItems } from '../mocks/riskMock';
import type { RiskItem } from '../types';
import { delay } from './_util';

let store: RiskItem[] = [...riskItems];

export async function getRisks(): Promise<RiskItem[]> {
  return delay([...store]);
}

export async function updateRiskStatus(id: string, status: RiskItem['status']): Promise<RiskItem> {
  store = store.map((r) => (r.id === id ? { ...r, status } : r));
  return delay(store.find((r) => r.id === id)!);
}
