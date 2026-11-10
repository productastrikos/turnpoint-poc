import { useMemo, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { DataTable } from '../../components/ui/DataTable';
import { BarChart } from '../../components/charts/BarChart';
import { CHAIN_NAMES, type CpDay, type DelayEvent, type Snapshot } from '../../services/criticalPathService';
import { dayToDate, shortDate } from '../../mocks/_gen';

function download(name: string, rows: Record<string, string | number>[]) {
  const head = Object.keys(rows[0] ?? {});
  const csv = [head.join(','), ...rows.map((r) => head.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** PBC 10: how many times the critical path changed, what changed and why, with a printable end-of-TA report. */
export function ChangeReport({ days, events, snap, showCost }: { days: CpDay[]; events: DelayEvent[]; snap: Snapshot; showCost: boolean }) {
  const [report, setReport] = useState(false);
  const total = days.reduce((s, d) => s + d.changes, 0);
  const today = days[days.length - 1];
  const worst = [...days].sort((a, b) => b.changes - a.changes)[0];
  const byActivity = useMemo(() => [...snap.rows].sort((a, b) => b.changeCount - a.changeCount).slice(0, 5), [snap]);
  const causes = useMemo(() => {
    const m = new Map<string, number>();
    events.filter((e) => e.kind === 'delay').forEach((e) => m.set(e.cause, (m.get(e.cause) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [events]);
  const delayCost = events.filter((e) => e.kind === 'delay').reduce((s, e) => s + e.costOMR, 0);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <StatTile label="Critical path changed" value={`${total}×`} tone="crit" delta={`in ${days.length} TA days`} />
        <StatTile label="Today (D14)" value={String(today?.changes ?? 0)} tone="warn" delta={events.length ? `${events.length} live events` : undefined} />
        <StatTile label="Busiest day" value={worst ? `D${worst.day}` : '—'} delta={worst ? `${worst.changes} changes` : undefined} />
        <StatTile label="Average per day" value={(total / Math.max(1, days.length)).toFixed(1)} />
      </div>

      <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Changes to the critical path per TA day" />
          <BarChart height={240} labels={days.map((d) => `D${d.day}`)} series={[{ name: 'Changes', color: 'var(--crit)', data: days.map((d) => d.changes) }]} />
        </Card>
        <Card>
          <CardHeader title="Most-changed activities" />
          {byActivity.map((a) => (
            <div key={a.id} className="list-row"><span>{a.name}<div className="small muted mono">{a.id} · {a.chain}</div></span><span className="mono" style={{ fontWeight: 700 }}>{a.changeCount}×</span></div>
          ))}
          {causes.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '12px 0 4px' }}>Causes raised in this session</div>
              {causes.map(([c, n]) => <div key={c} className="list-row small"><span>{c}</span><span className="mono">{n}×</span></div>)}
            </>
          )}
        </Card>
      </div>

      {events.length > 0 && (
        <Card>
          <CardHeader title="Live events: what changed and why" />
          <DataTable
            dense
            rowKey={(e: DelayEvent) => e.id}
            rows={events}
            columns={[
              { key: 'id', header: 'Event', mono: true },
              { key: 'what', header: 'What', render: (e) => <span>{e.kind === 'recovery' ? 'Recovery' : 'Delay'} on <span className="mono">{e.activityId}</span> {e.name} ({e.days > 0 ? '+' : ''}{e.days} d)<div className="small muted">{e.cause}</div></span> },
              { key: 'crit', header: 'Became critical', render: (e) => (e.newlyCritical.length ? e.newlyCritical.map((x) => <Chip key={x} tone="crit">{x}</Chip>) : <span className="muted">none</span>), nosort: true },
              { key: 'path', header: 'Driving path', render: (e) => <span className="small">{e.switched ? `${CHAIN_NAMES[e.pathBefore]} → ${CHAIN_NAMES[e.pathAfter]}` : CHAIN_NAMES[e.pathAfter]}</span>, nosort: true },
              { key: 'end', header: 'TA end', mono: true, render: (e) => `${shortDate(dayToDate(Math.round(e.endBefore)))} → ${shortDate(dayToDate(Math.round(e.endAfter)))}`, nosort: true },
              { key: 'counted', header: 'Counted', render: (e) => <Chip tone={e.countedChange ? 'crit' : 'neutral'}>{e.countedChange ? '+1 change' : 'no'}</Chip>, nosort: true },
              ...(showCost ? [{ key: 'cost', header: 'Cost (OMR)', mono: true, align: 'right' as const, render: (e: DelayEvent) => e.costOMR.toLocaleString(), sortValue: (e: DelayEvent) => e.costOMR }] : []),
            ]}
          />
        </Card>
      )}

      <Card>
        <CardHeader
          title="Daily change log"
          action={
            <div className="row no-print">
              <button className="btn btn-sm" onClick={() => download('critical_path_changes.csv', days.map((d) => ({ Day: d.day, Changes: d.changes, Note: d.note })))}>Export CSV</button>
              <button className="btn btn-primary btn-sm" onClick={() => setReport((r) => !r)}>{report ? 'Hide' : 'Generate'} end-of-TA report</button>
            </div>
          }
        />
        <DataTable
          dense
          rowKey={(d: CpDay) => String(d.day)}
          rows={[...days].reverse()}
          columns={[
            { key: 'day', header: 'TA day', mono: true, render: (d) => `D${d.day}`, sortValue: (d) => d.day },
            { key: 'changes', header: 'Changes', mono: true, align: 'right' },
            { key: 'note', header: 'What changed', render: (d) => d.note || <span className="muted">no structural change</span> },
          ]}
        />
        {report && (
          <div className="callout" style={{ marginTop: 14 }}>
            <div className="spread no-print" style={{ marginBottom: 6 }}><strong>End-of-TA report: critical path changes</strong><button className="btn btn-sm" onClick={() => window.print()}>Print / Save PDF</button></div>
            <p style={{ margin: '0 0 8px' }}>
              The critical path changed <strong>{total} times</strong> over {days.length} TA days (average {(total / days.length).toFixed(1)} per day). The busiest day was Day {worst?.day} with {worst?.changes} changes. The TA end is forecast for <strong>{shortDate(snap.endDate)}</strong>, {snap.slipDays > 0.01 ? `${snap.slipDays.toFixed(1)} days after` : 'in line with'} the plan ({shortDate(snap.planEndDate)}).
            </p>
            <p style={{ margin: '0 0 8px' }}>
              Main drivers: crane conflicts, discovery work on R-101 internals, scaffold access, tie-in spool rework{causes.length ? `, and in this session ${causes.map(([c]) => c.toLowerCase()).join(', ')}` : ''}. {snap.critCount} activities are critical now and {snap.nearCount} more are near-critical.{showCost && delayCost > 0 ? ` Delays raised in this session cost OMR ${delayCost.toLocaleString()}.` : ''}
            </p>
            <p className="small muted" style={{ margin: 0 }}>This section is also included in the Close-Out report.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
