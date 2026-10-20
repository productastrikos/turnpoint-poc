import { alertItems } from '../mocks/alertsMock';
import type { AlertItem } from '../types';
import { delay } from './_util';

let store: AlertItem[] = [...alertItems];

export async function getAlerts(): Promise<AlertItem[]> {
  return delay([...store]);
}

export async function markRead(id: string): Promise<AlertItem> {
  store = store.map((a) => (a.id === id ? { ...a, read: true } : a));
  return delay(store.find((a) => a.id === id)!);
}

export async function markAllRead(): Promise<AlertItem[]> {
  store = store.map((a) => ({ ...a, read: true }));
  return delay([...store]);
}

let seq = 100;

export async function addAlert(input: Pick<AlertItem, 'type' | 'message' | 'severity' | 'link'>): Promise<AlertItem> {
  const alert: AlertItem = { ...input, id: `ALT-${seq++}`, raisedAt: '2026-08-16T09:30:00', read: false };
  store = [alert, ...store];
  return delay(alert);
}
