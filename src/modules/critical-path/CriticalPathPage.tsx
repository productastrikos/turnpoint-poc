import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { FilterChips } from '../../components/ui/FilterChips';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { BarChart } from '../../components/charts/BarChart';
import { NetworkGraph, type NetNode } from '../../components/charts/NetworkGraph';
import { ActionButton } from '../../components/ui/ActionButton';
import { LoadingState } from '../../components/ui/EmptyState';
import { TABS } from '../../app/tabRegistry';
import { getCpDailyChanges, getCriticalPathActivities, getNearCritical, setActivityStatus, tickMonitor, type CpDay, type NearCritical } from '../../services/criticalPathService';
import { useDataEvent } from '../../app/dataEvents';
import { scheduleActivities } from '../../mocks/scheduleMock';
import type { CPStatus, CriticalPathActivity, Tone } from '../../types';
import { useToast } from '../../app/ToastContext';
import { longDate, shortDate } from '../../mocks/_gen';
import { useCanEdit } from '../../app/AccessContext';
import { IdChips } from '../_shared/IdChips';

const PATHS: CriticalPathActivity['path'][] = ['CP1', 'CP2', 'CP3'];
const toneFor = (s: CPStatus): Tone => (s === 'on-track' ? 'good' : s === 'at-risk' ? 'warn' : 'crit');
const META = Object.fromEntries(scheduleActivities.filter((a) => a.cp).map((a) => [a.id, a]));
const STANDING_COST_PER_DAY = 102_800; // fixed logistics burn (WBS-8xxx) / 32 days

