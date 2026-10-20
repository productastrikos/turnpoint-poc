/** Div-grid heatmap. `mode="ready"` colours low=red -> high=green; `mode="load"` uses a single accent ramp. */
export function Heatmap({
  rows,
  cols,
  values,
  intensity,
  max,
  mode = 'load',
  format = (v: number) => String(Math.round(v)),
  onCellClick,
  rowLabelWidth = 150,
  cellMin = 46,
}: {
  rows: string[];
  cols: string[];
  values: (number | null)[][];
  /** Optional separate numbers that drive the colour (values are then only labels). */
  intensity?: (number | null)[][];
  max?: number;
  mode?: 'ready' | 'load';
  format?: (v: number) => string;
  onCellClick?: (row: string, col: string, value: number | null) => void;
  rowLabelWidth?: number;
  cellMin?: number;
}) {
  const hi = max ?? Math.max(1, ...(intensity ?? values).flat().filter((v): v is number => v !== null));
  const bg = (v: number | null) => {
    if (v === null) return 'transparent';
    if (mode === 'ready') {
      const p = Math.max(0, Math.min(1, v / hi));
      const c = p >= 0.85 ? 'var(--good)' : p >= 0.6 ? 'var(--warn)' : 'var(--crit)';
      return `color-mix(in srgb, ${c} ${28 + p * 30}%, var(--surface))`;
    }
    const p = Math.max(0, Math.min(1, v / hi));
    return `color-mix(in srgb, var(--accent) ${Math.round(p * 78)}%, var(--surface))`;
  };
  return (
    <div className="heatmap" style={{ gridTemplateColumns: `${rowLabelWidth}px repeat(${cols.length}, minmax(${cellMin}px, 1fr))` }}>
      <div />
      {cols.map((c) => (
        <div key={c} className="hm-col">{c}</div>
      ))}
      {rows.map((r, ri) => (
        <div key={r} style={{ display: 'contents' }}>
          <div className="hm-row">{r}</div>
          {cols.map((c, ci) => {
            const v = values[ri]?.[ci] ?? null;
            const iv = intensity ? (v === null ? null : intensity[ri]?.[ci] ?? null) : v;
            const strong = mode === 'load' ? iv !== null && iv / hi > 0.55 : false;
            return (
              <div
                key={c}
                className={`hm-cell ${onCellClick ? 'clickable' : ''}`}
                style={{ background: bg(iv), color: strong ? '#fff' : 'var(--ink)' }}
                title={`${r} / ${c}: ${v === null ? '—' : format(v)}`}
                onClick={onCellClick ? () => onCellClick(r, c, v) : undefined}
              >
                {v === null ? '' : format(v)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
