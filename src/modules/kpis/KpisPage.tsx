import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { LoadingState } from '../../components/ui/EmptyState';
import { Sparkline } from '../../components/charts/Sparkline';
import { LineChart } from '../../components/charts/LineChart';
import { TABS } from '../../app/tabRegistry';
import { SCURVE_SCOPES, getProgressByLevel, getScorecard, getScurve, type Curve, type Kpi, type ProgressRow } from '../../services/kpiService';
import { TOTAL_MANHOURS } from '../../mocks/progress';
import { useRole } from '../../app/RoleContext';

const COLOR = { good: 'var(--good)', warn: 'var(--warn)', crit: 'var(--crit)' } as const;

function Scorecard() {
  const { role } = useRole();
  const [k, setK] = useState<Kpi[] | null>(null);
  useEffect(() => {
    getScorecard().then(setK);
  }, []);
  if (!k) return <LoadingState />;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        {k.map((x0) => {
          const hide = role === 'contractor' && x0.id === 'cost';
          const x = hide ? { ...x0, value: 'Restricted', target: 'OQ staff only', note: 'cost figures are restricted (SOW 4.17)', trend: [] as number[] } : x0;
          return (
          <Card key={x.id}>
            <div className="spread" style={{ alignItems: 'flex-start' }}>
              <span className="eyebrow" style={{ maxWidth: 150 }}>{x.name}</span>
              <Chip tone={x.tone}>{x.tone === 'good' ? 'on target' : x.tone === 'warn' ? 'watch' : 'off target'}</Chip>
            </div>
            <div className="spread" style={{ marginTop: 8 }}>
              <span className="mono" style={{ fontSize: 24, fontWeight: 600, color: COLOR[x.tone] }}>{x.value}</span>
              {x.trend.length > 0 && <Sparkline data={x.trend} color={COLOR[x.tone]} />}
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>Target {x.target} · SOW {x.sow}</div>
            <div className="small" style={{ marginTop: 2 }}>{x.note}</div>
          </Card>
          );
        })}
      </div>
      <p className="small muted" style={{ margin: 0 }}>Sparklines show the last 14 TA days. KPIs follow SOW section 17 (schedule adherence, CPI, TRIF / SIF / HiPo, scope growth, productivity, digital adoption, planned vs actual cost and man-hours).</p>
    </div>
  );
}

function Scurve() {
  const [scope, setScope] = useState('all');
  const [c, setC] = useState<Curve | null>(null);
  useEffect(() => {
    getScurve(scope).then(setC);
  }, [scope]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <label className="small muted" htmlFor="scope-sel">Show man-hour S-curve for</label>
          <select id="scope-sel" value={scope} onChange={(e) => setScope(e.target.value)}>
            {SCURVE_SCOPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <span className="small muted" style={{ marginLeft: 'auto' }}>Calculated from budgeted (BLU) and actual (ALU) labour units, as P6 does.</span>
        </div>
      </Card>
      {!c ? <LoadingState /> : (
        <>
          <div className="grid grid-4">
            <StatTile label="Actual progress (man-hour)" value={`${c.actualToday}%`} tone={c.actualToday >= c.plannedToday ? 'good' : 'warn'} delta={`planned ${c.plannedToday}% today`} />
            <StatTile label="Variance" value={`${c.actualToday - c.plannedToday > 0 ? '+' : ''}${c.actualToday - c.plannedToday} pts`} tone={c.actualToday >= c.plannedToday ? 'good' : 'crit'} />
            <StatTile label="Budgeted labour units" value={`${Math.round(c.blu).toLocaleString()} h`} delta={scope === 'all' ? `of ${TOTAL_MANHOURS.toLocaleString()} h total` : 'for the selected scope'} />
            <StatTile label="Earned labour units" value={`${Math.round((c.blu * c.actualToday) / 100).toLocaleString()} h`} tone="accent" />
          </div>
          <Card>
            <CardHeader title="Man-hour S-curve: planned, actual and forecast" />
            <LineChart
              height={300}
              labels={c.day.map((d) => `D${d}`)}
              xTickEvery={4}
              yMax={100}
              series={[
                { name: 'Planned (BLU)', data: c.planned, color: 'var(--ink-3)', dashed: true },
                { name: 'Actual (ALU)', data: c.actual, color: 'var(--accent)', area: true },
                { name: 'Forecast', data: c.forecast, color: 'var(--s2)', dashed: true },
              ]}
              markers={[{ index: 14, label: 'Data date' }]}
              yFormat={(v) => `${Math.round(v)}%`}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function ProgressLevels() {
  const [rows, setRows] = useState<ProgressRow[] | null>(null);
  useEffect(() => {
    getProgressByLevel().then(setRows);
  }, []);
  if (!rows) return <LoadingState />;
  return (
    <Card>
      <CardHeader title="% progress by unit and asset (man-hour weighted)" />
      <p className="small muted" style={{ margin: '-6px 0 10px' }}>Rolled up from the P6 activities of the major work packages, so unit and asset figures change as soon as activity progress is updated in the mobile app. Overall project: 44% actual vs 47% planned (all {TOTAL_MANHOURS.toLocaleString()} h).</p>
      <DataTable
        dense
        rowKey={(r: ProgressRow) => r.key}
        rows={rows}
        columns={[
          { key: 'label', header: 'Unit / asset', render: (r) => <span style={{ paddingLeft: r.level === 'Asset' ? 18 : 0, fontWeight: r.level === 'Unit' ? 700 : 400 }}>{r.level === 'Asset' ? '↳ ' : ''}{r.label}</span> },
          { key: 'level', header: 'Level', render: (r) => <Chip tone={r.level === 'Unit' ? 'accent' : 'neutral'}>{r.level}</Chip> },
          { key: 'planned', header: 'Planned %', mono: true, align: 'right', render: (r) => `${r.planned.toFixed(1)}%` },
          { key: 'actual', header: 'Actual %', mono: true, align: 'right', render: (r) => `${r.actual.toFixed(1)}%` },
          { key: 'bar', header: 'Actual vs plan', render: (r) => <ProgressBar value={r.actual} tone={r.actual >= r.planned - 1 ? 'good' : r.actual >= r.planned - 8 ? 'warn' : 'crit'} /> },
          { key: 'var', header: 'Variance', mono: true, align: 'right', render: (r) => { const v = r.actual - r.planned; return <span style={{ color: v < -5 ? 'var(--crit)' : v < 0 ? 'var(--warn)' : 'var(--good)' }}>{v > 0 ? '+' : ''}{v.toFixed(1)}</span>; } },
          { key: 'blu', header: 'BLU (h)', mono: true, align: 'right', render: (r) => r.blu.toLocaleString() },
          { key: 'activities', header: 'Activities', mono: true, align: 'right' },
        ]}
      />
    </Card>
  );
}

export default function KpisPage() {
  const [tab, setTab] = useTabParam(TABS.kpis, 'scorecard');
  return (
    <div>
      <PageHeader
        title="KPIs & S-Curve"
        subtitle="The performance scorecard against targets, man-hour S-curves at project, unit and equipment level, and progress by unit and asset."
        checklist="G9 · X15 · SOW dry run 9, 26-29"
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'scorecard', label: 'KPI scorecard' }, { id: 'scurve', label: 'S-curve (man-hours)' }, { id: 'progress', label: 'Progress by level' }]} />
      {tab === 'scorecard' && <Scorecard />}
      {tab === 'scurve' && <Scurve />}
      {tab === 'progress' && <ProgressLevels />}
    </div>
  );
}