export default function CriticalPathPage() {
  const canEdit = useCanEdit();
  const { showToast } = useToast();
  const [tab, setTab] = useTabParam(TABS['critical-path'], 'activities');
  const [activities, setActivities] = useState<CriticalPathActivity[]>([]);
  const [days, setDays] = useState<CpDay[]>([]);
  const [pathFilter, setPathFilter] = useState('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState<string | null>('CPA-003');

  const reload = useCallback(async () => {
    const [a, d] = await Promise.all([getCriticalPathActivities(), getCpDailyChanges()]);
    setActivities(a);
    setDays(d);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useDataEvent('schedule', reload); // dates and float written back from a P6 reschedule

  const totalChanges = days.reduce((s, d) => s + d.changes, 0);
  const today = days[days.length - 1]?.changes ?? 0;
  const visible = pathFilter === 'all' ? activities : activities.filter((a) => a.path === pathFilter);

  async function cycleStatus(a: CriticalPathActivity) {
    const order: CPStatus[] = ['on-track', 'at-risk', 'delayed'];
    const next = order[(order.indexOf(a.status) + 1) % order.length];
    setLoadingId(a.id);
    const updated = await setActivityStatus(a.id, next);
    await reload();
    setLoadingId(null);
    showToast(`${a.id} set to ${next}. Critical path change logged (${updated.changeCount}× on this activity).`, next === 'on-track' ? 'good' : next === 'at-risk' ? 'warn' : 'crit');
  }

  const columns: Column<CriticalPathActivity>[] = [
    { key: 'id', header: 'ID', mono: true },
    { key: 'name', header: 'Activity', render: (a) => <div>{a.name}<div><IdChips p6Id={META[a.id]?.p6Id} sapWo={META[a.id]?.sapWo} /></div></div> },
    { key: 'path', header: 'Path', render: (a) => <Chip tone="accent">{a.path}</Chip> },
    { key: 'owner', header: 'Owner' },
    { key: 'plannedFinish', header: 'Planned finish', mono: true, render: (a) => shortDate(a.plannedFinish) },
    { key: 'forecastFinish', header: 'Forecast', mono: true, render: (a) => <span style={{ color: a.forecastFinish > a.plannedFinish ? 'var(--crit)' : 'var(--ink)' }}>{shortDate(a.forecastFinish)}</span> },
    { key: 'floatDays', header: 'Float', mono: true, align: 'right', render: (a) => <span style={{ color: a.floatDays < 0 ? 'var(--crit)' : undefined }}>{a.floatDays} d</span> },
    { key: 'changeCount', header: 'Changed', mono: true, align: 'right', render: (a) => `${a.changeCount}×` },
    {
      key: 'status',
      header: 'Status (click to update)',
      render: (a) => (
        <button className={`chip chip-${toneFor(a.status)}`} style={{ cursor: 'pointer', border: 'none' }} disabled={loadingId === a.id || !canEdit} title={!canEdit ? 'Your role has view-only access to this page' : 'Click to change the status'} onClick={() => cycleStatus(a)}>
          {loadingId === a.id ? 'updating…' : a.status}
        </button>
      ),
      sortValue: (a) => a.status,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Critical Path Monitor"
        subtitle="CP1, CP2 and CP3 with dependencies, float, resources and cost, a live view of newly critical activities, and a running count of how many times the critical path has changed."
        checklist="X3 · X21 · X30"
        action={days.length > 0 ? <Chip tone={today > 2 ? 'crit' : 'warn'}>{totalChanges} CP changes this TA · {today} today</Chip> : undefined}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'activities', label: 'Activities' },
          { id: 'network', label: 'Dependency network & insights' },
          { id: 'monitor', label: 'Live monitor' },
          { id: 'changes', label: 'CP change report', badge: totalChanges },
        ]}
      />

      {tab === 'activities' && (
        <Card>
          <div className="toolbar">
            <FilterChips options={PATHS.map((p) => ({ value: p, count: activities.filter((a) => a.path === p).length }))} value={pathFilter} onChange={setPathFilter} allLabel="All paths" />
            <span className="small muted" style={{ marginLeft: 'auto' }}>Changing a status counts as a critical path change and appears in the change report.</span>
          </div>
          <DataTable columns={columns} rows={visible} rowKey={(a) => a.id} dense pageSize={16} />
        </Card>
      )}

      {tab === 'network' && <NetworkTab activities={activities} active={activeNode} setActive={setActiveNode} />}
      {tab === 'monitor' && <MonitorTab onChange={reload} />}
      {tab === 'changes' && <ChangesTab days={days} total={totalChanges} activities={activities} />}
    </div>
  );
}

// ------------------------------------------------------------------ network + insights

function NetworkTab({ activities, active, setActive }: { activities: CriticalPathActivity[]; active: string | null; setActive: (id: string | null) => void }) {
  if (activities.length === 0) return <LoadingState />;
  return <NetworkBody activities={activities} active={active} setActive={setActive} />;
}

function NetworkBody({ activities, active, setActive }: { activities: CriticalPathActivity[]; active: string | null; setActive: (id: string | null) => void }) {
  const nodes: NetNode[] = activities.map((a) => ({ id: a.id, label: a.name, sub: a.path, lane: PATHS.indexOf(a.path), tone: toneFor(a.status), tag: META[a.id]?.p6Id }));
  const edges: [string, string][] = activities.flatMap((a) => a.predecessors.map((p) => [p, a.id] as [string, string]));
  const hot = activities.filter((a) => a.status !== 'on-track').map((a) => a.id);
  const sel = activities.find((a) => a.id === active);

  const succCount: Record<string, number> = {};
  edges.forEach(([p]) => (succCount[p] = (succCount[p] ?? 0) + 1));
  const topDriver = [...activities].sort((a, b) => (succCount[b.id] ?? 0) + (b.status === 'delayed' ? 5 : 0) - ((succCount[a.id] ?? 0) + (a.status === 'delayed' ? 5 : 0)))[0];
  const negFloat = activities.filter((a) => a.floatDays < 0);

  // resource insight: crews booked on overlapping activities
  const byRes: Record<string, CriticalPathActivity[]> = {};
  activities.forEach((a) => (byRes[a.resource] ??= []).push(a));
  const conflicts = Object.entries(byRes).filter(([, list]) =>
    list.some((x, i) => list.some((y, j) => j > i && Math.abs(+new Date(x.plannedFinish) - +new Date(y.plannedFinish)) < 3 * 86_400_000))
  );
  const cpCost = activities.reduce((s, a) => s + a.costOMR, 0);
  const slipDays = Math.max(...activities.map((a) => Math.round((+new Date(a.forecastFinish) - +new Date(a.plannedFinish)) / 86_400_000)));

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <Card>
          <div className="eyebrow">Dependencies</div>
          <div style={{ fontWeight: 600, margin: '4px 0' }}>{topDriver.id} drives {succCount[topDriver.id] ?? 0} successors</div>
          <p className="small muted" style={{ margin: 0 }}>{topDriver.name} is {topDriver.status}; its slip flows to {edges.filter(([p]) => p === topDriver.id).map(([, s]) => s).join(', ') || 'no successors'}.</p>
        </Card>
        <Card>
          <div className="eyebrow">Logic</div>
          <div style={{ fontWeight: 600, margin: '4px 0' }}>{edges.length} links, all finish-to-start</div>
          <p className="small muted" style={{ margin: 0 }}>{negFloat.length} activities carry negative float ({negFloat.map((n) => n.id).join(', ')}). 0 open ends, 0 constraint conflicts.</p>
        </Card>
        <Card>
          <div className="eyebrow">Resource</div>
          <div style={{ fontWeight: 600, margin: '4px 0' }}>{conflicts.length} crew booked back-to-back</div>
          <p className="small muted" style={{ margin: 0 }}>{conflicts.length ? `${conflicts.map(([r]) => r).slice(0, 2).join(', ')} are on consecutive critical activities: no slack to absorb a delay.` : 'No crew conflicts on the critical path.'}</p>
        </Card>
        <Card>
          <div className="eyebrow">Cost</div>
          <div style={{ fontWeight: 600, margin: '4px 0' }}>OMR {(cpCost / 1e6).toFixed(2)}M on the critical path</div>
          <p className="small muted" style={{ margin: 0 }}>Each day of slip burns about OMR {STANDING_COST_PER_DAY.toLocaleString()} of fixed logistics. Current worst slip: {slipDays} days.</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Dependency network: CP1 reactor R-101 · CP2 E-204 / Train B · CP3 compressor C-301"
          action={
            <div className="chart-legend" style={{ margin: 0 }}>
              <span><i style={{ background: 'var(--good)' }} />On track</span>
              <span><i style={{ background: 'var(--warn)' }} />At risk</span>
              <span><i style={{ background: 'var(--crit)' }} />Delayed</span>
              <span><i style={{ background: 'var(--crit)', height: 2 }} />Delay propagation</span>
            </div>
          }
        />
        <NetworkGraph nodes={nodes} edges={edges} laneLabels={['CP1', 'CP2', 'CP3']} highlight={hot} onNodeClick={setActive} activeId={active} />
      </Card>

      {sel && (
        <Card>
          <CardHeader title={`${sel.id} · ${sel.name}`} action={<Chip tone={toneFor(sel.status)}>{sel.status}</Chip>} />
          <div className="grid grid-3">
            <dl className="kv">
              <dt>Path</dt><dd>{sel.path}</dd>
              <dt>Owner</dt><dd>{sel.owner}</dd>
              <dt>Resource</dt><dd>{sel.resource}</dd>
              <dt>Cost</dt><dd className="mono">OMR {sel.costOMR.toLocaleString()}</dd>
            </dl>
            <dl className="kv">
              <dt>Duration</dt><dd>{sel.durationDays} d</dd>
              <dt>Planned finish</dt><dd className="mono">{longDate(sel.plannedFinish)}</dd>
              <dt>Forecast</dt><dd className="mono">{longDate(sel.forecastFinish)}</dd>
              <dt>Float</dt><dd className="mono">{sel.floatDays} d</dd>
            </dl>
            <dl className="kv">
              <dt>Predecessors</dt><dd className="mono">{sel.predecessors.join(', ') || 'none'}</dd>
              <dt>Successors</dt><dd className="mono">{activities.filter((a) => a.predecessors.includes(sel.id)).map((a) => a.id).join(', ') || 'none'}</dd>
              <dt>P6 / SAP</dt><dd><IdChips p6Id={META[sel.id]?.p6Id} sapWo={META[sel.id]?.sapWo} /></dd>
              <dt>Changed</dt><dd>{sel.changeCount}× this TA</dd>
            </dl>
          </div>
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ live monitor (simulated)

function MonitorTab({ onChange }: { onChange: () => void }) {
  const { showToast } = useToast();
  const [list, setList] = useState<NearCritical[]>([]);
  const [feed, setFeed] = useState<{ at: string; text: string; crit: boolean }[]>([]);
  const [live, setLive] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    getNearCritical().then(setList);
  }, []);

  const tick = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const r = await tickMonitor();
    setList(r.list);
    if (r.event) {
      const crit = r.event.includes('CRITICAL');
      setFeed((f) => [{ at: new Date().toLocaleTimeString('en-GB'), text: r.event!, crit }, ...f].slice(0, 12));
      if (crit) {
        showToast(r.event, 'crit');
        onChange();
      }
    }
    busy.current = false;
  }, [onChange, showToast]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(tick, 3500);
    return () => clearInterval(id);
  }, [live, tick]);

  const critNow = list.filter((n) => n.floatDays <= 0);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <div className="spread">
          <div>
            <h3 style={{ fontSize: 17 }}>Real-time monitoring <span className="sim-badge sim-simulated">Simulated</span></h3>
            <p className="small muted" style={{ margin: '4px 0 0', maxWidth: 720 }}>
              In production this runs on every P6 recalculation. Here a timer feeds execution delays into near-critical activities: when float reaches zero the activity is flagged as newly critical automatically and counted as a critical path change.
            </p>
          </div>
          <div className="row">
            <ActionButton onClick={tick}>Simulate delay now</ActionButton>
            <ActionButton variant={live ? 'danger' : 'primary'} small={false} onClick={() => setLive((l) => !l)}>{live ? 'Pause live feed' : 'Start live feed'}</ActionButton>
          </div>
        </div>
      </Card>
      <div className="grid grid-4">
        <StatTile label="Near-critical watched" value={String(list.length)} />
        <StatTile label="Newly critical" value={String(critNow.length)} tone={critNow.length ? 'crit' : 'good'} />
        <StatTile label="Smallest float" value={`${Math.min(...list.map((n) => n.floatDays), 9)} d`} tone="warn" />
        <StatTile label="Feed" value={live ? 'LIVE' : 'paused'} tone={live ? 'good' : 'neutral'} />
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Near-critical activities" />
          {list.map((n) => (
            <div key={n.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <strong>{n.name}</strong>
                <div className="small muted">{n.id} · {n.path} · driver: {n.driver}</div>
                <div style={{ marginTop: 6, maxWidth: 260 }}><ProgressBar value={Math.max(0, n.floatDays)} max={5} tone={n.floatDays <= 0 ? 'crit' : n.floatDays <= 1 ? 'warn' : 'good'} showLabel={false} /></div>
              </div>
              <Chip tone={n.floatDays <= 0 ? 'crit' : n.floatDays <= 1 ? 'warn' : 'good'}>{n.floatDays <= 0 ? 'CRITICAL' : `float ${n.floatDays} d`}</Chip>
            </div>
          ))}
        </Card>
        <Card>
          <CardHeader title="Event feed" />
          {feed.length === 0 && <p className="small muted">No events yet. Press “Simulate delay now” or start the live feed.</p>}
          {feed.map((f, i) => (
            <div key={i} className="list-row" style={{ alignItems: 'flex-start' }}>
              <span style={{ color: f.crit ? 'var(--crit)' : undefined, fontWeight: f.crit ? 700 : 400 }}>{f.text}</span>
              <span className="mono small muted">{f.at}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ CP change report

function ChangesTab({ days, total, activities }: { days: CpDay[]; total: number; activities: CriticalPathActivity[] }) {
  const worst = [...days].sort((a, b) => b.changes - a.changes)[0];
  const [report, setReport] = useState(false);
  const byActivity = useMemo(() => [...activities].sort((a, b) => b.changeCount - a.changeCount).slice(0, 5), [activities]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <StatTile label="Critical path changed" value={`${total}×`} tone="crit" delta="in 14 TA days" />
        <StatTile label="Today" value={String(days[days.length - 1]?.changes ?? 0)} tone="warn" />
        <StatTile label="Busiest day" value={worst ? `D${worst.day}` : '—'} delta={worst ? `${worst.changes} changes` : undefined} />
        <StatTile label="Average per day" value={(total / Math.max(1, days.length)).toFixed(1)} />
      </div>
      <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Changes to the critical path per TA day" />
          <BarChart height={240} labels={days.map((d) => `D${d.day}`)} series={[{ name: 'Changes', color: 'var(--crit)', data: days.map((d) => d.changes) }]} />
        </Card>
        <Card>
          <CardHeader title="Most-changed activities" />
          {byActivity.map((a) => (
            <div key={a.id} className="list-row"><span>{a.name}<div className="small muted mono">{a.id} · {a.path}</div></span><span className="mono" style={{ fontWeight: 700 }}>{a.changeCount}×</span></div>
          ))}
        </Card>
      </div>
      <Card>
        <CardHeader title="Daily change log" action={<button className="btn btn-primary btn-sm" onClick={() => setReport((r) => !r)}>{report ? 'Hide' : 'Generate'} end-of-TA report</button>} />
        <DataTable
          dense
          rowKey={(d: CpDay) => String(d.day)}
          rows={[...days].reverse()}
          columns={[
            { key: 'day', header: 'TA day', mono: true, render: (d) => `D${d.day}`, sortValue: (d) => d.day },
            { key: 'changes', header: 'Changes', mono: true, align: 'right' },
            { key: 'note', header: 'What changed', render: (d) => d.note || <span className="muted">no structural change</span> },
          ]}
        />
        {report && (
          <div className="callout" style={{ marginTop: 14 }}>
            <strong>End-of-TA report: critical path changes.</strong> The critical path changed {total} times over {days.length} days (average {(total / days.length).toFixed(1)} per day). Peak: Day {worst?.day} with {worst?.changes} changes. Main drivers: crane conflicts, discovery work on R-101 internals, scaffold access and tie-in spool rework. This section is also included in the Close-Out report.
          </div>
        )}
      </Card>
    </div>
  );
}
