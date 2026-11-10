import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { FilterChips } from '../../components/ui/FilterChips';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { NetworkGraph, type NetNode } from '../../components/charts/NetworkGraph';
import { LoadingState } from '../../components/ui/EmptyState';
import { TABS } from '../../app/tabRegistry';
import { CHAIN_NAMES, getCpDailyChanges, getCpSnapshot, getDelayEvents, type CpDay, type LiveRow, type Snapshot } from '../../services/criticalPathService';
import { useDataEvent } from '../../app/dataEvents';
import { scheduleActivities } from '../../mocks/scheduleMock';
import type { Tone } from '../../types';
import { dayToDate, longDate, shortDate } from '../../mocks/_gen';
import { useRole } from '../../app/RoleContext';
import { IdChips } from '../_shared/IdChips';
import { STANDING_COST_NOTE } from './costNote';
import { LiveMonitor } from './LiveMonitor';
import { ChangeReport } from './ChangeReport';

const META = Object.fromEntries(scheduleActivities.map((a) => [a.id, a]));
const critTone = (r: LiveRow): Tone => (r.crit === 'critical' ? 'crit' : r.crit === 'near' ? 'warn' : 'good');
const statusTone = (s: LiveRow['status']): Tone => (s === 'on-track' ? 'good' : s === 'at-risk' ? 'warn' : 'crit');
const d1 = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10} d`;

export default function CriticalPathPage() {
  const { role } = useRole();
  const showCost = role !== 'contractor';
  const [tab, setTab] = useTabParam(TABS['critical-path'], 'activities');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [days, setDays] = useState<CpDay[]>([]);
  const [changed, setChanged] = useState<string[]>([]);
  const [pathFilter, setPathFilter] = useState('all');
  const [activeNode, setActiveNode] = useState<string | null>('CPA-003');

  const reload = useCallback(async () => {
    const [s, d] = await Promise.all([getCpSnapshot(), getCpDailyChanges()]);
    setSnap(s);
    setDays(d);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useDataEvent('schedule', reload); // dates and float written back from a P6 reschedule

  if (!snap) return <div><PageHeader title="Critical Path Monitor" subtitle="" checklist="X3 · X21 · X30" /><LoadingState /></div>;

  const totalChanges = days.reduce((s, d) => s + d.changes, 0);
  const today = days[days.length - 1]?.changes ?? 0;
  const slip = snap.slipDays;
  const visible = pathFilter === 'all' ? snap.rows : snap.rows.filter((r) => (pathFilter === 'Near' ? r.path === 'Near' : r.path === pathFilter));
  const events = getDelayEvents();

  const columns: Column<LiveRow>[] = [
    { key: 'id', header: 'ID', mono: true },
    { key: 'name', header: 'Activity', render: (a) => <div>{a.name}<div><IdChips p6Id={a.p6Id} sapWo={META[a.id]?.sapWo} /></div></div> },
    { key: 'path', header: 'Path', render: (a) => <div><Chip tone={a.path === 'Near' ? 'neutral' : 'accent'}>{a.path === 'Near' ? 'near-critical' : a.path}</Chip><div className="small muted">{a.path === 'Near' ? a.owner : a.chain}</div></div>, sortValue: (a) => a.path },
    { key: 'owner', header: 'Owner', render: (a) => <span className="small">{a.owner}</span> },
    { key: 'planFinish', header: 'Plan finish', mono: true, render: (a) => shortDate(dayToDate(Math.round(a.planFinish))), sortValue: (a) => a.planFinish },
    { key: 'finish', header: 'Forecast', mono: true, render: (a) => <span style={{ color: a.shiftDays > 0.01 ? 'var(--crit)' : 'var(--ink)' }}>{shortDate(dayToDate(Math.round(a.finish)))}{a.shiftDays > 0.01 ? ` (${d1(a.shiftDays)})` : ''}</span>, sortValue: (a) => a.finish },
    { key: 'floatDays', header: 'Float', mono: true, align: 'right', render: (a) => <span style={{ color: a.floatDays < 0 ? 'var(--crit)' : undefined }}>{Math.round(a.floatDays)} d</span>, sortValue: (a) => a.floatDays },
    { key: 'crit', header: 'Criticality', render: (a) => <Chip tone={critTone(a)}>{a.crit === 'critical' ? (a.floatDays < 0 ? 'critical, behind' : 'critical') : a.crit === 'near' ? 'near-critical' : 'normal'}</Chip>, sortValue: (a) => a.floatDays },
    { key: 'status', header: 'Execution status', render: (a) => <Chip tone={statusTone(a.status)}>{a.status === 'delayed' ? `delayed ${a.ownDelay} d` : a.status === 'at-risk' ? 'at risk (knock-on)' : 'on track'}</Chip>, sortValue: (a) => a.status },
    { key: 'changeCount', header: 'Changed', mono: true, align: 'right', render: (a) => `${a.changeCount}×`, sortValue: (a) => a.changeCount },
  ];

  return (
    <div>
      <PageHeader
        title="Critical Path Monitor"
        subtitle="CP1, CP2 and CP3 are computed from the schedule logic, not labelled by hand: activities with zero or negative float are critical, up to 5 days of float are near-critical. Add a delay to any line and see what becomes critical, how far the TA end moves and what it costs."
        checklist="X3 · X21 · X30"
        action={
          <div className="row-wrap">
            <Chip tone={slip > 0.01 ? 'crit' : 'good'}>TA end {shortDate(snap.endDate)} ({slip > 0.01 ? d1(slip) : 'on plan'})</Chip>
            <Chip tone={today > 2 ? 'crit' : 'warn'}>{totalChanges} CP changes this TA · {today} today</Chip>
          </div>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'activities', label: 'Activities' },
          { id: 'network', label: 'Dependency network & insights' },
          { id: 'monitor', label: 'Live monitor & delay impact' },
          { id: 'changes', label: 'CP change report', badge: totalChanges },
        ]}
      />

      {tab === 'activities' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid grid-4">
            {snap.chains.map((c) => (
              <div key={c.gate} className="card card-pad" style={{ borderTop: `4px solid ${c.label === 'CP1' ? 'var(--crit)' : c.label === 'CP2' ? 'var(--warn)' : 'var(--accent)'}` }}>
                <span className="eyebrow">{c.label}{c.label === 'CP1' ? ' · drives the TA end' : ''}</span>
                <div style={{ fontWeight: 600, margin: '4px 0' }}>{CHAIN_NAMES[c.gate]}</div>
                <div className="small muted">arrives {shortDate(dayToDate(Math.round(c.arrival)))} · float {Math.round(c.floatDays)} d</div>
              </div>
            ))}
            <div className="card card-pad">
              <span className="eyebrow">How it is computed</span>
              <div className="small" style={{ margin: '4px 0' }}>Forward and backward pass over the P6 logic. Critical = float ≤ 0, near-critical = float 1 to 5 d. Negative float means the activity is already behind a contractual date.</div>
            </div>
          </div>
          <Card>
            <div className="toolbar">
              <FilterChips options={[{ value: 'CP1', count: snap.rows.filter((r) => r.path === 'CP1').length }, { value: 'CP2', count: snap.rows.filter((r) => r.path === 'CP2').length }, { value: 'CP3', count: snap.rows.filter((r) => r.path === 'CP3').length }, { value: 'Near', label: 'Near-critical work', count: snap.rows.filter((r) => r.path === 'Near').length }]} value={pathFilter} onChange={setPathFilter} allLabel="All paths" />
              <span className="small muted" style={{ marginLeft: 'auto' }}>Status and float update from the live monitor and from P6 reschedules.</span>
            </div>
            <DataTable columns={columns} rows={visible} rowKey={(a) => a.id} dense pageSize={22} />
          </Card>
        </div>
      )}

      {tab === 'network' && <NetworkBody snap={snap} active={activeNode} setActive={setActiveNode} changed={changed} showCost={showCost} />}
      {tab === 'monitor' && <LiveMonitor snap={snap} events={events} showCost={showCost} onChange={(ids) => { setChanged(ids); reload(); }} />}
      {tab === 'changes' && <ChangeReport days={days} events={events} snap={snap} showCost={showCost} />}
    </div>
  );
}

// ------------------------------------------------------------------ network + insights

function NetworkBody({ snap, active, setActive, changed, showCost }: { snap: Snapshot; active: string | null; setActive: (id: string | null) => void; changed: string[]; showCost: boolean }) {
  const rows = snap.rows;
  const laneOrder = ['HCU-MS', 'CDU-MS', 'FCC-MS'];
  const stableLane = (r: LiveRow) => (r.gate ? laneOrder.indexOf(r.gate) : 3);
  const nodes: NetNode[] = rows.map((r) => ({ id: r.id, label: r.name, sub: r.path === 'Near' ? `float ${Math.round(r.floatDays)} d` : `${r.path} · float ${Math.round(r.floatDays)} d`, lane: stableLane(r), tone: critTone(r), tag: r.p6Id }));
  const ids = new Set(rows.map((r) => r.id));
  const edges: [string, string][] = rows.flatMap((r) => r.predecessors.filter((p) => ids.has(p)).map((p) => [p, r.id] as [string, string]));
  const sel = rows.find((a) => a.id === active);

  const driver = [...rows].filter((r) => r.crit === 'critical').sort((a, b) => b.successors.length + b.ownDelay * 3 - (a.successors.length + a.ownDelay * 3))[0] ?? rows[0];
  const behind = rows.filter((r) => r.floatDays < 0);
  const byRes: Record<string, LiveRow[]> = {};
  rows.filter((r) => r.crit !== 'normal').forEach((r) => (byRes[r.resource] ??= []).push(r));
  const clash = Object.entries(byRes).filter(([, l]) => l.length > 1);
  const cpCost = rows.filter((r) => r.crit === 'critical').reduce((s, r) => s + r.costOMR, 0);
  const laneLabels = laneOrder.map((g) => `${snap.chains.find((c) => c.gate === g)!.label} ${CHAIN_NAMES[g].split(' · ')[0]}`).concat('Near-critical');

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <Card>
          <div className="eyebrow">Dependencies</div>
          <div style={{ fontWeight: 600, margin: '4px 0' }}>{driver.id} drives {driver.successors.length} successor{driver.successors.length === 1 ? '' : 's'}</div>
          <p className="small muted" style={{ margin: 0 }}>{driver.name}{driver.ownDelay > 0 ? ` carries ${driver.ownDelay} d of own delay; ` : ' is the busiest critical activity; '}its slip flows to {driver.successors.join(', ') || 'no successors'}.</p>
        </Card>
        <Card>
          <div className="eyebrow">Logic</div>
          <div style={{ fontWeight: 600, margin: '4px 0' }}>{edges.length} links, all finish-to-start</div>
          <p className="small muted" style={{ margin: 0 }}>{behind.length ? `${behind.length} activities are behind a contractual date (negative float): ${behind.slice(0, 4).map((n) => n.id).join(', ')}${behind.length > 4 ? '…' : ''}.` : 'No activity is behind a contractual date.'} No open ends, no logic loops.</p>
        </Card>
        <Card>
          <div className="eyebrow">Resource</div>
          <div style={{ fontWeight: 600, margin: '4px 0' }}>{clash.length} crew{clash.length === 1 ? '' : 's'} on more than one critical activity</div>
          <p className="small muted" style={{ margin: 0 }}>{clash.length ? `${clash.slice(0, 2).map(([r]) => r).join(', ')}: a slip on one activity delays the crew's next critical activity.` : 'No crew conflicts on critical work.'}</p>
        </Card>
        <Card>
          <div className="eyebrow">Cost</div>
          <div style={{ fontWeight: 600, margin: '4px 0' }}>{showCost ? `OMR ${(cpCost / 1e6).toFixed(2)}M on critical activities` : `${snap.critCount} critical activities`}</div>
          <p className="small muted" style={{ margin: 0 }}>{showCost ? STANDING_COST_NOTE : 'Cost values are restricted for contractors.'} Current slip: {snap.slipDays.toFixed(1)} days.</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Dependency network by chain"
          action={
            <div className="chart-legend" style={{ margin: 0 }}>
              <span><i style={{ background: 'var(--crit)' }} />Critical</span>
              <span><i style={{ background: 'var(--warn)' }} />Near-critical</span>
              <span><i style={{ background: 'var(--good)' }} />Float to spare</span>
              {changed.length > 0 && <span><i style={{ background: 'var(--accent)', height: 2 }} />Changed by the last delay</span>}
            </div>
          }
        />
        <NetworkGraph nodes={nodes} edges={edges} laneLabels={laneLabels} highlight={changed} onNodeClick={setActive} activeId={active} />
      </Card>

      {sel && (
        <Card>
          <CardHeader title={`${sel.id} · ${sel.name}`} action={<Chip tone={critTone(sel)}>{sel.crit === 'critical' ? 'critical' : sel.crit === 'near' ? 'near-critical' : 'float to spare'}</Chip>} />
          <div className="grid grid-3">
            <dl className="kv">
              <dt>Chain</dt><dd>{sel.path === 'Near' ? 'near-critical work' : `${sel.path} · ${sel.chain}`}</dd>
              <dt>Owner</dt><dd>{sel.owner}</dd>
              <dt>Resource</dt><dd>{sel.resource}</dd>
              {showCost && (<><dt>Cost</dt><dd className="mono">OMR {sel.costOMR.toLocaleString()}</dd></>)}
            </dl>
            <dl className="kv">
              <dt>Remaining</dt><dd>{sel.remaining} d{sel.ownDelay ? ` (incl. ${sel.ownDelay} d delay)` : ''}</dd>
              <dt>Planned finish</dt><dd className="mono">{longDate(dayToDate(Math.round(sel.planFinish)))}</dd>
              <dt>Forecast</dt><dd className="mono">{longDate(dayToDate(Math.round(sel.finish)))}</dd>
              <dt>Total float</dt><dd className="mono">{Math.round(sel.floatDays)} d</dd>
            </dl>
            <dl className="kv">
              <dt>Predecessors</dt><dd className="mono">{sel.predecessors.join(', ') || 'none'}</dd>
              <dt>Successors</dt><dd className="mono">{sel.successors.join(', ') || 'none'}</dd>
              <dt>P6 / SAP</dt><dd><IdChips p6Id={sel.p6Id} sapWo={META[sel.id]?.sapWo} /></dd>
              <dt>Changed</dt><dd>{sel.changeCount}× this TA</dd>
            </dl>
          </div>
        </Card>
      )}
      <StatTile label="Network" value={`${rows.length} monitored activities`} delta={`${snap.critCount} critical · ${snap.nearCount} near-critical`} />
    </div>
  );
}
