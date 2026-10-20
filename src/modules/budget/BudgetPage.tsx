import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { LoadingState } from '../../components/ui/EmptyState';
import { BarChart } from '../../components/charts/BarChart';
import { Donut } from '../../components/charts/Donut';
import { LineChart } from '../../components/charts/LineChart';
import { Waterfall } from '../../components/charts/Waterfall';
import { TABS } from '../../app/tabRegistry';
import { getBridge, getBudgetLines, getEstimateTrend, type BudgetBridge } from '../../services/budgetService';
import type { BudgetLine } from '../../types';
import { useRole } from '../../app/RoleContext';
import { shortDate } from '../../mocks/_gen';

const pctVar = (f: number, p: number) => ((f - p) / p) * 100;
const M = (n: number) => `OMR ${(n / 1e6).toFixed(2)}M`;
const sum = (l: BudgetLine[], k: 'plannedOMR' | 'committedOMR' | 'actualOMR' | 'forecastOMR') => l.reduce((s, x) => s + x[k], 0);

export default function BudgetPage() {
  const { role } = useRole();
  const [tab, setTab] = useTabParam(TABS.budget, 'control');
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [bridge, setBridge] = useState<BudgetBridge | null>(null);
  const [trend, setTrend] = useState<Awaited<ReturnType<typeof getEstimateTrend>>>([]);

  useEffect(() => {
    getBudgetLines().then(setLines);
    getBridge().then(setBridge);
    getEstimateTrend().then(setTrend);
  }, []);

  if (role === 'contractor') {
    return (
      <div>
        <PageHeader title="Budget Control" subtitle="Sub-WBS level planned vs committed vs actual vs forecast." checklist="G10 · X24" />
        <Card><div className="empty-state">Budget figures are hidden for the Contractor view. Switch to an OQ role (top right) to view.</div></Card>
      </div>
    );
  }
  if (!bridge || lines.length === 0) return <div><PageHeader title="Budget Control" subtitle="" checklist="G10 · X24" /><LoadingState /></div>;

  const t = { planned: sum(lines, 'plannedOMR'), committed: sum(lines, 'committedOMR'), actual: sum(lines, 'actualOMR'), forecast: sum(lines, 'forecastOMR') };
  const variable = lines.filter((l) => l.kind === 'variable');
  const fixed = lines.filter((l) => l.kind === 'fixed');
  const growth = bridge.current - bridge.base;

  return (
    <div>
      <PageHeader
        title="Budget Control"
        subtitle="Planned, committed, actual and forecast cost per Sub-WBS, split into variable estimated costs and fixed logistics costs, with the base vs current estimate and every approved additional job and scope change incorporated."
        checklist="G10 · X24"
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'control', label: 'Budget control' }, { id: 'comparison', label: 'Budget comparison dashboard' }, { id: 'bridge', label: 'Base vs current estimate' }]} />

      <div className="grid grid-5" style={{ marginBottom: 16 }}>
        <StatTile label="Planned (approved)" value={M(t.planned)} />
        <StatTile label="Committed" value={M(t.committed)} delta={`${Math.round((t.committed / t.planned) * 100)}% of budget`} />
        <StatTile label="Actual (spent)" value={M(t.actual)} />
        <StatTile label="Forecast at completion" value={M(t.forecast)} tone={t.forecast > t.planned ? 'warn' : 'good'} />
        <StatTile label="Forecast vs plan" value={`${pctVar(t.forecast, t.planned) >= 0 ? '+' : ''}${pctVar(t.forecast, t.planned).toFixed(1)}%`} tone={t.forecast > t.planned ? 'crit' : 'good'} />
      </div>

      {tab === 'control' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
            <Card>
              <CardHeader title="By Sub-WBS" />
              <DataTable
                dense
                rowKey={(l: BudgetLine) => l.id}
                rows={lines}
                columns={[
                  { key: 'subWbs', header: 'Sub-WBS', render: (l) => <div>{l.subWbs}<div className="small muted mono">{l.id}</div></div> },
                  { key: 'kind', header: 'Type', render: (l) => <Chip tone={l.kind === 'fixed' ? 'accent' : 'neutral'}>{l.kind === 'fixed' ? 'fixed logistics' : 'variable'}</Chip>, sortValue: (l) => l.kind },
                  { key: 'base', header: 'Base est.', mono: true, align: 'right', render: (l) => (l.plannedOMR - (bridge.perWbs[l.id] ?? 0)).toLocaleString() },
                  { key: 'plannedOMR', header: 'Planned', mono: true, align: 'right', render: (l) => l.plannedOMR.toLocaleString() },
                  { key: 'committedOMR', header: 'Committed', mono: true, align: 'right', render: (l) => l.committedOMR.toLocaleString() },
                  { key: 'actualOMR', header: 'Actual', mono: true, align: 'right', render: (l) => l.actualOMR.toLocaleString() },
                  { key: 'forecastOMR', header: 'Forecast', mono: true, align: 'right', render: (l) => l.forecastOMR.toLocaleString() },
                  { key: 'v', header: 'Variance', mono: true, align: 'right', render: (l) => { const v = pctVar(l.forecastOMR, l.plannedOMR); return <span style={{ color: v > 5 ? 'var(--crit)' : v > 0 ? 'var(--warn)' : 'var(--good)', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{v.toFixed(1)}%</span>; }, sortValue: (l) => pctVar(l.forecastOMR, l.plannedOMR) },
                ]}
              />
            </Card>
            <div className="stack">
              <Card>
                <CardHeader title="Variable vs fixed logistics" />
                <Donut segments={[{ label: 'Variable estimated costs', value: Math.round(sum(variable, 'plannedOMR') / 1000), color: 'var(--s1)' }, { label: 'Fixed logistics costs', value: Math.round(sum(fixed, 'plannedOMR') / 1000), color: 'var(--s2)' }]} centerValue={`${Math.round((sum(fixed, 'plannedOMR') / t.planned) * 100)}%`} centerLabel="fixed" valueFormat={(v) => `OMR ${(v / 1000).toFixed(2)}M`} />
                <div className="small muted" style={{ marginTop: 8 }}>Planned budget split. Fixed logistics burn about OMR 103K per TA day, which is why schedule slip costs money even when scope is unchanged.</div>
              </Card>
              <Card>
                <CardHeader title="Spend progress" />
                {[['Committed', t.committed], ['Actual', t.actual]].map(([l, v]) => (
                  <div key={String(l)} className="list-row"><span>{l}</span><span style={{ width: 170 }}><ProgressBar value={Number(v)} max={t.planned} tone="accent" /></span></div>
                ))}
              </Card>
            </div>
          </div>
        </div>
      )}

      {tab === 'comparison' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <Card>
              <CardHeader title="Planned vs committed vs actual vs forecast (OMR thousand)" />
              <BarChart height={290} labels={lines.map((l) => l.id.replace('WBS-', ''))} series={[
                { name: 'Planned', color: 'var(--s6)', data: lines.map((l) => Math.round(l.plannedOMR / 1000)) },
                { name: 'Committed', color: 'var(--s2)', data: lines.map((l) => Math.round(l.committedOMR / 1000)) },
                { name: 'Actual', color: 'var(--s3)', data: lines.map((l) => Math.round(l.actualOMR / 1000)) },
                { name: 'Forecast', color: 'var(--s5)', data: lines.map((l) => Math.round(l.forecastOMR / 1000)) },
              ]} />
              <div className="small muted">WBS codes: 1000 Inspection, 2000 Rotating, 3000 Process, 4000 Instrumentation, 5000 Civil, 6000 Electrical, 7000 Materials, 8100-8400 fixed logistics.</div>
            </Card>
            <Card>
              <CardHeader title="Largest forecast overruns" />
              {[...lines].sort((a, b) => b.forecastOMR - b.plannedOMR - (a.forecastOMR - a.plannedOMR)).slice(0, 5).map((l) => (
                <div key={l.id} className="list-row"><span>{l.subWbs}<div className="small muted mono">{l.id}</div></span><Chip tone={l.forecastOMR > l.plannedOMR * 1.05 ? 'crit' : 'warn'}>+{(l.forecastOMR - l.plannedOMR).toLocaleString()} ({pctVar(l.forecastOMR, l.plannedOMR).toFixed(1)}%)</Chip></div>
              ))}
              <div className="callout" style={{ marginTop: 12 }}>
                Cost per man-hour: STO-2026 forecast OMR {(t.forecast / 412_000).toFixed(1)} vs STO-2024 OMR {(5_200_000 / 148_000).toFixed(1)} (previous TA, same method). Scope is 2.8× larger and unit cost is lower.
              </div>
            </Card>
          </div>
          <Card>
            <CardHeader title="Cumulative spend vs budget (OMR M)" />
            <LineChart
              height={230}
              labels={['T-12m', 'T-9m', 'T-6m', 'T-3m', 'T-1m', 'Day 14']}
              series={[
                { name: 'Base estimate', data: trend.map((p) => p.base / 1e6), color: 'var(--ink-3)', dashed: true },
                { name: 'Current approved', data: trend.map((p) => p.current / 1e6), color: 'var(--accent)' },
              ]}
              yMin={10.8}
              yMax={12.1}
              yFormat={(v) => v.toFixed(2)}
            />
          </Card>
        </div>
      )}

      {tab === 'bridge' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <Card>
              <CardHeader title="Base estimate to current budget to forecast" />
              <Waterfall
                height={300}
                format={(v) => `${(v / 1e6).toFixed(2)}M`}
                steps={[
                  { label: 'Base estimate', value: bridge.base, kind: 'total' },
                  ...bridge.bySource.filter((s) => s.value !== 0).map((s) => ({ label: s.source === 'SCF' ? 'Approved SCFs' : s.source === 'Discovery job' ? 'Discovery jobs' : `${s.source} additions`, value: s.value, kind: 'delta' as const })),
                  { label: 'Current approved', value: bridge.current, kind: 'total' },
                  { label: 'Forecast overrun', value: t.forecast - bridge.current, kind: 'delta' },
                  { label: 'Forecast final', value: t.forecast, kind: 'total' },
                ]}
              />
            </Card>
            <div className="stack">
              <div className="grid grid-2" style={{ gap: 10 }}>
                <StatTile label="Base estimate" value={M(bridge.base)} />
                <StatTile label="Approved scope growth" value={`+${M(growth)}`} tone="warn" delta={`+${((growth / bridge.base) * 100).toFixed(1)}%`} />
                <StatTile label="Current approved budget" value={M(bridge.current)} />
                <StatTile label="Pending, not in budget" value={M(bridge.pending.reduce((s, v) => s + v.costOMR, 0))} tone="crit" delta={`${bridge.pending.length} variations`} />
              </div>
              <div className="callout">All approved additional jobs and scope changes are incorporated into the current budget automatically: approve a variation in Scope &gt; Variations and it appears here and in the Sub-WBS planned column.</div>
            </div>
          </div>
          <Card>
            <CardHeader title={`Approved additional jobs and scope changes included in the budget (${bridge.included.length})`} />
            <DataTable
              dense
              pageSize={8}
              rowKey={(x) => x.v.id}
              rows={bridge.included}
              columns={[
                { key: 'id', header: 'Variation', render: (x) => <div><strong className="mono">{x.v.id}</strong><div className="small muted">{x.v.ref}</div></div>, sortValue: (x) => x.v.id },
                { key: 'title', header: 'Description', render: (x) => x.v.title },
                { key: 'src', header: 'Source', render: (x) => <span className="small">{x.v.source}</span> },
                { key: 'wbs', header: 'Sub-WBS', mono: true, render: (x) => x.wbs },
                { key: 'cost', header: 'Included', mono: true, align: 'right', render: (x) => <span style={{ color: x.v.costOMR < 0 ? 'var(--good)' : undefined }}>{x.v.costOMR >= 0 ? '+' : ''}{x.v.costOMR.toLocaleString()}</span>, sortValue: (x) => x.v.costOMR },
                { key: 'when', header: 'Approved', mono: true, render: (x) => shortDate(x.v.raisedAt) },
                { key: 'in', header: 'In budget', render: () => <Chip tone="good">included ✓</Chip> },
              ]}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
