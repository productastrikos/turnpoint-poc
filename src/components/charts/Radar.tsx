const PALETTE = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];

export function Radar({
  axes,
  series,
  size = 280,
  max = 100,
}: {
  axes: string[];
  series: { name: string; values: number[]; color?: string }[];
  size?: number;
  max?: number;
}) {
  const c = size / 2;
  const r = size / 2 - 42;
  const n = axes.length;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + (r * v) / max * Math.cos(a), c + (r * v) / max * Math.sin(a)] as const;
  };
  return (
    <div>
      <div className="chart-legend">
        {series.map((s, i) => (
          <span key={s.name}>
            <i style={{ background: s.color ?? PALETTE[i % PALETTE.length] }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size + 40 }} role="img">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <polygon key={t} points={axes.map((_, i) => pt(i, max * t).join(',')).join(' ')} fill="none" stroke="var(--border)" />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, max);
          const [lx, ly] = pt(i, max * 1.2);
          return (
            <g key={a}>
              <line x1={c} y1={c} x2={x} y2={y} stroke="var(--border)" />
              <text x={lx} y={ly + 3} fontSize={10} textAnchor="middle" fill="var(--ink-2)">{a}</text>
            </g>
          );
        })}
        {series.map((s, si) => {
          const color = s.color ?? PALETTE[si % PALETTE.length];
          return (
            <polygon key={s.name} points={s.values.map((v, i) => pt(i, v).join(',')).join(' ')} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2}>
              <title>{s.name}</title>
            </polygon>
          );
        })}
      </svg>
    </div>
  );
}
