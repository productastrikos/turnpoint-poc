import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatusChip } from '../../components/ui/StatusChip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { BarChart } from '../../components/charts/BarChart';
import { advancePostTa, listPostTa } from '../../services/closeoutService';
import type { PostTaItem } from '../../mocks/closeoutMock';
import { areaLabel } from '../../mocks/master';

const pctOf = (rows: PostTaItem[]) => {
  const w = rows.reduce((s, r) => s + r.weight, 0) || 1;
  return Math.round((rows.reduce((s, r) => s + r.weight * (r.status === 'Complete' ? 1 : r.status === 'In progress' ? 0.5 : 0), 0) / w) * 100);
};

const config: TrackerConfig<PostTaItem> = {
  title: 'Post-TA Work Completion',
  subtitle: 'Work that is completed after start-up (scaffold removal, insulation reinstatement, hot-bolting checks, calibration, paint, as-built updates) by area, weighted by man-hours. The turnaround is not closed until every area reaches 100%.',
  checklist: 'C2',
  load: listPostTa,
  kpis: (rows) => [
    { label: 'Post-TA items', value: String(rows.length) },
    { label: 'Complete (man-hour weighted)', value: `${pctOf(rows)}%`, tone: 'accent' },
    { label: 'Open items', value: String(rows.filter((r) => r.status === 'Open').length), tone: 'warn' },
    { label: 'In progress', value: String(rows.filter((r) => r.status === 'In progress').length), tone: 'accent' },
    { label: 'Complete', value: String(rows.filter((r) => r.status === 'Complete').length), tone: 'good' },
  ],
  top: (rows) => {
    const areas = Array.from(new Set(rows.map((r) => r.area)));
    return (
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Completion by area" />
          {areas.map((a) => (
            <div key={a} className="list-row"><span>{areaLabel(a)}</span><span style={{ width: 200 }}><ProgressBar value={pctOf(rows.filter((r) => r.area === a))} /></span></div>
          ))}
        </Card>
        <Card>
          <CardHeader title="Items by area and status" />
          <BarChart height={210} stacked labels={areas.map((a) => a.replace('Unit ', 'U').replace('Pipe Rack 4', 'PR4').replace('Flare System', 'Flare'))} series={[
            { name: 'Open', color: 'var(--warn)', data: areas.map((a) => rows.filter((r) => r.area === a && r.status === 'Open').length) },
            { name: 'In progress', color: 'var(--accent)', data: areas.map((a) => rows.filter((r) => r.area === a && r.status === 'In progress').length) },
            { name: 'Complete', color: 'var(--good)', data: areas.map((a) => rows.filter((r) => r.area === a && r.status === 'Complete').length) },
          ]} />
        </Card>
      </div>
    );
  },
  columns: [
    { key: 'id', header: 'ID', mono: true },
    { key: 'description', header: 'Work', render: (r) => <div>{r.description}<div className="small muted">{areaLabel(r.area)} · {r.discipline} · {r.contractor}</div></div> },
    { key: 'dueDay', header: 'Due', mono: true, render: (r) => `T+${r.dueDay} d`, sortValue: (r) => r.dueDay },
    { key: 'weight', header: 'Man-hours', mono: true, align: 'right' },
    { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} tone={r.status === 'Complete' ? 'good' : r.status === 'In progress' ? 'accent' : 'warn'} />, sortValue: (r) => r.status },
    { key: 'p', header: '', render: (r) => (r.dueDay <= 3 && r.status === 'Open' ? <Chip tone="crit">due within 3 days</Chip> : null) },
  ],
  filters: [{ label: 'areas', get: (r) => r.area }, { label: 'status', get: (r) => r.status, options: ['Open', 'In progress', 'Complete'] }],
  search: (r) => `${r.id} ${r.description} ${r.contractor}`,
  rowAction: { label: (r) => (r.status === 'Open' ? 'Start' : r.status === 'In progress' ? 'Mark complete' : null), run: (r) => advancePostTa(r.id), toast: (r) => `${r.id} updated` },
  initialSort: { key: 'dueDay', dir: 'asc' },
};

export default function PostTaPage() {
  return <TrackerPage config={config} />;
}
