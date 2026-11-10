import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Chip } from '../../components/ui/Chip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ActionButton } from '../../components/ui/ActionButton';
import { SimBadge } from '../../components/ui/SimBadge';
import { estimateScopeBudget, type Estimate, type EstimateInput } from '../../services/estimateService';
import { useRole } from '../../app/RoleContext';

const HINT =
  'Estimating model running on this device: man-hours x discipline rate + material allowance + access + contingency, blended with the nearest completed jobs. Rates and the job history are illustrative until OQ SAP PM actuals are loaded. No language model is called.';

export const omr = (n: number) => `OMR ${n.toLocaleString()}`;

/** The result of one estimate: figure, range, confidence and the working behind it. */
export function EstimateCard({ est, onAccept, acceptLabel }: { est: Estimate; onAccept?: () => void; acceptLabel?: string }) {
  return (
    <div className="stack" style={{ gap: 10 }} data-testid="estimate-card">
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="eyebrow">Budgetary estimate</div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 700 }} data-testid="estimate-value">{omr(est.estimateOMR)}</div>
          <div className="small muted">Range {omr(est.lowOMR)} to {omr(est.highOMR)}</div>
        </div>
        <div style={{ minWidth: 190 }}>
          <div className="spread"><span className="eyebrow">Confidence</span><span className="mono small">{est.confidence}%</span></div>
          <ProgressBar value={est.confidence} />
          <div className="small muted" style={{ marginTop: 4 }}>{est.analogies.length} similar past job{est.analogies.length === 1 ? '' : 's'} · {est.workType} on a {est.equipClass.toLowerCase()}</div>
        </div>
      </div>
      <div className="card-flat">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Basis of estimate</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
          {est.basis.map((b) => <li key={b}>{b}</li>)}
        </ul>
      </div>
      {est.analogies.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Similar completed jobs</div>
          {est.analogies.map((a) => (
            <div key={a.job.id} className="list-row" style={{ padding: '6px 0' }}>
              <span style={{ fontSize: 12.5 }}><strong className="mono">{a.job.id}</strong> {a.job.desc}<div className="small muted">{a.job.ta} · {a.job.manhours.toLocaleString()} h · actual {omr(a.job.costOMR)}</div></span>
              <span className="mono small" style={{ textAlign: 'right' }}>{Math.round(a.similarity * 100)}% similar<div className="muted">scaled {omr(Math.round(a.scaledOMR))}</div></span>
            </div>
          ))}
        </div>
      )}
      {onAccept && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <ActionButton variant="primary" small={false} onClick={onAccept} data-testid="estimate-accept">{acceptLabel ?? `Use ${omr(est.estimateOMR)}`}</ActionButton>
        </div>
      )}
    </div>
  );
}

/** "AI budget estimate" inside the new-scope form: runs the estimate, shows the working, fills the cost field when accepted. */
export function BudgetEstimatePanel({ input, onAccept }: { input: EstimateInput; onAccept: (e: Estimate) => void }) {
  const { role } = useRole();
  const [est, setEst] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState(false);
  if (role === 'contractor') return null;
  const can = input.desc.trim().length >= 8 && Boolean(input.discipline);

  async function run() {
    setBusy(true);
    setEst(null);
    setEst(await estimateScopeBudget(input));
    setBusy(false);
  }

  return (
    <div className="card-flat" style={{ marginTop: 14 }} data-testid="budget-panel">
      <div className="spread">
        <span><strong>AI budget estimate</strong> <SimBadge kind="ondevice" title={HINT} /></span>
        <ActionButton small={false} busy={busy} disabled={!can} onClick={run} title={can ? undefined : 'Enter a description and a discipline first'} data-testid="budget-estimate-btn">
          {est ? 'Re-estimate' : 'Estimate budget'}
        </ActionButton>
      </div>
      {!est && !busy && <div className="small muted" style={{ marginTop: 4 }}>No estimate to hand? Let the model propose one from similar past jobs and the man-hours. You review it, then accept.</div>}
      {est && (
        <div style={{ marginTop: 10 }}>
          <EstimateCard
            est={est}
            onAccept={() => {
              onAccept(est);
              setEst(null);
            }}
            acceptLabel={`Use ${omr(est.estimateOMR)} as the budgetary estimate`}
          />
        </div>
      )}
    </div>
  );
}

/** Same estimate for an existing item (worklist row, import preview). Accepting hands the figure back to the caller. */
export function BudgetEstimateModal({ open, title, input, onAccept, onClose }: { open: boolean; title: string; input: EstimateInput | null; onAccept: (e: Estimate) => void; onClose: () => void }) {
  const [est, setEst] = useState<Estimate | null>(null);
  const sig = input ? JSON.stringify(input) : '';
  useEffect(() => {
    setEst(null);
    if (!open || !input) return;
    let live = true;
    estimateScopeBudget(input).then((e) => live && setEst(e));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sig]);
  return (
    <Modal open={open} onClose={onClose} title={<span>{title} <SimBadge kind="ondevice" title={HINT} /></span>} width={680}>
      {!est ? (
        <div className="loading-state" role="status"><span className="spinner" />Estimating from comparable jobs, man-hours and material allowances…</div>
      ) : (
        <EstimateCard est={est} onAccept={() => onAccept(est)} />
      )}
      <div className="row" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
        <Chip tone="neutral">Simulated: rates and job history are illustrative</Chip>
      </div>
    </Modal>
  );
}
