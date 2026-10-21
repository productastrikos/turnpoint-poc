import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { Field } from '../../components/ui/Field';
import { LoadingState } from '../../components/ui/EmptyState';
import { SimBadge } from '../../components/ui/SimBadge';
import { BarChart } from '../../components/charts/BarChart';
import { applyFixes, evaluate, getDraft, getHistory, getReviewLog, keepDraft, resetDraft, submitPlan, type Finding, type History, type PlanDraft, type ReviewEntry, type Severity } from '../../services/planCheckService';
import { CreatePlanDialog } from './CreatePlanDialog';
import { useToast } from '../../app/ToastContext';
import { useAuth } from '../../app/AuthContext';
import { PERSONAS } from '../../app/access';
import { longDate } from '../../mocks/_gen';
import type { TaEvent, TaType } from '../../types/platform';

const TONE: Record<Severity, 'good' | 'warn' | 'crit'> = { pass: 'good', warn: 'warn', block: 'crit' };
const LABEL: Record<Severity, string> = { pass: 'Pass', warn: 'Review', block: 'Blocker' };
const M = (n: number) => `OMR ${(n / 1e6).toFixed(2)}M`;
const TYPES: TaType[] = ['Major STO', 'Minor TA', 'Inspection Shutdown', 'Catalyst Change'];

