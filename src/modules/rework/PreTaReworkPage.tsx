import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ActionButton } from '../../components/ui/ActionButton';
import { LoadingState } from '../../components/ui/EmptyState';
import { Pareto } from '../../components/charts/Pareto';
import { BarChart } from '../../components/charts/BarChart';
import { createLoss, listLosses } from '../../services/qualityService';
import { EQUIPMENT_RATE, LOSS_CAUSES, REWORK_EQUIPMENT, type LossCause, type LossEvent, type ReworkEquipment } from '../../mocks/qualityMock';
import { CONTRACTOR_NAMES, DISCIPLINES, PEOPLE } from '../../mocks/master';
import { scheduleActivities } from '../../mocks/scheduleMock';
import { useRole } from '../../app/RoleContext';
import { useToast } from '../../app/ToastContext';
import { shortDate, dayToDate } from '../../mocks/_gen';

const ACTIVITY_OPTIONS = scheduleActivities.filter((a) => a.startDay <= 14).map((a) => `${a.p6Id} ${a.name}`);
const MAN_HOURS = 181_280; // man-hours worked to date (same base as the Re-work dashboard)
const ALLOWANCE_PCT = 1.0; // re-work allowance in the plan, % of man-hours
const sum = (xs: LossEvent[]) => xs.reduce((s, r) => s + r.hours, 0);
const group = <T,>(xs: LossEvent[], key: (r: LossEvent) => T) => {
  const m = new Map<T, LossEvent[]>();
  xs.forEach((x) => m.set(key(x), [...(m.get(key(x)) ?? []), x]));
  return m;
};

