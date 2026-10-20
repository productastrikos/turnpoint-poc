import { Drawer } from '../../components/ui/Drawer';
import { SimBadge } from '../../components/ui/SimBadge';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { ExplainBars } from '../../components/charts/ExplainBars';
import { getRiskModelCard, type ActivityRisk } from '../../services/predictionService';
import { RISK_FEATURE_LABEL, HISTORY_PROCESS } from '../../ai/riskModel';
import { pct, riskTone } from './riskFormat';

const fmtValue = (feature: string, v: number) =>
  feature === 'predLate' ? (v ? 'yes' : 'no') : feature === 'reliability' ? v.toFixed(2) : feature === 'shortfall' ? `${v}%` : String(Math.round(v * 10) / 10);

/** Why one activity got its slip probability: inputs, contributions and the records they were read from. */
export function ActivityRiskDrawer({ a, onClose }: { a: ActivityRisk | null; onClose: () => void }) {
  return (
    <Drawer open={Boolean(a)} onClose={onClose} width={620} title={a ? <span>{a.id} · {a.name}</span> : ''} subtitle={a ? `${a.path === 'Near' ? 'Near-critical' : a.path} · ${a.crew} (${a.contractor})${a.p6Id ? ` · P6 ${a.p6Id}` : ''}` : ''}>
      {a && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="grid grid-3">
            <StatTile label="Slip ≥1 more day" value={pct(a.p)} tone={riskTone(a.p)} />
            {a.criticality !== undefined && <StatTile label="Sets the finish date" value={pct(a.criticality)} delta="share of simulations" />}
            {a.becomesCritical !== undefined && <StatTile label="Becomes critical" value={pct(a.becomesCritical)} tone={riskTone(a.becomesCritical)} delta="uses up its float" />}
            <StatTile label="Float" value={`${a.float} d`} tone={a.float < 0 ? 'crit' : a.float <= 1 ? 'warn' : 'neutral'} />
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>What moves this prediction (log-odds contribution vs an average activity)</div>
            <ExplainBars items={a.drivers} labelWidth={250} />
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Inputs read from the live data</div>
            <dl className="kv" style={{ gridTemplateColumns: '250px 1fr' }}>
              {a.drivers.map((d) => (
                <span key={d.feature} style={{ display: 'contents' }}><dt>{d.label}</dt><dd className="mono">{fmtValue(d.feature, d.value)}</dd></span>
              ))}
            </dl>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Linked records</div>
            {a.evidence.length ? a.evidence.map((e) => <div key={e} className="list-row small">{e}</div>) : <div className="small muted">No open findings, risks or constraints linked to this activity.</div>}
          </div>
        </div>
      )}
    </Drawer>
  );
}

/** How the risk model and the simulation work, with live hold-out metrics and the learned weights. */
export function RiskModelDrawer({ open, onClose, runs }: { open: boolean; onClose: () => void; runs: number }) {
  if (!open) return null;
  const card = getRiskModelCard();
  const h = card.holdout;
  const maxW = Math.max(...card.weights.map((w) => Math.abs(w.weight * (w.feature === 'reliability' ? 0.05 : 1))));
  return (
    <Drawer open={open} onClose={onClose} width={680} title={<span>Risk prediction model <SimBadge kind="model" /></span>} subtitle="Slip classifier + Monte Carlo schedule simulation, running in this browser">
      <div className="stack" style={{ gap: 14 }}>
        <div className="eyebrow">1 · Slip classifier (per activity)</div>
        <p className="small" style={{ margin: 0 }}>
          For every critical and near-critical activity the model reads nine signals from the live data (float, progress behind plan, times re-planned, open discovery jobs and NCRs on the equipment, crew shortfall from attendance, contractor SPI, late predecessors, remaining duration, open risks / SCFs / field constraints) and returns the probability that the activity slips at least one more day beyond today's forecast.
        </p>
        <div className="grid grid-4">
          <StatTile label="Training activities" value={card.rows.toLocaleString()} delta={`${pct(card.slipRate)} slipped`} />
          <StatTile label="Hold-out AUC" value={h.auc.toFixed(2)} tone="good" delta={`${h.n} activities not used in training`} />
          <StatTile label="Brier score" value={h.brier.toFixed(3)} delta="lower is better" />
          <StatTile label="Precision / recall" value={`${pct(h.precision)} / ${pct(h.recall)}`} delta={`alert threshold ${pct(h.threshold)}`} />
        </div>
        <div className="eyebrow">Learned weight per unit vs the process the history was drawn from</div>
        <div className="stack" style={{ gap: 6 }}>
          {card.weights.map((w) => {
            const scale = w.feature === 'reliability' ? 0.05 : 1; // SPI shown per 0.05
            return (
              <div key={w.feature} style={{ display: 'grid', gridTemplateColumns: '270px 1fr 120px', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
                <span style={{ color: 'var(--ink-2)' }}>{RISK_FEATURE_LABEL[w.feature]}{scale !== 1 ? ' (per 0.05)' : ''}</span>
                <div style={{ background: 'var(--surface-2)', borderRadius: 5, height: 12 }}>
                  <div style={{ width: `${(Math.abs(w.weight * scale) / maxW) * 100}%`, height: '100%', borderRadius: 5, background: w.weight >= 0 ? 'var(--crit)' : 'var(--good)' }} />
                </div>
                <span className="mono small" style={{ textAlign: 'right' }}>{(w.weight * scale).toFixed(2)} <span className="muted">({(w.truth * scale).toFixed(2)})</span></span>
              </div>
            );
          })}
        </div>
        <div className="eyebrow">2 · Monte Carlo schedule simulation</div>
        <p className="small" style={{ margin: 0 }}>
          {runs.toLocaleString()} runs over the CP1 / CP2 / CP3 network with the plan's own finish-to-start logic and lags. In each run every activity gets an extra delay drawn from its slip probability (0.2 to 1.6 days if it slips, a few hours either way if not); delays propagate to successors and the latest path sets the turnaround end. The runs give P10 / P50 / P90 finish dates, the chance of meeting today's forecast, the expected cost of delay at OMR 103K per day, and how often each activity sets the finish date. Actions are costed by re-running the same random draws with the action applied.
        </p>
        <div className="callout">
          Training data: {card.rows.toLocaleString()} activities generated to stand in for six previous turnarounds (STO-2012 to TA-2024), drawn from the process in the right-hand column (intercept {HISTORY_PROCESS.intercept}, noise sd {HISTORY_PROCESS.noiseSd}), because OQ RPI's activity history is not digitised yet. The model, its inputs and every number on these tabs are computed live in the browser; loading OQ's history retrains it the same way.
        </div>
        <div className="row-wrap"><Chip tone="accent">trained in {card.trainMs} ms</Chip><Chip tone="neutral">logistic regression, L2</Chip><Chip tone="neutral">no data leaves the device</Chip></div>
      </div>
    </Drawer>
  );
}
