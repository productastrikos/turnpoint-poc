import { DataTable, type Column } from '../../components/ui/DataTable';
import { Chip } from '../../components/ui/Chip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { PO_STAGES, NCR_STAGE, type PoRec } from '../../mocks/qaqcMock';
import { acceptanceStatus, breaching, daysInStage, displayStage, nextInspectionDate, openNcrCount, pointCounts, progressPct, slaOf } from '../../services/qaqcService';
import { ACCEPT_TONE, ItpChip, shortDate } from './poHelpers';
import { fmtOMR } from '../../mocks/_gen';

const stageName = (p: PoRec) => (displayStage(p) === 'ncr' ? NCR_STAGE : PO_STAGES.find((s) => s.id === p.stage)!).short;

/** The PO table used by the Workflow tab (compact) and the PO & ITP tab (full). */
export function PoTable({ rows, today, showValue, activeKey, onOpen, compact, focusId }: { rows: PoRec[]; today: string; showValue: boolean; activeKey: string | null; onOpen: (id: string) => void; compact?: boolean; focusId?: string | null }) {
  const poCell: Column<PoRec> = {
    key: 'id',
    header: 'PO',
    render: (p) => (
      <div>
        <strong className="mono">{p.id}</strong>
        {p.demo && <span className="tag-chip" style={{ marginLeft: 6 }}>demo</span>}
        <div className="small muted">{p.materialId} · {shortDate(p.poDate)}</div>
      </div>
    ),
  };
  const vendor: Column<PoRec> = { key: 'vendor', header: 'Vendor', render: (p) => <span className="small">{p.vendor}</span> };
  const item: Column<PoRec> = { key: 'item', header: 'Item', render: (p) => <span className="small">{p.item}</span> };
  const stage: Column<PoRec> = {
    key: 'stage',
    header: 'Stage',
    sortValue: (p) => (displayStage(p) === 'ncr' ? 4.5 : PO_STAGES.findIndex((s) => s.id === p.stage)),
    render: (p) => {
      const d = daysInStage(p, today);
      const sla = slaOf(displayStage(p));
      return (
        <div>
          <Chip tone={displayStage(p) === 'ncr' ? 'crit' : p.stage === 'release' ? 'good' : 'accent'}>{stageName(p)}</Chip>
          {d !== null && sla > 0 && <div className="small" style={{ color: breaching(p, today) ? 'var(--crit)' : 'var(--ink-3)' }}>{d}d of {sla}d SLA{breaching(p, today) ? ' · breach' : ''}</div>}
        </div>
      );
    },
  };
  const itp: Column<PoRec> = { key: 'itp', header: 'ITP', sortValue: (p) => p.itpStatus, render: (p) => <ItpChip p={p} /> };
  const pts: Column<PoRec> = {
    key: 'pts',
    header: 'Inspection points',
    sortValue: (p) => pointCounts(p).all.done / pointCounts(p).all.total,
    render: (p) => {
      const c = pointCounts(p);
      return (
        <div className="small">
          <span className="mono"><b>{c.all.done}</b>/{c.all.total}</span> <span className="muted">· H {c.H.done}/{c.H.total} · W {c.W.done}/{c.W.total}</span>
        </div>
      );
    },
  };
  const next: Column<PoRec> = {
    key: 'next',
    header: 'Next inspection',
    sortValue: (p) => nextInspectionDate(p) ?? '9999',
    render: (p) => {
      const d = nextInspectionDate(p);
      if (!d) return <span className="small muted">{p.points.every((x) => x.done) ? 'all released' : 'not scheduled'}</span>;
      const late = d < today && p.stage === 'fat';
      return <span className="small" style={{ color: late ? 'var(--crit)' : undefined, fontWeight: late ? 700 : undefined }}>{shortDate(d)}{late ? ' · overdue' : ''}</span>;
    },
  };
  const ncr: Column<PoRec> = { key: 'ncr', header: 'NCRs open', mono: true, align: 'right', sortValue: (p) => openNcrCount(p), render: (p) => (openNcrCount(p) ? <Chip tone="crit">{openNcrCount(p)}</Chip> : <span className="muted">0</span>) };
  const acc: Column<PoRec> = { key: 'acc', header: 'Acceptance', sortValue: (p) => acceptanceStatus(p), render: (p) => <Chip tone={ACCEPT_TONE[acceptanceStatus(p)]}>{acceptanceStatus(p)}</Chip> };
  const pct: Column<PoRec> = { key: 'pct', header: '% complete', width: 130, sortValue: (p) => progressPct(p), render: (p) => <ProgressBar value={progressPct(p)} /> };
  const val: Column<PoRec> = { key: 'val', header: 'PO value (OMR)', mono: true, align: 'right', sortValue: (p) => p.valueOMR, render: (p) => fmtOMR(p.valueOMR).replace(/^OMR\s?/, '') };

  const columns: Column<PoRec>[] = compact ? [poCell, vendor, item, stage, itp, next, acc, pct] : [poCell, vendor, item, stage, itp, pts, next, ncr, acc, ...(showValue ? [val] : []), pct];
  return (
    <DataTable
      dense
      rowKey={(p: PoRec) => p.id}
      rows={rows}
      onRowClick={(p) => onOpen(p.id)}
      activeKey={activeKey ?? focusId}
      columns={columns}
      emptyText="No purchase orders at this stage"
    />
  );
}
