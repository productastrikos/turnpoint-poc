import { useEffect, useState, type ComponentType } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Chip } from '../../components/ui/Chip';
import { ActionButton } from '../../components/ui/ActionButton';
import { CostValue } from '../../components/ui/CostValue';
import { SimBadge } from '../../components/ui/SimBadge';
import { LoadingState } from '../../components/ui/EmptyState';
import { LineChart } from '../../components/charts/LineChart';
import { BarChart } from '../../components/charts/BarChart';
import {
  attendanceRows,
  funnelTotal,
  getMobilisation,
  listEquipment,
  mobilizationSCurve,
  mobilizationWeeks,
  mobilizeCrew,
  mobilizeEquipment,
  readiness,
  resetWorkforce,
  shortfallAlerts,
  totals,
  type AttRow,
  type EquipRow,
  type MobilizeResult,
  type Readiness,
  type ShortfallAlert,
} from '../../services/workforceService';
import { CONTRACTORS, CONTRACTOR_NAMES } from '../../mocks/master';
import { useToast } from '../../app/ToastContext';
import { useWorkforce } from '../attendance/useWorkforce';

type Mob = Awaited<ReturnType<typeof getMobilisation>>;
const PHASES = { planning: { label: 'Planning (T-28 to T-14)', from: -28, to: -14 }, preta: { label: 'Pre-TA (T-14 to start)', from: -14, to: 0 }, execution: { label: 'Execution (D1 to D32)', from: 1, to: 32 } } as const;
const SHORT = (c: string) => c.replace('Sohar Industrial Services', 'Sohar Ind.').replace('Larsen & Toubro', 'L&T').replace('Petrofac Services', 'Petrofac');

// The tools stream (S5) publishes a small read-only widget with the faulty-tools list. It is picked up when that file exists
// and silently omitted otherwise, so this page never depends on it to compile or render.
type WidgetModule = { default?: ComponentType; FaultyToolsWidget?: ComponentType };
const widgetModules = import.meta.glob('../tools-tracking/FaultyToolsWidget.tsx', { eager: true }) as Record<string, WidgetModule>;
const first = Object.values(widgetModules)[0];
const FaultyToolsWidget: ComponentType | undefined = first?.FaultyToolsWidget ?? first?.default;

const dayLabel = (d: number) => (d < 1 ? `T${d - 1}` : `D${d}`);

