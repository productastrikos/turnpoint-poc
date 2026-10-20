import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { StatusChip } from '../../components/ui/StatusChip';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { FilterChips } from '../../components/ui/FilterChips';
import { CostValue } from '../../components/ui/CostValue';
import { GateStepper } from '../../components/workflow/GateStepper';
import { IdChips } from '../_shared/IdChips';
import { approveGate, divertToMaintenance, rejectGate } from '../../services/jobsService';
import { getGateConfig, setGateEnabled, setGateSla, type GateConfig } from '../../services/scopeService';
import { BAND_TONE, riskBand, riskScore } from '../../services/scopeModel';
import { sapNotificationForJob, sapWoForJob } from '../../mocks/sapKeys';
import { useRole } from '../../app/RoleContext';
import { useCanEdit } from '../../app/AccessContext';
import { useToast } from '../../app/ToastContext';
import type { Job } from '../../types';

const GATE_LABEL = { 1: 'Area Ops Focal Point', 2: 'Head of Area Ops', 3: 'VP Asset Ops' } as const;

export function ApprovalsTab({ jobs, reload }: { jobs: Job[]; reload: () => void }) {
  const { role } = useRole();
  const canEdit = useCanEdit();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [cfg, setCfg] = useState<GateConfig[]>([]);
  const loadCfg = useCallback(() => getGateConfig().then(setCfg), []);
  useEffect(() => {
    loadCfg();
  }, [loadCfg]);

  const g4 = cfg.find((g) => g.gate === 4)?.enabled ?? false;
  const pending = jobs.filter((j) => j.status === 'pending');

  async function approve(j: Job) {
    setBusy(j.id);
    const updated = await approveGate(j.id, 'You (Demo User)');
    reload();
    setBusy(null);
    showToast(
      updated.status === 'approved'
        ? `${j.id} fully approved. All three gates cleared; status pushed to SAP (simulated).`
        : `${j.id} cleared gate ${j.gate}, now awaiting ${GATE_LABEL[updated.gate]}`,
      'good'
    );
  }
  async function reject(j: Job) {
    setBusy(j.id);
    await rejectGate(j.id, 'You (Demo User)');
    reload();
    setBusy(null);
    showToast(`${j.id} rejected at gate ${j.gate}`, 'crit');
  }
  async function divert(j: Job) {
    setBusy(j.id);
    await divertToMaintenance(j.id);
    reload();
    setBusy(null);
    showToast(`${j.id} diverted to routine maintenance (not TA-dependent). It leaves the TA worklist.`, 'accent');
  }

  const rows = jobs.filter((j) => filter === 'all' || (filter === 'gate1' ? j.status === 'pending' && j.gate === 1 : filter === 'gate2' ? j.status === 'pending' && j.gate === 2 : filter === 'gate3' ? j.status === 'pending' && j.gate === 3 : j.status === filter));

  const columns: Column<Job>[] = [
    { key: 'id', header: 'ID', render: (j) => <div><strong className="mono">{j.id}</strong><IdChips sapWo={sapWoForJob(j)} sapNotif={sapNotificationForJob(j)} /></div> },
    { key: 'desc', header: 'Description', render: (j) => <div style={{ maxWidth: 260 }}>{j.desc}<div className="small muted">{j.requestedBy} · {j.discipline}</div></div> },
    { key: 'costOMR', header: 'Cost', align: 'right', render: (j) => <span><CostValue amount={j.costOMR} />{g4 && j.costOMR > 250_000 && <div><Chip tone="warn">Needs gate 4 (CPC)</Chip></div>}</span>, sortValue: (j) => j.costOMR },
    { key: 'risk', header: 'Risk', render: (j) => <Chip tone={BAND_TONE[riskBand(riskScore(j))]}>{riskScore(j)}</Chip>, sortValue: (j) => riskScore(j) },
    { key: 'taClass', header: 'TA / Non-TA', render: (j) => <Chip tone={j.taClass === 'TA' ? 'accent' : 'neutral'}>{j.taClass}</Chip> },
    { key: 'gates', header: 'Gate progress', nosort: true, render: (j) => <GateStepper approvals={j.approvals} /> },
    { key: 'current', header: 'Awaiting', render: (j) => <span className="small">{j.status === 'pending' ? GATE_LABEL[j.gate] : '—'}</span> },
    { key: 'status', header: 'Status', render: (j) => <StatusChip status={j.status === 'rejected' && j.taClass === 'Non-TA' ? 'diverted' : j.status} tone={j.status === 'approved' ? 'good' : j.status === 'rejected' ? (j.taClass === 'Non-TA' ? 'neutral' : 'crit') : 'warn'} /> },
    {
      key: 'act',
      header: '',
      nosort: true,
      render: (j) =>
        j.status !== 'pending' ? null : role === 'contractor' ? (
          <span className="small muted" style={{ fontStyle: 'italic' }}>OQ Staff only</span>
        ) : (
          <div className="row-wrap" style={{ gap: 6 }}>
            <ActionButton variant="primary" busy={busy === j.id} onClick={() => approve(j)}>Approve</ActionButton>
            <ActionButton variant="danger" busy={busy === j.id} onClick={() => reject(j)}>Reject</ActionButton>
            {j.gate === 1 && <ActionButton busy={busy === j.id} onClick={() => divert(j)} title="Gate 1 screening: not TA-dependent, divert to routine maintenance">Divert to maintenance</ActionButton>}
          </div>
        ),
    },
  ];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="callout">
        <strong>Three-stage gating before inclusion in the TA worklist.</strong> Gate 1 Area Operations Focal Point: screen TA vs non-TA work and divert routine maintenance. Gate 2 Head of Area Operations: risk assessment, ranking and criticality. Gate 3 VP Asset Operations: budget implications and strategic priorities. Each gate must approve before the next unlocks. A final approval pushes the order status to SAP.
      </div>
      <div className="grid grid-4">
        <StatTile label="At Gate 1" value={String(pending.filter((j) => j.gate === 1).length)} tone="warn" delta="TA vs non-TA screening" />
        <StatTile label="At Gate 2" value={String(pending.filter((j) => j.gate === 2).length)} tone="warn" delta="risk and criticality" />
        <StatTile label="At Gate 3" value={String(pending.filter((j) => j.gate === 3).length)} tone="warn" delta="budget and priorities" />
        <StatTile label="Approved" value={String(jobs.filter((j) => j.status === 'approved').length)} tone="good" delta={`${jobs.filter((j) => j.status === 'rejected').length} rejected or diverted`} />
      </div>
      <Card>
        <div className="toolbar">
          <FilterChips options={[{ value: 'gate1', label: 'Gate 1' }, { value: 'gate2', label: 'Gate 2' }, { value: 'gate3', label: 'Gate 3' }, { value: 'approved' }, { value: 'rejected' }]} value={filter} onChange={setFilter} allLabel="All items" />
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(j) => j.id} pageSize={10} dense />
      </Card>
      <Card>
        <CardHeader title="Gate configuration" action={<Chip tone="accent">configurable</Chip>} />
        <p className="small muted" style={{ margin: '-6px 0 10px' }}>The number of gates, approvers and SLAs are configuration, not code. Enable the optional fourth gate to route items above OMR 250,000 to the Capital Projects Committee.</p>
        <DataTable
          dense
          rowKey={(g: GateConfig) => String(g.gate)}
          rows={cfg}
          columns={[
            { key: 'gate', header: 'Gate', mono: true, render: (g) => `G${g.gate}` },
            { key: 'name', header: 'Approver role', render: (g) => <div><strong>{g.name}</strong><div className="small muted">{g.approver}</div></div> },
            { key: 'criteria', header: 'Criteria', render: (g) => <span className="small">{g.criteria}</span> },
            { key: 'sla', header: 'SLA (hours)', nosort: true, render: (g) => <input type="number" min={1} disabled={!canEdit} value={g.slaHours} style={{ width: 80 }} onChange={async (e) => setCfg(await setGateSla(g.gate, Number(e.target.value) || 1))} aria-label={`SLA for gate ${g.gate}`} /> },
            { key: 'enabled', header: 'Enabled', nosort: true, render: (g) => <input type="checkbox" checked={g.enabled} disabled={!g.optional || !canEdit} onChange={async (e) => { setCfg(await setGateEnabled(g.gate, e.target.checked)); showToast(e.target.checked ? 'Gate 4 enabled: items above OMR 250,000 now route to the Capital Projects Committee' : 'Gate 4 disabled', 'accent'); }} aria-label={`Enable gate ${g.gate}`} /> },
          ]}
        />
      </Card>
    </div>
  );
}
