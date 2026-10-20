import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ActionButton } from '../../components/ui/ActionButton';
import { LoadingState } from '../../components/ui/EmptyState';
import { BarChart } from '../../components/charts/BarChart';
import { LineChart } from '../../components/charts/LineChart';
import { checkIn, getAttendance, manpowerSeries, type AttRow, type CheckIn } from '../../services/workforceService';
import { CONTRACTOR_NAMES } from '../../mocks/master';
import { useToast } from '../../app/ToastContext';

type Data = Awaited<ReturnType<typeof getAttendance>>;

export default function AttendancePage() {
  const { showToast } = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [who, setWho] = useState(CONTRACTOR_NAMES[0]);
  const [shift, setShift] = useState<'Day' | 'Night'>('Day');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => getAttendance().then(setD), []);
  useEffect(() => {
    load();
  }, [load]);

  if (!d) return <div><PageHeader title="Attendance & Manpower" subtitle="" checklist="G7" /><LoadingState /></div>;
  const t = d.totals;
  const pct = (a: number, b: number) => `${((a / b) * 100).toFixed(1)}%`;
  const series = manpowerSeries().filter((s) => s.day >= 1 && s.day <= 14);

  async function simulate() {
    setBusy(true);
    const made = await checkIn(who, shift, 6);
    await load();
    setBusy(false);
    showToast(`${made.length} badge check-ins from ${who} (${shift} shift). Actual manpower and today's man-hours updated.`, 'good');
  }

  return (
    <div>
      <PageHeader
        title="Attendance & Manpower"
        subtitle="Actual manpower that reports to the turnaround every day in both shifts, compared with plan, by contractor and shift. The same numbers feed the Daily Newsletter and the Command Dashboard."
        checklist="G7"
      />
      <div className="grid grid-5" style={{ marginBottom: 16 }}>
        <StatTile label="Day shift on site" value={t.actDay.toLocaleString()} delta={`plan ${t.planDay.toLocaleString()} · ${pct(t.actDay, t.planDay)}`} tone="warn" trend="down" />
        <StatTile label="Night shift on site" value={t.actNight.toLocaleString()} delta={`plan ${t.planNight.toLocaleString()} · ${pct(t.actNight, t.planNight)}`} tone="warn" trend="down" />
        <StatTile label="Total on site" value={(t.actual).toLocaleString()} delta={`plan ${t.plan.toLocaleString()}`} />
        <StatTile label="Man-hours today (actual)" value={t.actualMh.toLocaleString()} delta={`plan ${t.planMh.toLocaleString()}`} tone="warn" />
        <StatTile label="Shortfall" value={(t.plan - t.actual).toLocaleString()} delta="heads vs plan" tone="crit" />
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Plan vs actual by contractor and shift" />
          <BarChart
            height={260}
            labels={d.rows.map((r) => r.contractor.replace('Sohar Industrial Services', 'Sohar Ind.').replace('Larsen & Toubro', 'L&T').replace('Petrofac Services', 'Petrofac'))}
            series={[
              { name: 'Day plan', color: 'var(--s6)', data: d.rows.map((r) => r.planDay) },
              { name: 'Day actual', color: 'var(--s1)', data: d.rows.map((r) => r.actDay) },
              { name: 'Night plan', color: 'var(--s7)', data: d.rows.map((r) => r.planNight) },
              { name: 'Night actual', color: 'var(--s4)', data: d.rows.map((r) => r.actNight) },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Total manpower, TA days 1 to 14" />
          <LineChart
            height={260}
            labels={series.map((s) => `D${s.day}`)}
            xTickEvery={2}
            series={[
              { name: 'Planned', data: series.map((s) => s.plan), color: 'var(--ink-3)', dashed: true },
              { name: 'Actual', data: series.map((s) => s.actual), color: 'var(--accent)' },
            ]}
            yMin={0}
            yFormat={(v) => Math.round(v).toLocaleString()}
          />
        </Card>
      </div>

      <div className="grid grid-3-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <Card>
          <CardHeader title="By contractor" />
          <DataTable
            dense
            rowKey={(r: AttRow) => r.contractor}
            rows={d.rows}
            columns={[
              { key: 'contractor', header: 'Contractor', render: (r) => <div><strong>{r.contractor}</strong><div className="small muted">{r.discipline}</div></div> },
              { key: 'day', header: 'Day (act / plan)', mono: true, render: (r) => `${r.actDay} / ${r.planDay}`, sortValue: (r) => r.actDay },
              { key: 'night', header: 'Night (act / plan)', mono: true, render: (r) => `${r.actNight} / ${r.planNight}`, sortValue: (r) => r.actNight },
              { key: 'att', header: 'Attendance', render: (r) => <ProgressBar value={r.actDay + r.actNight} max={r.planDay + r.planNight} />, sortValue: (r) => (r.actDay + r.actNight) / (r.planDay + r.planNight) },
              { key: 'var', header: 'Variance', mono: true, align: 'right', render: (r) => { const v = r.actDay + r.actNight - (r.planDay + r.planNight); return <span style={{ color: v < -20 ? 'var(--crit)' : v < 0 ? 'var(--warn)' : 'var(--good)' }}>{v}</span>; }, sortValue: (r) => r.actDay + r.actNight - (r.planDay + r.planNight) },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Gate check-ins (simulated)" />
          <div className="row-wrap" style={{ marginBottom: 10 }}>
            <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Contractor">{CONTRACTOR_NAMES.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={shift} onChange={(e) => setShift(e.target.value as 'Day' | 'Night')} aria-label="Shift"><option>Day</option><option>Night</option></select>
            <ActionButton variant="primary" busy={busy} onClick={simulate}>Simulate 6 check-ins</ActionButton>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px' }} tabIndex={0} aria-label="Recent gate check-ins (scrollable)">
            {d.feed.map((f: CheckIn, i) => (
              <div key={i} className="list-row">
                <span style={{ fontSize: 12.5 }}>{f.who}<div className="small muted">{f.contractor} · {f.gate}</div></span>
                <span className="row"><Chip tone={f.shift === 'Night' ? 'accent' : 'neutral'}>{f.shift}</Chip><span className="mono small muted">{f.at}</span></span>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>The real feed comes from the site access-control (badge) system. Contractors reconcile their daily list against it.</p>
        </Card>
      </div>
    </div>
  );
}
