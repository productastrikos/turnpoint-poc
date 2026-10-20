import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { StatusChip } from '../../components/ui/StatusChip';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ActionButton } from '../../components/ui/ActionButton';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/EmptyState';
import { Stepper } from '../../components/workflow/Stepper';
import { TABS } from '../../app/tabRegistry';
import { act, allRemarks, availableActions, incomplete, listExchangers, listItps, recordPoint, summarise, type Action, type RemarkRow } from '../../services/qaqcService';
import { STAGES, SUBTYPE_COMPONENTS, type CellState, type Exchanger, type Itp, type StageId } from '../../mocks/qaqcMock';
import { useRole } from '../../app/RoleContext';
import { useCanEdit } from '../../app/AccessContext';
import { useToast } from '../../app/ToastContext';
import { areaLabel } from '../../mocks/master';

const CELL_TONE: Record<CellState, 'neutral' | 'warn' | 'accent' | 'good' | 'crit'> = { 'Not requested': 'neutral', Requested: 'warn', Done: 'accent', Cleared: 'good', Rework: 'crit' };
const CELL_SHORT: Record<CellState, string> = { 'Not requested': '—', Requested: 'REQ', Done: 'DONE', Cleared: 'OK', Rework: 'RWK' };
const ACTION_LABEL: Record<Action, string> = { request: 'Request inspection', record: 'Record inspection done', clear: 'Give clearance', rework: 'Raise rework' };
const REASONS = ['Awaiting inspector', 'Scaffold access not ready', 'Permit not yet issued', 'Waiting for NDT crew'];

