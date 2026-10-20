/**
 * Diverging bars for a model explanation: each signal's push on the log-odds, left (lowers the probability) or
 * right (raises it). Exact for the linear models used in TURNPOINT, so "why 91 %?" has an honest answer.
 */
export function ExplainBars({ items, labels = ['lowers the probability', 'raises the probability'], labelWidth = 220 }: { items: { label: string; contrib: number }[]; labels?: [string, string]; labelWidth?: number }) {
  const max = Math.max(...items.map((c) => Math.abs(c.contrib)), 0.5);
  const cols = `${labelWidth}px 1fr 1fr 48px`;
  return (
    <div className="stack" style={{ gap: 5 }}>
      {items.map((c) => (
        <div key={c.label} style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--ink-2)' }}>{c.label}</span>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {c.contrib < 0 && <div style={{ width: `${(Math.abs(c.contrib) / max) * 100}%`, height: 10, borderRadius: 4, background: 'var(--good)' }} />}
          </div>
          <div>{c.contrib > 0 && <div style={{ width: `${(c.contrib / max) * 100}%`, height: 10, borderRadius: 4, background: 'var(--crit)' }} />}</div>
          <span className="mono" style={{ textAlign: 'right', color: 'var(--ink-2)' }}>{c.contrib >= 0 ? '+' : ''}{c.contrib.toFixed(2)}</span>
        </div>
      ))}
      <div className="small muted" style={{ display: 'grid', gridTemplateColumns: cols, gap: 8 }}>
        <span />
        <span style={{ textAlign: 'right' }}>{labels[0]}</span>
        <span>{labels[1]}</span>
        <span />
      </div>
    </div>
  );
}
