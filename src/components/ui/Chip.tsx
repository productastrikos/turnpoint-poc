type Tone = 'good' | 'warn' | 'crit' | 'neutral' | 'accent';

export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}
