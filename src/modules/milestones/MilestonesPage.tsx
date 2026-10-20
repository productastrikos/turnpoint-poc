import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { FilterChips } from '../../components/ui/FilterChips';
import { LoadingState } from '../../components/ui/EmptyState';
import { Gantt, type GanttRow } from '../../components/charts/Gantt';
import { StatusChip } from '../../components/ui/StatusChip';
import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { TABS } from '../../app/tabRegistry';
import { addEvent, advanceEvent, completeMilestone, listEvents, listMilestones } from '../../services/closeoutService';
import type { MsStatus, TaEventRow, TaMilestone } from '../../mocks/closeoutMock';
import { addDays, daysBetween, shortDate } from '../../mocks/_gen';
import { useToast } from '../../app/ToastContext';

const TONE: Record<MsStatus, 'good' | 'accent' | 'warn' | 'crit'> = { Done: 'good', 'On track': 'accent', 'At risk': 'warn', Late: 'crit' };
const COLOR: Record<MsStatus, string> = { Done: 'var(--good)', 'On track': 'var(--accent)', 'At risk': 'var(--warn)', Late: 'var(--crit)' };

const eventConfig: TrackerConfig<TaEventRow> = {
  title: 'Event tracker',
  subtitle: '',
  embedded: true,
  load: listEvents,
  kpis: (rows) => [
    { label: 'Tracked items', value: String(rows.length) },
    { label: 'Open issues', value: String(rows.filter((r) => r.kind === 'Issue' && r.status !== 'Done').length), tone: 'warn' },
    { label: 'Upcoming events', value: String(rows.filter((r) => r.kind === 'Event' && r.status === 'Planned').length), tone: 'accent' },
    { label: 'Escalated', value: String(rows.filter((r) => r.status === 'Escalated').length), tone: 'crit' },
  ],
  columns: [
    { key: 'id', header: 'ID', mono: true },
    { key: 'kind', header: 'Kind', render: (r) => <Chip tone={r.kind === 'Issue' ? 'warn' : r.kind === 'Milestone' ? 'accent' : 'neutral'}>{r.kind}</Chip> },
    { key: 'title', header: 'Event, milestone or issue', render: (r) => <div>{r.title}{r.note && <div className="small muted">{r.note}</div>}</div> },
    { key: 'date', header: 'Date', mono: true, render: (r) => shortDate(r.date), sortValue: (r) => r.date },
    { key: 'owner', header: 'Owner' },
    { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} tone={r.status === 'Done' ? 'good' : r.status === 'Escalated' ? 'crit' : r.status === 'Open' ? 'warn' : 'accent'} /> },
  ],
  filters: [{ label: 'kinds', get: (r) => r.kind, options: ['Event', 'Milestone', 'Issue'] }, { label: 'status', get: (r) => r.status }],
  search: (r) => `${r.title} ${r.owner} ${r.note}`,
  rowAction: { label: (r) => (r.status === 'Planned' ? 'Mark done' : r.status === 'Open' ? 'Escalate' : r.status === 'Escalated' ? 'Resolve' : null), run: (r) => advanceEvent(r.id), toast: (r) => `${r.id} updated` },
  create: {
    label: 'Add item',
    title: 'Add an event, milestone or issue',
    fields: [
      { name: 'kind', label: 'Kind', type: 'select', options: ['Event', 'Milestone', 'Issue'], required: true },
      { name: 'title', label: 'Title', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: '2026-08-18' },
      { name: 'owner', label: 'Owner', required: true, defaultValue: 'S. Al-Harthy' },
      { name: 'note', label: 'Note', type: 'textarea' },
    ],
    submit: (v) => addEvent({ kind: v.kind as TaEventRow['kind'], title: v.title, date: v.date, owner: v.owner, note: v.note ?? '' }),
    toast: (e) => `${e.id} added to the event tracker`,
  },
  initialSort: { key: 'date', dir: 'asc' },
};

