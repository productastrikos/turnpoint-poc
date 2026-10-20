export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

const PALETTE = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

export function Donut({
  segments,
  size = 150,
  thickness = 22,
  centerValue,
  centerLabel,
  legend = true,
  valueFormat,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
  legend?: boolean;
  /** how the legend shows a segment value (default: the raw number). */
  valueFormat?: (v: number) => string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color ?? PALETTE[i % PALETTE.length]}
              strokeWidth={thickness}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        {centerValue && (
          <>
            <text x={size / 2} y={size / 2 + 2} textAnchor="middle" fontSize={size / 6} fontWeight={600} fill="var(--ink)" fontFamily="var(--font-mono)">{centerValue}</text>
            {centerLabel && <text x={size / 2} y={size / 2 + size / 8 + 4} textAnchor="middle" fontSize={10} fill="var(--ink-3)">{centerLabel}</text>}
          </>
        )}
      </svg>
      {legend && (
        <div className="donut-legend">
          {segments.map((s, i) => (
            <div key={s.label}>
              <i style={{ background: s.color ?? PALETTE[i % PALETTE.length] }} />
              <span>{s.label}</span>
              <b className="mono">{valueFormat ? valueFormat(s.value) : s.value}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
