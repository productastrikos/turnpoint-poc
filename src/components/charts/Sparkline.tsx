export function Sparkline({
  data,
  width = 96,
  height = 28,
  color = 'var(--accent)',
  target,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  target?: number;
}) {
  if (data.length < 2) return null;
  const lo = Math.min(...data, target ?? Infinity);
  const hi = Math.max(...data, target ?? -Infinity);
  const span = hi - lo || 1;
  const x = (i: number) => 2 + (i / (data.length - 1)) * (width - 4);
  const y = (v: number) => height - 3 - ((v - lo) / span) * (height - 6);
  const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-hidden="true">
      {target !== undefined && <line x1={2} x2={width - 2} y1={y(target)} y2={y(target)} stroke="var(--ink-3)" strokeDasharray="2 2" />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={2.4} fill={color} />
    </svg>
  );
}
