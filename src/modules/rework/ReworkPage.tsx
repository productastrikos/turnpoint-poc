import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { Pareto } from '../../components/charts/Pareto';
import { BarChart } from '../../components/charts/BarChart';
import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { TABS } from '../../app/tabRegistry';
import { createLoss, listLosses } from '../../services/qualityService';
import { LOSS_CAUSES, type LossCause, type LossEvent } from '../../mocks/qualityMock';
import { CONTRACTOR_NAMES, DISCIPLINES, PEOPLE } from '../../mocks/master';
import { scheduleActivities } from '../../mocks/scheduleMock';
import { dayToDate, shortDate } from '../../mocks/_gen';
import { useRole } from '../../app/RoleContext';

const ACTIVITY_OPTIONS = scheduleActivities.filter((a) => a.startDay <= 14).map((a) => `${a.p6Id} ${a.name}`);

const detailBody = (r: LossEvent, showCost: boolean) => (
  <dl className="kv">
    <dt>Activity</dt><dd>{r.activity} <span className="tag-chip p6">{r.p6Id}</span></dd>
    <dt>Cause</dt><dd>{r.cause}</dd>
    <dt>Discipline</dt><dd>{r.discipline}</dd>
    <dt>Contractor</dt><dd>{r.contractor}</dd>
    <dt>Hours lost</dt><dd className="mono">{r.hours}</dd>
    {showCost && <><dt>Cost impact</dt><dd className="mono">OMR {r.costOMR.toLocaleString()}</dd></>}
    <dt>Note</dt><dd>{r.note || '—'}</dd>
  </dl>
);

const config: TrackerConfig<LossEvent> = {
  title: 'Delay & Rework Capture',
  subtitle: '',
  embedded: true,
  load: listLosses,
  kpis: (rows) => [
    { label: 'Events captured', value: String(rows.length) },
    { label: 'Rework hours', value: rows.filter((r) => r.kind === 'Rework').reduce((s, r) => s + r.hours, 0).toLocaleString(), tone: 'warn' },
    { label: 'Delay hours', value: rows.filter((r) => r.kind === 'Delay').reduce((s, r) => s + r.hours, 0).toLocaleString(), tone: 'crit' },
    { label: 'Cost impact', value: `OMR ${rows.reduce((s, r) => s + r.costOMR, 0).toLocaleString()}`, tone: 'neutral' },
  ],
  columns: [
    { key: 'id', header: 'ID', mono: true },
    { key: 'kind', header: 'Kind', render: (r) => <Chip tone={r.kind === 'Rework' ? 'warn' : 'crit'}>{r.kind}</Chip> },
    { key: 'day', header: 'Day', mono: true, align: 'right', render: (r) => `D${r.day}`, sortValue: (r) => r.day },
    { key: 'activity', header: 'Activity', render: (r) => <span>{r.activity} <span className="tag-chip p6">{r.p6Id}</span></span> },
    { key: 'cause', header: 'Cause', render: (r) => <span className="small">{r.cause}</span> },
    { key: 'contractor', header: 'Contractor', render: (r) => <span className="small">{r.contractor}</span> },
    { key: 'hours', header: 'Hours lost', mono: true, align: 'right' },
    { key: 'costOMR', header: 'Cost (OMR)', mono: true, align: 'right', render: (r) => r.costOMR.toLocaleString() },
  ],
  filters: [
    { label: 'kinds', get: (r) => r.kind },
    { label: 'causes', get: (r) => r.cause },
  ],
  search: (r) => `${r.id} ${r.activity} ${r.p6Id} ${r.note}`,
  create: {
    label: 'Capture delay / rework',
    title: 'Capture a delay or rework event',
    fields: [
      { name: 'kind', label: 'Kind', type: 'select', options: ['Delay', 'Rework'], required: true },
      { name: 'activity', label: 'Activity', type: 'select', options: ACTIVITY_OPTIONS, required: true },
      { name: 'cause', label: 'Cause', type: 'select', options: LOSS_CAUSES, required: true },
      { name: 'discipline', label: 'Discipline', type: 'select', options: DISCIPLINES, required: true },
      { name: 'contractor', label: 'Contractor', type: 'select', options: CONTRACTOR_NAMES, required: true },
      { name: 'hours', label: 'Hours lost', type: 'number', required: true, min: 1, max: 2000 },
      { name: 'note', label: 'Note', type: 'textarea' },
    ],
    submit: (v) => {
      const [p6Id, ...rest] = v.activity.split(' ');
      return createLoss({ kind: v.kind as LossEvent['kind'], day: 14, activity: rest.join(' '), p6Id, discipline: v.discipline, contractor: v.contractor, cause: v.cause as LossCause, hours: Number(v.hours), reportedBy: PEOPLE.planner, note: v.note ?? '' });
    },
    toast: (e) => `${e.id} captured: ${e.hours} h lost to "${e.cause}". It now appears in the Pareto.`,
  },
  detail: {
    title: (r) => `${r.id} · ${r.kind}`,
    subtitle: (r) => `Day ${r.day} · ${shortDate(dayToDate(r.day))} · ${r.reportedBy}`,
    render: (r) => detailBody(r, true),
  },
  initialSort: { key: 'day', dir: 'desc' },
};

