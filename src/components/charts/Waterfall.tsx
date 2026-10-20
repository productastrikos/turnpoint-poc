import { useChartWidth } from './chartKit';

export interface WaterfallStep {
  label: string;
  value: number;
  kind: 'total' | 'delta';
}

/** Waterfall / bridge chart (e.g. base estimate -> approved changes -> current estimate). */
export function Waterfall({ steps, height = 280, format = (v: number) => v.toLocaleString() }: { steps: WaterfallStep[]; height?: number; format?: (v: number) => string }) {
  const [wrap, width] = useChartWidth(640);
  const padL = 12;
  const padR = 12;
  const padT = 24;
  const padB = 56;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  let run = 0;
  const bars = steps.map((s) => {
    const start = s.kind === 'total' ? 0 : run;
    const end = s.kind === 'total' ? s.value : run + s.value;
    run = end;
    return { ...s, start, end };
  });
  const lo = Math.min(...bars.flatMap((b) => [b.start, b.end]));
  const hi = Math.max(...bars.flatMap((b) => [b.start, b.end]));
  // zoom the axis so deltas are visible when totals are large
  const axisLo = lo > 0 ? lo - (hi - lo) * 0.6 : lo;
  const y = (v: number) => padT + innerH - ((v - axisLo) / (hi - axisLo || 1)) * innerH;
  const slot = innerW / bars.length;
  const w = Math.min(56, slot * 0.64);
  return (
    <div ref={wrap}>
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
      <line x1={padL} x2={width - padR} y1={y(axisLo)} y2={y(axisLo)} stroke="var(--border)" />
      {bars.map((b, i) => {
        const cx = padL + slot * i + slot / 2;
        const top = y(Math.max(b.start, b.end));
        const h = Math.max(2, Math.abs(y(b.start) - y(b.end)));
        const color = b.kind === 'total' ? 'var(--accent)' : b.value >= 0 ? 'var(--warn)' : 'var(--good)';
        return (
          <g key={b.label}>
            <rect x={cx - w / 2} y={top} width={w} height={h} rx={2} fill={color}>
              <title>{`${b.label}: ${format(b.value)}`}</title>
            </rect>
            <text x={cx} y={top - 5} fontSize={10} textAnchor="middle" fill="var(--ink)" fontFamily="var(--font-mono)">
              {b.kind === 'delta' && b.value > 0 ? '+' : ''}{format(b.value)}
            </text>
            <text x={cx} y={height - padB + 14} fontSize={10} fill="var(--ink-2)" textAnchor="end" transform={`rotate(-28 ${cx} ${height - padB + 14})`}>
              {b.label.length > 24 ? `${b.label.slice(0, 23)}…` : b.label}
            </text>
            {i < bars.length - 1 && <line x1={cx + w / 2} x2={cx + slot - w / 2} y1={y(b.end)} y2={y(b.end)} stroke="var(--ink-3)" strokeDasharray="2 2" />}
          </g>
        );
      })}
    </svg>
    </div>
  );
}
