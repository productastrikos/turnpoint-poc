import { useSyncExternalStore } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { StatTile } from '../../components/ui/StatTile';
import { LineChart } from '../../components/charts/LineChart';
import { BarChart } from '../../components/charts/BarChart';
import { HSE_DAY, HSE_WEIGHTS, type HseScore } from '../../services/hseService';
import { getMobileState, subscribeMobile } from '../../services/mobileService';
import { dayToDate, shortDate, stamp } from '../../mocks/_gen';

const tone = (v: number) => (v >= 90 ? 'good' : v >= 80 ? 'warn' : 'crit');
const f1 = (n: number) => n.toFixed(1);

/** Compliance calendar: one cell per contractor per TA day, green when the toolbox talk was held, red when missed. */
function ComplianceCalendar({ scores }: { scores: HseScore[] }) {
  const days = Array.from({ length: HSE_DAY }, (_, i) => i + 1);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `150px repeat(${HSE_DAY}, minmax(26px, 1fr))`, gap: 3, alignItems: 'center' }}>
        <div />
        {days.map((d) => (
          <div key={d} className="small muted mono" style={{ textAlign: 'center', fontSize: 10.5, fontWeight: d === HSE_DAY ? 700 : 400 }} title={`Day ${d}, ${shortDate(dayToDate(d))}`}>
            {d}
          </div>
        ))}
        {scores.map((s) => (
          <div key={s.contractor} style={{ display: 'contents' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{s.contractor.length > 20 ? `${s.contractor.slice(0, 19)}…` : s.contractor}</div>
            {s.calendar.map((c, i) => {
              const bg = c.state === 'done' ? (c.attendancePct! >= 85 ? 'var(--good)' : 'var(--warn)') : c.state === 'missed' ? 'var(--crit)' : 'transparent';
              const title = c.state === 'done' ? `${s.contractor}, Day ${i + 1}: ${c.topic}, ${c.attendees} of ${c.expected} attended (${c.attendancePct}%)` : c.state === 'missed' ? `${s.contractor}, Day ${i + 1}: toolbox talk MISSED` : `${s.contractor}, Day ${i + 1}: not entered yet`;
              return (
                <div
                  key={i}
                  title={title}
                  style={{ height: 26, borderRadius: 4, background: bg, opacity: c.state === 'done' ? 0.8 : 1, border: c.state === 'pending' ? '2px dashed var(--warn)' : 'none', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {c.state === 'missed' ? '×' : ''}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="row-wrap small muted" style={{ marginTop: 10, gap: 14 }}>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--good)', opacity: 0.8, borderRadius: 2 }} /> held, attendance 85% or more</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--warn)', opacity: 0.8, borderRadius: 2 }} /> held, low attendance</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--crit)', borderRadius: 2 }} /> missed</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, border: '2px dashed var(--warn)', borderRadius: 2 }} /> today, not entered yet (counts as missed until the supervisor submits)</span>
      </div>
    </div>
  );
}

export function HseSection({ scores, scoreDelta }: { scores: HseScore[]; scoreDelta?: Record<string, number> }) {
  const m = useSyncExternalStore(subscribeMobile, getMobileState, getMobileState);
  const waiting = m.queue.filter((q) => q.kind === 'hse' && q.status !== 'synced').length;
  const avg = (f: (s: HseScore) => number) => scores.reduce((t, s) => t + f(s), 0) / Math.max(1, scores.length);
  const labels = Array.from({ length: HSE_DAY }, (_, i) => `D${i + 1}`);
  const colors = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
  const latest = scores.flatMap((s) => (s.last ? [{ c: s.contractor, ...s.last }] : [])).sort((a, b) => b.at.localeCompare(a.at))[0];

  return (
    <div style={{ marginTop: 28 }}>
      <div className="spread" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>HSE compliance from the field</h2>
          <p className="small muted" style={{ margin: '4px 0 0', maxWidth: 760 }}>
            Typed by each contractor's supervisor in the Mobile Field App (HSE tab): toolbox talk, housekeeping inspection, permit-to-work and PPE checks, observations. Weights inside the HSE score: toolbox talks {HSE_WEIGHTS.tbt * 100}%, housekeeping {HSE_WEIGHTS.housekeeping * 100}%, permits {HSE_WEIGHTS.permit * 100}%, PPE {HSE_WEIGHTS.ppe * 100}%, observation closure {HSE_WEIGHTS.obs * 100}%.
          </p>
        </div>
        {latest && <Chip tone="accent">Last entry: {latest.c}, from mobile, {stamp(latest.at)}</Chip>}
      </div>

      {waiting > 0 && (
        <div className="card card-pad" style={{ borderColor: 'var(--warn)', background: 'var(--warn-soft)', marginBottom: 12, fontSize: 13 }}>
          <strong>{waiting} HSE entr{waiting > 1 ? 'ies' : 'y'} recorded on a supervisor's phone, waiting for signal.</strong> The scorecard updates when the phone syncs.
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatTile label="Toolbox talks held" value={`${scores.reduce((t, s) => t + s.tbtDone, 0)} of ${scores.length * HSE_DAY}`} tone="neutral" delta="contractor-days, Day 1 to 14" />
        <StatTile label="Toolbox attendance" value={`${f1(avg((s) => s.attendancePct))}%`} tone={tone(avg((s) => s.attendancePct))} delta="of crew on shift" />
        <StatTile label="Permit compliance" value={`${f1(avg((s) => s.permitPct))}%`} tone={tone(avg((s) => s.permitPct))} delta="permits audited in the field" />
        <StatTile label="PPE compliance" value={`${f1(avg((s) => s.ppePct))}%`} tone={tone(avg((s) => s.ppePct))} delta="workers sampled" />
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start', marginBottom: 16 }}>
        <Card>
          <CardHeader title="Toolbox talk compliance calendar" />
          <ComplianceCalendar scores={scores} />
        </Card>
        <Card>
          <CardHeader title="Housekeeping inspection score by day" />
          <LineChart labels={labels} height={250} yMin={50} yMax={100} series={scores.map((s, i) => ({ name: s.contractor.split(' ')[0], color: colors[i % colors.length], data: s.hkTrend }))} />
          <p className="small muted" style={{ margin: '6px 0 0' }}>Gaps are days without an inspection.</p>
        </Card>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="HSE observations: open vs closed" />
          <BarChart height={230} stacked labels={scores.map((s) => s.contractor.split(' ')[0])} series={[{ name: 'Closed', color: 'var(--good)', data: scores.map((s) => s.obsClosed) }, { name: 'Open', color: 'var(--crit)', data: scores.map((s) => s.obsOpen) }]} />
        </Card>
        <Card>
          <CardHeader title="HSE compliance score" />
          <BarChart height={230} labels={scores.map((s) => s.contractor.split(' ')[0])} yMax={100} refLine={{ value: 90, label: 'target 90' }} series={[{ name: 'HSE compliance', color: 'var(--accent)', data: scores.map((s) => s.composite) }]} />
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <CardHeader title="HSE compliance detail" />
        <DataTable
          dense
          rowKey={(s: HseScore) => s.contractor}
          rows={scores}
          columns={[
            { key: 'contractor', header: 'Contractor', render: (s) => <strong>{s.contractor}</strong> },
            { key: 'tbt', header: 'Toolbox talks', mono: true, align: 'right', sortValue: (s) => s.tbtDone, render: (s) => <span style={{ color: s.tbtDone < s.tbtRequired - 2 ? 'var(--crit)' : undefined }}>{s.tbtDone} of {s.tbtRequired}</span> },
            { key: 'att', header: 'Attendance', mono: true, align: 'right', sortValue: (s) => s.attendancePct, render: (s) => `${f1(s.attendancePct)}%` },
            { key: 'hk', header: 'Housekeeping avg', mono: true, align: 'right', sortValue: (s) => s.hkAvg, render: (s) => `${f1(s.hkAvg)} (${s.hkDays}d)` },
            { key: 'permit', header: 'Permit compliance', mono: true, align: 'right', sortValue: (s) => s.permitPct, render: (s) => `${f1(s.permitPct)}%` },
            { key: 'ppe', header: 'PPE compliance', mono: true, align: 'right', sortValue: (s) => s.ppePct, render: (s) => `${f1(s.ppePct)}%` },
            { key: 'obs', header: 'Observations', mono: true, align: 'right', sortValue: (s) => s.obsOpen, render: (s) => `${s.obsOpen} open / ${s.obsClosed} closed` },
            {
              key: 'composite',
              header: 'HSE score',
              sortValue: (s) => s.composite,
              render: (s) => (
                <span>
                  <Chip tone={tone(s.composite)}>{f1(s.composite)}</Chip>
                  {scoreDelta?.[s.contractor] ? <span className="small" style={{ color: scoreDelta[s.contractor] > 0 ? 'var(--good)' : 'var(--crit)', marginLeft: 6 }}>{scoreDelta[s.contractor] > 0 ? '+' : ''}{f1(scoreDelta[s.contractor])}</span> : null}
                </span>
              ),
            },
            { key: 'last', header: 'Last entered by', sortValue: (s) => s.last?.at ?? '', render: (s) => (s.last ? <div><span className="small">{s.last.by}</span><div className="small muted">{s.last.source === 'seed' ? 'Office' : 'From mobile'} · {stamp(s.last.at)}</div></div> : <span className="small muted">no entries</span>) },
          ]}
        />
      </Card>
    </div>
  );
}
