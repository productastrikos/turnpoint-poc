import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { StatTile } from '../../components/ui/StatTile';
import { StatusChip } from '../../components/ui/StatusChip';
import { Chip } from '../../components/ui/Chip';
import { Donut } from '../../components/charts/Donut';
import { BarChart } from '../../components/charts/BarChart';
import { Heatmap } from '../../components/charts/Heatmap';
import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { TABS } from '../../app/tabRegistry';
import { advanceIssue, createIssue, issueAge, issueNextLabel, listIssues } from '../../services/qualityService';
import type { Issue, Severity } from '../../mocks/qualityMock';
import { AREA_IDS, PEOPLE } from '../../mocks/master';
import { shortDate } from '../../mocks/_gen';

const SEV_TONE = { Low: 'good', Medium: 'warn', High: 'crit', Critical: 'crit' } as const;

const config: TrackerConfig<Issue> = {
  title: 'Issues & Safety Log',
  subtitle: '',
  embedded: true,
  load: listIssues,
  kpis: (rows) => [
    { label: 'Open issues', value: String(rows.filter((r) => r.status === 'Open' || r.status === 'In progress').length), tone: 'warn' },
    { label: 'Safety items (open)', value: String(rows.filter((r) => r.type !== 'Issue' && (r.status === 'Open' || r.status === 'In progress')).length), tone: 'crit' },
    { label: 'High-potential (HiPo)', value: String(rows.filter((r) => r.hipo).length), tone: 'crit' },
    { label: 'Avg age (open)', value: `${(rows.filter((r) => r.status === 'Open' || r.status === 'In progress').reduce((s, r) => s + issueAge(r), 0) / Math.max(1, rows.filter((r) => r.status === 'Open' || r.status === 'In progress').length)).toFixed(1)} d`, tone: 'neutral' },
  ],
  columns: [
    { key: 'id', header: 'ID', mono: true },
    { key: 'type', header: 'Type', render: (r) => <Chip tone={r.type === 'Issue' ? 'neutral' : r.type === 'Near miss' ? 'warn' : 'crit'}>{r.type}{r.hipo ? ' · HiPo' : ''}</Chip> },
    { key: 'title', header: 'Description', render: (r) => <span>{r.title}{r.linked && <span className="small muted"> · {r.linked}</span>}</span> },
    { key: 'severity', header: 'Severity', render: (r) => <Chip tone={SEV_TONE[r.severity]}>{r.severity}</Chip>, sortValue: (r) => ['Low', 'Medium', 'High', 'Critical'].indexOf(r.severity) },
    { key: 'area', header: 'Area' },
    { key: 'owner', header: 'Owner' },
    { key: 'raisedAt', header: 'Raised', mono: true, render: (r) => shortDate(r.raisedAt) },
    { key: 'age', header: 'Age', mono: true, align: 'right', render: (r) => (r.status === 'Open' || r.status === 'In progress' ? `${issueAge(r)} d` : '—'), sortValue: (r) => issueAge(r) },
    { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
  ],
  filters: [
    { label: 'types', get: (r) => r.type },
    { label: 'status', get: (r) => r.status },
    { label: 'severity', get: (r) => r.severity, options: ['Low', 'Medium', 'High', 'Critical'] },
  ],
  search: (r) => `${r.id} ${r.title} ${r.area} ${r.owner}`,
  rowAction: { label: (r) => issueNextLabel(r.status), run: (r) => advanceIssue(r.id), toast: (r) => `${r.id} moved forward` },
  create: {
    label: 'Log issue',
    title: 'Log an issue or safety observation',
    fields: [
      { name: 'type', label: 'Type', type: 'select', options: ['Issue', 'Near miss', 'Unsafe condition'], required: true },
      { name: 'severity', label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High'], required: true },
      { name: 'area', label: 'Area', type: 'select', options: AREA_IDS, required: true },
      { name: 'owner', label: 'Owner', required: true, defaultValue: PEOPLE.hse },
      { name: 'title', label: 'Description', type: 'textarea', required: true },
    ],
    submit: (v) => createIssue({ type: v.type as Issue['type'], severity: v.severity as Severity, area: v.area, owner: v.owner, title: v.title }),
    toast: (i) => `${i.id} logged${i.hipo ? ' as high-potential and escalated to the HSE manager' : ''}`,
  },
  detail: {
    title: (r) => `${r.id} · ${r.type}`,
    subtitle: (r) => `${r.area} · raised ${shortDate(r.raisedAt)} by ${r.owner}`,
    render: (r) => (
      <div className="stack">
        <p style={{ margin: 0 }}>{r.title}</p>
        <div className="row-wrap"><Chip tone={SEV_TONE[r.severity]}>{r.severity}</Chip><StatusChip status={r.status} />{r.hipo && <Chip tone="crit">High-potential</Chip>}</div>
        {r.linked && <div className="callout">Linked risk: {r.linked}</div>}
        <p className="small muted">Safety observations feed the HSSE statistics on the Command Dashboard and the daily newsletter.</p>
      </div>
    ),
  },
  initialSort: { key: 'raisedAt', dir: 'desc' },
};

function IssuesDashboard() {
  const [rows, setRows] = useState<Issue[]>([]);
  useEffect(() => {
    listIssues().then(setRows);
  }, []);
  const open = rows.filter((r) => r.status === 'Open' || r.status === 'In progress');
  const byType = ['Near miss', 'Unsafe condition', 'Issue'].map((t) => ({ label: t, value: rows.filter((r) => r.type === t).length }));
  const sevs: Severity[] = ['Low', 'Medium', 'High'];
  const aging = [
    { label: '0-1 d', f: (a: number) => a <= 1 },
    { label: '2-3 d', f: (a: number) => a >= 2 && a <= 3 },
    { label: '4-6 d', f: (a: number) => a >= 4 && a <= 6 },
    { label: '7+ d', f: (a: number) => a >= 7 },
  ];
  const areas = AREA_IDS;
  const heat = areas.map((a) => (['Near miss', 'Unsafe condition', 'Issue'] as const).map((t) => rows.filter((r) => r.area === a && r.type === t).length));

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-5">
        <StatTile label="Total logged" value={String(rows.length)} />
        <StatTile label="Open / in progress" value={String(open.length)} tone="warn" />
        <StatTile label="Near misses" value={String(rows.filter((r) => r.type === 'Near miss').length)} tone="warn" delta="matches Command Dashboard" />
        <StatTile label="High-potential" value={String(rows.filter((r) => r.hipo).length)} tone="crit" />
        <StatTile label="Lost-time injuries" value="0" tone="good" delta="212 days clean" />
      </div>
      <div className="grid grid-3" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="By type" />
          <Donut segments={byType} centerValue={String(rows.length)} centerLabel="logged" />
        </Card>
        <Card>
          <CardHeader title="Open items by severity and age" />
          <BarChart
            height={210}
            stacked
            labels={aging.map((a) => a.label)}
            series={sevs.map((s, i) => ({ name: s, color: ['var(--good)', 'var(--warn)', 'var(--crit)'][i], data: aging.map((a) => open.filter((r) => r.severity === s && a.f(issueAge(r))).length) }))}
          />
        </Card>
        <Card>
          <CardHeader title="Where they happen" />
          <Heatmap rows={areas} cols={['Near miss', 'Unsafe', 'Issue']} values={heat} rowLabelWidth={92} cellMin={44} />
        </Card>
      </div>
      <Card>
        <CardHeader title="Needs attention: high severity, still open" />
        {open.filter((r) => r.severity === 'High').map((r) => (
          <div key={r.id} className="list-row">
            <div><strong>{r.title}</strong><div className="small muted">{r.id} · {r.area} · {r.owner} · {issueAge(r)} d old</div></div>
            <StatusChip status={r.status} />
          </div>
        ))}
      </Card>
    </div>
  );
}

export default function IssuesPage() {
  const [tab, setTab] = useTabParam(TABS.issues, 'dashboard');
  return (
    <div>
      <PageHeader title="Issues & Safety Log" subtitle="Log and track operational issues, near misses and unsafe conditions with owner, severity and aging. The dashboard tab is the Issues dashboard; the log tab is the working register." checklist="X4 · X23" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'dashboard', label: 'Issues dashboard' }, { id: 'log', label: 'Issues & safety log' }]} />
      {tab === 'dashboard' ? <IssuesDashboard /> : <TrackerPage config={config} />}
    </div>
  );
}
