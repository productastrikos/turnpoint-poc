import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { StatusChip } from '../../components/ui/StatusChip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { LoadingState } from '../../components/ui/EmptyState';
import { Donut } from '../../components/charts/Donut';
import { BarChart } from '../../components/charts/BarChart';
import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { TABS } from '../../app/tabRegistry';
import { addLesson, advanceLesson, lessonActionLabel, listLessons, toggleCarry } from '../../services/closeoutService';
import { LESSON_CATEGORIES, type Lesson } from '../../mocks/closeoutMock';
import { ActionButton } from '../../components/ui/ActionButton';
import { shortDate, daysBetween, STATUS_DATE } from '../../mocks/_gen';

const config: TrackerConfig<Lesson> = {
  title: 'Lesson actions',
  subtitle: '',
  embedded: true,
  load: listLessons,
  kpis: (rows) => [
    { label: 'Lessons digitised', value: String(rows.length) },
    { label: 'Actions closed', value: `${Math.round((rows.filter((r) => r.status === 'Closed').length / rows.length) * 100)}%`, tone: 'good' },
    { label: 'Open or in progress', value: String(rows.filter((r) => r.status !== 'Closed').length), tone: 'warn' },
    { label: 'Overdue', value: String(rows.filter((r) => r.status !== 'Closed' && r.due < STATUS_DATE).length), tone: 'crit' },
  ],
  columns: [
    { key: 'id', header: 'ID', mono: true },
    { key: 'lesson', header: 'Lesson and recommended action', render: (r) => <div style={{ maxWidth: 360 }}>{r.lesson}<div className="small" style={{ color: 'var(--accent-strong)' }}>→ {r.recommendation}</div></div> },
    { key: 'category', header: 'Category', render: (r) => <span className="small">{r.category}</span> },
    { key: 'impact', header: 'Impact', render: (r) => <Chip tone={r.impact === 'High' ? 'crit' : r.impact === 'Medium' ? 'warn' : 'neutral'}>{r.impact}</Chip>, sortValue: (r) => ['Low', 'Medium', 'High'].indexOf(r.impact) },
    { key: 'owner', header: 'Owner' },
    { key: 'due', header: 'Due', mono: true, render: (r) => <span style={{ color: r.status !== 'Closed' && r.due < STATUS_DATE ? 'var(--crit)' : undefined }}>{shortDate(r.due)}</span>, sortValue: (r) => r.due },
    { key: 'carried', header: 'In STO-2026 plan', render: (r) => (r.carried ? <Chip tone="accent">carried forward</Chip> : <span className="muted small">no</span>) },
    { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} />, sortValue: (r) => r.status },
  ],
  filters: [{ label: 'categories', get: (r) => r.category }, { label: 'status', get: (r) => r.status, options: ['Open', 'In progress', 'Closed'] }],
  search: (r) => `${r.id} ${r.lesson} ${r.recommendation} ${r.owner}`,
  rowAction: { label: (r) => lessonActionLabel(r.status), run: (r) => advanceLesson(r.id), toast: (r) => `${r.id} moved forward` },
  create: {
    label: 'Add lesson',
    title: 'Add a lesson learned',
    fields: [
      { name: 'category', label: 'Category', type: 'select', options: LESSON_CATEGORIES, required: true },
      { name: 'lesson', label: 'What happened', type: 'textarea', required: true },
      { name: 'recommendation', label: 'Recommended action', type: 'textarea', required: true },
      { name: 'owner', label: 'Action owner', required: true },
      { name: 'impact', label: 'Impact', type: 'select', options: ['High', 'Medium', 'Low'], required: true },
    ],
    submit: (v) => addLesson({ category: v.category as Lesson['category'], lesson: v.lesson, recommendation: v.recommendation, owner: v.owner, impact: v.impact as Lesson['impact'] }),
    toast: (l) => `${l.id} added and carried into the current TA plan`,
  },
  detail: {
    title: (r) => `${r.id} · ${r.category}`,
    subtitle: (r) => `Owner ${r.owner} · due ${shortDate(r.due)}`,
    render: (r) => (
      <div className="stack">
        <p style={{ margin: 0, fontWeight: 600 }}>{r.lesson}</p>
        <div className="callout">{r.recommendation}</div>
        <div className="row-wrap"><StatusChip status={r.status} /><Chip tone={r.impact === 'High' ? 'crit' : 'neutral'}>{r.impact} impact</Chip>{r.carried && <Chip tone="accent">carried into STO-2026</Chip>}</div>
        <ActionButton onClick={async () => { await toggleCarry(r.id); }}>{r.carried ? 'Remove from current TA plan' : 'Carry forward to current TA'}</ActionButton>
        <p className="small muted">Carried-forward lessons become checklist items in the planning of the current turnaround, so they are acted on rather than filed.</p>
      </div>
    ),
  },
  initialSort: { key: 'status', dir: 'desc' },
};