function Milestones() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<TaMilestone[] | null>(null);
  const [phase, setPhase] = useState('all');
  const load = useCallback(() => listMilestones().then(setRows), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!rows) return <LoadingState />;
  const shown = rows.filter((r) => phase === 'all' || r.phase === phase);
  const gantt: GanttRow[] = rows.map((r) => ({ id: r.id, label: r.name, start: r.planned, end: addDays(r.status === 'Done' ? r.actual ?? r.planned : r.forecast, 1), color: COLOR[r.status], tag: r.forecast > r.planned && r.status !== 'Done' ? `+${daysBetween(r.planned, r.forecast)} d` : undefined }));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <StatTile label="Milestones" value={String(rows.length)} />
        <StatTile label="Done" value={String(rows.filter((r) => r.status === 'Done').length)} tone="good" />
        <StatTile label="At risk" value={String(rows.filter((r) => r.status === 'At risk').length)} tone="warn" />
        <StatTile label="Late (forecast after plan)" value={String(rows.filter((r) => r.status === 'Late').length)} tone="crit" />
      </div>
      <Card>
        <CardHeader title="TA milestones: planned vs forecast" action={<div className="chart-legend" style={{ margin: 0 }}>{(Object.keys(COLOR) as MsStatus[]).map((s) => <span key={s}><i style={{ background: COLOR[s] }} />{s}</span>)}</div>} />
        <Gantt rows={gantt} from="2025-09-01" to="2026-12-15" tickMode="month" today="2026-08-16" rowHeight={24} labelWidth={260} />
      </Card>
      <Card>
        <div className="toolbar"><FilterChips options={['Initiation', 'Scoping', 'Planning', 'Pre-TA', 'Execution', 'Close-Out'].map((p) => ({ value: p }))} value={phase} onChange={setPhase} allLabel="All stages" /></div>
        <DataTable
          dense
          rowKey={(m: TaMilestone) => m.id}
          rows={shown}
          columns={[
            { key: 'name', header: 'Milestone', render: (m) => <strong>{m.name}</strong> },
            { key: 'phase', header: 'Stage', render: (m) => <span className="small">{m.phase}</span> },
            { key: 'planned', header: 'Planned', mono: true, render: (m) => shortDate(m.planned), sortValue: (m) => m.planned },
            { key: 'forecast', header: 'Forecast / actual', mono: true, render: (m) => shortDate(m.actual ?? m.forecast), sortValue: (m) => m.actual ?? m.forecast },
            { key: 'var', header: 'Variance', mono: true, align: 'right', render: (m) => { const v = daysBetween(m.planned, m.actual ?? m.forecast); return <span style={{ color: v > 0 ? 'var(--crit)' : undefined }}>{v > 0 ? `+${v} d` : v === 0 ? '0' : `${v} d`}</span>; } },
            { key: 'owner', header: 'Owner' },
            { key: 'status', header: 'RAG', render: (m) => <Chip tone={TONE[m.status]}>{m.status}</Chip>, sortValue: (m) => m.status },
            { key: 'a', header: '', nosort: true, render: (m) => (m.status !== 'Done' && m.planned <= '2026-08-16' ? <ActionButton onClick={async () => { await completeMilestone(m.id); await load(); showToast(`${m.name} marked done`, 'good'); }}>Mark done</ActionButton> : null) },
          ]}
        />
      </Card>
    </div>
  );
}

export default function MilestonesPage() {
  const [tab, setTab] = useTabParam(TABS.milestones, 'milestones');
  return (
    <div>
      <PageHeader title="Milestones & Event Tracker" subtitle="TA milestones with planned, forecast and actual dates and a RAG status, plus a tracker for the key events, milestones and issues the TA office follows through the whole turnaround." checklist="I3 · I4" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'milestones', label: 'TA milestones' }, { id: 'tracker', label: 'Event tracker' }]} />
      {tab === 'milestones' ? <Milestones /> : <TrackerPage config={eventConfig} />}
    </div>
  );
}
