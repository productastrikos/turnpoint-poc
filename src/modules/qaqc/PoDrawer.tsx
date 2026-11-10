import { useState, type ReactNode } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { Chip } from '../../components/ui/Chip';
import { ActionButton } from '../../components/ui/ActionButton';
import { Modal } from '../../components/ui/Modal';
import { Stepper } from '../../components/workflow/Stepper';
import { NCR_STAGE, PO_STAGES, type PoRec } from '../../mocks/qaqcMock';
import {
  acceptanceStatus,
  approveItp,
  certificateBlockers,
  closeNcr,
  displayStage,
  issueCertificate,
  openNcrCount,
  raiseNcr,
  receiveMaterial,
  rejectItp,
  releasePoint,
  requestItp,
  scheduleInspection,
  siteAccept,
  startReview,
  submitItp,
  submitRework,
  type Actor,
  type PoResult,
} from '../../services/qaqcService';
import { ACCEPT_TONE, fmtStamp, ItpChip, PointBadge, shortDate } from './poHelpers';
import { fmtOMR } from '../../mocks/_gen';

type Call = (id: string) => Promise<PoResult>;

/** Detail drawer for one PO: stepper, role-based actions for the current stage, ITP points, NCRs, history, acceptance certificate. */
export function PoDrawer({ po, actor, showValue, canEdit, onClose, onDone }: { po: PoRec | null; actor: Actor; showValue: boolean; canEdit: boolean; onClose: () => void; onDone: (r: PoResult) => void }) {
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [cert, setCert] = useState(false);
  if (!po) return null;

  const ds = displayStage(po);
  const stageIdx = PO_STAGES.findIndex((s) => s.id === po.stage);
  const current = po.cert ? PO_STAGES.length : stageIdx;
  const nextPt = po.points.find((x) => !x.done);
  const openNcr = po.ncrs.filter((n) => n.status !== 'Closed');
  const blockers = certificateBlockers(po);

  async function go(fn: Call) {
    setBusy(true);
    const r = await fn(po!.id);
    setBusy(false);
    onDone(r);
    if (r.ok) setComment('');
  }

  const btn = (label: string, fn: Call, variant: 'primary' | 'danger' | 'default' = 'primary') => (
    <ActionButton key={label} variant={variant} busy={busy} disabled={!canEdit} onClick={() => go(fn)}>{label}</ActionButton>
  );

  const actions: ReactNode[] = [];
  if (openNcr.length) {
    const n = openNcr[0];
    if (n.status === 'Open') actions.push(btn(`Vendor submits rework (${n.id})`, (id) => submitRework(id, n.id, actor)));
    if (n.status === 'Rework submitted') actions.push(btn(`Verify and close ${n.id}`, (id) => closeNcr(id, n.id, actor)));
  } else if (po.stage === 'po') actions.push(btn('Request ITP from vendor', (id) => requestItp(id, actor)));
  else if (po.stage === 'itp-submit') actions.push(btn('Vendor submits ITP (vendor portal)', (id) => submitItp(id, actor)));
  else if (po.stage === 'itp-review') {
    if (po.itpStatus === 'Submitted') actions.push(btn('Start review', (id) => startReview(id, actor), 'default'));
    actions.push(btn('Approve ITP', (id) => approveItp(id, actor, comment || undefined)));
    actions.push(btn('Reject with comments', (id) => rejectItp(id, actor, comment || 'Hold points and acceptance criteria to be revised.'), 'danger'));
  } else if (po.stage === 'schedule') actions.push(btn('Schedule inspection points', (id) => scheduleInspection(id, actor)));
  else if (po.stage === 'fat') {
    if (nextPt) actions.push(btn(`Release ${nextPt.type === 'H' ? 'hold' : nextPt.type === 'W' ? 'witness' : 'inspection'} point: ${nextPt.name}`, (id) => releasePoint(id, nextPt.id, actor)));
    actions.push(btn('Raise NCR (failed inspection)', (id) => raiseNcr(id, actor), 'danger'));
  } else if (po.stage === 'receipt') {
    if (!po.receivedOn) actions.push(btn('Record material receipt', (id) => receiveMaterial(id, actor)));
    else actions.push(btn('Site acceptance inspection passed', (id) => siteAccept(id, actor)));
    actions.push(btn('Raise NCR (failed inspection)', (id) => raiseNcr(id, actor), 'danger'));
  } else if (po.stage === 'cert') actions.push(btn('Issue acceptance certificate', (id) => issueCertificate(id, actor)));

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width={780}
        title={<span>PO <span className="mono">{po.id}</span> · {po.item}</span>}
        subtitle={`${po.vendor} · ${po.itpNo} · ${po.materialId} · job ${po.jobId}`}
        footer={
          <>
            <span className="small muted" style={{ marginRight: 'auto' }}>Acting as {actor.person} ({actor.label}){actor.qa ? ' · OQ QA/QC' : ''}</span>
            {po.cert && <button className="btn btn-primary" onClick={() => setCert(true)}>View acceptance certificate</button>}
          </>
        }
      >
        <div className="stack">
          <Stepper steps={PO_STAGES.map((s) => s.short)} current={current} failedIndex={ds === 'ncr' ? stageIdx : undefined} />
          <div className="row-wrap">
            <Chip tone={ds === 'ncr' ? 'crit' : po.cert ? 'good' : 'accent'}>{ds === 'ncr' ? NCR_STAGE.name : PO_STAGES[stageIdx].name}</Chip>
            <ItpChip p={po} />
            <Chip tone={ACCEPT_TONE[acceptanceStatus(po)]}>{acceptanceStatus(po)}</Chip>
            {openNcrCount(po) > 0 && <Chip tone="crit">{openNcrCount(po)} NCR open</Chip>}
            {showValue && <span className="small muted">PO value {fmtOMR(po.valueOMR)}</span>}
            <span className="small muted">PO date {shortDate(po.poDate)} · required by {shortDate(po.requiredBy)}</span>
          </div>

          <div className="card-flat">
            <div className="eyebrow">Next step ({PO_STAGES[stageIdx]?.owner ?? ''})</div>
            {po.stage === 'itp-review' && (
              <label className="field" style={{ margin: '6px 0' }}>
                <span className="field-label">Review comment (used for reject, optional for approve)</span>
                <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Add witness point for hydrotest; acceptance criteria per PO clause 4.2" />
              </label>
            )}
            <div className="row-wrap" style={{ marginTop: 6 }}>
              {actions.length ? actions : <span className="small muted">{po.cert ? 'Complete. Acceptance certificate issued and the material is released to the work pack.' : 'No step available for your role.'}</span>}
            </div>
            {po.stage === 'cert' && blockers.length > 0 && <div className="callout callout-crit" style={{ marginTop: 8 }}>Stage control: certificate blocked because {blockers.join('; ')}.</div>}
          </div>

          <div>
            <div className="eyebrow">Inspection test plan {po.itpNo} · Rev {po.itpRev}</div>
            <table className="table dt-dense">
              <thead><tr><th>Point</th><th>Type</th><th>Where</th><th>Planned</th><th>Status</th></tr></thead>
              <tbody>
                {po.points.map((x) => (
                  <tr key={x.id}>
                    <td>{x.name}</td>
                    <td><PointBadge type={x.type} /></td>
                    <td className="small">{x.where}</td>
                    <td className="small mono">{shortDate(x.planned)}</td>
                    <td>{x.done ? <Chip tone="good">released {x.doneAt ? shortDate(x.doneAt) : ''}</Chip> : <Chip tone={x.type === 'H' ? 'crit' : 'neutral'}>open</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {po.ncrs.length > 0 && (
            <div>
              <div className="eyebrow">Non-conformance reports</div>
              {po.ncrs.map((n) => (
                <div key={n.id} className="list-row small">
                  <span><strong className="mono">{n.id}</strong> · {n.pointName}<div className="muted">{n.text}</div></span>
                  <Chip tone={n.status === 'Closed' ? 'good' : n.status === 'Open' ? 'crit' : 'warn'}>{n.status}</Chip>
                </div>
              ))}
            </div>
          )}

          {po.itpComments.length > 0 && (
            <div>
              <div className="eyebrow">ITP review comments</div>
              {po.itpComments.map((c, i) => <div key={i} className="list-row small"><span>{c.text}<div className="muted">{c.by} · {fmtStamp(c.at)}</div></span><Chip tone={c.kind === 'approved' ? 'good' : c.kind === 'rejected' ? 'crit' : 'neutral'}>{c.kind}</Chip></div>)}
            </div>
          )}

          <div>
            <div className="eyebrow">History</div>
            {po.events.slice(0, 12).map((e, i) => <div key={i} className="list-row small"><span>{e.text}<div className="muted">{e.by}</div></span><span className="mono muted">{fmtStamp(e.at)}</span></div>)}
          </div>
        </div>
      </Drawer>

      <Modal open={cert} onClose={() => setCert(false)} width={700} title="Acceptance certificate" footer={<><button className="btn" onClick={() => setCert(false)}>Close</button><button className="btn btn-primary" onClick={() => window.print()}>Print / Save PDF</button></>}>
        {po.cert && (
          <div>
            <div className="eyebrow">OQ · Sohar Refinery · STO 2026</div>
            <h3 style={{ fontSize: 24, margin: '4px 0 2px' }}>Material Acceptance Certificate</h3>
            <div className="small muted">Certificate {po.cert.no} · issued {fmtStamp(po.cert.issuedAt)} by {po.cert.by}</div>
            <dl className="kv" style={{ marginTop: 14 }}>
              <dt>Purchase order</dt><dd className="mono">{po.id}</dd>
              <dt>Item</dt><dd>{po.item}</dd>
              <dt>Vendor</dt><dd>{po.vendor}</dd>
              <dt>ITP</dt><dd>{po.itpNo} Rev {po.itpRev} (approved)</dd>
              <dt>Inspection points</dt><dd>{po.points.filter((x) => x.done).length} of {po.points.length} released ({po.points.filter((x) => x.type === 'H').length} hold, {po.points.filter((x) => x.type === 'W').length} witness)</dd>
              <dt>NCRs</dt><dd>{po.ncrs.length} raised, {po.ncrs.filter((n) => n.status === 'Closed').length} closed</dd>
              <dt>Released to</dt><dd>Work pack {po.cert.workPack}</dd>
            </dl>
            <p className="small muted">Material conforms to the purchase order and the approved ITP. Released for use in the turnaround work pack above.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