export default function PlanCheckPage() {
  const [params, setParams] = useSearchParams();
  const { showToast } = useToast();
  const { personaId } = useAuth();
  const by = PERSONAS.find((p) => p.id === personaId)?.person ?? 'TA planner';
  const [events, setEvents] = useState<TaEvent[]>([]);
  const [hist, setHist] = useState<History | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [unitsText, setUnitsText] = useState('');
  const [override, setOverride] = useState('');
  const [log, setLog] = useState<ReviewEntry[]>(getReviewLog());
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const taId = params.get('ta') ?? 'TA-2027';

  useEffect(() => {
    getHistory().then(setHist);
  }, []);
  useEffect(() => {
    setDraft(null);
    getDraft(taId).then(({ draft: d, events: ev }) => {
      setDraft(d);
      setEvents(ev);
      setUnitsText(d.units.join(', '));
      setOverride('');
    });
  }, [taId]);

  const result = useMemo(() => (draft && hist ? evaluate(draft, hist, events) : null), [draft, hist, events]);
  if (!draft || !hist || !result) return <div><PageHeader title="Plan vs History Check" subtitle="" /><LoadingState /></div>;

  const patch = (p: Partial<PlanDraft>) => {
    const next = { ...draft, ...p };
    setDraft(next);
    keepDraft(next);
    if (p.units) setUnitsText(p.units.join(', '));
  };
  const num = (k: keyof PlanDraft) => (e: React.ChangeEvent<HTMLInputElement>) => patch({ [k]: Number(e.target.value) } as Partial<PlanDraft>);
  const fixable = result.findings.filter((f) => f.severity !== 'pass' && f.fix && f.fix.bulk !== false);
  const applyAll = () => patch(applyFixes(draft, hist, events));

  async function submit() {
    if (!draft || !result) return;
    setBusy(true);
    try {
      const entry = await submitPlan(draft, result, by, override);
      setLog(getReviewLog());
      setOverride('');
      showToast(entry.override ? `${draft.taId} submitted with an override. The justification is in the review log.` : `${draft.taId} plan submitted for approval and saved to the 10-year plan.`, entry.override ? 'warn' : 'good');
    } catch (e) {
      showToast((e as Error).message, 'crit');
    } finally {
      setBusy(false);
    }
  }

  const g = result.gate;
  const o = result.outcome;
  const planned = events.filter((e) => e.status !== 'completed');
  const cmpRows = [
    { m: 'Duration (days)', y24: `${hist.y24.plannedDays} planned, ${hist.y24.actualDays} actual`, y26: `${hist.y26.plannedDays} planned, ${hist.y26.forecastDays} forecast`, now: String(draft.durationDays) },
    { m: 'Budget', y24: `${M(hist.y24.budget)} planned, ${M(hist.y24.finalCost)} final`, y26: `${M(hist.y26.budget)} planned, ${M(hist.y26.forecastCost)} forecast`, now: M(draft.budgetOMR) },
    { m: 'Man-hours', y24: hist.y24.manhours.toLocaleString(), y26: hist.y26.manhours.toLocaleString(), now: draft.manhours.toLocaleString() },
    { m: 'Units in scope', y24: String(hist.y24.units), y26: String(hist.y26.units), now: String(draft.units.length) },
    { m: 'MH per day per unit', y24: Math.round(hist.y24.manhours / hist.y24.actualDays / hist.y24.units).toLocaleString(), y26: Math.round(hist.y26.manhours / hist.y26.forecastDays / hist.y26.units).toLocaleString(), now: Math.round(result.derived.mhPerDayPerUnit).toLocaleString() },
    { m: 'OMR per man-hour', y24: (hist.y24.finalCost / hist.y24.manhours).toFixed(1), y26: (hist.y26.forecastCost / hist.y26.manhours).toFixed(1), now: result.derived.omrPerMh.toFixed(1) },
    { m: 'Overrun vs plan (time / cost)', y24: `${(((hist.y24.actualDays / hist.y24.plannedDays) - 1) * 100).toFixed(0)}% / ${(((hist.y24.finalCost / hist.y24.budget) - 1) * 100).toFixed(1)}%`, y26: `${(((hist.y26.forecastDays / hist.y26.plannedDays) - 1) * 100).toFixed(0)}% / ${(((hist.y26.forecastCost / hist.y26.budget) - 1) * 100).toFixed(1)}%`, now: `P80 expected ${Math.round((o.p80Days / draft.durationDays - 1) * 100)}% / ${(((o.p80Cost / draft.budgetOMR) - 1) * 100).toFixed(1)}%` },
  ];

  return (
    <div>
      <PageHeader
        title="Plan vs History Check"
        subtitle="Compare a turnaround plan with the previous turnarounds and industry practice before it is approved. Every rule shows your value, the evidence, and a one-click fix."
        badges={['illustrative']}
        action={
          <div className="row" style={{ gap: 8 }}>
            <ActionButton variant="primary" small={false} onClick={() => setCreating(true)}>Create plan</ActionButton>
          <select aria-label="Turnaround to check" value={draft.taId} onChange={(e) => setParams({ ta: e.target.value }, { replace: true })}>
            {planned.map((e) => <option key={e.id} value={e.id}>{e.id} · {e.type} · {e.startDate.slice(0, 4)}</option>)}
          </select>
          </div>
        }
      />
      <CreatePlanDialog open={creating} onClose={() => setCreating(false)} onCreated={(ev) => { setLog(getReviewLog()); setParams({ ta: ev.id }, { replace: true }); }} />

      <div className={`callout callout-${g === 'ready' ? 'good' : g === 'review' ? 'warn' : 'crit'}`} role="status" aria-live="polite" style={{ marginBottom: 16, borderLeft: `4px solid var(--${g === 'ready' ? 'good' : g === 'review' ? 'warn' : 'crit'})` }}>
        <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
          <strong data-testid="gate">
            {g === 'ready' ? 'Ready to approve: the plan agrees with history and industry practice' : g === 'review' ? `Review needed: ${result.warns} warning${result.warns === 1 ? '' : 's'}, no blockers` : `Do not approve yet: ${result.blocks} blocker${result.blocks === 1 ? '' : 's'}, ${result.warns} warning${result.warns === 1 ? '' : 's'}`}
          </strong>
          <span className="row" style={{ gap: 6 }}>
            <Chip tone="crit">{result.blocks} blockers</Chip><Chip tone="warn">{result.warns} warnings</Chip><Chip tone="good">{result.passes} passed</Chip>
            {fixable.length > 0 && <ActionButton small onClick={applyAll}>Apply all {fixable.length} suggested fixes</ActionButton>}
          </span>
        </div>
      </div>

      <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <Card>
            <CardHeader title="Checks" action={<SimBadge kind="illustrative" title="Rules and thresholds are TURNPOINT defaults calibrated on the seeded STO-2024 and STO-2026 figures. Replace with OQ RPI's own history and cost-engineering standard." />} />
            <div className="stack">
              {result.findings.map((f) => <FindingRow key={f.id} f={f} onFix={() => f.fix && patch(f.fix.patch)} />)}
            </div>
          </Card>

          <Card>
            <CardHeader title="This plan vs previous turnarounds" />
            <DataTable dense rowKey={(r: (typeof cmpRows)[number]) => r.m} rows={cmpRows} columns={[
              { key: 'm', header: 'Measure', render: (r) => <strong>{r.m}</strong> },
              { key: 'y24', header: 'STO-2024 (done)', render: (r) => <span className="small">{r.y24}</span> },
              { key: 'y26', header: 'STO-2026 (running)', render: (r) => <span className="small">{r.y26}</span> },
              { key: 'now', header: `${draft.taId} (this plan)`, render: (r) => <strong className="mono">{r.now}</strong> },
            ]} />
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHeader title="Plan inputs" action={<button className="btn btn-sm" onClick={() => { resetDraft(draft.taId); getDraft(draft.taId).then(({ draft: d }) => { setDraft(d); setUnitsText(d.units.join(', ')); }); }}>Restore saved</button>} />
            <div className="form-grid">
              <Field label="Type"><select value={draft.type} onChange={(e) => patch({ type: e.target.value as TaType })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Units (comma separated)"><input value={unitsText} onChange={(e) => { setUnitsText(e.target.value); patch({ units: e.target.value.split(',').map((u) => u.trim().toUpperCase()).filter(Boolean) }); }} /></Field>
              <Field label="Planned start"><input type="date" value={draft.startDate} onChange={(e) => e.target.value && patch({ startDate: e.target.value })} /></Field>
              <Field label="Scope freeze date"><input type="date" value={draft.freezeDate} onChange={(e) => e.target.value && patch({ freezeDate: e.target.value })} /></Field>
              <Field label="Duration (days)"><input type="number" min={1} value={draft.durationDays} onChange={num('durationDays')} /></Field>
              <Field label="Contingency (%)"><input type="number" min={0} max={60} value={draft.contingencyPct} onChange={num('contingencyPct')} /></Field>
              <Field label="Budget (OMR)"><input type="number" min={0} step={10000} value={draft.budgetOMR} onChange={num('budgetOMR')} /></Field>
              <Field label="Man-hours"><input type="number" min={0} step={1000} value={draft.manhours} onChange={num('manhours')} /></Field>
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>Ends {longDate(new Date(new Date(`${draft.startDate}T00:00:00Z`).getTime() + draft.durationDays * 86400000).toISOString().slice(0, 10))}. Edits re-check instantly and are not saved to the portfolio until you submit.</p>
          </Card>

          <div className="grid grid-2">
            <StatTile label="Likely duration (P50 / P80)" value={`${o.p50Days} / ${o.p80Days} d`} delta={`plan ${draft.durationDays} d`} tone={o.p80Days > draft.durationDays * 1.15 ? 'warn' : 'neutral'} />
            <StatTile label="Likely cost (P50 / P80)" value={`${(o.p50Cost / 1e6).toFixed(1)} / ${(o.p80Cost / 1e6).toFixed(1)} M`} delta={`budget ${(draft.budgetOMR / 1e6).toFixed(1)} M`} tone={o.p80Cost > draft.budgetOMR * (1 + draft.contingencyPct / 100) ? 'crit' : 'neutral'} />
          </div>
          <Card>
            <CardHeader title="If this plan performs like history" />
            <BarChart height={180} labels={['Budget', 'Budget + contingency', 'P50', 'P80']} yFormat={(v) => `${v.toFixed(1)}`}
              series={[{ name: 'OMR M', data: [draft.budgetOMR, draft.budgetOMR * (1 + draft.contingencyPct / 100), o.p50Cost, o.p80Cost].map((v) => Math.round(v / 1e5) / 10), color: 'var(--accent)' }]} legend={false} />
            <p className="small muted">P50 uses the average overrun of STO-2024 and STO-2026, P80 the worst. P80 slippage exposes about OMR {(o.downtimeExposureOMR / 1e6).toFixed(2)}M of lost production at OMR 100K a day.</p>
          </Card>

          <Card>
            <CardHeader title="Submit for approval" />
            {result.blocks > 0 && (
              <Field label="Override justification (required with blockers)" hint="Logged with your name in the review log.">
                <textarea rows={2} value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Why is it acceptable to proceed despite the blockers?" />
              </Field>
            )}
            <div className="row" style={{ marginTop: 8 }}>
              <ActionButton variant="primary" small={false} busy={busy} onClick={submit} disabled={result.blocks > 0 && override.trim().length < 15}>
                {result.blocks > 0 ? 'Submit with override' : result.warns > 0 ? 'Submit with warnings noted' : 'Submit for approval'}
              </ActionButton>
            </div>
          </Card>
        </div>
      </div>

      <Card style={{ marginTop: 16 }}>
        <CardHeader title="Review log" />
        <DataTable dense rowKey={(r: ReviewEntry) => r.at} rows={log} emptyText="No plans submitted yet." columns={[
          { key: 'at', header: 'When', mono: true, render: (r) => r.at.slice(0, 16).replace('T', ' ') },
          { key: 'taId', header: 'Event', mono: true },
          { key: 'by', header: 'By' },
          { key: 'gate', header: 'Result', render: (r) => <Chip tone={r.gate === 'ready' ? 'good' : r.gate === 'review' ? 'warn' : 'crit'}>{r.blocks} blockers, {r.warns} warnings</Chip> },
          { key: 'summary', header: 'Plan submitted', render: (r) => <span className="small">{r.summary}</span> },
          { key: 'override', header: 'Override reason', render: (r) => <span className="small">{r.override ?? '-'}</span> },
        ]} />
      </Card>

      <Card style={{ marginTop: 16 }}>
        <CardHeader title="Where the rules come from" />
        <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><strong>History:</strong> STO-2024 actuals and STO-2026 forecast (seeded, replace with OQ RPI close-out data). Reference-class forecasting: a new plan is judged against what comparable events really did.</li>
          <li><strong>Scope growth:</strong> a 1,350-turnaround database puts average growth after freeze at 19%, top quartile at 7% (AP-Networks, via <a href="https://cleopatraenterprise.com/blog/role-of-scope-freeze-in-turnarounds/" target="_blank" rel="noreferrer">scope freeze article</a>).</li>
          <li><strong>Estimate accuracy:</strong> turnaround estimates vary about -27% to +43% against the +/-10% teams claim (<a href="https://www.ogj.com/general-interest/article/17227163/analysis-yields-turnaround-benchmarks-for-allowance-contingency" target="_blank" rel="noreferrer">Oil &amp; Gas Journal</a>); scope freeze about 9 months before shutdown.</li>
          <li><strong>Estimate maturity:</strong> AACE 18R-97 estimate classes; the less defined the scope, the wider the range, so contingency steps down from Class 4 to Class 3 once scope is frozen.</li>
          <li><strong>SOW 13:</strong> preparation lead time T-36 months (high complexity) and T-24 months (medium). Thresholds marked Policy are TURNPOINT defaults to be agreed with OQ RPI.</li>
        </ul>
      </Card>
    </div>
  );
}

function FindingRow({ f, onFix }: { f: Finding; onFix: () => void }) {
  return (
    <div className={`callout ${f.severity === 'block' ? 'callout-crit' : f.severity === 'warn' ? 'callout-warn' : 'callout-good'}`} style={{ borderLeft: `4px solid var(--${TONE[f.severity]})` }} data-testid={`finding-${f.id}`}>
      <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
        <strong>{f.rule}</strong>
        <span className="row" style={{ gap: 6 }}><Chip tone={TONE[f.severity]}>{LABEL[f.severity]}</Chip><span className="small muted">{f.basis}</span></span>
      </div>
      <dl className="kv" style={{ marginTop: 6, color: 'var(--ink)' }}>
        <dt>Your plan</dt><dd>{f.yours}</dd>
        <dt>Evidence</dt><dd>{f.history}</dd>
        {f.severity !== 'pass' && <><dt>Why it matters</dt><dd>{f.why}</dd></>}
      </dl>
      {f.fix && f.severity !== 'pass' && <div style={{ marginTop: 8 }}><button className="btn btn-sm" onClick={onFix}>{f.fix.label}</button></div>}
    </div>
  );
}