export default function MobilizationPage() {
  const { showToast } = useToast();
  useWorkforce();
  const [mob, setMob] = useState<Mob | null>(null);
  const [phase, setPhase] = useState<keyof typeof PHASES>('execution');
  const [hist, setHist] = useState('labour');
  const [who, setWho] = useState('Galfar');
  const [crew, setCrew] = useState('20');
  const [last, setLast] = useState<MobilizeResult | null>(null);

  useEffect(() => {
    getMobilisation().then(setMob);
  }, []);

  if (!mob) return <div><PageHeader title="Contractor Mobilization" subtitle="" checklist="R4" /><LoadingState /></div>;

  // everything below reads the shared workforce store, so a swipe on the Attendance page shows here immediately
  const att = attendanceRows();
  const t = totals();
  const ready = readiness();
  const alerts = shortfallAlerts();
  const equipment = listEquipment();
  const fun = funnelTotal();
  const weeks = mobilizationWeeks();
  const scurve = mobilizationSCurve();
  const overall = Math.round(ready.reduce((s, r) => s + r.readiness, 0) / ready.length);
  const eqPlan = equipment.reduce((s, e) => s + e.plan, 0);
  const eqAct = equipment.reduce((s, e) => s + e.actual, 0);
  const ph = PHASES[phase];
  const series = mob.series.map((s) => (s.day === 14 ? { ...s, actual: t.actual } : s)).filter((s) => s.day >= ph.from && s.day <= ph.to);
  const planPeak = Math.max(...series.map((s) => s.plan));
  const critCount = alerts.filter((a) => a.severity === 'crit').length;

  function mobilize() {
    const r = mobilizeCrew(who, Number(crew));
    setLast(r);
    if (!r.added) {
      showToast(`${who} is already at the badge-in cap for both shifts: nothing more to mobilize.`, 'warn');
      return;
    }
    const cleared = r.clearedAlerts.length ? ` Shortfall alert cleared for ${who}.` : r.remainingGap ? ` ${r.remainingGap} heads still short.` : '';
    showToast(`${who} mobilized ${r.added} heads (${r.day} day, ${r.night} night). Mobilization readiness ${r.readinessBefore}% to ${r.readinessAfter}%. Attendance now shows ${totals().actual.toLocaleString()} on site.${cleared}`, 'good');
  }

  function arrive(e: EquipRow) {
    const r = mobilizeEquipment(e.id);
    if (r && r.added) showToast(`${r.added} x ${e.item.replace(/ \(.*\)/, '')} from ${e.contractor} arrived: ${r.item.actual} of ${r.item.plan} on site. Needed by ${e.p6Ids.join(', ')}.`, 'good');
  }

  function notify(a: ShortfallAlert) {
    showToast(`Shortfall notice sent to ${a.contractor}: ${a.title.split(': ')[1]}.${a.activity ? ` ${a.activity.p6Id} ${a.activity.name} is at risk.` : ''} Contractor must confirm a recovery plan (simulated message).`, 'accent');
  }

  function reset() {
    resetWorkforce();
    setLast(null);
    showToast('Mobilization and attendance demo data restored.', 'accent');
  }

  return (
    <div>
      <PageHeader
        title="Contractor Mobilization"
        subtitle="The mobilization plan against what is actually on site, for manpower (read from the attendance system, by contractor, shift and trade) and for equipment, through planning, Pre-TA and TA execution. Shortfalls name the P6 activity they put at risk."
        checklist="R4 · PBC 7"
        badges={['simulated']}
        action={<ActionButton onClick={reset}>Reset demo</ActionButton>}
      />

      <Card style={{ marginBottom: 16 }}>
        <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
          <span className="row-wrap">
            <strong style={{ fontSize: 13 }}>Demo: a contractor mobilizes</strong>
            <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Contractor">{CONTRACTOR_NAMES.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={crew} onChange={(e) => setCrew(e.target.value)} aria-label="Crew size"><option value="10">10 heads</option><option value="20">20 heads</option><option value="40">40 heads</option></select>
            <ActionButton variant="primary" onClick={mobilize}>Simulate contractor mobilizes crew</ActionButton>
          </span>
          {last && last.added > 0 && (
            <span className="row-wrap small" aria-live="polite">
              <Chip tone="good">{last.contractor} +{last.added} heads</Chip>
              <span>readiness <strong className="mono">{last.readinessBefore}% to {last.readinessAfter}%</strong></span>
              {last.clearedAlerts.length > 0 && <Chip tone="good">alert cleared</Chip>}
              <span className="muted">same numbers on Attendance</span>
            </span>
          )}
        </div>
      </Card>

      <div className="grid grid-5" style={{ marginBottom: 16 }}>
        <StatTile label="Manpower on site vs plan (D14)" value={`${t.actual.toLocaleString()} / ${t.plan.toLocaleString()}`} delta={`${((t.actual / t.plan) * 100).toFixed(1)}% · from attendance system`} tone={t.actual >= t.plan * 0.97 ? 'good' : 'warn'} />
        <StatTile label="Mobilization readiness" value={`${overall}%`} delta="manpower 50% · equipment 30% · cleared 20%" tone={overall >= 95 ? 'good' : overall >= 88 ? 'warn' : 'crit'} />
        <StatTile label="Equipment on site" value={`${eqAct} of ${eqPlan}`} delta={`${eqPlan - eqAct} units outstanding`} tone={eqAct >= eqPlan ? 'good' : 'warn'} />
        <StatTile label="Open shortfall alerts" value={String(alerts.length)} delta={critCount ? `${critCount} critical` : 'none critical'} tone={critCount ? 'crit' : alerts.length ? 'warn' : 'good'} />
        <StatTile label="Badged of submitted" value={`${fun.badged.toLocaleString()} / ${fun.submitted.toLocaleString()}`} delta={`${fun.blocked} not yet cleared · ${fun.awaiting} awaiting entry`} tone="accent" />
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Mobilization histogram: weekly average heads, Pre-TA weeks and TA" />
          <BarChart
            height={260}
            labels={weeks.map((w) => w.label)}
            series={[
              { name: 'Planned', color: 'var(--s6)', data: weeks.map((w) => w.plan) },
              { name: 'Actual (attendance)', color: 'var(--s1)', data: weeks.map((w) => w.actual ?? 0) },
            ]}
            yFormat={(v) => Math.round(v).toLocaleString()}
          />
          <p className="small muted" style={{ margin: '6px 0 0' }}>Four Pre-TA weeks (T-4w to T-1w), then TA weeks. Weeks after D14 have no actuals yet.</p>
        </Card>
        <Card>
          <CardHeader title="Mobilization S-curve: cumulative % of planned man-days" />
          <LineChart
            height={260}
            labels={scurve.map((s) => dayLabel(s.day))}
            xTickEvery={6}
            yMin={0}
            yMax={100}
            series={[
              { name: 'Planned', data: scurve.map((s) => s.plan), color: 'var(--ink-3)', dashed: true },
              { name: 'Actual', data: scurve.map((s) => s.actual), color: 'var(--accent)', area: true },
            ]}
            yFormat={(v) => `${Math.round(v)}%`}
            markers={[{ index: scurve.findIndex((s) => s.day === 14), label: 'Today' }]}
          />
        </Card>
      </div>

      <div className="grid grid-3-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <Card>
          <CardHeader title={`Shortfall alerts and the activities at risk (${alerts.length})`} />
          {alerts.length === 0 && <div className="empty-state">No open shortfalls: every contractor is at or above plan.</div>}
          <div style={{ maxHeight: 420, overflowY: 'auto' }} tabIndex={0} aria-label="Shortfall alerts (scrollable)">
            {alerts.map((a) => (
              <div key={a.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13 }}>
                  <Chip tone={a.severity}>{a.kind}</Chip> <strong>{a.title}</strong>
                  <div className="small muted">{a.detail}</div>
                  {a.activity ? (
                    <div className="small" style={{ marginTop: 3 }}>
                      At risk: <span className="tag-chip p6">{a.activity.p6Id}</span> {a.activity.name} · D{a.activity.startDay}-D{a.activity.endDay} · {a.activity.pct}% done{a.activity.cp ? ` · ${a.activity.cp}` : ''}
                    </div>
                  ) : null}
                  <div className="small muted" style={{ marginTop: 2 }}>
                    Impact: about {a.mhPerDay.toLocaleString()} man-hours/day not worked, est. +{a.slipDays} d on the activity if not recovered · <CostValue amount={a.costPerDayOMR} /> per day
                  </div>
                </span>
                <ActionButton onClick={() => notify(a)}>Notify contractor</ActionButton>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Mobilization readiness by contractor" />
          <DataTable
            dense
            rowKey={(r: Readiness) => r.contractor}
            rows={ready}
            initialSort={{ key: 'readiness', dir: 'asc' }}
            columns={[
              { key: 'contractor', header: 'Contractor', render: (r) => <div><strong>{SHORT(r.contractor)}</strong><div className="small muted">{r.gapHeads} heads short</div></div> },
              { key: 'manpowerPct', header: 'Manpower', mono: true, align: 'right', render: (r) => `${r.manpowerPct.toFixed(0)}%` },
              { key: 'equipmentPct', header: 'Equip.', mono: true, align: 'right', render: (r) => `${r.equipmentPct.toFixed(0)}%` },
              { key: 'clearedPct', header: 'Cleared', mono: true, align: 'right', render: (r) => `${r.clearedPct.toFixed(0)}%` },
              { key: 'readiness', header: 'Readiness', render: (r) => <ProgressBar value={r.readiness} tone={r.readiness >= 95 ? 'good' : r.readiness >= 90 ? 'warn' : 'crit'} />, sortValue: (r) => r.readiness },
            ]}
          />
          <p className="small muted" style={{ margin: '8px 0 0' }}>Readiness = 50% manpower on site vs plan today, 30% equipment on site vs plan, 20% of the submitted manpower list that is inducted and badged.</p>
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <Card>
          <CardHeader title="Manpower by contractor (today, from the attendance system)" />
          <DataTable
            dense
            rowKey={(r: AttRow) => r.contractor}
            rows={att}
            columns={[
              { key: 'contractor', header: 'Contractor', render: (r) => <div><strong>{r.contractor}</strong><div className="small muted">{CONTRACTORS.find((c) => c.name === r.contractor)?.scope}</div></div> },
              { key: 'plan', header: 'Plan', mono: true, align: 'right', render: (r) => (r.planDay + r.planNight).toLocaleString(), sortValue: (r) => r.planDay + r.planNight },
              { key: 'act', header: 'Actual', mono: true, align: 'right', render: (r) => (r.actDay + r.actNight).toLocaleString(), sortValue: (r) => r.actDay + r.actNight },
              { key: 'peak', header: 'Peak plan', mono: true, align: 'right' },
              { key: 'p', header: 'Of plan', render: (r) => <ProgressBar value={r.actDay + r.actNight} max={r.planDay + r.planNight} />, sortValue: (r) => (r.actDay + r.actNight) / (r.planDay + r.planNight) },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Equipment mobilization: planned vs on site" />
          <DataTable
            dense
            rowKey={(e: EquipRow) => e.id}
            rows={equipment}
            columns={[
              { key: 'item', header: 'Equipment', render: (e) => <div>{e.item}<div className="small muted">{e.contractor}</div></div> },
              { key: 'plan', header: 'Plan', mono: true, align: 'right' },
              { key: 'actual', header: 'On site', mono: true, align: 'right' },
              { key: 's', header: 'Status', render: (e) => <Chip tone={e.actual >= e.plan ? 'good' : e.actual >= e.plan * 0.9 ? 'warn' : 'crit'}>{e.actual >= e.plan ? 'complete' : `${e.plan - e.actual} short`}</Chip>, sortValue: (e) => e.plan - e.actual },
              { key: 'a', header: '', nosort: true, render: (e) => (e.actual < e.plan ? <ActionButton onClick={() => arrive(e)}>Simulate arrival</ActionButton> : null) },
            ]}
          />
        </Card>
      </div>

      {FaultyToolsWidget && (
        <div style={{ marginTop: 16 }}>
          <FaultyToolsWidget />
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 16 }}>
        <FilterChips options={(Object.keys(PHASES) as (keyof typeof PHASES)[]).map((k) => ({ value: k, label: PHASES[k].label }))} value={phase} onChange={(v) => setPhase(v as keyof typeof PHASES)} hideAll />
        <span className="small muted">Daily manpower and resource histogram <SimBadge kind="illustrative" title="History before today is generated from the plan; today follows the live attendance numbers." /></span>
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title={`Manpower plan vs actual · ${ph.label} (peak planned ${planPeak.toLocaleString()})`} />
          <LineChart
            height={250}
            labels={series.map((s) => dayLabel(s.day))}
            xTickEvery={Math.max(1, Math.ceil(series.length / 8))}
            yMin={0}
            series={[
              { name: 'Planned', data: series.map((s) => s.plan), color: 'var(--ink-3)', dashed: true },
              { name: 'Actual', data: series.map((s) => s.actual), color: 'var(--accent)' },
            ]}
            yFormat={(v) => Math.round(v).toLocaleString()}
            markers={phase === 'execution' ? [{ index: 13, label: 'Today' }] : []}
          />
        </Card>
        <Card>
          <CardHeader title="Resource histogram, D1 to D14" action={<FilterChips options={[{ value: 'labour' }, { value: 'equipment', label: 'non-labour' }]} value={hist} onChange={setHist} hideAll />} />
          <BarChart
            height={250}
            labels={mob.hist.map((h) => `D${h.day}`)}
            series={
              hist === 'equipment'
                ? [{ name: 'BLU (equipment days)', color: 'var(--s6)', data: mob.hist.map((h) => h.bluE) }, { name: 'ALU', color: 'var(--s1)', data: mob.hist.map((h) => h.aluE) }]
                : [{ name: 'BLU (labour hours)', color: 'var(--s6)', data: mob.hist.map((h) => h.bluH) }, { name: 'ALU (labour hours)', color: 'var(--s1)', data: mob.hist.map((h) => (h.day === 14 ? Math.round(t.actualMh) : h.aluH)) }]
            }
            yFormat={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))}
          />
        </Card>
      </div>
    </div>
  );
}
