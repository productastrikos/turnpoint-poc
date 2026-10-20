import type { SCurvePoint } from '../../types';
import { useChartWidth } from './chartKit';

export function SCurveChart({ data, height = 260 }: { data: SCurvePoint[]; height?: number }) {
  const [wrap, width] = useChartWidth(640);
  const padL = 34;
  const padR = 16;
  const padB = 28;
  const padT = 16;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  if (data.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Loading…</div>;
  }

  const maxDay = Math.max(...data.map((d) => d.day));
  const x = (day: number) => padL + (day / maxDay) * innerW;
  const y = (val: number) => padT + innerH - (val / 100) * innerH;

  const plannedPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.day)} ${y(d.planned)}`).join(' ');
  const actualPts = data.filter((d) => !Number.isNaN(d.actual));
  const areaPath =
    actualPts.length > 0
      ? `${actualPts.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.day)} ${y(d.actual)}`).join(' ')} L ${x(actualPts[actualPts.length - 1].day)} ${y(0)} L ${x(actualPts[0].day)} ${y(0)} Z`
      : '';
  const actualPath = actualPts.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.day)} ${y(d.actual)}`).join(' ');
  const today = actualPts[actualPts.length - 1];
  const variance = today ? today.actual - today.planned : 0;

  const gridLines = [0, 25, 50, 75, 100];
  const dayTicks = [0, Math.round(maxDay / 2), maxDay];

  return (
    <div ref={wrap}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 8, fontSize: 11.5, color: 'var(--ink-2)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 14, height: 0, borderTop: '2px dashed var(--ink-3)', display: 'inline-block' }} />
          Planned
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 14, height: 2, background: 'var(--accent)', display: 'inline-block', borderRadius: 2 }} />
          Actual
        </span>
        <span style={{ marginLeft: 'auto' }} className="mono">
          {variance >= 0 ? '+' : ''}{variance.toFixed(1)} pts vs plan today
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="S-curve: planned vs actual progress">
        <defs>
          <linearGradient id="scurve-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((g) => (
          <g key={g}>
            <line x1={padL} x2={width - padR} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeWidth={1} />
            <text x={4} y={y(g) + 4} fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)">{g}</text>
          </g>
        ))}

        <path d={areaPath} fill="url(#scurve-fill)" />
        <path d={plannedPath} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="5 4" />
        <path d={actualPath} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {actualPts.map((d) => (
          <circle key={d.day} cx={x(d.day)} cy={y(d.actual)} r={2.5} fill="var(--accent)">
            <title>{`Day ${d.day} — actual ${d.actual}%, planned ${d.planned}%`}</title>
          </circle>
        ))}

        {today && (
          <>
            <line x1={x(today.day)} x2={x(today.day)} y1={padT} y2={height - padB} stroke="var(--accent)" strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
            <circle cx={x(today.day)} cy={y(today.actual)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2}>
              <title>{`Today — Day ${today.day}: ${today.actual}% actual vs ${today.planned}% planned`}</title>
            </circle>
          </>
        )}

        <line x1={padL} x2={width - padR} y1={height - padB} y2={height - padB} stroke="var(--border)" />
        {dayTicks.map((d) => (
          <text key={d} x={x(d)} y={height - 8} fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)" textAnchor="middle">
            Day {d}
          </text>
        ))}
      </svg>
    </div>
  );
}
