import type { Tone } from '../../types';

export interface NetNode {
  id: string;
  label: string;
  sub?: string;
  lane: number;
  tone?: Tone;
  tag?: string;
}

const STROKE: Record<Tone, string> = {
  good: 'var(--good)',
  warn: 'var(--warn)',
  crit: 'var(--crit)',
  accent: 'var(--accent)',
  neutral: 'var(--border)',
};

/** Left-to-right dependency network. Column = longest path depth; row = lane (e.g. CP1/CP2/CP3). */
export function NetworkGraph({
  nodes,
  edges,
  laneLabels,
  highlight = [],
  onNodeClick,
  activeId,
}: {
  nodes: NetNode[];
  edges: [string, string][];
  laneLabels: string[];
  highlight?: string[];
  onNodeClick?: (id: string) => void;
  activeId?: string | null;
}) {
  const W = 186;
  const H = 52;
  const gx = 42;
  const gy = 26;
  const padL = 46;
  const padT = 10;

  const preds: Record<string, string[]> = {};
  nodes.forEach((n) => (preds[n.id] = []));
  edges.forEach(([a, b]) => preds[b]?.push(a));
  const depth: Record<string, number> = {};
  const calc = (id: string, seen: Set<string> = new Set()): number => {
    if (depth[id] !== undefined) return depth[id];
    if (seen.has(id)) return 0;
    seen.add(id);
    const p = preds[id] ?? [];
    depth[id] = p.length ? 1 + Math.max(...p.map((x) => calc(x, seen))) : 0;
    return depth[id];
  };
  nodes.forEach((n) => calc(n.id));
  // within a lane, nodes sharing a column are stacked into sub-rows so they never overlap
  const cellCount: Record<string, number> = {};
  const sub: Record<string, number> = {};
  const laneRows: number[] = laneLabels.map(() => 1);
  nodes.forEach((n) => {
    const key = `${n.lane}:${depth[n.id]}`;
    const k = cellCount[key] ?? 0;
    cellCount[key] = k + 1;
    sub[n.id] = k;
    laneRows[n.lane] = Math.max(laneRows[n.lane], k + 1);
  });
  const laneTop: number[] = [];
  laneRows.reduce((acc, rows, i) => {
    laneTop[i] = acc;
    return acc + rows * (H + gy);
  }, padT);
  const pos: Record<string, { x: number; y: number }> = {};
  nodes.forEach((n) => {
    pos[n.id] = { x: padL + depth[n.id] * (W + gx), y: laneTop[n.lane] + sub[n.id] * (H + gy) };
  });
  const cols = Math.max(...Object.values(depth)) + 1;
  const width = padL + cols * (W + gx);
  const height = laneTop[laneTop.length - 1] + laneRows[laneRows.length - 1] * (H + gy);

  return (
    <div className="gantt-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ maxWidth: 'none' }} role="img">
        <defs>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill="var(--ink-3)" />
          </marker>
          <marker id="arrow-hot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill="var(--crit)" />
          </marker>
        </defs>
        {laneLabels.map((l, i) => (
          <g key={l}>
            <rect x={0} y={laneTop[i] - gy / 2} width={width} height={laneRows[i] * (H + gy)} fill="var(--surface-2)" opacity={i % 2 === 0 ? 0.5 : 0} />
            <text x={6} y={laneTop[i] + H / 2 + 4} fontSize={12} fontWeight={700} fill="var(--ink-3)" fontFamily="var(--font-display)">{l}</text>
          </g>
        ))}
        {edges.map(([a, b]) => {
          const pa = pos[a];
          const pb = pos[b];
          if (!pa || !pb) return null;
          const x1 = pa.x + W;
          const y1 = pa.y + H / 2;
          const x2 = pb.x;
          const y2 = pb.y + H / 2;
          const mx = (x1 + x2) / 2;
          const hot = highlight.includes(a) && highlight.includes(b);
          return (
            <path
              key={`${a}-${b}`}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 2} ${y2}`}
              fill="none"
              stroke={hot ? 'var(--crit)' : 'var(--ink-3)'}
              strokeWidth={hot ? 2.2 : 1.3}
              opacity={hot ? 1 : 0.7}
              markerEnd={hot ? 'url(#arrow-hot)' : 'url(#arrow)'}
            />
          );
        })}
        {nodes.map((n) => {
          const p = pos[n.id];
          const tone = n.tone ?? 'neutral';
          const active = activeId === n.id;
          return (
            <g key={n.id} transform={`translate(${p.x} ${p.y})`} onClick={onNodeClick ? () => onNodeClick(n.id) : undefined} style={{ cursor: onNodeClick ? 'pointer' : 'default' }}>
              <rect width={W} height={H} rx={7} fill="var(--surface)" stroke={active ? 'var(--accent)' : STROKE[tone]} strokeWidth={active ? 2.5 : tone === 'neutral' ? 1 : 2} />
              <rect width={5} height={H} rx={2} fill={STROKE[tone]} />
              <text x={13} y={19} fontSize={11} fontWeight={600} fill="var(--ink)">{n.label.length > 27 ? `${n.label.slice(0, 26)}…` : n.label}</text>
              <text x={13} y={35} fontSize={9.5} fill="var(--ink-3)" fontFamily="var(--font-mono)">{n.id}{n.sub ? ` · ${n.sub}` : ''}</text>
              {n.tag && <text x={W - 8} y={H - 8} fontSize={9} textAnchor="end" fill="var(--accent-strong)" fontFamily="var(--font-mono)">{n.tag}</text>}
              {/* native hover tooltip: the full name and id, since the label above is cut at 27 characters */}
              <title>{`${n.label} · ${n.id}${n.sub ? ` · ${n.sub}` : ''}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
