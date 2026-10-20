import { isWhole, niceScale, useChartWidth } from './chartKit';

/** Pareto chart: bars sorted descending + cumulative % line. Drawn at the container width with room for rotated labels. */
export function Pareto({ items, height = 280, unit = '' }: { items: { label: string; value: number }[]; height?: number; unit?: string }) {
  const [wrap, width] = useChartWidth(640);
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, i) => s + i.value, 0) || 1;
  const padR = 44;
  const padT = 16;
  // rotated labels (-32 deg) hang down and to the left of their bar: size the bottom and left margins from the longest one
  const maxLabel = Math.min(26, Math.max(...sorted.map((s) => s.label.length), 4));
  const padB = Math.round(22 + maxLabel * 5.6 * 0.53);
  const slot0 = (width - 44 - padR) / Math.max(1, sorted.length);
  const padL = Math.max(44, Math.round(maxLabel * 5.6 * 0.85 - slot0 / 2) + 8);
  const innerW = width - padL - padR;
  const slot = innerW / Math.max(1, sorted.length);
  const innerH = height - padT - padB;
  const scale = niceScale(sorted[0]?.value ?? 1, 3, isWhole(sorted.map((s) => s.value)));
  const hi = scale.hi;
  const barW = Math.min(44, slot * 0.66);
  let acc = 0;
  const pts = sorted.map((it, i) => {
    acc += it.value;
    return { x: padL + slot * i + slot / 2, y: padT + innerH - (acc / total) * innerH, pct: Math.round((acc / total) * 100) };
  });
  return (
    <div ref={wrap}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
        {scale.ticks.map((t) => {
          const yy = padT + innerH - (t / hi) * innerH;
          return (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={yy} y2={yy} stroke="var(--border)" />
              <text x={padL - 6} y={yy + 3} fontSize={10} textAnchor="end" fill="var(--ink-3)" fontFamily="var(--font-mono)">{t}</text>
            </g>
          );
        })}
        {[0, 0.5, 1].map((t) => (
          <text key={t} x={width - padR + 6} y={padT + innerH * (1 - t) + 3} fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)">{Math.round(t * 100)}%</text>
        ))}
        {sorted.map((it, i) => {
          const h = (it.value / hi) * innerH;
          const cx = padL + slot * i + slot / 2;
          return (
            <g key={it.label}>
              <rect x={cx - barW / 2} y={padT + innerH - h} width={barW} height={h} fill="var(--accent)" rx={2}>
                <title>{`${it.label}: ${it.value}${unit}`}</title>
              </rect>
              <text x={cx} y={padT + innerH - h - 4} fontSize={10} textAnchor="middle" fill="var(--ink-2)" fontFamily="var(--font-mono)">{it.value}</text>
              <text x={cx + 4} y={height - padB + 14} fontSize={10} fill="var(--ink-2)" textAnchor="end" transform={`rotate(-32 ${cx + 4} ${height - padB + 14})`}>
                {it.label.length > maxLabel ? `${it.label.slice(0, maxLabel - 1)}…` : it.label}
                <title>{it.label}</title>
              </text>
            </g>
          );
        })}
        <path d={pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} fill="none" stroke="var(--s2)" strokeWidth={2} />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--s2)">
            <title>{`Cumulative ${p.pct}%`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
