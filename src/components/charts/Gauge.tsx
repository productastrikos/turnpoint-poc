/** Semicircular gauge. Tone follows the value unless overridden. */
export function Gauge({
  value,
  max = 100,
  label,
  size = 150,
  good = 85,
  warn = 60,
  unit = '%',
}: {
  value: number;
  max?: number;
  label?: string;
  size?: number;
  good?: number;
  warn?: number;
  unit?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const arc = (p: number) => {
    const a = Math.PI * (1 - p);
    return `${cx + r * Math.cos(a)} ${cy - r * Math.sin(a)}`;
  };
  const pctVal = (value / max) * 100;
  const color = pctVal >= good ? 'var(--good)' : pctVal >= warn ? 'var(--warn)' : 'var(--crit)';
  return (
    <div className="gauge" style={{ width: size }}>
      <svg viewBox={`0 0 ${size} ${size / 2 + 14}`} width={size} height={size / 2 + 14} role="img" aria-label={`${label ?? 'Gauge'} ${Math.round(pctVal)}${unit}`}>
        <path d={`M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(1)}`} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} strokeLinecap="round" />
        {pct > 0 && <path d={`M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(pct)}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={size / 5} fontWeight={700} fill="var(--ink)" fontFamily="var(--font-body)">{Math.round(pctVal)}{unit}</text>
      </svg>
      {label && <div className="gauge-label">{label}</div>}
    </div>
  );
}
