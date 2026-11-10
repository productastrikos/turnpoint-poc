import { useMemo, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { ActionButton } from '../../components/ui/ActionButton';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { applyDelay, applyRecovery, applyScriptedDelay, CHAIN_NAMES, getImpactAssumptions, RECOVERY, resetCpDemo, setImpactAssumptions, type DelayEvent, type DelayResult, type RecoveryKind, type Snapshot } from '../../services/criticalPathService';
import { dayToDate, shortDate } from '../../mocks/_gen';
import { useToast } from '../../app/ToastContext';
import { useCanEdit } from '../../app/AccessContext';

const CAUSES = [
  'Crane conflict (shared lift)',
  'Material arrived late',
  'Permit not issued on time',
  'Welder / skilled labour shortage',
  'Discovery job found at inspection',
  'Tool faulty or missing',
  'Scaffold access not ready',
  'Vendor rework on a spool',
];

const omr = (n: number) => `OMR ${Math.round(n).toLocaleString()}`;
const dateOf = (d: number) => shortDate(dayToDate(Math.round(d)));
const fmtD = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10} d`;

/** Live monitor: inject a delay on any line, see what became critical, what it costs, and what recovers it. */
export function LiveMonitor({ snap, events, onChange, showCost }: { snap: Snapshot; events: DelayEvent[]; onChange: (changed: string[]) => void; showCost: boolean }) {
  const { showToast } = useToast();
  const canEdit = useCanEdit();
  const [id, setId] = useState('ACT-318');
  const [days, setDays] = useState(2);
  const [cause, setCause] = useState(CAUSES[5]);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<DelayEvent | null>(null);
  const [standing, setStanding] = useState(getImpactAssumptions().standingCostPerDay);

  const rows = snap.rows;
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const nameOf = (x: string) => byId.get(x)?.name ?? x;

  function finish(r: DelayResult, verb: string) {
    setBusy(false);
    if (!r.ok || !r.event) {
      showToast(r.error ?? 'Not applied', 'crit');
      return;
    }
    setLast(r.event);
    onChange(r.changedIds);
    const e = r.event;
    const slip = e.endAfter - e.endBefore;
    if (e.newlyCritical.length) showToast(`${verb}: ${e.newlyCritical.map((x) => `${x} ${nameOf(x)}`).join(', ')} became critical. The critical path changed.`, 'crit');
    else if (e.switched) showToast(`${verb}: the driving path switched to ${CHAIN_NAMES[e.pathAfter]}. The critical path changed.`, 'crit');
    else if (slip > 0.01) showToast(`${verb}: TA end moves ${fmtD(slip)}.`, 'warn');
    else showToast(`${verb}: absorbed by float, no change to the critical path.`, 'good');
  }

  async function apply() {
    setBusy(true);
    finish(await applyDelay({ id, days, cause }), `${id} +${days} d`);
  }
  async function scripted() {
    setBusy(true);
    const r = await applyScriptedDelay();
    if (r.script) {
      setId(r.script.id);
      setDays(r.script.days);
      setCause(r.script.cause);
    }
    finish(r, r.script ? `${r.script.id} +${r.script.days} d` : 'Delay');
  }
  async function recover(kind: RecoveryKind) {
    if (!last) return;
    setBusy(true);
    finish(await applyRecovery(last.activityId, kind), `${RECOVERY[kind].label} on ${last.activityId}`);
  }
  async function reset() {
    await resetCpDemo();
    setLast(null);
    onChange([]);
    showToast('Critical path monitor reset to the seeded plan', 'accent');
  }

  const near = rows.filter((r) => r.path === 'Near');
  const crit = rows.filter((r) => r.crit === 'critical');
  const slip = snap.slipDays;
  const overrun = near.filter((r) => r.floatDays < 0);
  const standingCost = slip * standing;
  const lastRow = last ? byId.get(last.activityId) : undefined;
  const crew = last ? last.lines.reduce((s, l) => s + l.crewCostOMR, 0) : 0;
  const lastSlip = last ? last.slipDelta : 0;
  const lastTotal = last ? Math.round(crew + lastSlip * standing) : 0;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <div className="spread" style={{ alignItems: 'flex-start', gap: 16 }}>
          <div style={{ maxWidth: 560 }}>
            <h3 style={{ fontSize: 17 }}>Real-time monitoring <span className="sim-badge sim-simulated">Simulated feed</span></h3>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              In production every progress update from the field or P6 re-runs the critical path method. Here you add a delay to any line and OQ recalculates immediately: which activities became critical, whether the driving path switched, how far the TA end moves, and what that costs.
            </p>
          </div>
          <div className="row-wrap no-print">
            <ActionButton variant="primary" busy={busy} disabled={!canEdit} onClick={scripted} title="Plays the next prepared delay of the demo">Next demo delay</ActionButton>
            <ActionButton onClick={reset}>Reset demo</ActionButton>
          </div>
        </div>
        <div className="toolbar no-print" style={{ marginTop: 14, flexWrap: 'wrap', gap: 10 }}>
          <label className="field" style={{ margin: 0 }}>
            <span className="field-label">Line that is delayed</span>
            <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Delayed activity" style={{ minWidth: 300 }}>
              <optgroup label="Critical-path chains">
                {rows.filter((r) => r.path !== 'Near').map((r) => <option key={r.id} value={r.id}>{r.id} {r.name} (float {Math.round(r.floatDays)} d)</option>)}
              </optgroup>
              <optgroup label="Near-critical work">
                {near.map((r) => <option key={r.id} value={r.id}>{r.id} {r.name} (float {Math.round(r.floatDays)} d)</option>)}
              </optgroup>
            </select>
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span className="field-label">Delay (days)</span>
            <input type="number" min={1} max={14} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} style={{ width: 80 }} aria-label="Delay in days" />
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span className="field-label">Cause</span>
            <select value={cause} onChange={(e) => setCause(e.target.value)} aria-label="Cause" style={{ minWidth: 240 }}>
              {(CAUSES.includes(cause) ? CAUSES : [cause, ...CAUSES]).map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <ActionButton variant="primary" busy={busy} disabled={!canEdit} onClick={apply}>Apply delay</ActionButton>
        </div>
      </Card>

      <div className="grid grid-4">
        <StatTile label="TA end (forecast)" value={shortDate(snap.endDate)} delta={`plan ${shortDate(snap.planEndDate)}`} tone={snap.slipDays > 0.01 ? 'crit' : 'good'} trend={snap.slipDays > 0.01 ? 'up' : 'flat'} />
        <StatTile label="Slip vs plan" value={fmtD(slip)} tone={slip > 0.01 ? 'crit' : 'good'} />
        <StatTile label="Critical activities" value={String(crit.length)} delta={`${snap.nearCount} near-critical (float ≤ 5 d)`} tone={crit.length ? 'warn' : 'good'} />
        <StatTile label="Cost of slip to date" value={showCost ? omr(standingCost) : 'restricted'} delta={showCost ? `${omr(standing)} per day` : undefined} tone={slip > 0.01 ? 'crit' : 'neutral'} />
      </div>

      {overrun.length > 0 && (
        <div className="callout callout-warn">Hand-back window overrun (not on the TA-end path): {overrun.map((r) => `${r.id} ${r.name} by ${Math.abs(Math.round(r.floatDays))} d`).join('; ')}. The dependent asset start-up is delayed; the TA end only moves if the critical chain slips.</div>
      )}

      {last ? (
        <Card style={{ borderTop: `4px solid ${last.kind === 'recovery' ? 'var(--good)' : last.newlyCritical.length || last.switched ? 'var(--crit)' : 'var(--accent)'}` }}>
          <CardHeader
            title={last.kind === 'recovery' ? `Recovery applied: ${last.cause} on ${last.activityId}` : `What happened: ${last.activityId} ${last.name} delayed ${last.days} d`}
            action={<Chip tone={last.countedChange ? 'crit' : 'good'}>{last.countedChange ? 'critical path changed (counted)' : 'no change to the critical path'}</Chip>}
          />
          {last.kind !== 'recovery' && <p className="small muted" style={{ margin: '-6px 0 12px' }}>Cause: {last.cause}</p>}
          <div className="grid grid-4" style={{ marginBottom: 14 }}>
            <div className="card-flat"><div className="eyebrow">TA end</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{dateOf(last.endBefore)} → {dateOf(last.endAfter)}</div><div className="small muted">{Math.abs(last.endAfter - last.endBefore) < 0.01 ? 'unchanged' : fmtD(last.endAfter - last.endBefore)}</div></div>
            <div className="card-flat"><div className="eyebrow">Newly critical</div>{last.newlyCritical.length ? last.newlyCritical.map((x) => <div key={x}><Chip tone="crit">{x}</Chip> <span className="small">{nameOf(x)}</span></div>) : <div className="small muted">none</div>}{last.dropped.length > 0 && <div className="small muted" style={{ marginTop: 4 }}>No longer critical: {last.dropped.join(', ')}</div>}</div>
            <div className="card-flat"><div className="eyebrow">Driving path</div><div style={{ fontWeight: 600 }}>{CHAIN_NAMES[last.pathAfter]}</div><div className="small muted">{last.switched ? `switched from ${CHAIN_NAMES[last.pathBefore]}` : 'unchanged'}</div></div>
            <div className="card-flat"><div className="eyebrow">Cost impact</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{showCost ? (last.kind === 'recovery' ? `${omr(last.costOMR)} to recover` : omr(lastTotal)) : 'restricted'}</div>{showCost && last.kind !== 'recovery' && <div className="small muted">{omr(crew)} crew standby + {lastSlip.toFixed(1)} d × {omr(standing)}</div>}</div>
          </div>

          <div className="eyebrow" style={{ marginBottom: 4 }}>Impact by line</div>
          <table className="table dt-dense">
            <thead><tr><th>Activity</th><th>Role</th><th style={{ textAlign: 'right' }}>Finish moves</th><th style={{ textAlign: 'right' }}>Float</th>{showCost && <th style={{ textAlign: 'right' }}>Crew standby</th>}</tr></thead>
            <tbody>
              {last.lines.map((l) => (
                <tr key={l.id}>
                  <td><span className="mono">{l.id}</span> {l.name}</td>
                  <td><Chip tone={l.role === 'delayed' ? 'crit' : 'warn'}>{l.role === 'delayed' ? 'delayed' : 'knock-on'}</Chip></td>
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtD(l.shiftDays)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{l.floatBefore} → <strong style={{ color: l.floatAfter <= 0 ? 'var(--crit)' : undefined }}>{l.floatAfter}</strong> d</td>
                  {showCost && <td className="mono" style={{ textAlign: 'right' }}>{l.crewCostOMR ? omr(l.crewCostOMR) : '—'}</td>}
                </tr>
              ))}
              {showCost && last.kind !== 'recovery' && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right' }}>TA overrun: {lastSlip.toFixed(1)} d × {omr(standing)} per day (logistics, rentals, lost margin)</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{omr(lastSlip * standing)}</td>
                </tr>
              )}
              {showCost && last.kind !== 'recovery' && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right' }}><strong>Total cost of this delay</strong></td>
                  <td className="mono" style={{ textAlign: 'right' }}><strong>{omr(lastTotal)}</strong></td>
                </tr>
              )}
            </tbody>
          </table>

          {last.kind !== 'recovery' && lastRow && (
            <div className="no-print" style={{ marginTop: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Recover the time</div>
              <div className="row-wrap">
                {(Object.keys(RECOVERY) as RecoveryKind[]).map((k) => {
                  const r = RECOVERY[k];
                  const cost = Math.max(r.minCost, Math.round(lastRow.costOMR * r.costShare));
                  return <ActionButton key={k} busy={busy} disabled={!canEdit} onClick={() => recover(k)} title={r.blurb}>{r.label} (−{Math.min(r.days, Math.max(0, lastRow.remaining - 1))} d{showCost ? `, ${omr(cost)}` : ''})</ActionButton>;
                })}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <div className="callout">No delay applied yet. Press <strong>Next demo delay</strong> to play a prepared case, or choose any line above and press <strong>Apply delay</strong>.</div>
      )}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Near-critical watch list (float 5 days or less)" />
          {near.map((n) => (
            <div key={n.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <strong>{n.name}</strong>
                <div className="small muted">{n.id} · {n.owner}</div>
                <div style={{ marginTop: 6, maxWidth: 260 }}><ProgressBar value={Math.max(0, Math.round(n.floatDays))} max={5} tone={n.floatDays <= 0 ? 'crit' : n.floatDays <= 1 ? 'warn' : 'good'} showLabel={false} /></div>
              </div>
              <Chip tone={n.floatDays <= 0 ? 'crit' : n.floatDays <= 1 ? 'warn' : 'good'}>{n.floatDays <= 0 ? `CRITICAL (${Math.round(n.floatDays)} d)` : `float ${Math.round(n.floatDays)} d`}</Chip>
            </div>
          ))}
        </Card>
        <Card>
          <CardHeader title="Event feed" />
          {events.length === 0 && <p className="small muted">Events appear here as delays and recoveries are applied.</p>}
          {events.slice(0, 10).map((e) => (
            <div key={e.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <span style={{ color: e.countedChange ? 'var(--crit)' : undefined, fontWeight: e.countedChange ? 700 : 400 }}>
                {e.kind === 'recovery' ? 'Recovery' : 'Delay'} {e.activityId} {e.days > 0 ? '+' : ''}{e.days} d: {e.cause}
                <div className="small muted">{e.newlyCritical.length ? `${e.newlyCritical.join(', ')} became critical. ` : ''}{e.switched ? 'Driving path switched. ' : ''}TA end {dateOf(e.endBefore)} → {dateOf(e.endAfter)}</div>
              </span>
              <span className="mono small muted">{e.id}</span>
            </div>
          ))}
        </Card>
      </div>

      {showCost && (
        <Card>
          <CardHeader title="Cost assumptions (editable)" />
          <label className="field" style={{ maxWidth: 360 }}>
            <span className="field-label">Cost of one day of TA overrun (OMR): logistics, rentals, lost margin share</span>
            <input type="number" min={0} step={1000} value={standing} onChange={(e) => { const v = Math.max(0, Number(e.target.value) || 0); setStanding(v); setImpactAssumptions({ standingCostPerDay: v }); }} />
          </label>
          <p className="small muted" style={{ margin: 0 }}>Crew standby assumes 40% of a crew's daily cost is paid while it waits; knock-on activities count half. These are assumptions for the demo, set by the TA office in the real product.</p>
        </Card>
      )}
    </div>
  );
}
