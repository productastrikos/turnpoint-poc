import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Chip } from '../../components/ui/Chip';
import { KanbanBoard, type KanbanColumn } from '../../components/workflow/KanbanBoard';
import { getChangeRequests, transitionChange } from '../../services/changeService';
import type { ChangeRequest, ChangeState } from '../../types';
import { useToast } from '../../app/ToastContext';

const COLUMNS: { key: ChangeState; title: string }[] = [
  { key: 'draft', title: 'Draft' },
  { key: 'under-review', title: 'Under Review' },
  { key: 'approved', title: 'Approved' },
  { key: 'rejected', title: 'Rejected' },
  { key: 'frozen', title: 'Frozen' },
];

const NEXT: Partial<Record<ChangeState, ChangeState[]>> = {
  draft: ['under-review'],
  'under-review': ['approved', 'rejected', 'frozen'],
};

const impactTone = { low: 'good', medium: 'warn', high: 'crit' } as const;

export default function ChangeMocPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [selected, setSelected] = useState<ChangeRequest | null>(null);

  useEffect(() => {
    getChangeRequests().then(setItems);
  }, []);

  const columns: KanbanColumn<ChangeRequest>[] = COLUMNS.map((c) => ({
    key: c.key,
    title: c.title,
    items: items.filter((i) => i.state === c.key),
  }));

  async function move(id: string, state: ChangeState) {
    const updated = await transitionChange(id, state, 'You (Demo User)');
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    setSelected((s) => (s?.id === id ? updated : s));
    showToast(`${id} moved to ${state.replace('-', ' ')}`, state === 'approved' ? 'good' : state === 'rejected' ? 'crit' : 'accent');
  }

  return (
    <div>
      <PageHeader
        title="Change / MOC Workflow"
        subtitle="Management of Change requests move through Draft → Under Review → Approved / Rejected / Frozen, with a full audit trail on every transition."
      />

      <KanbanBoard
        columns={columns}
        renderCard={(c) => (
          <div className="kanban-card" onClick={() => setSelected(c)} style={{ cursor: 'pointer' }}>
            <div className="kc-title">{c.title}</div>
            <Chip tone={impactTone[c.impact]}>{c.impact} impact</Chip>
            <div className="kc-meta">
              <span className="mono">{c.id}</span>
              <span>{c.discipline}</span>
            </div>
          </div>
        )}
      />

      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(18,26,32,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 }}
          onClick={() => setSelected(null)}
        >
          <div className="card" style={{ width: 420, height: '100%', borderRadius: 0, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="card-pad">
              <div className="card-header">
                <h3>{selected.id}</h3>
                <button className="btn btn-sm" onClick={() => setSelected(null)}>Close</button>
              </div>
              <h4 style={{ marginBottom: 6 }}>{selected.title}</h4>
              <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>{selected.description}</p>
              <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
                <Chip tone="accent">{selected.discipline}</Chip>
                <Chip tone={impactTone[selected.impact]}>{selected.impact} impact</Chip>
                <Chip tone="neutral">Requested by {selected.requestedBy}</Chip>
              </div>

              <div className="eyebrow" style={{ margin: '16px 0 8px' }}>Actions</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(NEXT[selected.state] ?? []).map((s) => (
                  <button key={s} className="btn btn-sm btn-primary" onClick={() => move(selected.id, s)}>
                    Move to {s.replace('-', ' ')}
                  </button>
                ))}
                {!(NEXT[selected.state] ?? []).length && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>No further transitions from this state.</span>}
              </div>

              <div className="eyebrow" style={{ margin: '20px 0 8px' }}>Audit Trail</div>
              {selected.auditTrail.map((t, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ textTransform: 'capitalize' }}>{t.state.replace('-', ' ')}</strong>
                    <span className="mono" style={{ color: 'var(--ink-3)' }}>{new Date(t.at).toLocaleString()}</span>
                  </div>
                  <div style={{ color: 'var(--ink-2)' }}>{t.by}{t.note ? ` — ${t.note}` : ''}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
