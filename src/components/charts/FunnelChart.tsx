export interface FunnelStage {
  label: string;
  value: number;
}

export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  const width = 420;
  const stageH = 36;
  const gap = 10;
  const height = stages.length * (stageH + gap);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      {stages.map((s, i) => {
        const w = Math.max(28, (s.value / max) * width);
        const xOff = (width - w) / 2;
        const yOff = i * (stageH + gap);
        const prev = i > 0 ? stages[i - 1].value : null;
        const dropPct = prev && prev > 0 ? Math.round(((prev - s.value) / prev) * 100) : null;
        const isLast = i === stages.length - 1;
        return (
          <g key={s.label}>
            <rect
              x={xOff}
              y={yOff}
              width={w}
              height={stageH}
              rx={7}
              fill={isLast ? 'var(--good-solid)' : 'var(--btn)'}
            >
              <title>{`${s.label}: ${s.value}${dropPct ? ` (${dropPct}% fewer than previous stage)` : ''}`}</title>
            </rect>
            <text x={width / 2} y={yOff + stageH / 2 - 3} textAnchor="middle" fontSize={12} fontWeight={600} fill="#fff">
              {s.label}
            </text>
            <text x={width / 2} y={yOff + stageH / 2 + 12} textAnchor="middle" fontSize={10} fill="#fff" fontFamily="var(--font-mono)">
              {s.value}{dropPct !== null && dropPct > 0 ? ` · -${dropPct}%` : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
