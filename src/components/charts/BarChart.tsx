import { isWhole, niceScale, useChartWidth } from './chartKit';

export interface BarSeries {
  name: string;
  data: number[];
  color?: string;
}

const PALETTE = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];

/** Vertical grouped / stacked bar chart. Draws at the container width; the y axis uses round tick values. */
export function BarChart({
  labels,
  series,
  height = 240,
  stacked = false,
  yFormat,
  refLine,
  yMax,
  legend = true,
}: {
  labels: string[];
  series: BarSeries[];
  height?: number;
  stacked?: boolean;
  yFormat?: (v: number) => string;
  refLine?: { value: number; label: string };
  yMax?: number;
  legend?: boolean;
}) {
  const [wrap, width] = useChartWidth(640);
  const fmt = yFormat ?? ((v: number) => String(Number(v.toFixed(2))));
  const padL = 46;
  const padR = 12;
  const padT = 12;
  const padB = 30;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const totals = labels.map((_, i) => (stacked ? series.reduce((s, x) => s + (x.data[i] ?? 0), 0) : Math.max(...series.map((x) => x.data[i] ?? 0))));
  const peak = Math.max(...totals, refLine?.value ?? 0, 1);
  const scale = yMax !== undefined ? { hi: yMax, ticks: [0, 0.25, 0.5, 0.75, 1].map((t) => yMax * t) } : niceScale(peak, 4, isWhole(series.flatMap((s) => s.data)));
  const hi = scale.hi;
  const y = (v: number) => padT + innerH - (v / hi) * innerH;
  const slot = innerW / labels.length;
  const barW = Math.min(46, (slot * 0.7) / (stacked ? 1 : series.length));
  const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(innerW / 52))));
  const maxChars = Math.max(4, Math.floor((slot * every) / 6.4));
  const clip = (l: string) => (l.length > maxChars ? `${l.slice(0, maxChars - 1)}…` : l);

  return (
    <div ref={wrap}>
      {legend && series.length > 1 && (
        <div className="chart-legend">
          {series.map((s, i) => (
            <span key={s.name}>
              <i style={{ background: s.color ?? PALETTE[i % PALETTE.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
        {scale.ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)">{fmt(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => {
          const cx = padL + slot * i + slot / 2;
          let acc = 0;
          return (
            <g key={l + i}>
              {series.map((s, si) => {
                const v = s.data[i] ?? 0;
                const color = s.color ?? PALETTE[si % PALETTE.length];
                if (stacked) {
                  const y0 = y(acc + v);
                  const h = y(acc) - y0;
                  acc += v;
                  return (
                    <rect key={s.name} x={cx - barW / 2} y={y0} width={barW} height={Math.max(h, 0)} fill={color} rx={2}>
                      <title>{`${l} — ${s.name}: ${fmt(v)}`}</title>
                    </rect>
                  );
                }
                const bx = cx - (barW * series.length) / 2 + si * barW;
                return (
                  <rect key={s.name} x={bx} y={y(v)} width={barW - 2} height={Math.max(y(0) - y(v), 0)} fill={color} rx={2}>
                    <title>{`${l} — ${s.name}: ${fmt(v)}`}</title>
                  </rect>
                );
              })}
              {i % every === 0 && (
                <text x={cx} y={height - 12} textAnchor="middle" fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)">{clip(l)}</text>
              )}
            </g>
          );
        })}
        {refLine && (
          <g>
            <line x1={padL} x2={width - padR} y1={y(refLine.value)} y2={y(refLine.value)} stroke="var(--crit)" strokeDasharray="5 4" />
            <text x={padL + 4} y={y(refLine.value) - 4} fontSize={10} fill="var(--crit)">{refLine.label}</text>
          </g>
        )}
        <line x1={padL} x2={width - padR} y1={y(0)} y2={y(0)} stroke="var(--border)" />
      </svg>
    </div>
  );
}
