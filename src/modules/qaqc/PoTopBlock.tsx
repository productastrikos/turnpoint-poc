import { StatTile } from '../../components/ui/StatTile';
import { ActionButton } from '../../components/ui/ActionButton';
import { shortDate } from './poHelpers';
import type { PoMetrics } from '../../services/qaqcService';
import type { PoRec } from '../../mocks/qaqcMock';

/** Demo helpers, live KPI strip and the ITP SLA-breach alert. Shown above the Workflow and PO & ITP tabs. */
export function PoTopBlock({
  metrics,
  today,
  focus,
  busy,
  onIssue,
  onFastForward,
  onFail,
  onReset,
  onClock,
  onOpen,
  onEscalate,
}: {
  metrics: PoMetrics;
  today: string;
  focus: PoRec | null;
  busy: boolean;
  onIssue: () => void;
  onFastForward: () => void;
  onFail: () => void;
  onReset: () => void;
  onClock: () => void;
  onOpen: (id: string) => void;
  onEscalate: (id: string) => void;
}) {
  const worst = metrics.slaBreaches[0];
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="qa-demobar no-print" role="group" aria-label="Demo controls">
        <span className="qa-demo-tag">Demo controls</span>
        <ActionButton variant="primary" onClick={onIssue} busy={busy}>Issue new PO (demo)</ActionButton>
        <ActionButton onClick={onFastForward} busy={busy} disabled={!focus} title={focus ? undefined : 'Open a PO or issue one first'}>
          Fast-forward {focus ? `PO ${focus.id}` : 'this PO'}
        </ActionButton>
        <ActionButton variant="danger" onClick={onFail} busy={busy} disabled={!focus} title="Raises an NCR at the vendor inspection or the site acceptance inspection">Simulate inspection failure</ActionButton>
        <span className="qa-sep" />
        <ActionButton onClick={onClock} busy={busy} title="Moves the demo date forward so SLA clocks run">+3 days (demo clock)</ActionButton>
        <span className="qa-clock" title="Simulated date used for all SLA clocks">Demo date {shortDate(today)} 2026</span>
        <span style={{ marginLeft: 'auto' }} />
        <span className="small muted">{focus ? <>Working on <b className="mono">PO {focus.id}</b> ({focus.vendor})</> : 'No PO selected'}</span>
        <ActionButton onClick={onReset}>Reset demo</ActionButton>
      </div>

      <div className="grid grid-5">
        <StatTile label="POs awaiting ITP approval" value={String(metrics.awaitingItp)} tone={metrics.slaBreaches.length ? 'warn' : 'accent'} delta={metrics.slaBreaches.length ? `${metrics.slaBreaches.length} past 3-day SLA` : 'within SLA'} />
        <StatTile label="Hold points overdue" value={String(metrics.holdOverdue)} tone={metrics.holdOverdue ? 'crit' : 'good'} delta="planned date passed" />
        <StatTile label="NCRs open" value={String(metrics.ncrOpen)} tone={metrics.ncrOpen ? 'crit' : 'good'} delta="block acceptance" />
        <StatTile label="Acceptance certificates issued" value={String(metrics.certs)} tone="good" delta="released to work packs" />
        <StatTile label="ITP approval cycle time" value={metrics.cycleDays === null ? '—' : `${metrics.cycleDays} d`} tone={metrics.cycleDays !== null && metrics.cycleDays > 3 ? 'warn' : 'good'} delta="average, SLA 3 d" />
      </div>

      {worst && (
        <div className="callout callout-crit qa-sla" role="alert">
          <div className="qa-sla-main">
            <b>SLA breach:</b> ITP for PO <span className="mono">{worst.po.id}</span> ({worst.po.vendor}, {worst.po.item}) has been waiting for OQ approval for <b>{worst.days} days</b> (SLA 3 days).
            {metrics.slaBreaches.length > 1 && <> {metrics.slaBreaches.length - 1} more past SLA.</>}
          </div>
          <button className="btn btn-sm" onClick={() => onOpen(worst.po.id)}>Open PO</button>
          <ActionButton onClick={() => onEscalate(worst.po.id)}>Escalate to QA/QC lead</ActionButton>
        </div>
      )}
    </div>
  );
}
