export function BarRow({
  label,
  value,
  max,
  formatted,
  tone = 'accent',
  labelWidth = 90,
  showPct = true,
}: {
  label: string;
  value: number;
  max: number;
  formatted?: string;
  tone?: 'accent' | 'good' | 'warn' | 'crit';
  /** width of the label column in px (default 90). */
  labelWidth?: number;
  /** show the bar's share of `max` in its own column (hide it when `formatted` already says what the bar means). */
  showPct?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }} title={`${label}: ${formatted ?? value} (${pct.toFixed(0)}% of plan)`}>
      <span style={{ width: labelWidth, fontSize: 12.5, color: 'var(--ink-2)', flexShrink: 0, overflowWrap: 'anywhere' }}>{label}</span>
      <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 7, height: 18, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: `var(--${tone})`,
            borderRadius: 7,
            transition: 'width 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
      {/* the percentage sits in its own column, never on top of the bar, so it is readable in both themes */}
      {showPct && (
        <span className="mono" style={{ width: 38, textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', flexShrink: 0 }}>
          {pct.toFixed(0)}%
        </span>
      )}
      <span className="mono" style={{ width: 96, textAlign: 'right', fontSize: 12.5, flexShrink: 0, fontWeight: 600 }}>
        {formatted ?? value}
      </span>
    </div>
  );
}
