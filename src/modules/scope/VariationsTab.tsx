import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { StatusChip } from '../../components/ui/StatusChip';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { ActionButton } from '../../components/ui/ActionButton';
import { FormDialog, type FieldDef } from '../../components/ui/FormDialog';
import { BarChart } from '../../components/charts/BarChart';
import { createVariation, decideVariation, listVariations, summarise } from '../../services/scopeService';
import { FREEZE_DATE, type Variation } from '../../mocks/scopeMock';
import { useToast } from '../../app/ToastContext';
import { shortDate } from '../../mocks/_gen';

const FIELDS: FieldDef[] = [
  { name: 'title', label: 'Variation', required: true },
  { name: 'ref', label: 'Reference (SCF / DJ / job)', required: true, placeholder: 'e.g. DJ-021' },
  { name: 'type', label: 'Type', type: 'select', options: ['Addition', 'Deletion', 'Change'], required: true },
  { name: 'source', label: 'Source', type: 'select', options: ['SCF', 'Discovery job', 'Originator', 'MOC'], required: true },
  { name: 'originator', label: 'Originator', required: true },
  { name: 'costOMR', label: 'Cost change (OMR, negative for deletion)', type: 'number', required: true },
  { name: 'manhours', label: 'Man-hour change', type: 'number', required: true },
];

const money = (n: number) => `${n >= 0 ? '+' : '-'}OMR ${Math.abs(n).toLocaleString()}`;

export function VariationsTab() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Variation[]>([]);
  const [phase, setPhase] = useState('all');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => listVariations().then(setRows), []);
  useEffect(() => {
    load();
  }, [load]);

  const s = summarise(rows);
  const shown = rows.filter((v) => (phase === 'all' || v.phase === phase) && (status === 'all' || v.status === status));
  const bySource = (['SCF', 'Discovery job', 'Originator', 'MOC'] as const).map((src) => rows.filter((v) => v.status === 'Approved' && v.source === src));

  async function decide(v: Variation, d: 'Approved' | 'Rejected') {
    setBusy(v.id);
    await decideVariation(v.id, d);
    await load();
    setBusy(null);
    showToast(d === 'Approved' ? `${v.id} approved: ${money(v.costOMR)} is now in the current budget and pushed to SAP` : `${v.id} rejected`, d === 'Approved' ? 'good' : 'crit');
  }

  async function create(vals: Record<string, string>) {
    const v = await createVariation({ title: vals.title, ref: vals.ref, type: vals.type as Variation['type'], source: vals.source as Variation['source'], originator: vals.originator, costOMR: Number(vals.costOMR), manhours: Number(vals.manhours) });
    await load();
    setOpen(false);
    showToast(`${v.id} raised after the freeze: pending approval`, 'accent');
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-5">
        <StatTile label="Net approved change" value={money(s.approvedNet)} tone="warn" delta={`${s.approvedCount} variations`} />
        <StatTile label="Before freeze" value={money(s.approvedPre)} delta={`up to ${shortDate(FREEZE_DATE)}`} />
        <StatTile label="After freeze" value={money(s.approvedPost)} tone="warn" delta="needs formal approval" />
        <StatTile label="Pending approval" value={money(s.pendingValue)} tone="crit" delta={`${s.pendingCount} variations`} />
        <StatTile label="Scope growth vs base" value={`+${((s.approvedNet / s.base) * 100).toFixed(1)}%`} delta={`base OMR ${(s.base / 1e6).toFixed(2)}M`} />
      </div>

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
            { l: `Frozen estimate (${shortDate(FREEZE_DATE)})`, v: s.frozen, tone: 'neutral' as const },
            { l: 'Variations after the freeze', v: s.approvedPost, tone: 'warn' as const },
            { l: 'Current approved budget', v: s.current, tone: 'neutral' as const },
          ].map((r, i) => (
            <div key={r.l} className="list-row" style={{ fontWeight: i % 2 === 0 ? 700 : 400 }}>
              <span>{r.l}</span>
              <Chip tone={r.tone}>{i % 2 === 0 ? `OMR ${r.v.toLocaleString()}` : money(r.v)}</Chip>
            </div>
          ))}
          <p className="small muted" style={{ margin: '10px 0 0' }}>The same walk appears in Budget Control: every approved variation is already inside the current budget.</p>
        </Card>
      </div>

      <Card>
        <div className="toolbar">
          <FilterChips options={[{ value: 'Pre-freeze' }, { value: 'Post-freeze' }]} value={phase} onChange={setPhase} allLabel="Before and after" />
          <FilterChips options={[{ value: 'Approved' }, { value: 'Pending' }, { value: 'Rejected' }]} value={status} onChange={setStatus} allLabel="Any status" />
          <span style={{ marginLeft: 'auto' }}><ActionButton variant="primary" small={false} onClick={() => setOpen(true)}>Raise variation</ActionButton></span>
        </div>
        <DataTable
          dense
          pageSize={10}
          rowKey={(v: Variation) => v.id}
          rows={shown}
          initialSort={{ key: 'raisedAt', dir: 'desc' }}
          columns={[
            { key: 'id', header: 'ID', mono: true },
            { key: 'title', header: 'Variation', render: (v) => <div>{v.title}<div className="small muted">{v.ref} · {v.originator}</div></div> },
            { key: 'type', header: 'Type', render: (v) => <Chip tone={v.type === 'Deletion' ? 'good' : v.type === 'Change' ? 'accent' : 'neutral'}>{v.type}</Chip> },
            { key: 'source', header: 'Source', render: (v) => <span className="small">{v.source}</span> },
            { key: 'phase', header: 'Timing', render: (v) => <Chip tone={v.phase === 'Pre-freeze' ? 'neutral' : 'warn'}>{v.phase}</Chip> },
            { key: 'costOMR', header: 'Cost', mono: true, align: 'right', render: (v) => <span style={{ color: v.costOMR < 0 ? 'var(--good)' : undefined }}>{money(v.costOMR)}</span>, sortValue: (v) => v.costOMR },
            { key: 'manhours', header: 'Man-hours', mono: true, align: 'right', render: (v) => `${v.manhours > 0 ? '+' : ''}${v.manhours.toLocaleString()}` },
            { key: 'raisedAt', header: 'Raised', mono: true, render: (v) => shortDate(v.raisedAt) },
            { key: 'status', header: 'Status', render: (v) => <StatusChip status={v.status} /> },
            {
              key: 'a',
              header: '',
              nosort: true,
              render: (v) =>
                v.status === 'Pending' ? (
                  <span className="row" style={{ gap: 4 }}>
                    <ActionButton variant="primary" busy={busy === v.id} onClick={() => decide(v, 'Approved')}>Approve</ActionButton>
                    <ActionButton variant="danger" busy={busy === v.id} onClick={() => decide(v, 'Rejected')}>Reject</ActionButton>
                  </span>
                ) : null,
            },
          ]}
        />
      </Card>
      <FormDialog open={open} onClose={() => setOpen(false)} title="Raise a post-freeze variation" fields={FIELDS} submitLabel="Raise variation" onSubmit={create} />
    </div>
  );
}