/** Contractor view: same page without any cost column, tile or detail line (SOW 4.17). */
const configNoCost: TrackerConfig<LossEvent> = {
  ...config,
  kpis: (rows) => config.kpis(rows).filter((k) => k.label !== 'Cost impact'),
  columns: config.columns.filter((c) => c.key !== 'costOMR'),
  detail: config.detail && { ...config.detail, render: (r) => detailBody(r, false) },
};

function ReworkDashboard() {
  const { role } = useRole();
  const [rows, setRows] = useState<LossEvent[]>([]);
  useEffect(() => {
    listLosses().then(setRows);
  }, []);
  const rework = rows.filter((r) => r.kind === 'Rework');
  const delay = rows.filter((r) => r.kind === 'Delay');
  const days = Array.from({ length: 14 }, (_, i) => i + 1);
  const contractors = Array.from(new Set(rows.map((r) => r.contractor)));
  const sum = (xs: LossEvent[]) => xs.reduce((s, r) => s + r.hours, 0);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <StatTile label="Rework hours" value={sum(rework).toLocaleString()} tone="warn" delta={`${rework.length} events`} />
        <StatTile label="Delay hours" value={sum(delay).toLocaleString()} tone="crit" delta={`${delay.length} events`} />
        <StatTile label="Rework as % of man-hours" value={`${((sum(rework) / 181_280) * 100).toFixed(2)}%`} tone="good" delta="of 181,280 h worked" />
        {role === 'contractor' ? <StatTile label="Cost impact" value="Restricted" delta="cost figures are OQ staff only" /> : <StatTile label="Cost impact" value={`OMR ${rows.reduce((s, r) => s + r.costOMR, 0).toLocaleString()}`} />}
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Pareto of causes (hours lost)" />
          <Pareto items={LOSS_CAUSES.map((c) => ({ label: c, value: sum(rows.filter((r) => r.cause === c)) })).filter((x) => x.value > 0)} unit=" h" />
        </Card>
        <Card>
          <CardHeader title="Hours lost per TA day" />
          <BarChart
            height={260}
            stacked
            labels={days.map((d) => `D${d}`)}
            series={[
              { name: 'Delay', color: 'var(--crit)', data: days.map((d) => sum(delay.filter((r) => r.day === d))) },
              { name: 'Rework', color: 'var(--warn)', data: days.map((d) => sum(rework.filter((r) => r.day === d))) },
            ]}
          />
        </Card>
      </div>
      <Card>
        <CardHeader title="By contractor" />
        <BarChart
          height={220}
          stacked
          labels={contractors.map((c) => c.replace('Sohar Industrial Services', 'Sohar Ind. Svcs'))}
          series={[
            { name: 'Delay', color: 'var(--crit)', data: contractors.map((c) => sum(delay.filter((r) => r.contractor === c))) },
            { name: 'Rework', color: 'var(--warn)', data: contractors.map((c) => sum(rework.filter((r) => r.contractor === c))) },
          ]}
        />
      </Card>
    </div>
  );
}

export default function ReworkPage() {
  const { role } = useRole();
  const [tab, setTab] = useTabParam(TABS.rework, 'dashboard');
  return (
    <div>
      <PageHeader title="Re-work & Delay Capture" subtitle="Capture every hour lost to delay or rework against the P6 activity, with the cause. The dashboard turns those captures into a Pareto, daily trend and contractor view." checklist="X25 · X32" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'dashboard', label: 'Re-work dashboard' }, { id: 'capture', label: 'Delay & rework capture' }]} />
      {tab === 'dashboard' ? <ReworkDashboard /> : <TrackerPage config={role === 'contractor' ? configNoCost : config} />}
    </div>
  );
}