function Dashboard() {
  const [rows, setRows] = useState<Lesson[] | null>(null);
  useEffect(() => {
    listLessons().then(setRows);
  }, []);
  if (!rows) return <LoadingState />;
  const closed = rows.filter((r) => r.status === 'Closed').length;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <StatTile label="Lessons from STO-2024" value={String(rows.length)} />
        <StatTile label="Actions closed" value={`${closed} of ${rows.length}`} tone="good" delta={`${Math.round((closed / rows.length) * 100)}%`} />
        <StatTile label="High impact still open" value={String(rows.filter((r) => r.impact === 'High' && r.status !== 'Closed').length)} tone="crit" />
        <StatTile label="Carried into STO-2026" value={String(rows.filter((r) => r.carried).length)} tone="accent" />
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="By category" />
          <Donut segments={LESSON_CATEGORIES.map((c) => ({ label: c, value: rows.filter((r) => r.category === c).length })).filter((s) => s.value > 0)} centerValue={String(rows.length)} centerLabel="lessons" />
        </Card>
        <Card>
          <CardHeader title="Action closure by category" />
          <BarChart
            height={250}
            stacked
            labels={LESSON_CATEGORIES.map((c) => c.split(' ')[0])}
            series={[
              { name: 'Closed', color: 'var(--good)', data: LESSON_CATEGORIES.map((c) => rows.filter((r) => r.category === c && r.status === 'Closed').length) },
              { name: 'In progress', color: 'var(--accent)', data: LESSON_CATEGORIES.map((c) => rows.filter((r) => r.category === c && r.status === 'In progress').length) },
              { name: 'Open', color: 'var(--warn)', data: LESSON_CATEGORIES.map((c) => rows.filter((r) => r.category === c && r.status === 'Open').length) },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

function Report() {
  const [rows, setRows] = useState<Lesson[] | null>(null);
  useEffect(() => {
    listLessons().then(setRows);
  }, []);
  if (!rows) return <LoadingState />;
  const closed = rows.filter((r) => r.status === 'Closed').length;
  return (
    <Card style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <div className="spread no-print" style={{ marginBottom: 8 }}><span /><button className="btn btn-primary btn-sm" onClick={() => window.print()}>Print / Save PDF</button></div>
      <div className="eyebrow">OQ RPI · Sohar Refinery · Continuous improvement</div>
      <h2 style={{ fontSize: 28, margin: '4px 0' }}>Lessons Learned Report</h2>
      <div className="small muted">Source: Minor TA 2024 (CDU / VDU), applied to Major STO 2026 · generated from the live action register</div>
      <p style={{ lineHeight: 1.7, fontSize: 13.5 }}>
        {rows.length} lessons were captured from the 2024 turnaround. {closed} actions ({Math.round((closed / rows.length) * 100)}%) are closed, {rows.filter((r) => r.status === 'In progress').length} are in progress and {rows.filter((r) => r.status === 'Open').length} are open. {rows.filter((r) => r.carried).length} lessons were carried forward into the planning of the current turnaround, including daily digital attendance, duplicate scope detection, order-by alerts, a digital blind list and a digital shift handover log.
      </p>
      {LESSON_CATEGORIES.map((c) => {
        const list = rows.filter((r) => r.category === c);
        if (!list.length) return null;
        return (
          <div key={c} style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 17, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>{c} <span className="mono small muted">({list.filter((l) => l.status === 'Closed').length}/{list.length} closed)</span></h3>
            {list.map((l) => (
              <div key={l.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                <div><strong style={{ fontSize: 13 }}>{l.lesson}</strong><div className="small" style={{ color: 'var(--accent-strong)' }}>Action: {l.recommendation}</div><div className="small muted">{l.owner} · due {shortDate(l.due)}{l.status !== 'Closed' && daysBetween(l.due, STATUS_DATE) > 0 ? ' · overdue' : ''}</div></div>
                <StatusChip status={l.status} />
              </div>
            ))}
          </div>
        );
      })}
      <div className="row" style={{ marginTop: 16 }}><span className="small muted">Action closure</span><span style={{ flex: 1 }}><ProgressBar value={closed} max={rows.length} /></span></div>
    </Card>
  );
}

export default function LessonsLearnedPage() {
  const [tab, setTab] = useTabParam(TABS['lessons-learned'], 'dashboard');
  return (
    <div>
      <PageHeader title="Lessons Learned" subtitle="The previous turnaround's lessons, digitised with a dashboard and an action tracker so every action is owned, dated and closed. Lessons are carried forward into the current TA and generate the lessons-learned report." checklist="I6 · C1" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'dashboard', label: 'Dashboard' }, { id: 'actions', label: 'Action tracker' }, { id: 'report', label: 'Lessons-learned report' }]} />
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'actions' && <TrackerPage config={config} />}
      {tab === 'report' && <Report />}
    </div>
  );
}
