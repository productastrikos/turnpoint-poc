// Seeded fake-data helpers. Everything in src/mocks that is "generated" goes through here so numbers are
// identical on every reload and every page that reads the same entity agrees with the others.

export type Rng = () => number;

/** mulberry32 — small, fast, deterministic PRNG. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(r: Rng, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

export function int(r: Rng, lo: number, hi: number): number {
  return Math.floor(lo + r() * (hi - lo + 1));
}

export function float(r: Rng, lo: number, hi: number, dp = 1): number {
  const v = lo + r() * (hi - lo);
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

export function chance(r: Rng, p: number): boolean {
  return r() < p;
}

/** Weighted pick: weights array parallel to items. */
export function weighted<T>(r: Rng, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let x = r() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function pad(n: number, w = 3): string {
  return String(n).padStart(w, '0');
}

// ---------- the scenario clock ----------
// The demo is frozen at a mid-turnaround "status date" so every page shows the same moment.
export const TA_START = '2026-08-03'; // Day 1
export const TA_END = '2026-09-03'; // Day 32
export const STATUS_DATE = '2026-08-16'; // Day 14
export const STATUS_DAY = 14;
export const TA_DAYS = 32;

const DAY = 86_400_000;

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(d.getTime() + n * DAY).toISOString().slice(0, 10);
}

/** TA day number (1-based) -> ISO date. */
export function dayToDate(day: number): string {
  return addDays(TA_START, day - 1);
}

/** ISO date -> TA day number (1-based; can be <1 or >32). */
export function dateToDay(iso: string): number {
  return Math.round((new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${TA_START}T00:00:00Z`).getTime()) / DAY) + 1;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Three-letter month, always "Sep" (never the locale's "Sept"). */
export function monthShort(d: Date): string {
  return MONTHS[d.getUTCMonth()];
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${monthShort(d)}`;
}

/** "03 Aug 2026" from an ISO date (a time part is ignored). */
export function longDate(iso: string): string {
  return `${shortDate(iso.slice(0, 10))} ${iso.slice(0, 4)}`;
}

/** "09 Jun 2026, 08:41" from an ISO timestamp with a time part. */
export function longStamp(iso: string): string {
  return `${longDate(iso)}, ${iso.slice(11, 16)}`;
}

/** "16 Aug, 09:02" from a local ISO timestamp. */
export function stamp(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmtOMR(n: number): string {
  if (Math.abs(n) >= 1e6) return `OMR ${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `OMR ${(n / 1e3).toFixed(0)}K`;
  return `OMR ${n}`;
}

export function fmtNum(n: number, dp = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/** Smooth S-curve fraction 0..1 for t in 0..1 */
export function sCurve(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return (1 - Math.cos(Math.PI * c)) / 2;
}
