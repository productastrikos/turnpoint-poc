import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Chip } from '../../components/ui/Chip';
import { LoadingState } from '../../components/ui/EmptyState';
import { LineChart } from '../../components/charts/LineChart';
import { BarChart } from '../../components/charts/BarChart';
import { EQUIPMENT_PLAN, getAttendance, getMobilisation, type AttRow } from '../../services/workforceService';
import { CONTRACTORS } from '../../mocks/master';

type Mob = Awaited<ReturnType<typeof getMobilisation>>;
const PHASES = { planning: { label: 'Planning (T-28 to T-14)', from: -28, to: -14 }, preta: { label: 'Pre-TA (T-14 to start)', from: -14, to: 0 }, execution: { label: 'Execution (D1 to D32)', from: 1, to: 32 } } as const;

export default function MobilizationPage() {
  const [mob, setMob] = useState<Mob | null>(null);
  const [att, setAtt] = useState<AttRow[]>([]);
  const [phase, setPhase] = useState<keyof typeof PHASES>('execution');
  const [hist, setHist] = useState('labour');

  useEffect(() => {
    getMobilisation().then(setMob);
    getAttendance().then((a) => setAtt(a.rows));
  }, []);

  if (!mob) return <div><PageHeader title="Contractor Mobilization" subtitle="" checklist="R4" /><LoadingState /></div>;
  const ph = PHASES[phase];
  const series = mob.series.filter((s) => s.day >= ph.from && s.day <= ph.to);
  const planPeak = Math.max(...series.map((s) => s.plan));

  return (
    <div>
      <PageHeader
        title="Contractor Mobilization"
        subtitle="Resources and equipment each contractor planned to mobilise against what is actually on site, through planning, pre-TA and execution. The resource histogram compares budgeted labour units (BLU) with actual (ALU) day by day."
        checklist="R4"
      />
      <div className="toolbar">
        <FilterChips options={(Object.keys(PHASES) as (keyof typeof PHASES)[]).map((k) => ({ value: k, label: PHASES[k].label }))} value={phase} onChange={(v) => setPhase(v as keyof typeof PHASES)} hideAll />
      </div>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatTile label="Peak planned in window" value={planPeak.toLocaleString()} delta="heads" />
        <StatTile label="Planned today (D14)" value={att.reduce((s, r) => s + r.planDay + r.planNight, 0).toLocaleString()} />
        <StatTile label="Actual today (D14)" value={att.reduce((s, r) => s + r.actDay + r.actNight, 0).toLocaleString()} tone="warn" />
        <StatTile label="Equipment on site" value={`${EQUIPMENT_PLAN.reduce((s, e) => s + e.actual, 0)} of ${EQUIPMENT_PLAN.reduce((s, e) => s + e.plan, 0)}`} tone="good" />
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title={`Manpower plan vs actual · ${ph.label}`} />
          <LineChart
            height={250}
            labels={series.map((s) => (s.day < 1 ? `T${s.day - 1}` : `D${s.day}`))}
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
                : [{ name: 'BLU (labour hours)', color: 'var(--s6)', data: mob.hist.map((h) => h.bluH) }, { name: 'ALU (labour hours)', color: 'var(--s1)', data: mob.hist.map((h) => h.aluH) }]
            }
            yFormat={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))}
          />
        </Card>
      </div>
      <div className="grid grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <Card>
          <CardHeader title="Manpower by contractor (today)" />
          <DataTable
            dense
            rowKey={(r: AttRow) => r.contractor}
            rows={att}
            columns={[
              { key: 'contractor', header: 'Contractor', render: (r) => <div><strong>{r.contractor}</strong><div className="small muted">{CONTRACTORS.find((c) => c.name === r.contractor)?.scope}</div></div> },
              { key: 'plan', header: 'Plan', mono: true, align: 'right', render: (r) => (r.planDay + r.planNight).toLocaleString(), sortValue: (r) => r.planDay + r.planNight },
              { key: 'act', header: 'Actual', mono: true, align: 'right', render: (r) => (r.actDay + r.actNight).toLocaleString(), sortValue: (r) => r.actDay + r.actNight },
              { key: 'peak', header: 'Peak plan', mono: true, align: 'right' },
              { key: 'p', header: 'Of plan', render: (r) => <ProgressBar value={r.actDay + r.actNight} max={r.planDay + r.planNight} /> },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Equipment mobilisation: planned vs on site" />
          <DataTable
            dense
            rowKey={(e) => e.contractor + e.item}
            rows={EQUIPMENT_PLAN}
            columns={[
              { key: 'item', header: 'Equipment', render: (e) => <div>{e.item}<div className="small muted">{e.contractor}</div></div> },
              { key: 'plan', header: 'Plan', mono: true, align: 'right' },
              { key: 'actual', header: 'On site', mono: true, align: 'right' },
              { key: 's', header: 'Status', render: (e) => <Chip tone={e.actual >= e.plan ? 'good' : e.actual >= e.plan * 0.9 ? 'warn' : 'crit'}>{e.actual >= e.plan ? 'complete' : `${e.plan - e.actual} short`}</Chip>, sortValue: (e) => e.plan - e.actual },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
