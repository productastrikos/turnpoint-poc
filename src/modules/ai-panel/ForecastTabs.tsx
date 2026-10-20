import { useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { LoadingState } from '../../components/ui/EmptyState';
import { LineChart } from '../../components/charts/LineChart';
import { BarRow } from '../../components/charts/BarRow';
import { FORECAST_DAYS, forecast, progressForecast } from '../../mocks/aiMock';
import { MITIGATIONS } from '../../mocks/riskContext';
import { useToast } from '../../app/ToastContext';
import type { ActivityRisk } from '../../services/predictionService';
import { ActivityRiskDrawer, RiskModelDrawer } from './riskShared';
import { dayLabel, pct, riskTone } from './riskFormat';
import { useRiskForecast } from './useRiskForecast';

const PATH_SCOPE: Record<'CP1' | 'CP2' | 'CP3', { unit: string; chain: string }> = {
  CP1: { unit: 'Unit 100 · HCU', chain: 'R-101 head removal to reactor leak test' },
  CP2: { unit: 'Unit 200 · CDU', chain: 'E-204 bundle pull to Train B leak test' },
  CP3: { unit: 'Unit 300 · FCC', chain: 'C-301 rotor removal to run-in' },
};

/** AI schedule forecasting (X16): progress and finish-date bands from the Monte Carlo. */
export function ForecastTab() {
  const { data } = useRiskForecast();
  const [card, setCard] = useState(false);
  if (!data) return <LoadingState label="Simulating the remaining schedule…" />;
  const s = data.sim;
  const rows = (['CP1', 'CP2', 'CP3'] as const).map((p) => ({ path: p, ...PATH_SCOPE[p], ...s.path[p] }));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <StatTile label="Baseline finish" value={dayLabel(data.baselineEnd)} delta={`Day ${data.baselineEnd}`} />
        <StatTile label="Schedule forecast (P6)" value={dayLabel(s.forecastEnd)} tone="warn" delta={`+${s.forecastEnd - data.baselineEnd} d vs baseline`} trend="down" />
        <StatTile label="AI forecast (P50)" value={dayLabel(s.p50)} tone={Math.round(s.p50) > s.forecastEnd ? 'crit' : 'good'} delta={`${pct(s.pMeetForecast)} chance of the P6 date`} />
        <StatTile label="P10 to P90" value={`${dayLabel(s.p10)} to ${dayLabel(s.p90)}`} tone="warn" delta={`P80 ${dayLabel(s.p80)}`} />
      </div>
      <Card>
        <CardHeader title="Progress forecast with P10 to P90 band" action={<button className="btn btn-sm" onClick={() => setCard(true)}>How the model works</button>} />
        <LineChart
          height={300}
          labels={FORECAST_DAYS.map((d) => `D${d}`)}
          xTickEvery={4}
          yMax={100}
          series={[
            { name: 'Planned', data: forecast.planned, color: 'var(--ink-3)', dashed: true },
            { name: 'Actual', data: forecast.actual, color: 'var(--accent)' },
            { name: 'AI forecast (P50)', data: progressForecast(s.p50), color: 'var(--s2)', dashed: true },
          ]}
          band={{ lo: progressForecast(s.p90), hi: progressForecast(s.p10), color: 'var(--s2)' }}
          markers={[{ index: 14, label: 'Today' }, { index: data.baselineEnd, label: 'Baseline end' }, { index: Math.round(s.p50), label: 'P50' }]}
          yFormat={(v) => `${Math.round(v)}%`}
        />
        <p className="small muted" style={{ margin: '8px 0 0' }}>Band edges are the P10 and P90 finish days of {s.runs.toLocaleString()} simulations of the remaining network, recomputed whenever critical-path status, findings, attendance or risks change.</p>
      </Card>
      <Card>
        <CardHeader title="Forecast finish by critical path" />
        <DataTable
          dense
          rowKey={(r) => r.path}
          rows={rows}
          columns={[
            { key: 'path', header: 'Path', render: (r) => <Chip tone="accent">{r.path}</Chip> },
            { key: 'unit', header: 'Unit', render: (r) => <div><strong>{r.unit}</strong><div className="small muted">{r.chain}</div></div> },
            { key: 'forecastEnd', header: 'P6 forecast', mono: true, render: (r) => dayLabel(r.forecastEnd) },
            { key: 'p50', header: 'AI P50', mono: true, render: (r) => <span style={{ color: Math.round(r.p50) > r.forecastEnd ? 'var(--crit)' : 'var(--good)', fontWeight: 600 }}>{dayLabel(r.p50)}</span> },
            { key: 'p80', header: 'AI P80', mono: true, render: (r) => dayLabel(r.p80) },
            { key: 'slipRisk', header: 'Slip ≥1 more day', render: (r) => <ProgressBar value={Math.round(r.slipRisk * 100)} tone={riskTone(r.slipRisk)} /> },
          ]}
        />
        <p className="small muted" style={{ margin: '8px 0 0' }}>Path end dates include the hand-back time to the end of the TA window (start-up preparation), so they compare directly with the turnaround finish.</p>
      </Card>
      <RiskModelDrawer open={card} onClose={() => setCard(false)} runs={s.runs} />
    </div>
  );
}

