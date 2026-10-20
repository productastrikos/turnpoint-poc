import type { Tone } from '../../types';
import { isWhole, niceScale, useChartWidth } from './chartKit';

export interface BubblePoint {
  id: string;
  x: number;
  y: number;
  r: number; // 0-1 relative size
  label: string;
  tone?: Tone;
  title?: string;
}

const COLOR: Record<Tone, string> = {
  good: 'var(--good)',
  warn: 'var(--warn)',
  crit: 'var(--crit)',
  accent: 'var(--accent)',
  neutral: 'var(--ink-3)',
};

/** Bubble / scatter chart with quadrant split lines. */
export function Bubble({
  points,
  xLabel,
  yLabel,
  xMax,
  yMax,
  splitX,
  splitY,
  height = 340,
  onPointClick,
  xFormat = (v: number) => String(Math.round(v)),
  yFormat = (v: number) => String(Math.round(v)),
}: {
  points: BubblePoint[];
  xLabel: string;
  yLabel: string;
  xMax?: number;
  yMax?: number;
  splitX?: number;
  splitY?: number;
  height?: number;
  onPointClick?: (p: BubblePoint) => void;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
}) {
  const [wrap, width] = useChartWidth(640);
  const padL = 52;
  const padR = 16;
  const padT = 14;
  const padB = 40;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const xs = xMax !== undefined ? { hi: xMax, ticks: [0, 0.25, 0.5, 0.75, 1].map((t) => xMax * t) } : niceScale(Math.max(...points.map((p) => p.x), 1), 4, isWhole(points.map((p) => p.x)));
  const ys = yMax !== undefined ? { hi: yMax, ticks: [0, 0.25, 0.5, 0.75, 1].map((t) => yMax * t) } : niceScale(Math.max(...points.map((p) => p.y), 1), 4, isWhole(points.map((p) => p.y)));
  const xm = xs.hi;
  const ym = ys.hi;
  const x = (v: number) => padL + (v / xm) * innerW;
  const y = (v: number) => padT + innerH - (v / ym) * innerH;
  return (
    <div ref={wrap}>
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
      {ys.ticks.map((t) => (
        <g key={`y${t}`}>
          <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" />
          <text x={padL - 6} y={y(t) + 3} fontSize={10} textAnchor="end" fill="var(--ink-3)" fontFamily="var(--font-mono)">{yFormat(t)}</text>
        </g>
      ))}
      {xs.ticks.map((t) => (
        <text key={`x${t}`} x={x(t)} y={height - padB + 14} fontSize={10} textAnchor="middle" fill="var(--ink-3)" fontFamily="var(--font-mono)">{xFormat(t)}</text>
      ))}      {splitX !== undefined && <line x1={x(splitX)} x2={x(splitX)} y1={padT} y2={padT + innerH} stroke="var(--ink-3)" strokeDasharray="4 4" />}
      {splitY !== undefined && <line x1={padL} x2={width - padR} y1={y(splitY)} y2={y(splitY)} stroke="var(--ink-3)" strokeDasharray="4 4" />}
      {points.map((p, pi) => {
        // label only when it will not sit on top of an earlier bubble's label
        const labelled = !points.slice(0, pi).some((q) => Math.hypot(x(q.x) - x(p.x), y(q.y) - y(p.y)) < 22);
        return (
        <g key={p.id} onClick={onPointClick ? () => onPointClick(p) : undefined} style={{ cursor: onPointClick ? 'pointer' : 'default' }}>
          <circle cx={x(p.x)} cy={y(p.y)} r={6 + p.r * 16} fill={COLOR[p.tone ?? 'accent']} opacity={0.55} stroke={COLOR[p.tone ?? 'accent']} strokeWidth={1.5}>
            <title>{p.title ?? p.label}</title>
          </circle>
          {labelled && <text x={x(p.x)} y={y(p.y) + 3} fontSize={8.5} textAnchor="middle" fill="var(--ink)" fontFamily="var(--font-mono)" fontWeight={600}>{p.label}</text>}
        </g>
        );
      })}
      <text x={padL + innerW / 2} y={height - 4} fontSize={11} textAnchor="middle" fill="var(--ink-2)">{xLabel}</text>
      <text x={12} y={padT + innerH / 2} fontSize={11} textAnchor="middle" fill="var(--ink-2)" transform={`rotate(-90 12 ${padT + innerH / 2})`}>{yLabel}</text>
    </svg>
    </div>
  );
}
