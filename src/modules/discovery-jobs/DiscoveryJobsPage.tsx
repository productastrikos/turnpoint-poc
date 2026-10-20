import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Chip } from '../../components/ui/Chip';
import { CostValue } from '../../components/ui/CostValue';
import { KanbanBoard, type KanbanColumn } from '../../components/workflow/KanbanBoard';
import { getDiscoveryJobs, transitionDiscoveryJob } from '../../services/discoveryService';
import type { DiscoveryJob, DiscoveryJobState } from '../../types';
import { useRole } from '../../app/RoleContext';
import { useToast } from '../../app/ToastContext';

const COLUMNS: { key: DiscoveryJobState; title: string }[] = [
  { key: 'identified', title: 'Identified' },
  { key: 'evaluating', title: 'Evaluating' },
  { key: 'approved', title: 'Approved' },
  { key: 'rejected', title: 'Rejected' },
  { key: 'merged', title: 'Merged into Base Scope' },
];

const NEXT: Partial<Record<DiscoveryJobState, DiscoveryJobState[]>> = {
  identified: ['evaluating'],
  evaluating: ['approved', 'rejected'],
  approved: ['merged'],
};

export default function DiscoveryJobsPage() {
  const { role } = useRole();
  const { showToast } = useToast();
  const [items, setItems] = useState<DiscoveryJob[]>([]);

  useEffect(() => {
    getDiscoveryJobs().then(setItems);
  }, []);

  const columns: KanbanColumn<DiscoveryJob>[] = COLUMNS.map((c) => ({
    key: c.key,
    title: c.title,
    items: items.filter((i) => i.state === c.key),
  }));

  async function move(id: string, state: DiscoveryJobState) {
    const updated = await transitionDiscoveryJob(id, state);
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    showToast(`${id} moved to ${state === 'merged' ? 'Merged into Base Scope' : state}`, state === 'rejected' ? 'crit' : 'good');
  }

  const totalExposure = items.filter((i) => i.state !== 'rejected').reduce((s, i) => s + i.estCostOMR, 0);

  return (
    <div>
      <PageHeader
        title="Discovery Job Workflow"
        checklist="X5"
        subtitle="Unplanned findings move Identification → Evaluation → Approval → Merge into base TA scope."
        action={role === 'oq-staff' ? <Chip tone="warn">OMR {totalExposure.toLocaleString()} in flight</Chip> : undefined}
      />

      <KanbanBoard
        columns={columns}
        renderCard={(d) => (
          <div className="kanban-card">
            <div className="kc-title">{d.desc}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <Chip tone="accent">{d.discipline}</Chip>
              <Chip tone="neutral">{d.area}</Chip>
            </div>
            {d.notes && <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 6 }}>{d.notes}</div>}
            <div className="kc-meta">
              <span className="mono">{d.id}</span>
              <CostValue amount={d.estCostOMR} />
            </div>
            {(NEXT[d.state] ?? []).length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {(NEXT[d.state] ?? []).map((s) => (
                  <button key={s} className="btn btn-sm" onClick={() => move(d.id, s)}>
                    {s === 'merged' ? 'Merge' : s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