function downloadCsv(name: string, rows: Record<string, string>[]) {
  const head = Object.keys(rows[0] ?? {});
  const csv = [head.join(','), ...rows.map((r) => head.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function QaqcPage() {
  const { persona } = useRole();
  const canEdit = useCanEdit();
  const { showToast } = useToast();
  const [tab, setTab] = useTabParam(TABS.qaqc, 'inspections');
  const [list, setList] = useState<Exchanger[] | null>(null);
  const [itps, setItps] = useState<Itp[]>([]);
  const [quick, setQuick] = useState('all');
  const [sel, setSel] = useState<string | null>(null);
  const [step, setStep] = useState<{ comp: string; stage: StageId } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [err, setErr] = useState('');
  const [report, setReport] = useState(false);
  const [rq, setRq] = useState('');

  const canClear = ['ta-manager', 'inspection'].includes(persona.id);

  const load = useCallback(async () => {
    const [e, i] = await Promise.all([listExchangers(), listItps()]);
    setList(e);
    setItps(i);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const all = useMemo(() => list ?? [], [list]);
  const sums = useMemo(() => Object.fromEntries(all.map((e) => [e.id, summarise(e)])), [all]);
  const current = all.find((e) => e.id === sel) ?? null;
  const pending = useMemo(() => incomplete(all), [all]);
  const remarkRows = useMemo(() => allRemarks(all), [all]);

  const counts = {
    reqNotDone: all.filter((e) => sums[e.id].requestedNotDone > 0).length,
    doneNoClear: all.filter((e) => sums[e.id].doneNotCleared > 0).length,
    rework: all.filter((e) => sums[e.id].rework > 0).length,
    cleared: all.filter((e) => sums[e.id].status === 'Cleared').length,
  };
  const shown = all.filter((e) => {
    const s = sums[e.id];
    if (quick === 'req') return s.requestedNotDone > 0;
    if (quick === 'done') return s.doneNotCleared > 0;
    if (quick === 'rework') return s.rework > 0;
    if (quick === 'cleared') return s.status === 'Cleared';
    return true;
  });

  async function submit(action: Action) {
    if (!current || !step) return;
    const r = await act(current.id, step.comp, step.stage, action, persona.person, { remarks, canClear, reason });
    if (!r.ok) {
      setErr(r.error ?? 'Not allowed');
      return;
    }
    setErr('');
    setRemarks('');
    setStep(null);
    await load();
    showToast(`${current.id} · ${step.comp} · ${STAGES.find((s) => s.id === step.stage)!.name}: ${ACTION_LABEL[action].toLowerCase()}`, action === 'rework' ? 'warn' : 'good');
  }

  async function point(i: Itp) {
    const r = await recordPoint(i.id, canClear);
    if (!r.ok) {
      showToast(r.error ?? 'Not allowed', 'crit');
      return;
    }
    await load();
    showToast(`${i.id}: inspection point recorded`, 'good');
  }

  if (!list) return <div><PageHeader title="QA/QC & ITP" subtitle="" checklist="P5 · P9" /><LoadingState /></div>;

  const cellOf = (e: Exchanger, comp: string, stage: StageId) => e.components.find((c) => c.name === comp)!.stages[stage];
  const stepCell = current && step ? cellOf(current, step.comp, step.stage) : null;
  const actions = current && step ? availableActions(current, step.comp, step.stage) : [];
  const allCleared = current ? sums[current.id].status === 'Cleared' : false;

  return (
    <div>
      <PageHeader
        title="QA/QC & Inspection Test Plans"
        subtitle="Digital inspection workflow for heat exchangers from pre-cleaning to final inspection, tracked per component with stage control, role-based clearance, signatures, remarks and rework at every stage. ITP tracking starts when the PO is issued."
        checklist="P5 · P9 · SOW dry run 15-24"
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'inspections', label: 'Exchanger inspections' }, { id: 'itp', label: 'ITP tracking (after PO)', badge: itps.length }, { id: 'remarks', label: 'Remarks register', badge: remarkRows.length }]} />

      {tab === 'inspections' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid grid-5">
            <StatTile label="Exchangers" value={String(all.length)} />
            <StatTile label="Requested, not done" value={String(pending.filter((p) => p.state === 'Requested').length)} tone="warn" delta="inspections" />
            <StatTile label="Done, clearance not given" value={String(pending.filter((p) => p.state === 'Done').length)} tone="accent" delta="inspections" />
            <StatTile label="In rework" value={String(pending.filter((p) => p.state === 'Rework').length)} tone="crit" delta="inspections" />
            <StatTile label="Fully cleared" value={String(counts.cleared)} tone="good" delta="exchangers" />
          </div>
          <Card>
            <div className="toolbar">
              <FilterChips
                options={[
                  { value: 'req', label: 'REQUESTED but NOT DONE', count: counts.reqNotDone },
                  { value: 'done', label: 'DONE but CLEARANCE NOT GIVEN', count: counts.doneNoClear },
                  { value: 'rework', label: 'In rework', count: counts.rework },
                  { value: 'cleared', label: 'Cleared', count: counts.cleared },
                ]}
                value={quick}
                onChange={setQuick}
                allLabel="All exchangers"
              />
            </div>
            <DataTable
              dense
              rowKey={(e: Exchanger) => e.id}
              rows={shown}
              onRowClick={(e) => setSel(e.id)}
              activeKey={sel}
              columns={[
                { key: 'id', header: 'Exchanger', render: (e) => <div><strong className="mono">{e.id}</strong><div className="small muted">{e.name}</div></div> },
                { key: 'subtype', header: 'Sub-type', render: (e) => <Chip tone="neutral">{e.subtype}</Chip> },
                { key: 'area', header: 'Area', render: (e) => <span className="small">{areaLabel(e.area)}</span> },
                { key: 'contractor', header: 'Contractor', render: (e) => <span className="small">{e.contractor}</span> },
                { key: 'stage', header: 'Current stage', render: (e) => sums[e.id].currentStage, sortValue: (e) => sums[e.id].currentStage },
                { key: 'pct', header: 'Cleared', render: (e) => <ProgressBar value={sums[e.id].pct} />, sortValue: (e) => sums[e.id].pct },
                { key: 'req', header: 'REQ', mono: true, align: 'right', render: (e) => sums[e.id].requestedNotDone || '—', sortValue: (e) => sums[e.id].requestedNotDone },
                { key: 'done', header: 'DONE', mono: true, align: 'right', render: (e) => sums[e.id].doneNotCleared || '—', sortValue: (e) => sums[e.id].doneNotCleared },
                { key: 'rwk', header: 'Rework', mono: true, align: 'right', render: (e) => (sums[e.id].reworkEver ? `${sums[e.id].rework} now / ${sums[e.id].reworkEver} total` : '—'), sortValue: (e) => sums[e.id].reworkEver },
                { key: 'status', header: 'Status', render: (e) => <StatusChip status={sums[e.id].status} tone={sums[e.id].status === 'Cleared' ? 'good' : sums[e.id].status === 'Rework' ? 'crit' : sums[e.id].status === 'Not started' ? 'neutral' : 'accent'} />, sortValue: (e) => sums[e.id].status },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title={`Incomplete inspections and why (${pending.length})`} action={<button className="btn btn-sm" onClick={() => downloadCsv('incomplete_inspections.csv', pending.map((p) => ({ Exchanger: p.tag, Component: p.component, Stage: p.stage, State: p.state, Reason: p.why })))}>Export CSV</button>} />
            <DataTable
              dense
              pageSize={8}
              rowKey={(p) => `${p.tag}${p.component}${p.stage}`}
              rows={pending}
              columns={[
                { key: 'tag', header: 'Exchanger', mono: true },
                { key: 'component', header: 'Component' },
                { key: 'stage', header: 'Stage' },
                { key: 'state', header: 'State', render: (p) => <Chip tone={CELL_TONE[p.state]}>{p.state}</Chip> },
                { key: 'why', header: 'Why not complete', render: (p) => <span className="small">{p.why}</span> },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'itp' && (
        <Card>
          <CardHeader title="Inspection Test Plans after PO issuance" />
          <p className="small muted" style={{ margin: '-6px 0 10px' }}>Each purchase order gets an ITP with hold (H), witness (W) and review (R) points. Hold points need an OQ inspector to attend and sign, so contractors cannot close them.</p>
          <DataTable
            dense
            rowKey={(i: Itp) => i.id}
            rows={itps}
            columns={[
              { key: 'id', header: 'ITP', mono: true },
              { key: 'item', header: 'Item', render: (i) => <div>{i.item}<div className="small muted">{i.vendor} · PO {i.po} · {i.materialId}</div>{i.note && <div className="small" style={{ color: 'var(--warn)' }}>{i.note}</div>}</div> },
              { key: 'points', header: 'Points', nosort: true, render: (i) => <span className="row-wrap" style={{ gap: 3 }}>{i.points.map((p) => <span key={p.name} title={`${p.name} (${p.type})`} className="tag-chip" style={{ background: p.done ? 'var(--good-soft)' : p.type === 'H' ? 'var(--crit-soft)' : 'var(--surface-2)', color: p.done ? 'var(--good)' : p.type === 'H' ? 'var(--crit)' : 'var(--ink-2)' }}>{p.type}{p.done ? '✓' : ''}</span>)}</span> },
              { key: 'prog', header: 'Progress', render: (i) => <ProgressBar value={i.points.filter((p) => p.done).length} max={i.points.length} />, sortValue: (i) => i.points.filter((p) => p.done).length },
              { key: 'next', header: 'Next point', render: (i) => { const n = i.points.find((p) => !p.done); return n ? <span className="small">{n.name} <Chip tone={n.type === 'H' ? 'crit' : 'neutral'}>{n.type}</Chip></span> : <Chip tone="good">complete, release note issued</Chip>; }, sortValue: (i) => i.points.filter((p) => p.done).length },
              { key: 'a', header: '', nosort: true, render: (i) => (i.points.every((p) => p.done) ? null : <ActionButton onClick={() => point(i)}>Record next point</ActionButton>) },
            ]}
          />
        </Card>
      )}

      {tab === 'remarks' && (
        <Card>
          <CardHeader title="Inspection remarks across stages and assets" action={<button className="btn btn-sm" onClick={() => downloadCsv('inspection_remarks.csv', remarkRows.map((r) => ({ Time: r.at, Exchanger: r.tag, Component: r.component, Stage: r.stage, State: r.state, By: r.by, Remark: r.text })))}>Export CSV</button>} />
          <div className="toolbar"><input type="text" placeholder="Search remarks, exchanger, stage" value={rq} onChange={(e) => setRq(e.target.value)} style={{ width: 320 }} /></div>
          <DataTable
            dense
            pageSize={12}
            rowKey={(r: RemarkRow) => r.tag + r.component + r.stage + r.at + r.text}
            rows={remarkRows.filter((r) => !rq || `${r.tag} ${r.component} ${r.stage} ${r.text} ${r.by}`.toLowerCase().includes(rq.toLowerCase()))}
            columns={[
              { key: 'at', header: 'Time', mono: true, render: (r) => r.at.slice(5, 16).replace('T', ' ') },
              { key: 'tag', header: 'Exchanger', mono: true },
              { key: 'component', header: 'Component' },
              { key: 'stage', header: 'Stage' },
              { key: 'state', header: 'Outcome', render: (r) => <Chip tone={CELL_TONE[r.state]}>{r.state}</Chip> },
              { key: 'text', header: 'Remark', render: (r) => <span>{r.text}<div className="small muted">{r.by}</div></span> },
            ]}
          />
        </Card>
      )}

      <Drawer open={Boolean(current)} onClose={() => { setSel(null); setStep(null); }} width={820} title={current ? `${current.id} · ${current.name}` : ''} subtitle={current ? `${current.subtype} · ${areaLabel(current.area)} · ${current.contractor}` : ''}
        footer={current ? <><span className="small muted" style={{ marginRight: 'auto' }}>Signing as {persona.person} ({persona.label}){canClear ? '' : ' · cannot give clearance'}</span><button className="btn" disabled={!allCleared} title={allCleared ? '' : 'Available when every stage is cleared'} onClick={() => setReport(true)}>Print inspection report</button></> : undefined}>
        {current && (
          <div className="stack">
            <Stepper steps={STAGES.map((s) => s.name)} current={STAGES.findIndex((s) => current.components.some((c) => c.stages[s.id].state !== 'Cleared'))} />
            <div className="small muted">Component-level matrix. Click a cell to request, record, clear or raise rework. A stage can only be requested once the previous stage is cleared for that component. Sub-type {current.subtype}: {SUBTYPE_COMPONENTS[current.subtype].join(', ')}.</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table dt-dense">
                <thead>
                  <tr><th>Component</th>{STAGES.map((s) => <th key={s.id} style={{ textAlign: 'center' }}>{s.name}</th>)}</tr>
                </thead>
                <tbody>
                  {current.components.map((c) => (
                    <tr key={c.name}>
                      <td><strong style={{ fontSize: 12.5 }}>{c.name}</strong></td>
                      {STAGES.map((s) => {
                        const cell = c.stages[s.id];
                        return (
                          <td key={s.id} style={{ textAlign: 'center' }}>
                            <button className={`chip chip-${CELL_TONE[cell.state]}`} style={{ cursor: 'pointer', border: 'none', minWidth: 52, justifyContent: 'center' }} title={`${cell.state}${cell.reason ? `: ${cell.reason}` : ''}${cell.reworkCount ? ` · rework x${cell.reworkCount}` : ''}`} onClick={() => { setStep({ comp: c.name, stage: s.id }); setErr(''); }}>
                              {CELL_SHORT[cell.state]}{cell.reworkCount ? ` ·${cell.reworkCount}` : ''}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="chart-legend">
              {(Object.keys(CELL_TONE) as CellState[]).map((s) => <span key={s}><i style={{ background: `var(--${CELL_TONE[s] === 'accent' ? 'accent' : CELL_TONE[s] === 'neutral' ? 'ink-3' : CELL_TONE[s]})` }} />{s}</span>)}
            </div>
          </div>
        )}
      </Drawer>

      <Modal open={Boolean(step && current)} onClose={() => setStep(null)} width={520} title={step && current ? `${current.id} · ${step.comp} · ${STAGES.find((s) => s.id === step.stage)!.name}` : ''}>
        {step && current && stepCell && (
          <div className="stack">
            <div className="row-wrap"><Chip tone={CELL_TONE[stepCell.state]}>{stepCell.state}</Chip>{stepCell.reworkCount > 0 && <Chip tone="warn">rework x{stepCell.reworkCount}</Chip>}{stepCell.signedBy && <span className="small muted">signed {stepCell.signedBy} {stepCell.signedAt?.slice(0, 16).replace('T', ' ')}</span>}</div>
            {stepCell.reason && <div className="callout callout-warn">Pending because: {stepCell.reason}</div>}
            {stepCell.remarks.length > 0 && (
              <div>
                <div className="eyebrow">History</div>
                {stepCell.remarks.map((r, i) => <div key={i} className="small list-row"><span>{r.text}<div className="muted">{r.by} · {r.at.slice(5, 16).replace('T', ' ')}</div></span><Chip tone={CELL_TONE[r.state]}>{r.state}</Chip></div>)}
              </div>
            )}
            {actions.length === 0 && <div className="callout">No step available: {stepCell.state === 'Cleared' ? 'this stage is cleared.' : 'the previous stage must be cleared first (stage control).'}</div>}
            {actions.length > 0 && (
              <>
                {actions.includes('request') && (
                  <label className="field"><span className="field-label">If it cannot start yet, why</span><select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
                )}
                <label className="field"><span className="field-label">Remarks (required to record, clear or raise rework)</span><textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Findings, readings, instruction…" /></label>
                {err && <div className="callout callout-crit" role="alert">{err}</div>}
                <div className="row-wrap">
                  {actions.map((a) => <ActionButton key={a} small={false} variant={a === 'clear' ? 'primary' : a === 'rework' ? 'danger' : 'default'} onClick={() => submit(a)} disabled={!canEdit}>{ACTION_LABEL[a]}</ActionButton>)}
                </div>
                <div className="small muted">Signature: {persona.person}. Clearance is restricted to OQ inspectors (role-based approval).</div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal open={report} onClose={() => setReport(false)} width={720} title="Heat exchanger inspection report" footer={<><button className="btn" onClick={() => setReport(false)}>Close</button><button className="btn btn-primary" onClick={() => window.print()}>Print</button></>}>
        {current && (
          <div>
            <div className="eyebrow">OQ RPI · Sohar Refinery · STO 2026</div>
            <h3 style={{ fontSize: 22, margin: '4px 0 8px' }}>{current.id} {current.name}</h3>
            <p className="small muted">{current.subtype} · {areaLabel(current.area)} · {current.contractor}. All stages cleared.</p>
            <table className="table dt-dense">
              <thead><tr><th>Component</th><th>Stage</th><th>Signed by</th><th>Remark</th></tr></thead>
              <tbody>
                {current.components.flatMap((c) => STAGES.map((s) => { const cell = c.stages[s.id]; return <tr key={c.name + s.id}><td>{c.name}</td><td>{s.name}{cell.reworkCount ? ` (rework x${cell.reworkCount})` : ''}</td><td className="small">{cell.signedBy ?? '—'}</td><td className="small">{cell.remarks[cell.remarks.length - 1]?.text ?? ''}</td></tr>; }))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
