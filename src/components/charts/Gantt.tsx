import { daysBetween, monthShort } from '../../mocks/_gen';
import { useChartWidth } from './chartKit';

export interface GanttRow {
  id: string;
  label: string;
  sub?: string;
  start: string;
  end: string;
  progress?: number; // 0-100
  color?: string;
  group?: string;
  tag?: string; // small text at the bar end (e.g. P6 id)
}

export interface GanttMilestone {
  date: string;
  label: string;
  color?: string;
}

/** Simple date-scaled Gantt in SVG. Dates are ISO yyyy-mm-dd. Drawn at the real container width, so text keeps its true size. */
export function Gantt({
  rows,
  from,
  to,
  milestones = [],
  today,
  rowHeight = 28,
  labelWidth = 230,
  tickMode = 'month',
  onRowClick,
  width: fallbackWidth = 1000,
}: {
  rows: GanttRow[];
  from: string;
  to: string;
  milestones?: GanttMilestone[];
  today?: string;
  rowHeight?: number;
  labelWidth?: number;
  tickMode?: 'month' | 'year' | 'day';
  onRowClick?: (row: GanttRow) => void;
  /** fallback viewBox width before the container has been measured. */
  width?: number;
}) {
  const [wrap, measured] = useChartWidth(fallbackWidth, 520);
  const width = measured;
  const padT = 26;
  // keep room at the right for bar-end tags such as "32 d · OMR 11.8M"
  const tagRoom = rows.some((r) => r.tag) ? Math.min(150, Math.max(...rows.map((r) => (r.tag ?? '').length)) * 6 + 16) : 12;
  const labelW = Math.min(labelWidth, Math.round(width * 0.34));
  const maxChars = Math.max(10, Math.floor((labelW - 12) / 6.2));
  const chartW = Math.max(120, width - labelW - tagRoom);
  const total = Math.max(1, daysBetween(from, to));
  const height = padT + rows.length * rowHeight + 10;
  const x = (iso: string) => labelW + (Math.max(0, Math.min(total, daysBetween(from, iso))) / total) * chartW;

  const ticks: { iso: string; label: string }[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const cursor = new Date(start);
  if (tickMode === 'year') {
    cursor.setUTCMonth(0, 1);
    if (cursor < start) cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
    while (cursor.toISOString().slice(0, 10) <= to) {
      ticks.push({ iso: cursor.toISOString().slice(0, 10), label: String(cursor.getUTCFullYear()) });
      cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
    }
  } else if (tickMode === 'day') {
    while (cursor.toISOString().slice(0, 10) <= to) {
      ticks.push({ iso: cursor.toISOString().slice(0, 10), label: String(cursor.getUTCDate()) });
      cursor.setUTCDate(cursor.getUTCDate() + (total > 40 ? 7 : 2));
    }
  } else {
    cursor.setUTCDate(1);
    if (cursor < start) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    // enough months per label so neighbouring labels never touch (about 54px each)
    const months = Math.max(1, total / 30.4);
    const step = Math.max(1, Math.ceil((months * 54) / chartW));
    while (cursor.toISOString().slice(0, 10) <= to) {
      ticks.push({ iso: cursor.toISOString().slice(0, 10), label: `${monthShort(cursor)} ${String(cursor.getUTCFullYear()).slice(2)}` });
      cursor.setUTCMonth(cursor.getUTCMonth() + step);
    }
  }

  return (
    <div className="gantt-scroll" ref={wrap}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
        {ticks.map((t) => (
          <g key={t.iso}>
            <line x1={x(t.iso)} x2={x(t.iso)} y1={padT - 6} y2={height - 6} stroke="var(--border)" />
            <text x={x(t.iso) + 3} y={padT - 10} fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)">{t.label}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = padT + i * rowHeight;
          const x1 = x(r.start);
          const x2 = Math.max(x(r.end), x1 + 4);
          const color = r.color ?? 'var(--accent)';
          return (
            <g key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
              {i % 2 === 0 && <rect x={0} y={y} width={width} height={rowHeight} fill="var(--surface-2)" opacity={0.5} />}
              <text x={6} y={y + rowHeight / 2 + 4} fontSize={11.5} fill="var(--ink)">
                {r.label.length > maxChars ? `${r.label.slice(0, maxChars - 1)}…` : r.label}
                {r.label.length > maxChars && <title>{r.label}</title>}
              </text>
              <rect x={x1} y={y + 6} width={x2 - x1} height={rowHeight - 12} rx={3} fill={color} opacity={0.28}>
                <title>{`${r.label}: ${r.start} → ${r.end}`}</title>
              </rect>
              {r.progress !== undefined && <rect x={x1} y={y + 6} width={((x2 - x1) * r.progress) / 100} height={rowHeight - 12} rx={3} fill={color} />}
              {r.tag && <text x={Math.min(x2 + 5, width - tagRoom + 4)} y={y + rowHeight / 2 + 4} fontSize={9.5} fill="var(--ink-3)" fontFamily="var(--font-mono)">{r.tag}</text>}
            </g>
          );
        })}
        {milestones.map((m) => (
          <g key={m.label + m.date}>
            <line x1={x(m.date)} x2={x(m.date)} y1={padT - 6} y2={height - 6} stroke={m.color ?? 'var(--warn)'} strokeDasharray="3 3" />
            <path d={`M ${x(m.date)} ${padT - 8} l 5 6 l -5 6 l -5 -6 z`} fill={m.color ?? 'var(--warn)'}>
              <title>{`${m.label} (${m.date})`}</title>
            </path>
          </g>
        ))}
        {today && (
          <g>
            <line x1={x(today)} x2={x(today)} y1={padT - 6} y2={height - 6} stroke="var(--crit)" strokeWidth={1.5} />
            <text x={x(today) + 3} y={height - 8} fontSize={9.5} fill="var(--crit)" fontWeight={600}>Today</text>
          </g>
        )}
      </svg>
    </div>
  );
}
