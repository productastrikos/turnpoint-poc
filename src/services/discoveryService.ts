import { discoveryJobs } from '../mocks/discoveryMock';
import type { DiscoveryJob, DiscoveryJobState } from '../types';
import { delay } from './_util';

let store: DiscoveryJob[] = [...discoveryJobs];

export async function getDiscoveryJobs(): Promise<DiscoveryJob[]> {
  return delay([...store]);
}

export async function transitionDiscoveryJob(id: string, state: DiscoveryJobState): Promise<DiscoveryJob> {
  store = store.map((d) => (d.id === id ? { ...d, state } : d));
  return delay(store.find((d) => d.id === id)!);
}
