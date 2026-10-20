// Vendor input at the SCF evaluation stage (SOW dry run 25). SIMULATED: vendors are invited and "respond" inside the demo.
import { delay } from './_util';

export interface VendorQuote {
  vendor: string;
  invited: boolean;
  quoteOMR?: number;
  days?: number;
  note?: string;
  respondedAt?: string;
}

export const VENDORS = ['Larsen & Toubro', 'Galfar', 'Petrofac Services', 'Heat Transfer Industries'];

const store: Record<string, VendorQuote[]> = {};

const fresh = (): VendorQuote[] => VENDORS.map((v) => ({ vendor: v, invited: false }));

export async function getVendorState(scfId: string): Promise<VendorQuote[]> {
  store[scfId] ??= fresh();
  return delay(store[scfId].map((q) => ({ ...q })), 80);
}

export async function inviteVendors(scfId: string, vendors: string[]): Promise<VendorQuote[]> {
  store[scfId] ??= fresh();
  store[scfId] = store[scfId].map((q) => (vendors.includes(q.vendor) ? { ...q, invited: true } : q));
  return delay(store[scfId].map((q) => ({ ...q })), 200);
}

/** Simulate invited vendors responding with a cost and duration. Deterministic from the SCF id. */
export async function simulateResponses(scfId: string, baseUSD: number): Promise<VendorQuote[]> {
  store[scfId] ??= fresh();
  const seed = scfId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  store[scfId] = store[scfId].map((q, i) =>
    q.invited && q.quoteOMR === undefined
      ? { ...q, quoteOMR: Math.round(baseUSD * 0.385 * (0.88 + ((seed + i * 7) % 20) / 100)), days: 2 + ((seed + i) % 3), note: i % 2 ? 'Price valid 14 days, mobilisation within 24 h' : 'Includes crane and scaffold, excludes materials', respondedAt: '2026-08-16T09:40' }
      : q
  );
  return delay(store[scfId].map((q) => ({ ...q })), 700);
}

export function bestQuote(list: VendorQuote[]): VendorQuote | undefined {
  return list.filter((q) => q.quoteOMR !== undefined).sort((a, b) => (a.quoteOMR ?? 0) - (b.quoteOMR ?? 0))[0];
}
