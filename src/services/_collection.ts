import { delay } from './_util';

/**
 * Tiny in-memory "table" with an async, REST-shaped API. Every domain service in the POC that does not need
 * bespoke logic is built on this, so swapping in a real API later only means replacing these calls.
 */
export interface Collection<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  add(item: T): Promise<T>;
  update(id: string, patch: Partial<T> | ((current: T) => Partial<T>)): Promise<T>;
  remove(id: string): Promise<void>;
  nextId(prefix: string, width?: number): string;
  reset(): void;
}

const registry: Array<() => void> = [];

/** Resets every collection created through createCollection (used by the "Reset demo data" action). */
export function resetAllCollections() {
  registry.forEach((fn) => fn());
}

export function createCollection<T extends { id: string }>(seed: T[], ms = 180): Collection<T> {
  const clone = (xs: T[]) => xs.map((x) => ({ ...x }));
  let store = clone(seed);
  let seq = 0;
  const api: Collection<T> = {
    list: () => delay(clone(store), ms),
    get: (id) => delay(store.find((x) => x.id === id) ? { ...store.find((x) => x.id === id)! } : undefined, ms),
    add: (item) => {
      store = [item, ...store];
      return delay({ ...item }, ms);
    },
    update: (id, patch) => {
      const cur = store.find((x) => x.id === id);
      if (!cur) return Promise.reject(new Error(`Not found: ${id}`));
      const p = typeof patch === 'function' ? patch(cur) : patch;
      const next = { ...cur, ...p };
      store = store.map((x) => (x.id === id ? next : x));
      return delay({ ...next }, ms);
    },
    remove: (id) => {
      store = store.filter((x) => x.id !== id);
      return delay(undefined, ms);
    },
    nextId: (prefix, width = 3) => {
      seq += 1;
      return `${prefix}${String(store.length + seq + 100).padStart(width, '0')}`;
    },
    reset: () => {
      store = clone(seed);
      seq = 0;
    },
  };
  registry.push(api.reset);
  return api;
}
