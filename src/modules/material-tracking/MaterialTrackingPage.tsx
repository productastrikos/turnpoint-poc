import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { StatusChip } from '../../components/ui/StatusChip';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { ActionButton } from '../../components/ui/ActionButton';
import { LoadingState } from '../../components/ui/EmptyState';
import { FunnelChart } from '../../components/charts/FunnelChart';
import { TABS } from '../../app/tabRegistry';
import { expedite, getTracked, markReceived, vendorStats, type TrackedLine } from '../../services/procurementService';
import { areaLabel } from '../../mocks/master';
import { shortDate } from '../../mocks/_gen';
import { useToast } from '../../app/ToastContext';

export default function MaterialTrackingPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useTabParam(TABS['material-tracking'], 'tracking');
  const [rows, setRows] = useState<TrackedLine[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => getTracked().then(setRows), []);
  useEffect(() => {
    load();
  }, [load]);

  async function doExpedite(r: TrackedLine) {
    setBusy(r.id);
    await expedite(r.id);
    await load();
    setBusy(null);
    showToast(`${r.id}: ${r.line.vendor} asked to expedite. ETA brought forward 2 days (simulated vendor response).`, 'good');
  }
  async function receive(r: TrackedLine) {
    setBusy(r.id);
    await markReceived(r.id);
    await load();
    setBusy(null);
    showToast(`${r.id} received at the Sohar laydown area. Goods receipt posted to SAP MM (simulated).`, 'good');
  }

  if (!rows) return <div><PageHeader title="Material & Procurement Tracking" subtitle="" checklist="P7 · P8" /><LoadingState /></div>;

  const inTransit = rows.filter((r) => ['In production', 'Shipped', 'At port'].includes(r.ship));
  const late = rows.filter((r) => r.late);
  const stage = (n: TrackedLine['ship'][]) => rows.filter((r) => n.includes(r.ship)).length;
  const funnel = [
    { label: 'PR raised', value: rows.filter((r) => r.ship !== 'Not requested').length },
    { label: 'PO issued', value: rows.filter((r) => ['In production', 'Shipped', 'At port', 'Received'].includes(r.ship)).length },
    { label: 'Shipped', value: stage(['Shipped', 'At port', 'Received']) },
    { label: 'Received', value: stage(['Received']) },
  ];
  const shown = rows.filter((r) => filter === 'all' || (filter === 'late' ? r.late : filter === 'transit' ? ['In production', 'Shipped', 'At port'].includes(r.ship) : r.ship === filter));

  return (
    <div>
      <PageHeader title="Material & Procurement Tracking" subtitle="Where every material line is, whether it will arrive before it is needed, and who to chase. Expedite from here and the vendor is asked through SAP (simulated)." checklist="P7 · P8" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'tracking', label: 'Material tracking & expediting' }, { id: 'procurement', label: 'Procurement tracking', badge: late.length || undefined }]} />

      <div className="grid grid-5" style={{ marginBottom: 16 }}>
        <StatTile label="Lines tracked" value={String(rows.length)} />
        <StatTile label="Received" value={String(stage(['Received']))} tone="good" />
        <StatTile label="In transit / production" value={String(inTransit.length)} tone="accent" />
        <StatTile label="Arriving after need date" value={String(late.length)} tone="crit" delta="expedite candidates" />
        <StatTile label="No PO yet" value={String(rows.filter((r) => r.ship === 'Not requested' || r.ship === 'PR raised').length)} tone="warn" />
      </div>

      {tab === 'tracking' && (
        <Card>
          <div className="toolbar">
            <FilterChips options={[{ value: 'late', label: 'Late vs need date', count: late.length }, { value: 'transit', label: 'In transit' }, { value: 'Received' }, { value: 'Not requested', label: 'Not requested' }]} value={filter} onChange={setFilter} allLabel="All lines" />
          </div>
          <DataTable
            dense
            pageSize={13}
            rowKey={(r: TrackedLine) => r.id}
            rows={shown}
            initialSort={{ key: 'margin', dir: 'asc' }}
            columns={[
              { key: 'id', header: 'Line', render: (r) => <div><strong className="mono">{r.id}</strong><div className="small muted">{r.item.jobId} · {areaLabel(r.item.area)}</div></div>, sortValue: (r) => r.id },
              { key: 'desc', header: 'Material', render: (r) => <div style={{ maxWidth: 260 }}>{r.item.description}<div className="small muted">{r.line.vendor}{r.line.po ? ` · PO ${r.line.po}` : ''}</div></div>, sortValue: (r) => r.item.description },
              { key: 'ship', header: 'Status', render: (r) => <StatusChip status={r.ship} tone={r.ship === 'Received' ? 'good' : r.ship === 'Not requested' ? 'crit' : r.ship === 'PR raised' ? 'warn' : 'accent'} /> },
              { key: 'need', header: 'Need date', mono: true, render: (r) => shortDate(r.item.requiredBy), sortValue: (r) => r.item.requiredBy },
              { key: 'eta', header: 'ETA', mono: true, render: (r) => (r.ship === 'Received' ? <span className="muted">received {shortDate(r.line.receivedOn ?? '2026-08-12')}</span> : r.line.eta ? shortDate(r.line.eta) : '—'), sortValue: (r) => r.line.eta ?? 'z' },
              { key: 'margin', header: 'Margin', render: (r) => (r.marginDays === null ? <span className="muted">—</span> : <Chip tone={r.marginDays < 0 ? 'crit' : r.marginDays <= 1 ? 'warn' : 'good'}>{r.marginDays < 0 ? `${-r.marginDays} d late` : `${r.marginDays} d spare`}</Chip>), sortValue: (r) => r.marginDays ?? 99 },
              { key: 'exp', header: '', nosort: true, render: (r) => (r.line.expedited ? <Chip tone="accent">expedited</Chip> : null) },
              {
                key: 'a',
                header: '',
                nosort: true,
                render: (r) =>
                  r.ship === 'Received' || r.ship === 'Not requested' || r.ship === 'PR raised' ? null : (
                    <span className="row" style={{ gap: 4 }}>
                      {!r.line.expedited && <ActionButton variant={r.late ? 'danger' : 'default'} busy={busy === r.id} onClick={() => doExpedite(r)}>Expedite</ActionButton>}
                      {(r.ship === 'Shipped' || r.ship === 'At port') && <ActionButton busy={busy === r.id} onClick={() => receive(r)}>Receive</ActionButton>}
                    </span>
                  ),
              },
            ]}
          />
        </Card>
      )}

      {tab === 'procurement' && (
        <div className="grid grid-2-3" style={{ alignItems: 'start' }}>
          <Card>
            <CardHeader title="PR to PO to shipped to received" />
            <FunnelChart stages={funnel} />
          </Card>
          <Card>
            <CardHeader title="Vendor delays" />
            <DataTable
              dense
              rowKey={(v) => v.vendor}
              rows={vendorStats(rows)}
              columns={[
                { key: 'vendor', header: 'Vendor', render: (v) => <strong>{v.vendor}</strong> },
                { key: 'lines', header: 'Lines', mono: true, align: 'right' },
                { key: 'open', header: 'Open POs', mono: true, align: 'right' },
                { key: 'late', header: 'Late', mono: true, align: 'right', render: (v) => (v.late ? <Chip tone="crit">{v.late} · up to {v.worst} d</Chip> : <span className="muted">0</span>), sortValue: (v) => v.late },
                { key: 'value', header: 'Value', mono: true, align: 'right', render: (v) => `OMR ${(v.value / 1000).toFixed(0)}K` },
                { key: 'expedited', header: 'Expedited', mono: true, align: 'right' },
              ]}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
