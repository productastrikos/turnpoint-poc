import { changeRequests } from '../mocks/changeMock';
import type { ChangeRequest, ChangeState } from '../types';
import { delay } from './_util';

let store: ChangeRequest[] = [...changeRequests];

export async function getChangeRequests(): Promise<ChangeRequest[]> {
  return delay([...store]);
}

export async function transitionChange(id: string, state: ChangeState, by = 'You', note?: string): Promise<ChangeRequest> {
  store = store.map((c) =>
    c.id === id
      ? { ...c, state, auditTrail: [...c.auditTrail, { state, at: new Date().toISOString(), by, note }] }
      : c
  );
  return delay(store.find((c) => c.id === id)!);
}
