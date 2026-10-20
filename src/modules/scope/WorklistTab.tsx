import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { StatusChip } from '../../components/ui/StatusChip';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ActionButton } from '../../components/ui/ActionButton';
import { Drawer } from '../../components/ui/Drawer';
import { CostValue } from '../../components/ui/CostValue';
import { IdChips } from '../_shared/IdChips';
import { CreateScopeDialog } from './CreateScopeDialog';
import { DuplicatePanel } from './DuplicatePanel';
import { BAND_TONE, completeness, rankJobs, riskBand, riskScore } from '../../services/scopeModel';
import { sapNotificationForJob, sapWoForJob, p6IdForJob } from '../../mocks/sapKeys';
import { areaLabel } from '../../mocks/master';
import { useRole } from '../../app/RoleContext';
import type { Job } from '../../types';

const STATUS_LABEL = (j: Job) => (j.status === 'rejected' && j.taClass === 'Non-TA' ? 'diverted' : j.status === 'approved' ? 'approved' : j.status === 'rejected' ? 'rejected' : `at gate ${j.gate}`);

export function WorklistTab({ jobs, reload }: { jobs: Job[]; reload: () => void }) {
  const { role } = useRole();
  const [q, setQ] = useState('');
  const [disc, setDisc] = useState('all');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Job | null>(null);

  const ranks = Object.fromEntries(rankJobs(jobs).map((r) => [r.job.id, r]));
  const visible = jobs.filter((j) => {
    if (q && !`${j.id} ${j.desc} ${j.tag} ${j.sapRef ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (disc !== 'all' && j.discipline !== disc) return false;
    if (status === 'approved' && j.status !== 'approved') return false;
    if (status === 'pending' && j.status !== 'pending') return false;
    if (status === 'rejected' && j.status !== 'rejected') return false;
    return true;
  });
  const live = jobs.filter((j) => j.status !== 'rejected');
  const totalCost = live.reduce((s, j) => s + j.costOMR, 0);
  const complete = Math.round(jobs.reduce((s, j) => s + completeness(j), 0) / Math.max(1, jobs.length));

  const columns: Column<Job>[] = [
    { key: 'id', header: 'Scope item', render: (j) => <div><strong className="mono">{j.id}</strong><div><IdChips p6Id={j.status === 'approved' || j.inBaseline ? p6IdForJob(j) : undefined} sapWo={sapWoForJob(j)} sapNotif={sapNotificationForJob(j)} /></div></div> },
    { key: 'desc', header: 'Description', render: (j) => <div style={{ maxWidth: 300 }}>{j.desc}<div className="small muted">{j.tag} · {areaLabel(j.area)}</div></div> },
    { key: 'discipline', header: 'Discipline', render: (j) => <span className="small">{j.discipline}</span> },
    { key: 'source', header: 'Source', render: (j) => <Chip tone={j.source.startsWith('SAP') ? 'accent' : 'neutral'}>{j.source}</Chip>, sortValue: (j) => j.source },
    { key: 'costOMR', header: 'Estimate', align: 'right', render: (j) => <CostValue amount={j.costOMR} />, sortValue: (j) => j.costOMR },
    { key: 'manhours', header: 'Man-hours', mono: true, align: 'right', render: (j) => j.manhours.toLocaleString() },
    { key: 'risk', header: 'Risk', render: (j) => <Chip tone={BAND_TONE[riskBand(riskScore(j))]}>{riskScore(j)} {riskBand(riskScore(j))}</Chip>, sortValue: (j) => riskScore(j) },
    { key: 'priority', header: 'Priority', render: (j) => <span><Chip tone={ranks[j.id].band === 'P1' ? 'crit' : ranks[j.id].band === 'P2' ? 'warn' : 'neutral'}>{ranks[j.id].band}</Chip> <span className="mono small muted">#{ranks[j.id].rank}</span></span>, sortValue: (j) => ranks[j.id].rank },
    { key: 'status', header: 'Status', render: (j) => <StatusChip status={STATUS_LABEL(j)} tone={j.status === 'approved' ? 'good' : j.status === 'rejected' ? (j.taClass === 'Non-TA' ? 'neutral' : 'crit') : 'warn'} />, sortValue: (j) => STATUS_LABEL(j) },
  ];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-5">
        <StatTile label="Scope items" value={String(jobs.length)} delta={`${jobs.filter((j) => j.status === 'approved').length} approved`} />
        <StatTile label="Budgetary estimate (live)" value={role === 'contractor' ? 'Restricted' : `OMR ${(totalCost / 1e6).toFixed(2)}M`} delta={role === 'contractor' ? 'cost figures are OQ staff only' : 'roll-up of active items'} />
        <StatTile label="Man-hours (live)" value={live.reduce((s, j) => s + j.manhours, 0).toLocaleString()} />
        <StatTile label="Data completeness" value={`${complete}%`} tone={complete === 100 ? 'good' : 'warn'} delta="mandatory fields" />
        <StatTile label="Via SAP" value={String(jobs.filter((j) => j.source.startsWith('SAP')).length)} tone="accent" delta="notifications and orders" />
      </div>

      <DuplicatePanel refreshKey={jobs} onChanged={reload} />

      <Card>
        <div className="toolbar">
          <input type="text" placeholder="Search scope items, tags, SAP numbers" value={q} onChange={(e) => setQ(e.target.value)} />
          <FilterChips options={['Inspection', 'Rotating Equipment', 'Process', 'Instrumentation', 'Civil', 'Electrical'].map((d) => ({ value: d }))} value={disc} onChange={setDisc} allLabel="All disciplines" />
          <FilterChips options={[{ value: 'approved' }, { value: 'pending' }, { value: 'rejected' }]} value={status} onChange={setStatus} allLabel="Any status" />
          <span style={{ marginLeft: 'auto' }}><ActionButton variant="primary" small={false} onClick={() => setOpen(true)}>New scope item</ActionButton></span>
        </div>
        <DataTable columns={columns} rows={visible} rowKey={(j) => j.id} onRowClick={setSel} activeKey={sel?.id} pageSize={12} dense initialSort={{ key: 'priority', dir: 'asc' }} />
      </Card>

      <CreateScopeDialog open={open} onClose={() => setOpen(false)} onCreated={() => reload()} />

      <Drawer open={Boolean(sel)} onClose={() => setSel(null)} title={sel ? `${sel.id} · ${sel.tag}` : ''} subtitle={sel ? `${areaLabel(sel.area)} · ${sel.discipline}` : ''}>
        {sel && (
          <div className="stack">
            <p style={{ margin: 0, fontWeight: 600 }}>{sel.desc}</p>
            <div className="row-wrap">
              <StatusChip status={STATUS_LABEL(sel)} tone={sel.status === 'approved' ? 'good' : sel.status === 'rejected' ? 'crit' : 'warn'} />
              <Chip tone={sel.taClass === 'TA' ? 'accent' : 'neutral'}>{sel.taClass}</Chip>
              <Chip tone={BAND_TONE[riskBand(riskScore(sel))]}>Risk {riskScore(sel)} {riskBand(riskScore(sel))}</Chip>
            </div>
            <IdChips p6Id={sel.status === 'approved' || sel.inBaseline ? p6IdForJob(sel) : undefined} sapWo={sapWoForJob(sel)} sapNotif={sapNotificationForJob(sel)} />
            <dl className="kv">
              <dt>Originator</dt><dd>{sel.requestedBy}</dd>
              <dt>Source</dt><dd>{sel.source}{sel.sapRef ? ` · SAP ${sel.sapRef}` : ''}</dd>
              <dt>Estimate</dt><dd><CostValue amount={sel.costOMR} /></dd>
              <dt>Man-hours</dt><dd className="mono">{sel.manhours.toLocaleString()}</dd>
              <dt>Contractor</dt><dd>{sel.contractor}</dd>
              <dt>Planned window</dt><dd className="mono">Day {sel.startDay} to {sel.startDay + sel.durationDays - 1}</dd>
              <dt>Completeness</dt><dd><ProgressBar value={completeness(sel)} /></dd>
              <dt>Priority</dt><dd>{ranks[sel.id].band} · rank {ranks[sel.id].rank} of {jobs.length} · score {ranks[sel.id].score}</dd>
            </dl>
            <div className="eyebrow">Approval trail</div>
            {sel.approvals.map((a) => (
              <div key={a.gate} className="list-row">
                <span>Gate {a.gate}: {a.role}<div className="small muted">{a.approver}{a.comment ? ` · ${a.comment}` : ''}</div></span>
                <StatusChip status={a.status} />
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}
