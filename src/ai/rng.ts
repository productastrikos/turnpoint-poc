// Seeded random numbers, so every training run and every simulation gives the same result in every demo.

export interface Rng {
  next(): number; // [0, 1)
  int(lo: number, hi: number): number; // inclusive
  pick<T>(xs: readonly T[]): T;
  chance(p: number): boolean;
  normal(mean?: number, sd?: number): number;
  /** Triangular distribution: min, most likely, max (the usual 3-point estimate). */
  triangular(min: number, mode: number, max: number): number;
}

export function rng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    chance: (p) => next() < p,
    normal: (mean = 0, sd = 1) => {
      const u = 1 - next();
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    triangular: (min, mode, max) => {
      const u = next();
      const c = max > min ? (mode - min) / (max - min) : 0.5;
      return u < c ? min + Math.sqrt(u * (max - min) * (mode - min)) : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
    },
  };
}
