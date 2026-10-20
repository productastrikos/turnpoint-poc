import { useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { LoadingState } from '../../components/ui/EmptyState';
import { BarChart } from '../../components/charts/BarChart';
import { acceptMitigation, type ActivityRisk, type MitigationResult } from '../../services/predictionService';
import { useToast } from '../../app/ToastContext';
import { useRole } from '../../app/RoleContext';
import { fmtOMR } from '../../mocks/_gen';
import { ActivityRiskDrawer, RiskModelDrawer } from './riskShared';
import { dayLabel, pct, riskTone } from './riskFormat';
import { useRiskForecast } from './useRiskForecast';

const signed = (v: number, unit: string, digits = 0) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}${unit}`;

function MitigationRow({ m, cost, busy, onAccept }: { m: MitigationResult; cost: boolean; busy: boolean; onAccept: () => void }) {
  const effects: string[] = [];
  if (Math.abs(m.deltaMeet) >= 0.005) effects.push(`chance of forecast ${signed(m.deltaMeet * 100, ' pts')}`);
  if (Math.abs(m.deltaP50) >= 0.05) effects.push(`P50 ${signed(m.deltaP50, ' d', 1)}`);
  if (Math.abs(m.deltaCp1Risk) >= 0.005) effects.push(`CP1 risk ${signed(m.deltaCp1Risk * 100, ' pts')}`);
  const nearOnly = Object.keys(m.effects).every((k) => k.startsWith('ACT-'));
  if (nearOnly) effects.push(`protects the float on ${Object.keys(m.effects).join(', ')}`);
  return (
    <div className="list-row" style={{ alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13 }}>{m.title}</div>
        <div className="row-wrap" style={{ gap: 6, marginTop: 4 }}>
          {effects.map((e) => <span key={e} className="reason-chip">{e}</span>)}
        </div>
        <div className="small" style={{ marginTop: 4, color: m.accepted ? 'var(--ink-3)' : m.netOMR >= 0 ? 'var(--good)' : 'var(--warn)' }}>
          {m.accepted
            ? `Accepted · action with ${m.owner}`
            : cost
              ? `${m.costOMR ? `Costs ${fmtOMR(m.costOMR)}` : 'No direct cost'}${m.deltaExposureOMR < -500 ? `, avoids ${fmtOMR(-m.deltaExposureOMR)} expected delay cost` : ''} · owner ${m.owner}`
              : `Owner ${m.owner}`}
        </div>
      </div>
      <ActionButton variant={m.accepted ? 'default' : 'primary'} disabled={m.accepted} busy={busy} onClick={onAccept}>{m.accepted ? 'Accepted' : 'Accept'}</ActionButton>
    </div>
  );
}

/** AI risk prediction (G12): live slip model + Monte Carlo, with actions costed by re-simulation. */
export function RiskTab() {
  const { showToast } = useToast();
  const { role } = useRole();
  const cost = role !== 'contractor';
  const { data, reload } = useRiskForecast();
  const [sel, setSel] = useState<ActivityRisk | null>(null);
  const [card, setCard] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (!data) return <LoadingState label="Running the risk model and 2,000 schedule simulations…" />;
  const s = data.sim;
  const fc = s.forecastEnd;
  const share = (d: number) => (s.endDays.filter((v) => Math.round(v) === d).length / s.runs) * 100;
  // histogram over the days that hold at least 0.5 % of the runs (keeps far outliers from stretching the axis)
  const allDays = Array.from({ length: Math.ceil(s.endDays[s.endDays.length - 1]) - Math.floor(s.endDays[0]) + 1 }, (_, i) => Math.floor(s.endDays[0]) + i);
  const kept = allDays.filter((d) => share(d) >= 0.5);
  const days = kept.length ? allDays.filter((d) => d >= kept[0] - 1 && d <= kept[kept.length - 1] + 1) : allDays;
  const cp1Hot = data.activities.filter((a) => a.path === 'CP1' && a.p >= 0.3);

  async function accept(m: MitigationResult) {
    setBusy(m.id);
    const before = data!.sim;
    await acceptMitigation(m.id);
    const after = (await reload()).sim;
    setBusy(null);
    showToast(`${m.id} accepted, action created for ${m.owner}. Chance of finishing by ${dayLabel(fc)}: ${pct(before.pMeetForecast)} → ${pct(after.pMeetForecast)}; P50 ${dayLabel(before.p50)} → ${dayLabel(after.p50)}.`, 'good');
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <StatTile label={`Chance of finishing by ${dayLabel(fc)}`} value={pct(s.pMeetForecast)} tone={s.pMeetForecast < 0.4 ? 'crit' : s.pMeetForecast < 0.7 ? 'warn' : 'good'} delta={`today's P6 forecast (+${fc - data.baselineEnd} d vs baseline)`} />
        <StatTile label="AI P50 finish" value={dayLabel(s.p50)} tone={Math.round(s.p50) > fc ? 'warn' : 'good'} delta={`P10 ${dayLabel(s.p10)} · P90 ${dayLabel(s.p90)}`} />
        <StatTile label="CP1 slip risk" value={pct(s.path.CP1.slipRisk)} tone={riskTone(s.path.CP1.slipRisk)} delta={`CP2 ${pct(s.path.CP2.slipRisk)} · CP3 ${pct(s.path.CP3.slipRisk)} (≥1 more day)`} />
        <StatTile label="Expected cost of delay" value={cost ? fmtOMR(data.exposureOMR) : 'Restricted'} tone="warn" delta={cost ? `vs ${dayLabel(data.baselineEnd)} baseline, probability-weighted` : 'cost figures are OQ staff only'} />
      </div>

      <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title={`Finish date across ${s.runs.toLocaleString()} simulated turnarounds`} action={<button className="btn btn-sm" onClick={() => setCard(true)}>How the model works</button>} />
          <BarChart
            height={300}
            labels={days.map(dayLabel)}
            stacked
            yFormat={(v) => `${Math.round(v)}%`}
            series={[
              { name: `By ${dayLabel(fc)} (forecast)`, data: days.map((d) => (d <= fc ? share(d) : 0)), color: 'var(--good)' },
              { name: 'Later than forecast', data: days.map((d) => (d > fc ? share(d) : 0)), color: 'var(--warn)' },
            ]}
          />
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            The P6 schedule says {dayLabel(fc)} (+{fc - data.baselineEnd} days on the {dayLabel(data.baselineEnd)} baseline). The model puts P50 at {dayLabel(s.p50)} because {cp1Hot.length} activities still to run on CP1 carry a slip risk of 30% or more ({cp1Hot.map((a) => `${a.id} ${pct(a.p)}`).join(', ')}). Computed in {data.computedMs} ms from the live data.
          </p>
        </Card>
        <Card>
          <CardHeader title="Recommended actions (modelled)" />
          <p className="small muted" style={{ margin: '-6px 0 4px' }}>Each action is applied to the model inputs and the {s.runs.toLocaleString()} runs are repeated with the same random draws, so the difference is the action's effect.</p>
          {data.mitigations.slice(0, 5).map((m) => <MitigationRow key={m.id} m={m} cost={cost} busy={busy === m.id} onAccept={() => accept(m)} />)}
        </Card>
      </div>

      <Card>
        <CardHeader title="Slip risk by activity: critical and near-critical" action={<span className="small muted">Click a row for the explanation and linked records</span>} />
        <DataTable
          dense
          rowKey={(a: ActivityRisk) => a.id}
          rows={data.activities}
          onRowClick={setSel}
          activeKey={sel?.id}
          initialSort={{ key: 'p', dir: 'desc' }}
          columns={[
            { key: 'name', header: 'Activity', render: (a) => <div><strong>{a.name}</strong><div className="small muted mono">{a.id}{a.p6Id ? <> · <span className="tag-chip p6">{a.p6Id}</span></> : null}</div></div> },
            { key: 'path', header: 'Path', render: (a) => <Chip tone={a.path === 'Near' ? 'neutral' : 'accent'}>{a.path === 'Near' ? 'near-critical' : a.path}</Chip> },
            { key: 'p', header: 'Slip ≥1 more day', render: (a) => <ProgressBar value={Math.round(a.p * 100)} tone={riskTone(a.p)} /> },
            { key: 'drive', header: 'Sets finish / turns critical', mono: true, sortValue: (a) => a.criticality ?? a.becomesCritical ?? 0, render: (a) => (a.criticality !== undefined ? pct(a.criticality) : <span style={{ color: `var(--${riskTone(a.becomesCritical ?? 0)})` }}>{pct(a.becomesCritical ?? 0)} turns critical</span>) },
            { key: 'drivers', header: 'Main drivers', nosort: true, render: (a) => <div className="row-wrap" style={{ gap: 4 }}>{a.drivers.filter((d) => d.contrib > 0.15).slice(0, 2).map((d) => <span key={d.feature} className="reason-chip">{d.label}</span>)}</div> },
            { key: 'ev', header: 'Linked records', align: 'right', mono: true, sortValue: (a) => a.evidence.length, render: (a) => a.evidence.length || '—' },
          ]}
        />
      </Card>
      <ActivityRiskDrawer a={sel} onClose={() => setSel(null)} />
      <RiskModelDrawer open={card} onClose={() => setCard(false)} runs={s.runs} />
    </div>
  );
}
