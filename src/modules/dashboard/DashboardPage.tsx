import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { Card, CardHeader } from '../../components/ui/Card';
import { SCurveChart } from '../../components/charts/SCurveChart';
import { BarRow } from '../../components/charts/BarRow';
import { Chip } from '../../components/ui/Chip';
import { SimBadge } from '../../components/ui/SimBadge';
import { getKPIs, getSCurve, getBudgetSummary, getSafetyStats } from '../../services/dashboardService';
import { getCriticalPathActivities } from '../../services/criticalPathService';
import type { KPI, SCurvePoint, CriticalPathActivity } from '../../types';
import { useRole } from '../../app/RoleContext';
import { useActiveTa } from '../../app/TaContext';
import { shortDate } from '../../mocks/_gen';
import { getRiskForecast, type RiskForecast } from '../../services/predictionService';
import { dayLabel, pct, riskTone } from '../ai-panel/riskFormat';
import { useDataEvent } from '../../app/dataEvents';
import { getLiveEvents, subscribeLive } from '../../integration/turnpointLink';

const KPI_LINK: Record<string, string> = {
  'Open Permits': '/alerts',
  'Open Discovery Jobs': '/discovery-jobs',
  'Critical Path Changes': '/critical-path?tab=changes',
  'Budget Committed': '/budget',
  'Progress (man-hour)': '/kpis?tab=scurve',
  'Man-hours (today)': '/attendance',
  'TA Day': '/critical-path',
  'Overall readiness': '/readiness',
};

