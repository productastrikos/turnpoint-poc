import { useMemo, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { Drawer } from '../../components/ui/Drawer';
import { BAND_TONE, onCriticalPath, riskBand, riskScore } from '../../services/scopeModel';
import { deferJob } from '../../services/jobsService';
import { useToast } from '../../app/ToastContext';
import type { Job } from '../../types';

const LIK = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'];
const CON = ['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'];

export function RiskTab({ jobs, reload }: { jobs: Job[]; reload: () => void }) {
  const { showToast } = useToast();
  const [cell, setCell] = useState<{ l: number; c: number } | null>(null);
  const [optimised, setOptimised] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const live = jobs.filter((j) => j.status !== 'rejected');
  const grid = (l: number, c: number) => live.filter((j) => j.likelihood === l && j.consequence === c);

  // optimisation: low-risk, costly, not on the critical path => candidates to defer; high-risk => protect
  const suggestions = useMemo(
    () =>
      live
        .filter((j) => riskScore(j) <= 6 && !onCriticalPath(j) && j.costOMR >= 40_000 && j.status !== 'approved')
        .concat(live.filter((j) => riskScore(j) <= 6 && !onCriticalPath(j) && j.costOMR >= 60_000 && j.status === 'approved'))
        .slice(0, 6),
    [live]
  );
  const protect = live.filter((j) => riskScore(j) >= 17);
  const savings = suggestions.reduce((s, j) => s + j.costOMR, 0);
  const hours = suggestions.reduce((s, j) => s + j.manhours, 0);

  async function defer(j: Job) {
    setBusy(j.id);
    await deferJob(j.id, 'Deferred by risk-based scope optimisation (low risk, off critical path)');
    reload();
    setBusy(null);
    showToast(`${j.id} deferred to the next TA. Saves OMR ${j.costOMR.toLocaleString()} and ${j.manhours.toLocaleString()} man-hours.`, 'good');
  }

  const cellBg = (l: number, c: number) => {
    const b = riskBand(l * c);
    return `color-mix(in srgb, var(--${b === 'Extreme' ? 'crit' : b === 'High' ? 'warn' : b === 'Medium' ? 'accent' : 'good'}) 26%, var(--surface))`;
  };
  const items = cell ? grid(cell.l, cell.c) : [];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <StatTile label="Extreme risk items" value={String(live.filter((j) => riskScore(j) >= 17).length)} tone="crit" delta="protect in scope" />
        <StatTile label="High risk items" value={String(live.filter((j) => riskScore(j) >= 10 && riskScore(j) < 17).length)} tone="warn" />
        <StatTile label="Low risk, off critical path" value={String(live.filter((j) => riskScore(j) <= 6 && !onCriticalPath(j)).length)} tone="good" delta="optimisation candidates" />
        <StatTile label="Items in matrix" value={String(live.length)} />
      </div>

      <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Risk matrix: scope items by likelihood and consequence" />
          <div style={{ display: 'grid', gridTemplateColumns: '110px repeat(5, 1fr)', gap: 4 }}>
            <div />
            {CON.map((c, i) => (
              <div key={c} className="hm-col" style={{ fontFamily: 'var(--font-body)' }}>{i + 1} {c}</div>
            ))}
            {[5, 4, 3, 2, 1].map((l) => (
              <div key={l} style={{ display: 'contents' }}>
                <div className="hm-row" style={{ fontSize: 11.5 }}>{l} {LIK[l - 1]}</div>
                {[1, 2, 3, 4, 5].map((c) => {
                  const n = grid(l, c).length;
                  return (
                    <button
                      key={c}
                      className="hm-cell clickable"
                      style={{ background: cellBg(l, c), border: 'none', minHeight: 54, color: 'var(--ink)', flexDirection: 'column', font: 'inherit' }}
                      onClick={() => n > 0 && setCell({ l, c })}
                      title={`Likelihood ${l} x consequence ${c} = ${l * c}`}
                    >
                      <span className="mono" style={{ fontWeight: 700, fontSize: 15 }}>{n || ''}</span>
                      <span className="mono" style={{ fontSize: 9.5, opacity: 0.6 }}>{l * c}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="chart-legend" style={{ marginTop: 12 }}>
            {(['Low', 'Medium', 'High', 'Extreme'] as const).map((b) => (
              <span key={b}><i style={{ background: `var(--${BAND_TONE[b] === 'accent' ? 'accent' : BAND_TONE[b]})` }} />{b}</span>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Risk-based scope optimisation" action={<ActionButton variant="primary" onClick={() => setOptimised(true)}>Optimise scope</ActionButton>} />
          {!optimised && <p className="small muted" style={{ margin: 0 }}>Press Optimise to propose deferring low-risk items that are off the critical path and keeping every high-risk item. You decide each suggestion.</p>}
          {optimised && (
            <>
              <div className="callout callout-good" style={{ marginBottom: 10 }}>
                {suggestions.length} items could be deferred: saves OMR {savings.toLocaleString()} and {hours.toLocaleString()} man-hours. {protect.length} extreme-risk items are protected.
              </div>
              {suggestions.length === 0 && <p className="small muted">No candidates left.</p>}
              {suggestions.map((j) => (
                <div key={j.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <div><strong style={{ fontSize: 13 }}>{j.id} {j.desc}</strong><div className="small muted">Risk {riskScore(j)} {riskBand(riskScore(j))} · OMR {j.costOMR.toLocaleString()} · {j.manhours.toLocaleString()} h</div></div>
                  <ActionButton busy={busy === j.id} onClick={() => defer(j)}>Defer</ActionButton>
                </div>
              ))}
              <div className="eyebrow" style={{ margin: '12px 0 4px' }}>Keep: extreme risk</div>
              {protect.map((j) => (
                <div key={j.id} className="list-row"><span style={{ fontSize: 13 }}>{j.id} {j.desc}</span><Chip tone="crit">{riskScore(j)} keep</Chip></div>
              ))}
            </>
          )}
        </Card>
      </div>

      <Drawer open={Boolean(cell)} onClose={() => setCell(null)} title={cell ? `Likelihood ${cell.l} × consequence ${cell.c}` : ''} subtitle={cell ? `${riskBand(cell.l * cell.c)} risk, score ${cell.l * cell.c}` : ''}>
        <DataTable
          dense
          rowKey={(j: Job) => j.id}
          rows={items}
          columns={[
            { key: 'id', header: 'ID', mono: true },
            { key: 'desc', header: 'Scope item' },
            { key: 'costOMR', header: 'OMR', mono: true, align: 'right', render: (j) => j.costOMR.toLocaleString() },
          ]}
        />
      </Drawer>
    </div>
  );
}
