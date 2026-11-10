import { useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { StatusChip } from '../../components/ui/StatusChip';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { ActionButton } from '../../components/ui/ActionButton';
import { Drawer } from '../../components/ui/Drawer';
import { FormDialog, type FieldDef } from '../../components/ui/FormDialog';
import { BarChart } from '../../components/charts/BarChart';
import { createVariation, decideVariation, formatHours, formatMoney, simulatePostFreezeRequest, summarise } from '../../services/scopeService';
import { FREEZE_DATE, type Variation } from '../../mocks/scopeMock';
import { useToast } from '../../app/ToastContext';
import { longDate, longStamp, shortDate } from '../../mocks/_gen';
import type { Job } from '../../types';
import { GrowthPanel } from './GrowthPanel';
import { useScope } from './useScope';

const FIELDS: FieldDef[] = [
  { name: 'title', label: 'Variation', required: true },
  { name: 'ref', label: 'Reference (SCF / DJ / job)', required: true, placeholder: 'e.g. DJ-021' },
  { name: 'type', label: 'Type', type: 'select', options: ['Addition', 'Deletion', 'Change'], required: true },
  { name: 'source', label: 'Source', type: 'select', options: ['SCF', 'Discovery job', 'Originator', 'MOC'], required: true },
  { name: 'originator', label: 'Originator', required: true },
  { name: 'costOMR', label: 'Cost change (OMR, negative for deletion)', type: 'number', required: true },
  { name: 'manhours', label: 'Man-hour change', type: 'number', required: true },
  { name: 'cpDays', label: 'Critical-path impact (days)', type: 'number', defaultValue: '0', hint: 'Days added to the longest path. 3 or more also needs the Head of Turnaround Services.' },
  { name: 'reason', label: 'Why (reason for the change)', type: 'textarea', required: true },
];

export function VariationsTab({ jobs, reload }: { jobs: Job[]; reload: () => void }) {
  const { showToast } = useToast();
  const scope = useScope();
  const rows = scope.variations;
  const [phase, setPhase] = useState('all');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const frozen = scope.stage === 'frozen';
  const s = summarise(rows);
  const shown = rows.filter((v) => (phase === 'all' || v.phase === phase) && (status === 'all' || v.status === status));
  const bySource = (['SCF', 'Discovery job', 'Originator', 'MOC'] as const).map((src) => rows.filter((v) => v.status === 'Approved' && v.source === src));
  const pendingNow = rows.filter((v) => v.status === 'Pending');
  const detail = rows.find((v) => v.id === sel);
  const jobsById = new Map(jobs.map((j) => [j.id, j]));

  async function decide(v: Variation, d: 'Approved' | 'Rejected') {
    setBusy(v.id);
    const r = await decideVariation(v.id, d);
    reload();
    setBusy(null);
    if (d === 'Rejected') showToast(r.effect, 'crit');
    else if (r.certificate) showToast(`${v.id} approved: ${r.effect}. ${formatMoney(v.costOMR)}, ${formatHours(v.manhours)}. Freeze certificate re-issued as Rev ${r.certificate.revision} and pushed to SAP (simulated).`, 'good');
    else showToast(`${v.id} approved: ${formatMoney(v.costOMR)} is now in the programme estimate and pushed to SAP (simulated)`, 'good');
  }

  async function approveAll() {
    setBusy('all');
    for (const v of pendingNow) await decideVariation(v.id, 'Approved');
    reload();
    setBusy(null);
    showToast(`${pendingNow.length} variations approved (${formatMoney(pendingNow.reduce((a, v) => a + v.costOMR, 0))}).${frozen ? ' The certificate was re-issued for each.' : ''}`, 'good');
  }

  async function create(vals: Record<string, string>) {
    const v = await createVariation({
      title: vals.title,
      ref: vals.ref,
      type: vals.type as Variation['type'],
      source: vals.source as Variation['source'],
      originator: vals.originator,
      costOMR: Number(vals.costOMR),
      manhours: Number(vals.manhours),
      cpDays: Number(vals.cpDays) || 0,
      reason: vals.reason,
    });
    setOpen(false);
    showToast(`${v.id} raised ${frozen ? 'after the freeze' : 'before the freeze'}: routed to ${v.approver} for approval`, 'accent');
  }

  async function simulate() {
    setBusy('sim');
    try {
      const r = await simulatePostFreezeRequest();
      reload();
      showToast(`${r.variation.id} raised after the freeze: ${r.variation.title}. ${formatMoney(r.variation.costOMR)}, ${formatHours(r.variation.manhours)}${r.variation.cpDays ? `, critical path +${r.variation.cpDays} d` : ''}. Routed to ${r.variation.approver}.`, 'warn');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not raise the request', 'crit');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-5">
        <StatTile label="Net approved change" value={formatMoney(s.approvedNet)} tone="warn" delta={`${s.approvedCount} variations`} />
        <StatTile label="Before freeze (approved)" value={formatMoney(s.approvedPre)} delta={frozen ? `up to ${shortDate(FREEZE_DATE)}` : `${s.pendingPreCount} still pending`} />
        <StatTile label="After freeze (approved)" value={frozen ? formatMoney(s.approvedPost) : 'n/a'} tone="warn" delta={frozen ? 'needs formal approval' : 'scope not frozen yet'} />
        <StatTile label="Pending approval" value={formatMoney(s.pendingValue)} tone="crit" delta={`${s.pendingCount} variations`} />
        <StatTile label="Scope growth vs base" value={`${s.totalGrowthPct >= 0 ? '+' : ''}${s.totalGrowthPct.toFixed(1)}%`} delta={`base OMR ${(s.base / 1e6).toFixed(2)}M`} />
      </div>

      <GrowthPanel s={s} scope={scope} />

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Approved change by source (OMR thousand)" />
          <BarChart
            height={220}
            stacked
            labels={['SCF', 'Discovery job', 'Originator', 'MOC']}
            series={[
              { name: 'Before freeze', color: 'var(--s1)', data: bySource.map((l) => Math.round(l.filter((v) => v.phase === 'Pre-freeze').reduce((a, v) => a + v.costOMR, 0) / 1000)) },
              { name: 'After freeze', color: 'var(--s2)', data: bySource.map((l) => Math.round(l.filter((v) => v.phase === 'Post-freeze').reduce((a, v) => a + v.costOMR, 0) / 1000)) },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Estimate walk" />
          {[
            { l: 'Base estimate', v: s.base, tone: 'neutral' as const },
            { l: 'Variations before the freeze', v: s.approvedPre, tone: 'accent' as const },
            { l: frozen ? `Frozen estimate (${shortDate(scope.baseline?.frozenAt.slice(0, 10) ?? FREEZE_DATE)})` : 'Estimate to freeze (approved so far)', v: s.frozen, tone: 'neutral' as const },
            { l: 'Variations after the freeze', v: s.approvedPost, tone: 'warn' as const },
            { l: 'Current approved budget', v: s.current, tone: 'neutral' as const },
          ].map((r, i) => (
            <div key={r.l} className="list-row" style={{ fontWeight: i % 2 === 0 ? 700 : 400 }}>
              <span>{r.l}</span>
              <Chip tone={r.tone}>{i % 2 === 0 ? `OMR ${r.v.toLocaleString()}` : formatMoney(r.v)}</Chip>
            </div>
          ))}
          <p className="small muted" style={{ margin: '10px 0 0' }}>The same walk appears in Budget Control: every approved variation is already inside the current budget.</p>
        </Card>
      </div>

      <Card>
        <div className="toolbar">
          <FilterChips options={[{ value: 'Pre-freeze' }, { value: 'Post-freeze' }]} value={phase} onChange={setPhase} allLabel="Before and after" />
          <FilterChips options={[{ value: 'Approved' }, { value: 'Pending' }, { value: 'Rejected' }]} value={status} onChange={setStatus} allLabel="Any status" />
          <span style={{ marginLeft: 'auto' }} className="row-wrap">
            {pendingNow.length > 1 && <ActionButton small={false} busy={busy === 'all'} onClick={approveAll} data-testid="approve-all-var">Approve all pending ({pendingNow.length})</ActionButton>}
            {frozen && <ActionButton variant="primary" small={false} busy={busy === 'sim'} onClick={simulate} data-testid="sim-var">Simulate post-freeze request</ActionButton>}
            <ActionButton small={false} onClick={() => setOpen(true)}>Raise variation</ActionButton>
          </span>
        </div>
        <DataTable
          dense
          pageSize={10}
          rowKey={(v: Variation) => v.id}
          rows={shown}
          onRowClick={(v) => setSel(v.id)}
          activeKey={sel ?? undefined}
          initialSort={{ key: 'raisedAt', dir: 'desc' }}
          columns={[
            { key: 'id', header: 'ID', mono: true },
            { key: 'title', header: 'Variation', render: (v) => <div style={{ maxWidth: 330 }}>{v.title}<div className="small muted">{v.ref} · {v.originator}</div></div> },
            { key: 'type', header: 'Type', render: (v) => <Chip tone={v.type === 'Deletion' ? 'good' : v.type === 'Change' ? 'accent' : 'neutral'}>{v.type}</Chip> },
            { key: 'source', header: 'Source', render: (v) => <span className="small">{v.source}</span> },
            { key: 'phase', header: 'Timing', render: (v) => <Chip tone={v.phase === 'Pre-freeze' ? 'neutral' : 'warn'}>{v.phase}</Chip> },
            { key: 'costOMR', header: 'Cost', mono: true, align: 'right', render: (v) => <span style={{ color: v.costOMR < 0 ? 'var(--good)' : undefined }}>{formatMoney(v.costOMR)}</span>, sortValue: (v) => v.costOMR },
            { key: 'manhours', header: 'Man-hours', mono: true, align: 'right', render: (v) => `${v.manhours > 0 ? '+' : ''}${v.manhours.toLocaleString()}` },
            { key: 'cpDays', header: 'Critical path', mono: true, align: 'right', render: (v) => (v.cpDays ? <Chip tone="warn">+{v.cpDays} d</Chip> : <span className="muted">none</span>), sortValue: (v) => v.cpDays ?? 0 },
            { key: 'approver', header: 'Approver', render: (v) => <span className="small">{v.approver ?? '—'}</span> },
            { key: 'raisedAt', header: 'Raised', mono: true, render: (v) => shortDate(v.raisedAt) },
            { key: 'status', header: 'Status', render: (v) => <span><StatusChip status={v.status} />{v.revision && <> <Chip tone="accent">Rev {v.revision}</Chip></>}</span> },
            {
              key: 'a',
              header: '',
              nosort: true,
              render: (v) =>
                v.status === 'Pending' ? (
                  <span className="row" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    <ActionButton variant="primary" busy={busy === v.id} onClick={() => decide(v, 'Approved')} data-testid={`approve-${v.id}`}>Approve</ActionButton>
                    <ActionButton variant="danger" busy={busy === v.id} onClick={() => decide(v, 'Rejected')}>Reject</ActionButton>
                  </span>
                ) : null,
            },
          ]}
        />
      </Card>

      <FormDialog open={open} onClose={() => setOpen(false)} title={frozen ? 'Raise a post-freeze variation' : 'Raise a pre-freeze scope movement'} fields={FIELDS} submitLabel="Raise variation" onSubmit={create} />

      <Drawer open={Boolean(detail)} onClose={() => setSel(null)} title={detail ? `${detail.id} · ${detail.type}` : ''} subtitle={detail ? `${detail.phase} · ${detail.source}` : ''}>
        {detail && (
          <div className="stack">
            <p style={{ margin: 0, fontWeight: 600 }}>{detail.title}</p>
            <div className="row-wrap">
              <StatusChip status={detail.status} />
              <Chip tone={detail.phase === 'Pre-freeze' ? 'neutral' : 'warn'}>{detail.phase}</Chip>
              {detail.revision && <Chip tone="accent">Certificate Rev {detail.revision}</Chip>}
            </div>
            <dl className="kv">
              <dt>Why</dt><dd>{detail.reason ?? '—'}</dd>
              <dt>Raised by</dt><dd>{detail.originator} on {longDate(detail.raisedAt)}</dd>
              <dt>Cost</dt><dd className="mono">{formatMoney(detail.costOMR)}</dd>
              <dt>Man-hours</dt><dd className="mono">{formatHours(detail.manhours)}</dd>
              <dt>Critical path</dt><dd>{detail.cpDays ? `+${detail.cpDays} day${detail.cpDays === 1 ? '' : 's'}` : 'no impact'}{detail.cpNote ? ` · ${detail.cpNote}` : ''}</dd>
              <dt>Approver</dt><dd>{detail.approver ?? '—'}</dd>
              {detail.jobId && <><dt>Scope item</dt><dd className="mono">{detail.jobId}{jobsById.get(detail.jobId) ? ` · ${jobsById.get(detail.jobId)!.desc}` : ''}</dd></>}
              <dt>Decision</dt><dd>{detail.status === 'Pending' ? 'Awaiting decision' : `${detail.status} by ${detail.decidedBy ?? '—'}${detail.decidedAt ? ` at ${longStamp(detail.decidedAt)}` : ''}`}</dd>
            </dl>
            {detail.status === 'Pending' && (
              <div className="row">
                <ActionButton variant="primary" small={false} busy={busy === detail.id} onClick={() => decide(detail, 'Approved')}>Approve</ActionButton>
                <ActionButton variant="danger" small={false} busy={busy === detail.id} onClick={() => decide(detail, 'Rejected')}>Reject</ActionButton>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
