import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatusChip } from '../../components/ui/StatusChip';
import { BarChart } from '../../components/charts/BarChart';
import { advanceBlind, listBlinds } from '../../services/executionService';
import type { Blind } from '../../mocks/executionMock';
import { areaLabel } from '../../mocks/master';

const config: TrackerConfig<Blind> = {
  title: 'Blinding / De-blinding',
  subtitle: 'The blind list: every spade, spectacle blind and blind flange from planning through installation to removal (de-blinding), with verification and progress by unit. All blinds must be removed and verified before start-up.',
  checklist: 'X14',
  load: listBlinds,
  kpis: (rows) => {
    const inst = rows.filter((r) => r.status === 'Installed').length;
    const rem = rows.filter((r) => r.status === 'Removed').length;
    return [
      { label: 'Blinds on list', value: String(rows.length) },
      { label: 'Installed (live)', value: String(inst), tone: 'warn' },
      { label: 'Removed (de-blinded)', value: String(rem), tone: 'good', delta: `${Math.round((rem / rows.length) * 100)}% of list` },
      { label: 'Not yet installed', value: String(rows.filter((r) => r.status === 'Planned').length), tone: 'accent' },
      { label: 'Unverified', value: String(rows.filter((r) => r.status !== 'Planned' && !r.verified).length), tone: 'crit' },
    ];
  },
  top: (rows) => {
    const units = Array.from(new Set(rows.map((r) => r.area)));
    return (
      <Card>
        <CardHeader title="Blinding progress by unit" />
        <BarChart height={210} stacked labels={units.map((u) => u.replace('Unit ', 'U').replace('Pipe Rack 4', 'PR4').replace('Flare System', 'Flare'))} series={[
          { name: 'Planned', color: 'var(--s6)', data: units.map((u) => rows.filter((r) => r.area === u && r.status === 'Planned').length) },
          { name: 'Installed', color: 'var(--s2)', data: units.map((u) => rows.filter((r) => r.area === u && r.status === 'Installed').length) },
          { name: 'Removed', color: 'var(--s3)', data: units.map((u) => rows.filter((r) => r.area === u && r.status === 'Removed').length) },
        ]} />
      </Card>
    );
  },
  columns: [
    { key: 'id', header: 'Blind', mono: true },
    { key: 'line', header: 'Line / equipment', render: (r) => <div><strong className="mono">{r.line}</strong><div className="small muted">{r.equipment} · {areaLabel(r.area)}</div></div> },
    { key: 'kind', header: 'Type', render: (r) => <span className="small">{r.kind}</span> },
    { key: 'size', header: 'Size / rating', render: (r) => `${r.size} ${r.rating}` },
    { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} tone={r.status === 'Removed' ? 'good' : r.status === 'Installed' ? 'warn' : 'neutral'} />, sortValue: (r) => r.status },
    { key: 'verified', header: 'Verified', render: (r) => (r.status === 'Planned' ? <span className="muted">—</span> : <Chip tone={r.verified ? 'good' : 'warn'}>{r.verified ? 'verified' : 'pending'}</Chip>) },
    { key: 'plannedDay', header: 'Planned', mono: true, render: (r) => `D${r.plannedDay}` },
  ],
  filters: [{ label: 'status', get: (r) => r.status, options: ['Planned', 'Installed', 'Removed'] }, { label: 'units', get: (r) => r.area }],
  search: (r) => `${r.id} ${r.line} ${r.equipment}`,
  rowAction: { label: (r) => (r.status === 'Planned' ? 'Install blind' : r.status === 'Installed' ? 'Remove (de-blind)' : null), run: (r) => advanceBlind(r.id), toast: (r) => `${r.id}: ${r.status === 'Planned' ? 'blind installed' : 'blind removed and verified'}` },
  initialSort: { key: 'status', dir: 'asc' },
};

export default function BlindingPage() {
  return <TrackerPage config={config} />;
}
