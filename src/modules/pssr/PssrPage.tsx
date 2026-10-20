import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ActionButton } from '../../components/ui/ActionButton';
import { Drawer } from '../../components/ui/Drawer';
import { LoadingState } from '../../components/ui/EmptyState';
import { Stepper } from '../../components/workflow/Stepper';
import { STAGE_ITEMS, getSystems, systemPct, toggleItem } from '../../services/readinessService';
import { addAlert } from '../../services/alertsService';
import type { ReadySystem } from '../../mocks/readinessMock';
import { useCanEdit } from '../../app/AccessContext';
import { useToast } from '../../app/ToastContext';

const SIGNERS = ['Process', 'Mechanical', 'Instrumentation', 'Electrical', 'HSE', 'Operations'];
const initialSigned = (s: ReadySystem) => {
  const pct = systemPct(s, 'pssr');
  return pct === 100 ? 4 : pct >= 75 ? 2 : pct >= 50 ? 1 : 0;
};

export default function PssrPage() {
  const { showToast } = useToast();
  const canEdit = useCanEdit();
  const [systems, setSystems] = useState<ReadySystem[] | null>(null);
  const [signed, setSigned] = useState<Record<string, number>>({});
  const [unit, setUnit] = useState('all');
  const [sel, setSel] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await getSystems();
    setSystems(s);
    setSigned((prev) => ({ ...Object.fromEntries(s.map((x) => [x.id, initialSigned(x)])), ...prev }));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const all = useMemo(() => systems ?? [], [systems]);
  const units = useMemo(() => Array.from(new Set(all.map((s) => s.unit))), [all]);
  const shown = all.filter((s) => unit === 'all' || s.unit === unit);
  const current = all.find((s) => s.id === sel) ?? null;

  async function signOff(s: ReadySystem) {
    const n = (signed[s.id] ?? 0) + 1;
    setSigned((p) => ({ ...p, [s.id]: n }));
    showToast(`${s.name}: signed off by ${SIGNERS[n - 1]} (${n} of ${SIGNERS.length})`, 'good');
    if (n === SIGNERS.length) {
      await addAlert({ type: 'pssr-approval', message: `PSSR fully signed off: ${s.name}`, severity: 'info', link: '/pssr' });
      showToast(`PSSR complete for ${s.name}. Ready for start-up.`, 'good');
    }
  }
  async function flip(s: ReadySystem, i: number) {
    await toggleItem(s.id, 'pssr', i);
    await load();
  }

  if (!systems) return <div><PageHeader title="PSSR (Pre-Startup Safety Review)" subtitle="" checklist="X9" /><LoadingState /></div>;

  const done = all.filter((s) => (signed[s.id] ?? 0) >= SIGNERS.length).length;
  return (
    <div>
      <PageHeader
        title="PSSR (Pre-Startup Safety Review)"
        subtitle="PSSR items by system, action closure, and a six-discipline sign-off flow. A system can only be signed off once every PSSR item is closed. The same items drive the Walkdown / PSSR / Start-up readiness board."
        checklist="X9"
      />
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatTile label="Systems" value={String(all.length)} />
        <StatTile label="Fully signed off" value={String(done)} tone="good" />
        <StatTile label="Items closed" value={`${all.reduce((s, x) => s + x.items.pssr.filter(Boolean).length, 0)} of ${all.length * STAGE_ITEMS.pssr.length}`} tone="accent" />
        <StatTile label="Open actions" value={String(all.reduce((s, x) => s + x.items.pssr.filter((v) => !v).length, 0))} tone="warn" />
      </div>
      <Card>
        <div className="toolbar"><FilterChips options={units.map((u) => ({ value: u }))} value={unit} onChange={setUnit} allLabel="All units" /></div>
        <DataTable
          dense
          pageSize={12}
          rowKey={(s: ReadySystem) => s.id}
          rows={shown}
          onRowClick={(s) => setSel(s.id)}
          columns={[
            { key: 'name', header: 'System', render: (s) => <div><strong>{s.name}</strong><div className="small muted">{s.unit} · owner {s.owner}</div></div> },
            { key: 'items', header: 'PSSR items', render: (s) => <ProgressBar value={systemPct(s, 'pssr')} />, sortValue: (s) => systemPct(s, 'pssr') },
            { key: 'open', header: 'Open actions', mono: true, align: 'right', render: (s) => s.items.pssr.filter((v) => !v).length, sortValue: (s) => s.items.pssr.filter((v) => !v).length },
            { key: 'sign', header: 'Sign-offs', render: (s) => <span className="row-wrap" style={{ gap: 3 }}>{SIGNERS.map((n, i) => <span key={n} title={n} className="tag-chip" style={{ background: i < (signed[s.id] ?? 0) ? 'var(--good-soft)' : 'var(--surface-2)', color: i < (signed[s.id] ?? 0) ? 'var(--good)' : 'var(--ink-3)' }}>{n.slice(0, 3)}</span>)}</span>, sortValue: (s) => signed[s.id] ?? 0 },
            { key: 'status', header: 'Status', render: (s) => { const n = signed[s.id] ?? 0; return n >= SIGNERS.length ? <Chip tone="good">PSSR complete</Chip> : systemPct(s, 'pssr') < 100 ? <Chip tone="warn">items open</Chip> : <Chip tone="accent">{n} of {SIGNERS.length} signed</Chip>; } },
            { key: 'a', header: '', nosort: true, render: (s) => { const n = signed[s.id] ?? 0; return n >= SIGNERS.length || systemPct(s, 'pssr') < 100 ? null : <ActionButton variant="primary" onClick={(e) => { e.stopPropagation(); void signOff(s); }}>Sign off: {SIGNERS[n]}</ActionButton>; } },
          ]}
        />
      </Card>

      <Drawer open={Boolean(current)} onClose={() => setSel(null)} title={current?.name ?? ''} subtitle={current ? `${current.unit} · owner ${current.owner}` : ''}>
        {current && (
          <div className="stack">
            <Stepper steps={SIGNERS} current={signed[current.id] ?? 0} />
            <CardHeader title="PSSR items" />
            {STAGE_ITEMS.pssr.map((label, i) => (
              <label key={label} className="list-row" style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                <span style={{ display: 'flex', gap: 10 }}>
                  <input type="checkbox" checked={current.items.pssr[i]} disabled={!canEdit} onChange={() => flip(current, i)} />
                  <span style={{ textDecoration: current.items.pssr[i] ? 'line-through' : 'none', opacity: current.items.pssr[i] ? 0.6 : 1 }}>{label}</span>
                </span>
                <Chip tone={current.items.pssr[i] ? 'good' : 'warn'}>{current.items.pssr[i] ? 'closed' : 'open'}</Chip>
              </label>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}
