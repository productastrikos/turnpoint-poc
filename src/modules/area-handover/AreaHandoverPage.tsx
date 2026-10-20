import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { ActionButton } from '../../components/ui/ActionButton';
import { LoadingState } from '../../components/ui/EmptyState';
import { Stepper } from '../../components/workflow/Stepper';
import { TABS } from '../../app/tabRegistry';
import { HANDOVER_ACTIONS, MILESTONES, advanceHandover, advanceMilestone, getMilestones, listHandovers } from '../../services/executionService';
import { HANDOVER_STAGES, type AssetMilestones, type Handover, type MilestoneId, type MsState } from '../../mocks/executionMock';
import { areaLabel } from '../../mocks/master';
import { useCanEdit } from '../../app/AccessContext';
import { useToast } from '../../app/ToastContext';

const TONE: Record<MsState, 'good' | 'accent' | 'neutral'> = { Done: 'good', 'In progress': 'accent', 'Not started': 'neutral' };
const SHORT: Record<MsState, string> = { Done: '✓', 'In progress': '…', 'Not started': '·' };

export default function AreaHandoverPage() {
  const { showToast } = useToast();
  const canEdit = useCanEdit();
  const [tab, setTab] = useTabParam(TABS['area-handover'], 'handover');
  const [rows, setRows] = useState<Handover[] | null>(null);
  const [ms, setMs] = useState<AssetMilestones[]>([]);
  const [area, setArea] = useState('all');
  const [sel, setSel] = useState<Handover | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [h, m] = await Promise.all([listHandovers(), getMilestones()]);
    setRows(h);
    setMs(m);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function advance(h: Handover) {
    setBusy(h.id);
    await advanceHandover(h.id);
    await load();
    setBusy(null);
    showToast(`${h.area} · ${h.package}: ${HANDOVER_ACTIONS[h.stage].toLowerCase()} done`, 'good');
  }
  async function flipMs(a: AssetMilestones, m: MilestoneId) {
    if (!canEdit || a.stateByMilestone[m] === 'Done') return;
    await advanceMilestone(a.id, m);
    await load();
  }

  if (!rows) return <div><PageHeader title="Area / Unit Handover" subtitle="" checklist="X27" /><LoadingState /></div>;
  const areas = Array.from(new Set(rows.map((r) => r.area)));
  const shown = rows.filter((r) => area === 'all' || r.area === area);

  return (
    <div>
      <PageHeader
        title="Area / Unit Handover"
        subtitle="Completion certificates handed over from the Main Mechanical Contractor to Operations by area: completion declared, walkdown and punch, handover signed, accepted. The milestone tab shows each asset's status in one view."
        checklist="X27 · SOW dry run 30"
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'handover', label: 'Handover from main contractor' }, { id: 'milestones', label: 'Asset milestones' }]} />

      {tab === 'handover' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid grid-4">
            <StatTile label="Packages" value={String(rows.length)} />
            <StatTile label="Accepted by Operations" value={String(rows.filter((r) => r.stage === 5).length)} tone="good" />
            <StatTile label="Handover signed" value={String(rows.filter((r) => r.stage === 4).length)} tone="accent" />
            <StatTile label="Punch A open" value={String(rows.reduce((s, r) => s + r.punchOpen, 0))} tone="crit" delta={`across ${rows.length} handover packages`} />
          </div>
          <Card>
            <div className="toolbar"><FilterChips options={areas.map((a) => ({ value: a }))} value={area} onChange={setArea} allLabel="All areas" /></div>
            <DataTable
              dense
              rowKey={(h: Handover) => h.id}
              rows={shown}
              onRowClick={setSel}
              activeKey={sel?.id}
              columns={[
                { key: 'package', header: 'Package', render: (h) => <div><strong>{h.package}</strong><div className="small muted">{areaLabel(h.area)} · {h.contractor}</div></div> },
                { key: 'stage', header: 'Stage', render: (h) => <Chip tone={h.stage === 5 ? 'good' : h.stage >= 3 ? 'accent' : h.stage === 0 ? 'neutral' : 'warn'}>{HANDOVER_STAGES[h.stage]}</Chip>, sortValue: (h) => h.stage },
                { key: 'punch', header: 'Punch A open', mono: true, align: 'right', render: (h) => <span style={{ color: h.punchOpen ? 'var(--crit)' : undefined }}>{h.punchOpen}</span>, sortValue: (h) => h.punchOpen },
                { key: 'plannedDay', header: 'Planned', mono: true, render: (h) => `D${h.plannedDay}`, sortValue: (h) => h.plannedDay },
                { key: 'a', header: '', nosort: true, render: (h) => (h.stage < 5 ? <ActionButton busy={busy === h.id} onClick={(e) => { e.stopPropagation(); void advance(h); }}>{HANDOVER_ACTIONS[h.stage]}</ActionButton> : null) },
              ]}
            />
          </Card>
          {sel && (
            <Card>
              <CardHeader title={`${sel.package} · ${sel.area}`} />
              <Stepper steps={HANDOVER_STAGES} current={rows.find((r) => r.id === sel.id)?.stage ?? sel.stage} />
            </Card>
          )}
        </div>
      )}

      {tab === 'milestones' && (
        <Card>
          <CardHeader title="Milestone and handover status per asset" action={<span className="small muted">Click a cell to advance it</span>} />
          <div style={{ overflowX: 'auto' }}>
            <table className="table dt-dense">
              <thead><tr><th>Asset</th>{MILESTONES.map((m) => <th key={m} style={{ textAlign: 'center', fontSize: 10 }}>{m}</th>)}<th>Done</th></tr></thead>
              <tbody>
                {ms.map((a) => {
                  const done = MILESTONES.filter((m) => a.stateByMilestone[m] === 'Done').length;
                  return (
                    <tr key={a.id}>
                      <td><strong className="mono">{a.id}</strong><div className="small muted">{a.name} · {a.area}</div></td>
                      {MILESTONES.map((m) => (
                        <td key={m} style={{ textAlign: 'center' }}>
                          <button className={`chip chip-${TONE[a.stateByMilestone[m]]}`} style={{ cursor: canEdit && a.stateByMilestone[m] !== 'Done' ? 'pointer' : 'default', border: 'none', minWidth: 34, justifyContent: 'center' }} title={`${m}: ${a.stateByMilestone[m]}`} onClick={() => flipMs(a, m)}>{SHORT[a.stateByMilestone[m]]}</button>
                        </td>
                      ))}
                      <td className="mono">{done}/{MILESTONES.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="chart-legend" style={{ marginTop: 10 }}>
            <span><i style={{ background: 'var(--good)' }} />Done</span><span><i style={{ background: 'var(--accent)' }} />In progress</span><span><i style={{ background: 'var(--ink-3)' }} />Not started</span>
          </div>
        </Card>
      )}
    </div>
  );
}
