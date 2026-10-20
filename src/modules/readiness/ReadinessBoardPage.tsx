import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { TABS } from '../../app/tabRegistry';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { FilterChips } from '../../components/ui/FilterChips';
import { Heatmap } from '../../components/charts/Heatmap';
import { Drawer } from '../../components/ui/Drawer';
import { LoadingState } from '../../components/ui/EmptyState';
import { STAGE_ITEMS, getSystems, systemPct, toggleItem } from '../../services/readinessService';
import type { ReadyStage, ReadySystem } from '../../mocks/readinessMock';
import { useCanEdit } from '../../app/AccessContext';
import { useToast } from '../../app/ToastContext';

const TITLES: Record<ReadyStage, { tab: string; head: string; sub: string; ready: string }> = {
  walkdown: { tab: 'Ready for Walkdown', head: 'Ready for Walkdown', sub: 'Systems, units and areas that have met the mechanical-completion prerequisites for the joint walkdown.', ready: 'Ready for walkdown' },
  pssr: { tab: 'Ready for PSSR sign-off', head: 'Ready for PSSR sign-off', sub: 'Systems whose Pre-Startup Safety Review prerequisites are closed and can be signed off.', ready: 'Ready for PSSR' },
  startup: { tab: 'Ready for Operational Startup', head: 'Ready for Operational Startup', sub: 'Systems that have passed leak test, purge and loop checks and can be handed to Operations for start-up.', ready: 'Ready for start-up' },
};

export default function ReadinessBoardPage() {
  const { showToast } = useToast();
  const canEdit = useCanEdit();
  const [tab, setTab] = useTabParam(TABS['readiness-board'], 'walkdown');
  const [systems, setSystems] = useState<ReadySystem[] | null>(null);
  const [unit, setUnit] = useState('all');
  const [sel, setSel] = useState<string | null>(null);

  const load = useCallback(() => getSystems().then(setSystems), []);
  useEffect(() => {
    load();
  }, [load]);

  const units = useMemo(() => Array.from(new Set((systems ?? []).map((s) => s.unit))), [systems]);
  const shown = (systems ?? []).filter((s) => unit === 'all' || s.unit === unit);
  const current = systems?.find((s) => s.id === sel) ?? null;

  if (!systems) {
    return (
      <div>
        <PageHeader title="Readiness Board" subtitle="Live readiness by system, unit and area." checklist="X18 · X19 · X20" />
        <LoadingState />
      </div>
    );
  }

  const stage = tab;
  const T = TITLES[stage];
  const avg = Math.round(systems.reduce((s, x) => s + systemPct(x, stage), 0) / systems.length);
  const ready = systems.filter((s) => systemPct(s, stage) === 100).length;
  const almost = systems.filter((s) => systemPct(s, stage) >= 75 && systemPct(s, stage) < 100).length;

  const heatRows = units;
  const heat = heatRows.map((u) => {
    const list = systems.filter((s) => s.unit === u);
    return (['walkdown', 'pssr', 'startup'] as ReadyStage[]).map((st) => Math.round(list.reduce((s, x) => s + systemPct(x, st), 0) / list.length));
  });

  async function flip(s: ReadySystem, i: number) {
    await toggleItem(s.id, stage, i);
    await load();
    const open = s.items[stage][i];
    showToast(open ? `Item re-opened on ${s.name}` : `Item closed on ${s.name}`, open ? 'warn' : 'good');
  }

  return (
    <div>
      <PageHeader title="Readiness Board" subtitle={T.sub + ' Click a system to see and close its items.'} checklist={stage === 'walkdown' ? 'X18' : stage === 'pssr' ? 'X19' : 'X20'} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'walkdown', label: TITLES.walkdown.tab },
          { id: 'pssr', label: TITLES.pssr.tab },
          { id: 'startup', label: TITLES.startup.tab },
        ]}
      />

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatTile label={T.ready} value={`${ready} of ${systems.length}`} tone="good" delta="systems at 100%" />
        <StatTile label="Almost ready (75%+)" value={String(almost)} tone="warn" />
        <StatTile label="Average readiness" value={`${avg}%`} tone={avg >= 75 ? 'good' : 'warn'} />
        <StatTile label="Not started (<25%)" value={String(systems.filter((s) => systemPct(s, stage) < 25).length)} tone="crit" />
      </div>

      <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Systems" action={<FilterChips options={units.map((u) => ({ value: u }))} value={unit} onChange={setUnit} allLabel="All units" />} />
          <div className="grid grid-3" style={{ gap: 10 }}>
            {shown.map((s) => {
              const p = systemPct(s, stage);
              const done = s.items[stage].filter(Boolean).length;
              return (
                <button key={s.id} className="card card-pad" style={{ textAlign: 'left', cursor: 'pointer', borderTop: `3px solid ${p === 100 ? 'var(--good)' : p >= 75 ? 'var(--warn)' : p >= 25 ? 'var(--accent)' : 'var(--crit)'}`, font: 'inherit', color: 'inherit' }} onClick={() => setSel(s.id)}>
                  <div className="spread">
                    <Chip tone="neutral">{s.unit}</Chip>
                    <span className="mono small muted">{done}/{s.items[stage].length}</span>
                  </div>
                  <div style={{ fontWeight: 600, margin: '8px 0 8px', minHeight: 38, fontSize: 13 }}>{s.name}</div>
                  <ProgressBar value={p} />
                </button>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardHeader title="Unit view: all three gates" />
          <Heatmap rows={heatRows} cols={['Walkdown', 'PSSR', 'Start-up']} values={heat} max={100} mode="ready" format={(v) => `${v}%`} rowLabelWidth={60} />
          <p className="small muted" style={{ margin: '12px 0 0' }}>Readiness is cumulative: a system cannot be ready for PSSR before its walkdown items are closed.</p>
        </Card>
      </div>

      <Drawer open={Boolean(current)} onClose={() => setSel(null)} title={current?.name ?? ''} subtitle={current ? `${current.unit} · owner ${current.owner} · ${T.head}` : ''}>
        {current && (
          <div className="stack">
            <ProgressBar value={systemPct(current, stage)} height={12} />
            {STAGE_ITEMS[stage].map((label, i) => {
              const done = current.items[stage][i];
              return (
                <label key={label} className="list-row" style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="checkbox" checked={done} disabled={!canEdit} onChange={() => flip(current, i)} />
                    <span style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>{label}</span>
                  </span>
                  <Chip tone={done ? 'good' : 'warn'}>{done ? 'closed' : 'open'}</Chip>
                </label>
              );
            })}
          </div>
        )}
      </Drawer>
    </div>
  );
}
