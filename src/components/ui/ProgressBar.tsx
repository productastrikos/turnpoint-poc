import type { Tone } from '../../types';

export function ProgressBar({
  value,
  max = 100,
  tone,
  showLabel = true,
  height = 8,
  label,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  showLabel?: boolean;
  height?: number;
  label?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const t = tone ?? (pct >= 90 ? 'good' : pct >= 50 ? 'accent' : pct >= 25 ? 'warn' : 'crit');
  const color = t === 'neutral' ? 'var(--ink-3)' : t === 'accent' ? 'var(--accent)' : `var(--${t})`;
  return (
    <div className="progress" title={`${label ?? ''} ${pct.toFixed(0)}%`.trim()}>
      <div className="progress-track" style={{ height }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {showLabel && <span className="mono progress-label">{pct.toFixed(0)}%</span>}
    </div>
  );
}
