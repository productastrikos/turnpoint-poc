import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { StatusChip } from '../../components/ui/StatusChip';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { FilterChips } from '../../components/ui/FilterChips';
import { Stepper } from '../../components/workflow/Stepper';
import { LoadingState } from '../../components/ui/EmptyState';
import { approveStep, getBom, getFlow, moveStep, setStepEnabled, type BomLine, type FlowStep } from '../../services/bomService';
import { advancePr } from '../../services/materialsService';
import { shortDate } from '../../mocks/_gen';
import { useCanEdit } from '../../app/AccessContext';
import { useToast } from '../../app/ToastContext';

const ALERT_TONE = { overdue: 'crit', 'due-soon': 'warn', ok: 'good', ordered: 'neutral' } as const;
const ALERT_TEXT = (l: BomLine) => (l.alert === 'overdue' ? `Order-by passed ${Math.abs(l.daysToOrder)} d ago` : l.alert === 'due-soon' ? `Order by in ${l.daysToOrder} d` : l.alert === 'ordered' ? 'Ordered' : `Order by in ${l.daysToOrder} d`);

export default function BomPage() {
  const canEdit = useCanEdit();
  const { showToast } = useToast();
  const [lines, setLines] = useState<BomLine[] | null>(null);
  const [flow, setFlow] = useState<FlowStep[]>([]);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [l, f] = await Promise.all([getBom(), getFlow()]);
    setLines(l);
    setFlow(f);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function approve(l: BomLine) {
    setBusy(l.item.id);
    await approveStep(l.item.id);
    await load();
    setBusy(null);
    showToast(`${l.item.id}: ${l.nextStep?.name} approved`, 'good');
  }
  async function order(l: BomLine) {
    setBusy(l.item.id);
    await advancePr(l.item.id);
    await load();
    setBusy(null);
    showToast(`${l.item.id}: purchase requisition raised in SAP MM (simulated)`, 'good');
  }

  if (!lines) return <div><PageHeader title="BOM & Approval Flow" subtitle="" checklist="P3" /><LoadingState /></div>;

  const alerts = lines.filter((l) => l.alert === 'overdue' || l.alert === 'due-soon').sort((a, b) => a.daysToOrder - b.daysToOrder);
  const active = flow.filter((f) => f.enabled);
  const shown = lines.filter((l) => filter === 'all' || l.alert === filter);

  return (
    <div>
      <PageHeader
        title="BOM & Approval Flow"
        subtitle="The consolidated bill of materials for the turnaround, with a configurable approval flow before procurement and automatic alerts when a line's order-by date (need date minus delivery time) is approaching or has passed."
        checklist="P3"
      />

      {alerts.length > 0 && (
        <div className="callout callout-crit" style={{ marginBottom: 16 }} role="alert">
          <strong>Procurement alerts: {alerts.length} BOM lines need ordering.</strong> {alerts.slice(0, 3).map((a) => `${a.item.id} (${ALERT_TEXT(a).toLowerCase()})`).join(' · ')}
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatTile label="BOM lines" value={String(lines.length)} delta={`OMR ${(lines.reduce((s, l) => s + l.item.estCostOMR, 0) / 1e6).toFixed(2)}M consolidated`} />
        <StatTile label="Past order-by date" value={String(lines.filter((l) => l.alert === 'overdue').length)} tone="crit" />
        <StatTile label="Order within 14 days" value={String(lines.filter((l) => l.alert === 'due-soon').length)} tone="warn" />
        <StatTile label="In approval" value={String(lines.filter((l) => l.alert !== 'ordered' && l.nextStep).length)} tone="accent" />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <CardHeader title="Approval flow (configurable)" action={<Chip tone="accent">{active.length} steps active</Chip>} />
        <Stepper steps={[...active.map((f) => f.name), 'Raise PR in SAP']} current={active.length} />
        <div className="grid grid-4" style={{ marginTop: 14, gap: 10 }}>
          {flow.map((f, i) => (
            <div key={f.id} className="card-flat" style={{ opacity: f.enabled ? 1 : 0.55 }}>
              <div className="spread"><strong style={{ fontSize: 13 }}>{i + 1}. {f.name}</strong>
                <input type="checkbox" checked={f.enabled} disabled={!f.optional} onChange={async (e) => setFlow(await setStepEnabled(f.id, e.target.checked))} aria-label={`Enable ${f.name}`} />
              </div>
              <div className="small muted">{f.role}</div>
              <div className="small" style={{ marginTop: 4 }}>{f.note}</div>
              <div className="row" style={{ gap: 4, marginTop: 6 }}>
                <button className="btn btn-sm" disabled={i === 0 || !canEdit} title={!canEdit ? 'Your role has view-only access to this page' : undefined} onClick={async () => setFlow(await moveStep(f.id, -1))}>↑</button>
                <button className="btn btn-sm" disabled={i === flow.length - 1 || !canEdit} title={!canEdit ? 'Your role has view-only access to this page' : undefined} onClick={async () => setFlow(await moveStep(f.id, 1))}>↓</button>
              </div>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>Reorder steps or switch on the optional budget-holder step. The table below re-evaluates every line against the new flow.</p>
      </Card>

      <Card>
        <div className="toolbar">
          <FilterChips options={[{ value: 'overdue', label: 'Past order-by' }, { value: 'due-soon', label: 'Due within 14 d' }, { value: 'ok', label: 'Later' }, { value: 'ordered', label: 'Ordered' }]} value={filter} onChange={setFilter} allLabel="All lines" />
        </div>
        <DataTable
          dense
          pageSize={12}
          rowKey={(l: BomLine) => l.item.id}
          rows={shown}
          initialSort={{ key: 'orderBy', dir: 'asc' }}
          columns={[
            { key: 'id', header: 'Line', render: (l) => <div><strong className="mono">{l.item.id}</strong><div className="small muted">{l.item.jobId}</div></div>, sortValue: (l) => l.item.id },
            { key: 'description', header: 'Material', render: (l) => <div style={{ maxWidth: 280 }}>{l.item.description}<div className="small muted">{l.item.qty.toLocaleString()} {l.item.uom} · {l.item.leadWeeks} wk delivery</div></div>, sortValue: (l) => l.item.description },
            { key: 'requiredBy', header: 'Needed', mono: true, render: (l) => shortDate(l.item.requiredBy), sortValue: (l) => l.item.requiredBy },
            { key: 'orderBy', header: 'Order by', mono: true, render: (l) => shortDate(l.orderBy), sortValue: (l) => l.orderBy },
            { key: 'alert', header: 'Alert', render: (l) => <Chip tone={ALERT_TONE[l.alert]}>{ALERT_TEXT(l)}</Chip>, sortValue: (l) => l.daysToOrder },
            { key: 'status', header: 'Approval', render: (l) => <StatusChip status={l.status} tone={l.alert === 'ordered' ? 'good' : l.nextStep ? 'warn' : 'accent'} />, sortValue: (l) => l.status },
            {
              key: 'a',
              header: '',
              nosort: true,
              render: (l) =>
                l.alert === 'ordered' ? null : l.nextStep ? (
                  <ActionButton busy={busy === l.item.id} onClick={() => approve(l)}>Approve: {l.nextStep.name}</ActionButton>
                ) : (
                  <ActionButton variant="primary" busy={busy === l.item.id} onClick={() => order(l)}>Raise PR</ActionButton>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
