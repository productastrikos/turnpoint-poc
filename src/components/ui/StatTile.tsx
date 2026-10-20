import type { KPI } from '../../types';

export function StatTile({ label, value, delta, trend, tone, onClick }: KPI & { onClick?: () => void }) {
  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const clickable = Boolean(onClick);
  // a rising number that is flagged warn/crit (more overdue permits, more path changes) must not read as good news
  const adverse = trend === 'up' && (tone === 'crit' || tone === 'warn') ? ` adverse-${tone}` : '';
  return (
    <div
      className={`card card-pad stat-tile ${clickable ? 'stat-tile-clickable' : ''}`}
      onClick={onClick}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick?.()) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <span className="eyebrow">{label}</span>
      <span className={`stat-value mono tone-${tone ?? 'neutral'}`}>{value}</span>
      {delta && <span className={`stat-delta ${trend ?? 'flat'}${adverse}`}>{arrow} {delta}</span>}
    </div>
  );
}