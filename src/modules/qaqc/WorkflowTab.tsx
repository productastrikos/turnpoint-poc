import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { NCR_STAGE, PO_STAGES, type PoRec, type PoStageDef } from '../../mocks/qaqcMock';
import type { PoMetrics } from '../../services/qaqcService';
import { OWNER_CLASS, PointBadge } from './poHelpers';
import { PoTable } from './PoTable';

function StageCard({ def, n, metrics, active, focusId, onPick, loop }: { def: PoStageDef; n?: number; metrics: PoMetrics; active: boolean; focusId: string | null; onPick: () => void; loop?: boolean }) {
  const m = metrics.stage[def.id];
  const shown = m.pos.slice(0, loop ? 6 : 3);
  return (
    <button className={`qa-stage ${loop ? 'qa-loop' : 'main'} ${active ? 'active' : ''}`} onClick={onPick} aria-pressed={active} title={`${def.name}: click to list the ${m.count} PO${m.count === 1 ? '' : 's'} at this stage`}>
      <div className="qa-stage-top">
        {!loop && <span className="qa-num">{n}</span>}
        <span className={`qa-own ${loop ? 'qa-own-vendor' : OWNER_CLASS[def.ownerKind]}`}>{def.owner}</span>
      </div>
      <div className="qa-stage-name">{def.name}</div>
      {!loop && <div className="qa-stage-desc">{def.desc}</div>}
      {loop && (
        <div className="qa-loop-flow">
          Inspection fails at <b>FAT</b> or <b>site acceptance</b> &rarr; NCR raised &rarr; vendor rework &rarr; OQ verifies and closes &rarr; PO <b>returns to the stage that failed</b>. Certificate stays blocked meanwhile.
        </div>
      )}
      <div className="qa-pos">
        {shown.map((p) => (
          <span key={p.id} className={`tag-chip ${p.id === focusId ? 'focus' : ''}`}>{p.id.slice(-4)}</span>
        ))}
        {m.count > shown.length && <span className="tag-chip">+{m.count - shown.length}</span>}
      </div>
      <div className="qa-stage-foot">
        <span className="qa-count">{m.count}<small>PO{m.count === 1 ? '' : 's'}</small></span>
        <span style={{ textAlign: 'right' }}>
          {m.breach > 0 && <div className="qa-breach">{m.breach} past SLA</div>}
          <div className="qa-sla-tag">{def.sla > 0 ? `SLA ${def.sla} d` : 'no SLA'}</div>
        </span>
      </div>
    </button>
  );
}

export function WorkflowTab({
  pos,
  metrics,
  today,
  stage,
  onStage,
  focusId,
  activeKey,
  onOpen,
  showValue,
}: {
  pos: PoRec[];
  metrics: PoMetrics;
  today: string;
  stage: string;
  onStage: (s: string) => void;
  focusId: string | null;
  activeKey: string | null;
  onOpen: (id: string) => void;
  showValue: boolean;
}) {
  const pick = (id: string) => onStage(stage === id ? 'all' : id);
  const filtered = stage === 'all' ? pos : (metrics.stage[stage as keyof PoMetrics['stage']]?.pos ?? []);
  const def = stage === 'all' ? null : stage === 'ncr' ? NCR_STAGE : PO_STAGES.find((s) => s.id === stage) ?? null;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <CardHeader
          title="Purchase order to acceptance: the end-to-end QA/QC workflow"
          action={
            <span className="row-wrap small muted">
              Points: <PointBadge type="H" /> hold <PointBadge type="W" /> witness <PointBadge type="R" /> review <PointBadge type="S" /> surveillance
            </span>
          }
        />
        <p className="small muted" style={{ margin: '-6px 0 14px' }}>
          Every PO follows the same eight steps. Each card shows who owns the step, the service level, and how many POs are there right now. Click a card to list its POs below.
        </p>
        <div className="qa-pipe">
          {PO_STAGES.map((s, i) => (
            <StageCard key={s.id} def={s} n={i + 1} metrics={metrics} active={stage === s.id} focusId={focusId} onPick={() => pick(s.id)} />
          ))}
          <div className="qa-legend">
            <div className="qa-legend-row">
              <span className="qa-own qa-own-proc">OQ Procurement</span>
              <span className="qa-own qa-own-vendor">Vendor</span>
              <span className="qa-own qa-own-oq">OQ QA/QC</span>
              <span className="qa-own qa-own-insp">Inspector</span>
              <span className="qa-own qa-own-site">Site</span>
              <span className="qa-own qa-own-plan">Planner</span>
            </div>
            <div className="small muted">The small numbers in each card are the last four digits of the PO numbers there. The highlighted one is the PO you are working on.</div>
          </div>
          <StageCard def={NCR_STAGE} metrics={metrics} active={stage === 'ncr'} focusId={focusId} onPick={() => pick('ncr')} loop />
          <div className="qa-note">
            After acceptance, the material is used on site. Its field inspections (pre-cleaning to final) are tracked in the Exchanger inspections tab.
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={def ? `POs at "${def.name}" (${filtered.length})` : `All purchase orders (${pos.length})`}
          action={
            def ? (
              <button className="btn btn-sm" onClick={() => onStage('all')}>Clear stage filter</button>
            ) : (
              <Chip tone="neutral">click a stage above to filter</Chip>
            )
          }
        />
        <PoTable rows={filtered} today={today} showValue={showValue} activeKey={activeKey} focusId={focusId} onOpen={onOpen} compact />
      </Card>
    </div>
  );
}
