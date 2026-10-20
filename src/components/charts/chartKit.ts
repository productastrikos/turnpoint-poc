import { useCallback, useRef, useState } from 'react';

/**
 * Shared helpers for the hand-rolled SVG charts.
 * - useChartWidth: draw at the real container width so text stays at its true pixel size and the chart fills its card.
 * - niceScale / niceRange: round axis limits to 1, 2, 2.5, 5 x 10^n so every tick label is a true value and bars match their labels.
 */

export function useChartWidth(fallback = 640, min = 280): [(node: HTMLDivElement | null) => void, number] {
  const [width, setWidth] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);
  // callback ref: still correct when the chart mounts late (after data loads) or is replaced
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!node) return;
      const update = () => {
        const w = Math.floor(node.getBoundingClientRect().width);
        if (w > 0) setWidth(Math.max(min, w));
      };
      update();
      if (typeof ResizeObserver !== 'undefined') {
        observer.current = new ResizeObserver(update);
        observer.current.observe(node);
      }
    },
    [min]
  );
  return [ref, width];
}

export interface NiceRange {
  lo: number;
  hi: number;
  ticks: number[];
}

/** Axis from `lo` up to a rounded maximum, with ~`count` gridlines. `integer` forces whole-number steps (counts). */
export function niceRange(lo: number, maxValue: number, count = 4, integer = false): NiceRange {
  const span = Math.max(maxValue - lo, 1e-9);
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  let step = nice * mag;
  if (integer) step = Math.max(1, Math.ceil(step));
  const steps = Math.max(1, Math.ceil(span / step - 1e-9));
  const hi = lo + steps * step;
  const ticks = Array.from({ length: steps + 1 }, (_, i) => Math.round((lo + i * step) * 1e6) / 1e6);
  return { lo, hi, ticks };
}

export function niceScale(maxValue: number, count = 4, integer = false): NiceRange {
  return niceRange(0, Math.max(maxValue, 1e-9), count, integer);
}

export const isWhole = (values: (number | null | undefined)[]) => values.every((v) => v === null || v === undefined || Number.isInteger(v));
