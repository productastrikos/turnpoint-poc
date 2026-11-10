import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { ActionButton } from '../../components/ui/ActionButton';
import { Stepper } from '../../components/workflow/Stepper';
import { useRole } from '../../app/RoleContext';
import { useToast } from '../../app/ToastContext';
import { fastForwardDemo, loadMidTaState, resetScopeDemo, simulatePostFreezeRequest, summarise, formatHours, formatMoney } from '../../services/scopeService';
import { FREEZE_DATE } from '../../mocks/scopeMock';
import { longDate } from '../../mocks/_gen';
import type { Job } from '../../types';
import { useReadiness, useScope } from './useScope';

function Count({ label, value, tone }: { label: string; value: number; tone: 'good' | 'warn' | 'crit' | 'neutral' }) {
  return (
    <div style={{ minWidth: 92 }}>
      <div className="eyebrow">{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: tone === 'neutral' ? 'var(--ink)' : `var(--${tone})` }}>{value}</div>
    </div>
  );
}

/** Lifecycle banner at the top of the Scope page: where the scope stands (open, frozen, post-freeze) and the demo controls. */
export function LifecycleBanner({ jobs, reload, goTo, onFreeze }: { jobs: Job[]; reload: () => void; goTo: (tab: string) => void; onFreeze: () => void }) {
  const { role } = useRole();
  const { showToast } = useToast();
  const scope = useScope();
  const ready = useReadiness(jobs);
  const [busy, setBusy] = useState<string | null>(null);
  const staff = role !== 'contractor';

  const frozen = scope.stage === 'frozen';
  const post = frozen && scope.certs.length > 1;
  const current = !frozen ? 0 : post ? 2 : 1;
  const sum = summarise(scope.variations);
  const approved = jobs.filter((j) => j.status === 'approved').length;
  const pending = jobs.filter((j) => j.status === 'pending').length;
  const rejected = jobs.filter((j) => j.status === 'rejected' && j.taClass === 'TA').length;
  const diverted = jobs.filter((j) => j.status === 'rejected' && j.taClass === 'Non-TA').length;
  const openVars = scope.variations.filter((v) => v.status === 'Pending').length;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'The action failed', 'crit');
    } finally {
      setBusy(null);
      reload();
    }
  }

  const fastForward = () =>
    run('ff', async () => {
      const r = await fastForwardDemo();
      const bits = [
        r.estimated ? `${r.estimated} missing budget estimated by AI` : '',
        r.merged ? `${r.merged} duplicate${r.merged === 1 ? '' : 's'} merged` : '',
        `${r.approved} items approved through gates 1 to 3`,
        r.diverted ? `${r.diverted} diverted to routine maintenance` : '',
        r.variationsApproved ? `${r.variationsApproved} pre-freeze variations approved` : '',
      ].filter(Boolean);
      showToast(`Fast-forwarded: ${bits.join(', ')}. The scope is ready to freeze.`, 'good');
    });

  const simulate = () =>
    run('sim', async () => {
      const r = await simulatePostFreezeRequest();
      const v = r.variation;
      showToast(
        `${v.id} raised after the freeze: ${v.title}. ${formatMoney(v.costOMR)}, ${formatHours(v.manhours)}${v.cpDays ? `, critical path +${v.cpDays} day${v.cpDays === 1 ? '' : 's'}` : ', no critical-path impact'}. Routed to ${v.approver}.`,
        'warn'
      );
      goTo('variations');
    });

  const reset = () =>
    run('reset', async () => {
      resetScopeDemo();
      showToast('Demo reset: the scope is back to pre-freeze, with the first items waiting at the gates.', 'accent');
      goTo('worklist');
    });

  const midTa = () =>
    run('mid', async () => {
      await loadMidTaState();
      showToast('Loaded the mid-turnaround picture: scope frozen and a history of post-freeze variations (Rev B).', 'accent');
    });

  const est = role === 'contractor' ? 'Restricted' : `OMR ${((frozen ? (scope.baseline?.estimateOMR ?? 0) : (ready?.projectedEstimate ?? 0)) / 1e6).toFixed(2)}M`;
  const cur = role === 'contractor' ? 'Restricted' : `OMR ${(sum.current / 1e6).toFixed(2)}M`;

  return (
    <Card style={{ marginBottom: 16, borderTop: `4px solid ${frozen ? (post ? 'var(--warn)' : 'var(--good)') : 'var(--accent)'}` }}>
        <div className="spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 420, maxWidth: 760 }} data-testid="lifecycle-stepper">
            <Stepper steps={['Pre-freeze (open)', 'Frozen (Rev A)', `Post-freeze (${post ? `Rev ${scope.revision}` : 'Rev B, C ...'})`]} current={current} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <Chip tone={frozen ? (post ? 'warn' : 'good') : 'accent'}>{scope.label}</Chip>
            <div className="mono small muted" style={{ marginTop: 4 }}>
              {frozen ? `Frozen ${longDate(scope.baseline?.frozenAt ?? FREEZE_DATE)}` : `Planned freeze date ${longDate(FREEZE_DATE)}`}
            </div>
          </div>
        </div>

        <div className="row-wrap" style={{ gap: 28, margin: '14px 0 12px' }}>
          <Count label="Approved" value={approved} tone="good" />
          <Count label="Pending at gates" value={pending} tone="warn" />
          <Count label="Rejected" value={rejected} tone="crit" />
          <Count label="Diverted" value={diverted} tone="neutral" />
          <Count label="Variations open" value={openVars} tone={openVars ? 'warn' : 'neutral'} />
          <div style={{ minWidth: 150 }}>
            <div className="eyebrow">{frozen ? 'Baseline estimate (Rev A)' : 'Projected baseline estimate'}</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{est}</div>
          </div>
          {frozen && (
            <div style={{ minWidth: 150 }}>
              <div className="eyebrow">Current estimate</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{cur}</div>
              {staff && sum.approvedPost !== 0 && <div className="small" style={{ color: 'var(--warn)' }}>{formatMoney(sum.approvedPost)} since freeze</div>}
            </div>
          )}
        </div>

        {staff && (
          <div className="row-wrap" style={{ gap: 8 }}>
            {!frozen ? (
              <>
                <span title={ready?.ok ? 'Freeze the scope, issue certificate Rev A and push SFRZ to SAP' : `Not ready: ${ready?.blockers ?? 'checking'}`}>
                  <ActionButton variant="primary" small={false} disabled={!ready?.ok} busy={false} onClick={onFreeze} data-testid="freeze-btn">Freeze scope</ActionButton>
                </span>
                <ActionButton small={false} busy={busy === 'ff'} onClick={fastForward} title="Approve everything that is still open so the freeze can be shown in seconds" data-testid="ff-btn">Fast-forward demo (approve all remaining)</ActionButton>
                <button className="btn" onClick={() => goTo('approvals')}>Readiness checklist</button>
              </>
            ) : (
              <>
                <ActionButton variant="primary" small={false} busy={busy === 'sim'} onClick={simulate} data-testid="sim-btn">Simulate post-freeze request</ActionButton>
                <button className="btn" onClick={() => goTo('variations')}>Variation log</button>
                <button className="btn" onClick={() => goTo('freeze')}>Certificate</button>
              </>
            )}
            <span style={{ marginLeft: 'auto' }} className="row-wrap">
              {frozen && !post && <ActionButton busy={busy === 'mid'} onClick={midTa} title="Fill the app with the frozen, mid-turnaround picture the other pages were built around">Load mid-TA state</ActionButton>}
              <ActionButton busy={busy === 'reset'} onClick={reset} title="Back to the open, pre-freeze scope" data-testid="reset-btn">Reset demo to pre-freeze</ActionButton>
            </span>
          </div>
        )}
        {staff && !frozen && ready && !ready.ok && (
          <div className="small" style={{ marginTop: 8, color: 'var(--warn)' }} data-testid="freeze-blockers">
            Freeze is blocked: {ready.blockers}.
          </div>
        )}
        {staff && !frozen && ready?.ok && (
          <div className="small" style={{ marginTop: 8, color: 'var(--good)' }}>All five readiness checks are green. The scope can be frozen.</div>
        )}
    </Card>
  );
}