export default function DashboardPage() {
  const { role } = useRole();
  const { activeTa, activeTaId } = useActiveTa();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [sCurve, setSCurve] = useState<SCurvePoint[]>([]);
  const [budget, setBudget] = useState<{ plannedOMR: number; committedOMR: number; actualOMR: number } | null>(null);
  const [safety, setSafety] = useState<{ ltiDays: number; nearMisses: number; highPotential: number; toolboxTalks: number; hseObservations: number } | null>(null);
  const [cp, setCp] = useState<CriticalPathActivity[]>([]);
  const [ai, setAi] = useState<RiskForecast | null>(null);

  const live = useSyncExternalStore(subscribeLive, getLiveEvents, getLiveEvents);

  const loadAll = useCallback(() => {
    getKPIs(activeTaId).then(setKpis);
    getSCurve(activeTaId).then(setSCurve);
    getBudgetSummary(activeTaId).then(setBudget);
    getSafetyStats().then(setSafety);
    getCriticalPathActivities().then(setCp);
  }, [activeTaId]);
  useEffect(loadAll, [loadAll]);

  const isActive = activeTa?.status === 'active';
  const loadAi = useCallback(() => {
    if (isActive) getRiskForecast().then(setAi);
  }, [isActive]);
  useEffect(loadAi, [loadAi]);
  // SAP / P6 messages change the scope, budget, critical path and forecast under the dashboard
  const onSchedule = useCallback(() => {
    loadAll();
    loadAi();
  }, [loadAll, loadAi]);
  useDataEvent('schedule', onSchedule);
  useDataEvent('scope', loadAll);
  const atRiskOrDelayed = cp.filter((a) => a.status !== 'on-track').length;
  const statusText = activeTa ? (activeTa.status === 'active' ? 'In execution' : activeTa.status === 'completed' ? 'Completed' : 'Planned') : '';

  return (
    <div>
      <PageHeader
        title="Command Dashboard"
        subtitle={
          activeTa
            ? `${activeTa.name} · ${statusText} · ${shortDate(activeTa.startDate)} start, ${activeTa.durationDays} days. Change the Active TA in the top bar to rescale every headline number. Tiles with a link are clickable.`
            : 'Loading turnaround…'
        }
      />

      {live.length > 0 && (
        <div className="live-feed" role="status" aria-live="polite">
          <div className="live-feed-head"><span className="live-dot" />Live from SAP &amp; Primavera P6 <span className="live-feed-sub">stand-in systems, over the local integration bus</span></div>
          {live.slice(0, 4).map((e, i) => (
            <div key={e.id} className={`live-feed-row tone-${e.tone} ${i === 0 ? 'newest' : ''}`}>
              <span className="live-feed-sys">{e.system}</span>
              <span className="live-feed-text">{e.text}</span>
              <span className="live-feed-at mono">{e.at}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {kpis.map((k) => (
          <StatTile key={k.label} {...(role === 'contractor' && k.label === 'Budget Committed' ? { label: k.label, value: 'Restricted', delta: 'cost figures are OQ staff only', trend: 'flat' as const, tone: 'neutral' as const } : k)} onClick={KPI_LINK[k.label] && !(role === 'contractor' && k.label === 'Budget Committed') ? () => navigate(KPI_LINK[k.label]) : undefined} />
        ))}
      </div>

      <div className="grid grid-2" style={{ alignItems: 'stretch' }}>
        <Card>
          <CardHeader title="S-Curve — Planned vs Actual Man-hours" action={<button className="btn btn-sm" onClick={() => navigate('/kpis?tab=scurve')}>Detail →</button>} />
          <SCurveChart data={sCurve} />
        </Card>

        {role === 'oq-staff' ? (
          <Card>
            <CardHeader title="Budget — Planned / Committed / Actual" action={<button className="btn btn-sm" onClick={() => navigate('/budget')}>Budget →</button>} />
            {budget && (
              <>
                <BarRow label="Planned" value={budget.plannedOMR} max={budget.plannedOMR} formatted={`OMR ${(budget.plannedOMR / 1e6).toFixed(2)}M`} tone="accent" />
                <BarRow label="Committed" value={budget.committedOMR} max={budget.plannedOMR} formatted={`OMR ${(budget.committedOMR / 1e6).toFixed(2)}M`} tone="warn" />
                <BarRow label="Actual" value={budget.actualOMR} max={budget.plannedOMR} formatted={`OMR ${(budget.actualOMR / 1e6).toFixed(2)}M`} tone="good" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  {[
                    ['Uncommitted headroom', `OMR ${((budget.plannedOMR - budget.committedOMR) / 1e6).toFixed(2)}M`],
                    ['Committed, not yet spent', `OMR ${((budget.committedOMR - budget.actualOMR) / 1e6).toFixed(2)}M`],
                    ['Spent of plan', `${Math.round((budget.actualOMR / budget.plannedOMR) * 100)}%`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="eyebrow">{k}</div>
                      <div className="mono" style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        ) : (
          <Card>
            <CardHeader title="Budget" />
            <div className="empty-state">Budget figures are hidden for the Contractor view.</div>
          </Card>
        )}
      </div>

      <div className="grid grid-3" style={{ marginTop: 20, alignItems: 'start' }}>
        <Card>
          <CardHeader
            title="Critical Path Snapshot"
            action={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Chip tone={atRiskOrDelayed > 0 ? 'warn' : 'good'}>{atRiskOrDelayed} at-risk/delayed</Chip>
                <button className="btn btn-sm" onClick={() => navigate('/critical-path')}>View all →</button>
              </div>
            }
          />
          {cp.slice(0, 6).map((a) => (
            <div key={a.id} onClick={() => navigate('/critical-path')} className="list-row" style={{ cursor: 'pointer' }}>
              <span>{a.path} · {a.name}</span>
              <Chip tone={a.status === 'on-track' ? 'good' : a.status === 'at-risk' ? 'warn' : 'crit'}>{a.status}</Chip>
            </div>
          ))}
        </Card>

        <Card>
          <CardHeader title={<span>AI Risk Prediction <SimBadge kind="model" /></span>} action={<button className="btn btn-sm" onClick={() => navigate('/ai-panel?tab=risk')}>Details →</button>} />
          {isActive ? (
            ai ? (
              <>
                <div className={`callout ${ai.sim.pMeetForecast < 0.4 ? 'callout-crit' : 'callout-warn'}`} style={{ marginBottom: 10 }}>
                  <strong>{pct(ai.sim.pMeetForecast)} chance of finishing by {dayLabel(ai.sim.forecastEnd)}; AI P50 {dayLabel(ai.sim.p50)}</strong>
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    Main drivers: {ai.activities.filter((a) => a.path !== 'Near').sort((a, b) => b.p - a.p).slice(0, 2).map((a) => `${a.id} ${a.name} (${pct(a.p)})`).join(', ')}.
                  </div>
                </div>
                <div className="row-wrap">
                  {(['CP1', 'CP2', 'CP3'] as const).map((p) => <Chip key={p} tone={riskTone(ai.sim.path[p].slipRisk)}>{p} · {pct(ai.sim.path[p].slipRisk)}</Chip>)}
                </div>
                <p className="small muted" style={{ margin: '10px 0 0' }}>{ai.sim.runs.toLocaleString()} simulations · P10 {dayLabel(ai.sim.p10)} · P90 {dayLabel(ai.sim.p90)} · best action: {ai.mitigations.find((m) => !m.accepted)?.title ?? 'all accepted'}</p>
              </>
            ) : (
              <div className="small muted" style={{ padding: 20 }}>Running the risk model…</div>
            )
          ) : (
            <div className="empty-state" style={{ padding: 20 }}>Risk prediction runs on the active turnaround. Select STO-2026 in the top bar to see it.</div>
          )}
        </Card>

        <Card>
          <CardHeader title="Safety Stats" />
          {safety && (
            <div className="grid grid-2">
              <StatTile label="LTI-free days" value={String(safety.ltiDays)} tone="good" />
              <StatTile label="Near misses" value={String(safety.nearMisses)} tone="warn" />
              <StatTile label="High-potential" value={String(safety.highPotential)} tone="crit" />
              <StatTile label="HSE observations" value={String(safety.hseObservations)} tone="neutral" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