/** AI predictive critical path (X17): which near-critical activities are likely to become critical, and what sets the finish. */
export function PredictiveTab() {
  const { showToast } = useToast();
  const { data } = useRiskForecast();
  const [watch, setWatch] = useState<string[]>([]);
  const [sel, setSel] = useState<ActivityRisk | null>(null);
  if (!data) return <LoadingState label="Simulating the remaining schedule…" />;
  const near = data.activities.filter((a) => a.path === 'Near');
  const cp = data.activities.filter((a) => a.path !== 'Near').sort((a, b) => (b.criticality ?? 0) - (a.criticality ?? 0));
  const actionFor = (id: string) => MITIGATIONS.find((m) => m.effects[id]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="callout">Activities that are not critical today, ranked by the chance they use up their float: today's lag behind plan (partly recovered) plus a simulated extra delay from the slip model, over {data.sim.runs.toLocaleString()} runs. The live monitor on the Critical Path page watches the same activities.</div>
      <Card>
        <DataTable
          rowKey={(a: ActivityRisk) => a.id}
          rows={near}
          onRowClick={setSel}
          activeKey={sel?.id}
          initialSort={{ key: 'becomesCritical', dir: 'desc' }}
          columns={[
            { key: 'name', header: 'Activity', render: (a) => <div><strong>{a.name}</strong><div className="small muted mono">{a.id}{a.p6Id ? <> · <span className="tag-chip p6">{a.p6Id}</span></> : null}</div></div> },
            { key: 'becomesCritical', header: 'Becomes critical', sortValue: (a) => a.becomesCritical ?? 0, render: (a) => <ProgressBar value={Math.round((a.becomesCritical ?? 0) * 100)} tone={riskTone(a.becomesCritical ?? 0)} /> },
            { key: 'float', header: 'Float now', mono: true, align: 'right', render: (a) => `${a.float} d` },
            { key: 'behind', header: 'Behind plan', mono: true, align: 'right', sortValue: (a) => a.x.behind, render: (a) => (a.x.behind ? `${a.x.behind} pts` : '—') },
            { key: 'why', header: 'Why', nosort: true, render: (a) => <span className="small">{a.evidence[0] ?? a.drivers[0]?.label}</span> },
            { key: 'act', header: 'Suggested action', nosort: true, render: (a) => <span className="small">{actionFor(a.id)?.title ?? 'Keep on the watch list'}</span> },
            { key: 'w', header: '', nosort: true, render: (a) => <ActionButton disabled={watch.includes(a.id)} onClick={(e) => { e.stopPropagation(); setWatch((w) => [...w, a.id]); showToast(`${a.id} added to the live monitor watch list`, 'accent'); }}>{watch.includes(a.id) ? 'Watching' : 'Watch'}</ActionButton> },
          ]}
        />
      </Card>
      <Card>
        <CardHeader title="What sets the finish date: share of simulations each path and branch drives" />
        {(['CP1', 'CP2', 'CP3'] as const).map((p) => {
          const acts = cp.filter((a) => a.path === p);
          const share = Math.max(0, ...acts.map((a) => a.criticality ?? 0));
          // activities in series all share the path's value; only parallel branches differ
          const branches = acts.filter((a) => (a.criticality ?? 0) > 0.02 && (a.criticality ?? 0) < share - 0.02);
          return (
            <div key={p}>
              <BarRow label={`${p}: ${PATH_SCOPE[p].unit}, ${acts.length} activities`} labelWidth={330} value={Math.round(share * 100)} max={100} showPct={false} formatted={pct(share)} tone={p === 'CP1' ? 'crit' : p === 'CP2' ? 'warn' : 'accent'} />
              {branches.map((a) => (
                <BarRow key={a.id} label={`  branch ${a.id} ${a.name}`} labelWidth={330} value={Math.round((a.criticality ?? 0) * 100)} max={100} showPct={false} formatted={pct(a.criticality ?? 0)} tone="warn" />
              ))}
            </div>
          );
        })}
        <p className="small muted" style={{ margin: 0 }}>Activities in series share their path's value. Parallel branches split it: the 14"-P-2201 tie-in (CPA-008) and the internals re-installation (CPA-011) both feed the R-101 box-up, and whichever runs later in a simulation sets the date.</p>
      </Card>
      <ActivityRiskDrawer a={sel} onClose={() => setSel(null)} />
    </div>
  );
}