/** Pre-TA re-work reports (PBC 8): re-work by discipline, contractor and cause, trend, first-time-right, and a printable generated report. */
export default function PreTaReworkPage() {
  const { role } = useRole();
  const { showToast } = useToast();
  const showCost = role !== 'contractor';
  const [rows, setRows] = useState<LossEvent[] | null>(null);
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ activity: ACTIVITY_OPTIONS[0], cause: LOSS_CAUSES[4] as string, discipline: DISCIPLINES[0] as string, contractor: CONTRACTOR_NAMES[0], hours: 40, equipment: 'Manlift' as ReworkEquipment | 'None', equipHours: 12 });

  const load = useCallback(() => listLosses().then(setRows), []);
  useEffect(() => {
    load();
  }, [load]);

  const rework = useMemo(() => (rows ?? []).filter((r) => r.kind === 'Rework'), [rows]);
  const byCause = useMemo(() => [...group(rework, (r) => r.cause).entries()].map(([cause, xs]) => ({ cause, hours: sum(xs), events: xs.length })).sort((a, b) => b.hours - a.hours), [rework]);
  const byDisc = useMemo(() => [...group(rework, (r) => r.discipline).entries()].map(([d, xs]) => ({ d, hours: sum(xs), cost: xs.reduce((s, r) => s + r.costOMR, 0) })).sort((a, b) => b.hours - a.hours), [rework]);
  const byCon = useMemo(() => [...group(rework, (r) => r.contractor).entries()].map(([c, xs]) => ({ c, hours: sum(xs), events: xs.length })).sort((a, b) => b.hours - a.hours), [rework]);
  const byEquip = useMemo(
    () =>
      REWORK_EQUIPMENT.map((e) => {
        const xs = rework.filter((r) => r.equipment === e);
        return { e, events: xs.length, equipHours: xs.reduce((s, r) => s + (r.equipHours ?? 0), 0), manHours: sum(xs), cost: xs.reduce((s, r) => s + (r.equipCostOMR ?? 0), 0) };
      })
        .filter((x) => x.events > 0)
        .sort((a, b) => b.equipHours - a.equipHours),
    [rework]
  );
  if (!rows) return <div><PageHeader title="Re-work Reports" subtitle="" checklist="PBC 8" /><LoadingState /></div>;

  const hours = sum(rework);
  const pct = (hours / MAN_HOURS) * 100;
  const ftr = 100 - pct;
  const cost = rework.reduce((s, r) => s + r.costOMR, 0);
  const equipHours = byEquip.reduce((s, x) => s + x.equipHours, 0);
  const equipCost = byEquip.reduce((s, x) => s + x.cost, 0);
  const days = Array.from({ length: 14 }, (_, i) => i + 1);
  const repeat = byCause.filter((c) => c.events >= 2).slice(0, 5);
  const lastDay = Math.max(14, ...rework.map((r) => r.day));

  async function capture() {
    setBusy(true);
    const [p6Id, ...rest] = form.activity.split(' ');
    const e = await createLoss({ kind: 'Rework', day: lastDay, activity: rest.join(' '), p6Id, discipline: form.discipline, contractor: form.contractor, cause: form.cause as LossCause, hours: form.hours, reportedBy: PEOPLE.planner, note: 'Captured from the Re-work Reports page', ...(form.equipment !== 'None' ? { equipment: form.equipment, equipHours: form.equipHours } : {}) });
    await load();
    setBusy(false);
    setOpen(false);
    showToast(`${e.id} captured: ${e.hours} man-hours of re-work to "${e.cause}"${e.equipment ? ` and ${e.equipHours} h of ${e.equipment.toLowerCase()}` : ''}. The charts and the report now include it.`, 'warn');
  }

  const equipSentence = byEquip[0] ? ` Equipment tied up by re-work: ${equipHours} equipment-hours${showCost ? ` (OMR ${equipCost.toLocaleString()})` : ''}, led by ${byEquip[0].e.toLowerCase()} (${byEquip[0].equipHours} h).` : '';
  const summary = `Re-work stands at ${hours.toLocaleString()} man-hours (${pct.toFixed(2)}% of ${MAN_HOURS.toLocaleString()} man-hours), ${pct <= ALLOWANCE_PCT ? 'inside' : 'above'} the ${ALLOWANCE_PCT.toFixed(1)}% allowance, so first-time-right is ${ftr.toFixed(2)}%. ${byCause[0] ? `The largest cause is "${byCause[0].cause}" (${byCause[0].hours} h, ${Math.round((byCause[0].hours / Math.max(1, hours)) * 100)}% of re-work).` : ''} ${byDisc[0] ? `${byDisc[0].d} carries the most re-work.` : ''} ${byCon[0] ? `${byCon[0].c} accounts for ${byCon[0].hours} h.` : ''} ${repeat.length ? `${repeat.length} causes repeat more than once and are the first candidates for a fix before Day 15.` : ''}${equipSentence}`;

  return (
    <div>
      <PageHeader
        title="Re-work Reports"
        subtitle="The re-work dashboard for the Pre-TA and TA team: hours and cost by cause, discipline and contractor, trend, first-time-right against the plan allowance, and a report you can print for the steering meeting."
        checklist="PBC 8"
        action={
          <div className="row no-print">
            <ActionButton onClick={() => setOpen(true)}>Capture re-work</ActionButton>
            <ActionButton variant="primary" onClick={() => setReport(true)}>Generate report</ActionButton>
          </div>
        }
      />
      <div className="grid grid-5" style={{ marginBottom: 16 }}>
        <StatTile label="Re-work man-hours" value={hours.toLocaleString()} tone="warn" delta={`${rework.length} events`} />
        <StatTile label="First-time-right" value={`${ftr.toFixed(2)}%`} tone={pct <= ALLOWANCE_PCT ? 'good' : 'crit'} delta={`allowance ${ALLOWANCE_PCT.toFixed(1)}% re-work`} />
        <StatTile label="Re-work vs man-hours" value={`${pct.toFixed(2)}%`} tone={pct <= ALLOWANCE_PCT ? 'good' : 'crit'} delta={`of ${MAN_HOURS.toLocaleString()} h`} />
        <StatTile label="Cost of re-work (labour)" value={showCost ? `OMR ${cost.toLocaleString()}` : 'Restricted'} tone="neutral" delta={showCost ? undefined : 'OQ staff only'} />
        <StatTile label="Equipment tied up" value={`${equipHours.toLocaleString()} h`} tone="warn" delta={showCost ? `OMR ${equipCost.toLocaleString()} equipment cost` : `${byEquip.length} equipment types`} />
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Re-work by cause (Pareto, hours)" />
          <Pareto items={byCause.map((c) => ({ label: c.cause, value: c.hours }))} unit=" h" />
        </Card>
        <Card>
          <CardHeader title="Re-work hours per TA day" />
          <BarChart height={260} labels={days.map((d) => `D${d}`)} series={[{ name: 'Re-work h', color: 'var(--warn)', data: days.map((d) => sum(rework.filter((r) => r.day === d))) }]} />
        </Card>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start', marginTop: 16 }}>
        <Card>
          <CardHeader title="By discipline" />
          <DataTable
            dense
            rowKey={(r: (typeof byDisc)[number]) => r.d}
            rows={byDisc}
            columns={[
              { key: 'd', header: 'Discipline' },
              { key: 'hours', header: 'Hours', mono: true, align: 'right' },
              ...(showCost ? [{ key: 'cost', header: 'Cost (OMR)', mono: true, align: 'right' as const, render: (r: (typeof byDisc)[number]) => r.cost.toLocaleString() }] : []),
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="By contractor" />
          <DataTable
            dense
            rowKey={(r: (typeof byCon)[number]) => r.c}
            rows={byCon}
            columns={[
              { key: 'c', header: 'Contractor' },
              { key: 'events', header: 'Events', mono: true, align: 'right' },
              { key: 'hours', header: 'Hours', mono: true, align: 'right' },
            ]}
          />
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <CardHeader title="Re-work by equipment: manlifts, scaffolding, cranes and other plant used again, with the man-hours" />
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <BarChart height={240} labels={byEquip.map((x) => x.e)} series={[{ name: 'Equipment hours', color: 'var(--accent)', data: byEquip.map((x) => x.equipHours) }, { name: 'Man-hours', color: 'var(--warn)', data: byEquip.map((x) => x.manHours) }]} />
          <DataTable
            dense
            rowKey={(r: (typeof byEquip)[number]) => r.e}
            rows={byEquip}
            columns={[
              { key: 'e', header: 'Equipment' },
              { key: 'events', header: 'Events', mono: true, align: 'right' },
              { key: 'equipHours', header: 'Equipment h', mono: true, align: 'right' },
              { key: 'manHours', header: 'Man-hours', mono: true, align: 'right' },
              ...(showCost ? [{ key: 'cost', header: 'Equipment cost (OMR)', mono: true, align: 'right' as const, render: (r: (typeof byEquip)[number]) => r.cost.toLocaleString() }] : []),
            ]}
          />
        </div>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <CardHeader title="Repeat causes (more than one event): fix these first" />
        {repeat.length === 0 ? <p className="small muted">No cause has repeated yet.</p> : repeat.map((c) => <div key={c.cause} className="list-row"><span>{c.cause}</span><span className="row"><Chip tone="warn">{c.events} events</Chip><span className="mono">{c.hours} h</span></span></div>)}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} width={520} title="Capture a re-work event" footer={<><button className="btn" onClick={() => setOpen(false)}>Cancel</button><ActionButton variant="primary" busy={busy} onClick={capture}>Capture</ActionButton></>}>
        <div className="stack">
          <label className="field"><span className="field-label">Activity</span><select value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })}>{ACTIVITY_OPTIONS.map((a) => <option key={a}>{a}</option>)}</select></label>
          <label className="field"><span className="field-label">Cause</span><select value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })}>{LOSS_CAUSES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <div className="grid grid-2">
            <label className="field"><span className="field-label">Discipline</span><select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>{DISCIPLINES.map((d) => <option key={d}>{d}</option>)}</select></label>
            <label className="field"><span className="field-label">Contractor</span><select value={form.contractor} onChange={(e) => setForm({ ...form, contractor: e.target.value })}>{CONTRACTOR_NAMES.map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
          <label className="field"><span className="field-label">Man-hours lost</span><input type="number" min={1} max={2000} value={form.hours} onChange={(e) => setForm({ ...form, hours: Math.max(1, Number(e.target.value) || 1) })} /></label>
          <div className="grid grid-2">
            <label className="field"><span className="field-label">Equipment used again</span><select value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value as ReworkEquipment | 'None' })}><option>None</option>{REWORK_EQUIPMENT.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="field"><span className="field-label">Equipment hours{form.equipment !== 'None' && showCost ? ` (OMR ${EQUIPMENT_RATE[form.equipment]}/h)` : ''}</span><input type="number" min={0} max={2000} disabled={form.equipment === 'None'} value={form.equipment === 'None' ? 0 : form.equipHours} onChange={(e) => setForm({ ...form, equipHours: Math.max(0, Number(e.target.value) || 0) })} /></label>
          </div>
        </div>
      </Modal>

      <Modal open={report} onClose={() => setReport(false)} width={760} title="Re-work report" footer={<><button className="btn" onClick={() => setReport(false)}>Close</button><button className="btn btn-primary" onClick={() => window.print()}>Print / Save PDF</button></>}>
        <div>
          <div className="eyebrow">OQ · Sohar Refinery · STO 2026</div>
          <h3 style={{ fontSize: 22, margin: '4px 0 2px' }}>Re-work report to Day {lastDay}</h3>
          <div className="small muted">Generated {shortDate(dayToDate(lastDay))} 2026 <span className="sim-badge sim-simulated">Summary text generated from the data (simulated)</span></div>
          <p style={{ lineHeight: 1.6 }}>{summary}</p>
          {byEquip.length > 0 && (
            <table className="table dt-dense" style={{ marginBottom: 12 }}>
              <thead><tr><th>Equipment</th><th style={{ textAlign: 'right' }}>Events</th><th style={{ textAlign: 'right' }}>Equipment h</th><th style={{ textAlign: 'right' }}>Man-hours</th></tr></thead>
              <tbody>{byEquip.map((x) => <tr key={x.e}><td>{x.e}</td><td className="mono" style={{ textAlign: 'right' }}>{x.events}</td><td className="mono" style={{ textAlign: 'right' }}>{x.equipHours}</td><td className="mono" style={{ textAlign: 'right' }}>{x.manHours}</td></tr>)}</tbody>
            </table>
          )}
          <table className="table dt-dense">
            <thead><tr><th>Cause</th><th style={{ textAlign: 'right' }}>Events</th><th style={{ textAlign: 'right' }}>Hours</th><th style={{ textAlign: 'right' }}>Share</th></tr></thead>
            <tbody>{byCause.map((c) => <tr key={c.cause}><td>{c.cause}</td><td className="mono" style={{ textAlign: 'right' }}>{c.events}</td><td className="mono" style={{ textAlign: 'right' }}>{c.hours}</td><td className="mono" style={{ textAlign: 'right' }}>{Math.round((c.hours / Math.max(1, hours)) * 100)}%</td></tr>)}</tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
