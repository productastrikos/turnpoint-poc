import { isWhole, niceRange, useChartWidth } from './chartKit';

export interface LineSeries {
  name: string;
  data: (number | null)[];
  color?: string;
  dashed?: boolean;
  area?: boolean;
  width?: number;
}

export interface LineMarker {
  index: number;
  label: string;
}

const firstIdx = (d: (number | null)[]) => Math.max(0, d.findIndex((v) => v !== null && !Number.isNaN(v)));
const lastIdx = (d: (number | null)[]) => d.reduce<number>((acc, v, i) => (v !== null && !Number.isNaN(v) ? i : acc), 0);

const PALETTE = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];

/** Generic multi-series line chart with optional confidence band and vertical markers. Hand-rolled SVG. */
export function LineChart({
  labels,
  series,
  height = 240,
  yMin,
  yMax,
  yFormat,
  band,
  markers,
  xTickEvery,
  legend = true,
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  yMin?: number;
  yMax?: number;
  yFormat?: (v: number) => string;
  band?: { lo: (number | null)[]; hi: (number | null)[]; color?: string };
  markers?: LineMarker[];
  xTickEvery?: number;
  legend?: boolean;
}) {
  const [wrap, width] = useChartWidth(640);
  const fmt = yFormat ?? ((v: number) => String(Number(v.toFixed(2))));
  const padL = 48;
  const padR = 14;
  const padT = 12;
  const padB = 26;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const all = series.flatMap((s) => s.data).concat(band ? [...band.lo, ...band.hi] : []).filter((v): v is number => v !== null && !Number.isNaN(v));
  const dataMax = Math.max(...all, 1e-9);
  const dataMin = yMin ?? Math.min(0, ...all);
  const auto = yMax === undefined ? niceRange(dataMin, dataMax, 4, yMin === undefined && isWhole(all)) : null;
  const lo = dataMin;
  const hi = yMax ?? auto!.hi;
  const n = Math.max(labels.length - 1, 1);
  const x = (i: number) => padL + (i / n) * innerW;
  const y = (v: number) => padT + innerH - ((v - lo) / (hi - lo || 1)) * innerH;
  const ticks = auto ? auto.ticks : [0, 0.25, 0.5, 0.75, 1].map((t) => lo + (hi - lo) * t);
  const every = xTickEvery ?? Math.max(1, Math.ceil(labels.length / 8));

  const path = (data: (number | null)[]) => {
    let d = '';
    let pen = false;
    data.forEach((v, i) => {
      if (v === null || Number.isNaN(v)) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };

  const bandPath = () => {
    if (!band) return '';
    const idx = band.hi.map((_, i) => i).filter((i) => band.hi[i] !== null && band.lo[i] !== null);
    if (!idx.length) return '';
    const top = idx.map((i, k) => `${k === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(band.hi[i] as number).toFixed(1)}`).join(' ');
    const bottom = [...idx].reverse().map((i) => `L ${x(i).toFixed(1)} ${y(band.lo[i] as number).toFixed(1)}`).join(' ');
    return `${top} ${bottom} Z`;
  };

  return (
    <div ref={wrap}>
      {legend && (
        <div className="chart-legend">
          {series.map((s, i) => (
            <span key={s.name}>
              <i style={{ background: s.dashed ? 'transparent' : s.color ?? PALETTE[i % PALETTE.length], borderTop: s.dashed ? `2px dashed ${s.color ?? PALETTE[i % PALETTE.length]}` : undefined }} />
              {s.name}
            </span>
          ))}
          {band && (
            <span>
              <i style={{ background: band.color ?? 'var(--accent)', opacity: 0.25 }} />
              Confidence band
            </span>
          )}
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)">{fmt(t)}</text>
          </g>
        ))}
        {band && <path d={bandPath()} fill={band.color ?? 'var(--accent)'} opacity={0.16} />}
        {series.map((s, i) => {
          const c = s.color ?? PALETTE[i % PALETTE.length];
          const d = path(s.data);
          return (
            <g key={s.name}>
              {s.area && d && <path d={`${d} L ${x(lastIdx(s.data))} ${y(lo)} L ${x(firstIdx(s.data))} ${y(lo)} Z`} fill={c} opacity={0.1} />}
              <path d={d} fill="none" stroke={c} strokeWidth={s.width ?? 2.2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {markers?.map((m) => (
          <g key={m.label + m.index}>
            <line x1={x(m.index)} x2={x(m.index)} y1={padT} y2={height - padB} stroke="var(--ink-3)" strokeDasharray="3 3" />
            <text x={x(m.index) + 4} y={padT + 10} fontSize={10} fill="var(--ink-2)">{m.label}</text>
          </g>
        ))}
        <line x1={padL} x2={width - padR} y1={height - padB} y2={height - padB} stroke="var(--border)" />
        {labels.map((l, i) =>
          i % every === 0 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)">{l}</text>
          ) : null
        )}
      </svg>
    </div>
  );
}
