import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatusChip } from '../../components/ui/StatusChip';
import { Donut } from '../../components/charts/Donut';
import { BarChart } from '../../components/charts/BarChart';
import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { advanceNcr, createNcr, listNcrs, ncrNextLabel } from '../../services/qualityService';
import type { Ncr, RootCause } from '../../mocks/qualityMock';
import { AREA_IDS, CONTRACTOR_NAMES, DISCIPLINES, PEOPLE } from '../../mocks/master';
import { STATUS_DATE, daysBetween, shortDate } from '../../mocks/_gen';

const SEV = { Minor: 'neutral', Major: 'warn', Critical: 'crit' } as const;
const CAUSES: RootCause[] = ['Workmanship', 'Material defect', 'Procedure not followed', 'Design / drawing error', 'Inspection gap', 'Tool / equipment'];

const config: TrackerConfig<Ncr> = {
  title: 'Non-Conformance Reports',
  subtitle: 'NCR register with severity, root cause, disposition and closure. Advance an NCR through review, disposition and closure.',
  checklist: 'X26',
  load: listNcrs,
  kpis: (rows) => {
    const open = rows.filter((r) => r.status !== 'Closed');
    return [
      { label: 'Total NCRs', value: String(rows.length) },
      { label: 'Open', value: String(open.length), tone: 'warn' },
      { label: 'Critical open', value: String(open.filter((r) => r.severity === 'Critical').length), tone: 'crit' },
      { label: 'Closure rate', value: `${Math.round(((rows.length - open.length) / rows.length) * 100)}%`, tone: 'good' },
      { label: 'Avg age (open)', value: `${(open.reduce((s, r) => s + daysBetween(r.raisedAt, STATUS_DATE), 0) / Math.max(1, open.length)).toFixed(1)} d` },
    ];
  },
  top: (rows) => (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <Card>
        <CardHeader title="Root cause" />
        <Donut segments={CAUSES.map((c) => ({ label: c, value: rows.filter((r) => r.rootCause === c).length }))} centerValue={String(rows.length)} centerLabel="NCRs" />
      </Card>
      <Card>
        <CardHeader title="NCRs raised per TA day" />
        <BarChart
          height={200}
          labels={Array.from({ length: 10 }, (_, i) => `D${5 + i}`)}
          series={[{ name: 'Raised', color: 'var(--s2)', data: Array.from({ length: 10 }, (_, i) => rows.filter((r) => daysBetween(r.raisedAt, STATUS_DATE) === 9 - i).length) }]}
        />
      </Card>
    </div>
  ),
  columns: [
    { key: 'id', header: 'NCR', mono: true },
    { key: 'title', header: 'Non-conformance' },
    { key: 'tag', header: 'Tag', mono: true },
    { key: 'severity', header: 'Severity', render: (r) => <Chip tone={SEV[r.severity]}>{r.severity}</Chip>, sortValue: (r) => ['Minor', 'Major', 'Critical'].indexOf(r.severity) },
    { key: 'rootCause', header: 'Root cause', render: (r) => <span className="small">{r.rootCause}</span> },
    { key: 'disposition', header: 'Disposition', render: (r) => <Chip tone={r.disposition === 'Pending' ? 'neutral' : r.disposition === 'Reject' ? 'crit' : 'accent'}>{r.disposition}</Chip> },
    { key: 'contractor', header: 'Contractor', render: (r) => <span className="small">{r.contractor}</span> },
    { key: 'raisedAt', header: 'Raised', mono: true, render: (r) => shortDate(r.raisedAt) },
    { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
  ],
  filters: [
    { label: 'status', get: (r) => r.status },
    { label: 'severity', get: (r) => r.severity, options: ['Minor', 'Major', 'Critical'] },
    { label: 'disciplines', get: (r) => r.discipline },
  ],
  search: (r) => `${r.id} ${r.title} ${r.tag} ${r.contractor}`,
  rowAction: { label: (r) => ncrNextLabel(r.status), run: (r) => advanceNcr(r.id), toast: (r) => `${r.id} moved forward` },
  create: {
    label: 'Raise NCR',
    title: 'Raise a non-conformance report',
    fields: [
      { name: 'title', label: 'Non-conformance', required: true },
      { name: 'tag', label: 'Equipment / line tag', required: true },
      { name: 'discipline', label: 'Discipline', type: 'select', options: DISCIPLINES, required: true },
      { name: 'area', label: 'Area', type: 'select', options: AREA_IDS, required: true },
      { name: 'severity', label: 'Severity', type: 'select', options: ['Minor', 'Major', 'Critical'], required: true },
      { name: 'rootCause', label: 'Root cause', type: 'select', options: CAUSES, required: true },
      { name: 'contractor', label: 'Contractor', type: 'select', options: CONTRACTOR_NAMES, required: true },
    ],
    submit: (v) => createNcr({ title: v.title, tag: v.tag, discipline: v.discipline, area: v.area, severity: v.severity as Ncr['severity'], rootCause: v.rootCause as RootCause, contractor: v.contractor, owner: PEOPLE.qaqc }),
    toast: (n) => `${n.id} raised and assigned to ${n.owner}`,
  },
  detail: {
    title: (r) => `${r.id} · ${r.tag}`,
    subtitle: (r) => `${r.area} · ${r.contractor}`,
    render: (r) => (
      <div className="stack">
        <p style={{ margin: 0, fontWeight: 600 }}>{r.title}</p>
        <dl className="kv">
          <dt>Severity</dt><dd><Chip tone={SEV[r.severity]}>{r.severity}</Chip></dd>
          <dt>Root cause</dt><dd>{r.rootCause}</dd>
          <dt>Disposition</dt><dd>{r.disposition}</dd>
          <dt>Status</dt><dd><StatusChip status={r.status} /></dd>
          <dt>Owner</dt><dd>{r.owner}</dd>
          <dt>Raised</dt><dd>{shortDate(r.raisedAt)}</dd>
        </dl>
        <div className="callout">Closed NCRs feed the Contractor KPI scorecard (quality) and the lessons-learned register.</div>
      </div>
    ),
  },
  initialSort: { key: 'raisedAt', dir: 'desc' },
};

export default function NcrPage() {
  return <TrackerPage config={config} />;
}
