import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { KanbanBoard, type KanbanColumn } from '../../components/workflow/KanbanBoard';
import { getEquipment, advanceEquipment } from '../../services/equipmentService';
import type { Equipment, EquipmentStatus } from '../../types';
import { useToast } from '../../app/ToastContext';

const COLUMNS: { key: EquipmentStatus; title: string }[] = [
  { key: 'removed', title: 'Removed' },
  { key: 'in-repair', title: 'In Repair' },
  { key: 'ready', title: 'Ready' },
  { key: 'installed', title: 'Installed' },
];

const NEXT_LABEL: Record<EquipmentStatus, string | null> = {
  removed: 'Send to Repair',
  'in-repair': 'Mark Ready',
  ready: 'Install',
  installed: null,
};

export default function EquipmentTrackingPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Equipment[]>([]);
  const [selected, setSelected] = useState<Equipment | null>(null);

  useEffect(() => {
    getEquipment().then(setItems);
  }, []);

  const columns: KanbanColumn<Equipment>[] = COLUMNS.map((c) => ({
    key: c.key,
    title: c.title,
    items: items.filter((i) => i.status === c.key),
  }));

  async function advance(id: string) {
    const updated = await advanceEquipment(id, 'You (Demo User)');
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    setSelected((s) => (s?.id === id ? updated : s));
    showToast(`${updated.tagNo} now ${updated.status.replace('-', ' ')}`, updated.status === 'installed' ? 'good' : 'accent');
  }

  return (
    <div>
      <PageHeader
        title="Equipment / Valve Tracking"
        subtitle="Valves, tube bundles, exchangers, rotors and other removed equipment: Removed → In Repair → Ready → Installed, with a full custody and handover audit trail per item. Click a card for its history."
        checklist="X33"
      />

      <KanbanBoard
        columns={columns}
        renderCard={(e) => (
          <div className="kanban-card" style={{ cursor: 'pointer' }} onClick={() => setSelected(e)}>
            <div className="kc-title">{e.tagNo} — {e.description}</div>
            <div className="kc-meta">
              <span className="mono">{e.id}</span>
              <span>{e.area}</span>
            </div>
            {NEXT_LABEL[e.status] && (
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={(ev) => { ev.stopPropagation(); advance(e.id); }}>
                {NEXT_LABEL[e.status]}
              </button>
            )}
          </div>
        )}
      />

      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(18,26,32,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 }}
          onClick={() => setSelected(null)}
        >
          <div className="card" style={{ width: 400, height: '100%', borderRadius: 0, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="card-pad">
              <div className="card-header">
                <h3>{selected.tagNo}</h3>
                <button className="btn btn-sm" onClick={() => setSelected(null)}>Close</button>
              </div>
              <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>{selected.description}</p>
              <div style={{ fontSize: 13, marginBottom: 16 }}>
                <div><strong>Area:</strong> {selected.area}</div>
                <div><strong>Custodian:</strong> {selected.custodian}</div>
              </div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Handover History</div>
              {selected.history.map((h, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12.5, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ textTransform: 'capitalize' }}>{h.status.replace('-', ' ')} — {h.by}</span>
                  <span className="mono" style={{ color: 'var(--ink-3)' }}>{h.at}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
