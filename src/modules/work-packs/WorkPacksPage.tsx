import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { StatusChip } from '../../components/ui/StatusChip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { FilterChips } from '../../components/ui/FilterChips';
import { DataTable } from '../../components/ui/DataTable';
import { Drawer } from '../../components/ui/Drawer';
import { ActionButton } from '../../components/ui/ActionButton';
import { LoadingState } from '../../components/ui/EmptyState';
import { KanbanBoard, type KanbanColumn } from '../../components/workflow/KanbanBoard';
import { IdChips } from '../_shared/IdChips';
import { advancePack, listWorkPacks, nextPackLabel, toggleReady } from '../../services/workPackService';
import { PACK_STAGES, READINESS_ITEMS, type WorkPack } from '../../mocks/workPackMock';
import { areaLabel } from '../../mocks/master';
import { useCanEdit } from '../../app/AccessContext';
import { useToast } from '../../app/ToastContext';

const readyCount = (p: WorkPack) => Object.values(p.ready).filter(Boolean).length;

export default function WorkPacksPage() {
  const { showToast } = useToast();
  const canEdit = useCanEdit();
  const [packs, setPacks] = useState<WorkPack[] | null>(null);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [disc, setDisc] = useState('all');
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => listWorkPacks().then(setPacks), []);
  useEffect(() => {
    load();
  }, [load]);

  const all = useMemo(() => packs ?? [], [packs]);
  const shown = all.filter((p) => disc === 'all' || p.discipline === disc);
  const current = all.find((p) => p.id === sel) ?? null;

  async function advance(p: WorkPack) {
    setBusy(p.id);
    const u = await advancePack(p.id);
    await load();
    setBusy(null);
    showToast(`${p.id} is now ${u.stage}${u.stage === 'Released' ? '. Order status pushed to SAP (simulated)' : ''}`, 'good');
  }
  async function flip(p: WorkPack, key: (typeof READINESS_ITEMS)[number]['key']) {
    await toggleReady(p.id, key);
    await load();
  }

  if (!packs) return <div><PageHeader title="Work Packs" subtitle="" checklist="P4" /><LoadingState /></div>;

  const columns: KanbanColumn<WorkPack>[] = PACK_STAGES.map((s) => ({ key: s, title: s, items: shown.filter((p) => p.stage === s) }));

  return (
    <div>
      <PageHeader
        title="Work Packs"
        subtitle="One work pack per scope item, with a five-point readiness checklist, its SAP work order and P6 activity ID. A pack can only be released when everything is ready. Releasing pushes the order status to SAP."
        checklist="P4"
        action={
          <div className="tabs" style={{ margin: 0, border: 'none' }}>
            <button className={`tab ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')}>Board</button>
            <button className={`tab ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>List</button>
          </div>
        }
      />
      <div className="grid grid-5" style={{ marginBottom: 16 }}>
        <StatTile label="Work packs" value={String(all.length)} />
        <StatTile label="Preparing" value={String(all.filter((p) => p.stage === 'Preparing').length)} tone="warn" />
        <StatTile label="Ready / released" value={String(all.filter((p) => p.stage === 'Ready for release' || p.stage === 'Released').length)} tone="accent" />
        <StatTile label="In progress" value={String(all.filter((p) => p.stage === 'In progress').length)} tone="good" />
        <StatTile label="Complete" value={String(all.filter((p) => p.stage === 'Complete').length)} tone="good" />
      </div>

      <div className="toolbar">
        <FilterChips options={['Inspection', 'Rotating Equipment', 'Process', 'Instrumentation', 'Civil', 'Electrical'].map((d) => ({ value: d, count: all.filter((p) => p.discipline === d).length }))} value={disc} onChange={setDisc} allLabel="All disciplines" />
      </div>

      {view === 'board' ? (
        <KanbanBoard
          columns={columns}
          renderCard={(p) => (
            <div className="kanban-card" style={{ cursor: 'pointer' }} onClick={() => setSel(p.id)}>
              <div className="kc-title">{p.title}</div>
              <IdChips p6Id={p.p6Id} sapWo={p.sapWo} />
              <div style={{ margin: '8px 0 4px' }}><ProgressBar value={readyCount(p)} max={5} showLabel={false} /></div>
              <div className="kc-meta"><span>{readyCount(p)}/5 ready</span><span>{p.contractor}</span></div>
              {nextPackLabel(p) && (
                <ActionButton style={{ marginTop: 8 }} busy={busy === p.id} onClick={(e) => { e.stopPropagation(); void advance(p); }}>{nextPackLabel(p)}</ActionButton>
              )}
            </div>
          )}
        />
      ) : (
        <Card>
          <DataTable
            dense
            pageSize={14}
            rowKey={(p: WorkPack) => p.id}
            rows={shown}
            onRowClick={(p) => setSel(p.id)}
            columns={[
              { key: 'id', header: 'Pack', render: (p) => <div><strong className="mono">{p.id}</strong><IdChips p6Id={p.p6Id} sapWo={p.sapWo} /></div> },
              { key: 'title', header: 'Work', render: (p) => <div style={{ maxWidth: 280 }}>{p.title}<div className="small muted">{areaLabel(p.area)} · {p.contractor}</div></div> },
              { key: 'ready', header: 'Readiness', render: (p) => <ProgressBar value={readyCount(p)} max={5} />, sortValue: (p) => readyCount(p) },
              { key: 'startDay', header: 'Window', mono: true, render: (p) => `D${p.startDay}-D${p.endDay}` },
              { key: 'manhours', header: 'Man-hours', mono: true, align: 'right', render: (p) => p.manhours.toLocaleString() },
              { key: 'stage', header: 'Stage', render: (p) => <StatusChip status={p.stage} /> },
            ]}
          />
        </Card>
      )}

      <Drawer
        open={Boolean(current)}
        onClose={() => setSel(null)}
        title={current ? `${current.id} · ${current.stage}` : ''}
        subtitle={current ? `${current.discipline} · ${areaLabel(current.area)} · ${current.contractor}` : ''}
        footer={current && nextPackLabel(current) ? <ActionButton variant="primary" small={false} busy={busy === current.id} onClick={() => advance(current)}>{nextPackLabel(current)}</ActionButton> : undefined}
      >
        {current && (
          <div className="stack">
            <p style={{ margin: 0, fontWeight: 600 }}>{current.title}</p>
            <IdChips p6Id={current.p6Id} sapWo={current.sapWo} />
            <div className="eyebrow">Readiness checklist</div>
            {READINESS_ITEMS.map((it) => (
              <label key={it.key} className="list-row" style={{ cursor: canEdit && it.key !== 'scope' ? 'pointer' : 'default' }}>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="checkbox" checked={current.ready[it.key]} disabled={!canEdit || it.key === 'scope' || current.stage === 'In progress' || current.stage === 'Complete'} onChange={() => flip(current, it.key)} />
                  {it.label}
                </span>
                <Chip tone={current.ready[it.key] ? 'good' : 'warn'}>{current.ready[it.key] ? 'ready' : 'open'}</Chip>
              </label>
            ))}
            <div className="eyebrow" style={{ marginTop: 6 }}>Materials (SAP MM)</div>
            {current.materials.length === 0 && <p className="small muted" style={{ margin: 0 }}>No special materials: consumables from stock.</p>}
            {current.materials.map((m) => (
              <div key={m.id} className="list-row"><span style={{ fontSize: 12.5 }}>{m.id} {m.description}</span><StatusChip status={m.status.replace('-', ' ')} /></div>
            ))}
            <dl className="kv">
              <dt>Window</dt><dd className="mono">Day {current.startDay} to {current.endDay}</dd>
              <dt>Man-hours</dt><dd className="mono">{current.manhours.toLocaleString()}</dd>
              <dt>P6 activities</dt><dd>{current.activities || 1}</dd>
            </dl>
          </div>
        )}
      </Drawer>
    </div>
  );
}
