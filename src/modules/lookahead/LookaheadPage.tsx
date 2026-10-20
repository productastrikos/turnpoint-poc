import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { Drawer } from '../../components/ui/Drawer';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Heatmap } from '../../components/charts/Heatmap';
import { IdChips } from '../_shared/IdChips';
import { TABS } from '../../app/tabRegistry';
import { scheduleActivities } from '../../mocks/scheduleMock';
import { nearCritical } from '../../mocks/criticalPathMock';
import { DISCIPLINES } from '../../mocks/master';
import { dayToDate, shortDate } from '../../mocks/_gen';
import { recalcRow } from '../../services/p6Service';
import { listWorkPacks } from '../../services/workPackService';
import type { ScheduleActivity } from '../../types/execution';
import type { WorkPack } from '../../mocks/workPackMock';

const DATA_DAY = 14;
const NEAR = new Set(nearCritical.map((n) => n.id));

interface Row extends ScheduleActivity {
  criticality: 'CP1' | 'CP2' | 'CP3' | 'Near-critical' | 'Non-critical';
  delayGain: number;
  ready: boolean | null;
}

export default function LookaheadPage() {
  const [tab, setTab] = useTabParam(TABS.lookahead, 'grid');
  const [weeks, setWeeks] = useState('2');
  const [packs, setPacks] = useState<WorkPack[]>([]);
  const [cell, setCell] = useState<{ disc: string; day: number } | null>(null);
  const [disc, setDisc] = useState('all');
  const [crit, setCrit] = useState('all');
  const [dg, setDg] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    listWorkPacks().then(setPacks);
  }, []);

  const from = DATA_DAY + 1;
  const to = DATA_DAY + Number(weeks) * 7;
  const rows: Row[] = useMemo(
    () =>
      scheduleActivities.map((a) => {
        const pack = packs.find((p) => p.jobId === a.jobId);
        const started = a.startDay <= DATA_DAY && a.pct > 0;
        return {
          ...a,
          criticality: a.cp ?? (NEAR.has(a.id) ? 'Near-critical' : 'Non-critical'),
          delayGain: started && a.pct < 100 ? recalcRow(a, a.pct).delayGain : 0,
          ready: a.startDay > DATA_DAY && a.startDay <= DATA_DAY + 4 ? (pack ? Object.values(pack.ready).every(Boolean) : null) : null,
        };
      }),
    [packs]
  );
  const win = rows.filter((a) => a.endDay >= from && a.startDay <= to);
  const days = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  const grid = DISCIPLINES.map((d) => days.map((day) => win.filter((a) => a.discipline === d && a.startDay <= day && a.endDay >= day).length));
  const mhGrid = DISCIPLINES.map((d) => days.map((day) => Math.round(win.filter((a) => a.discipline === d && a.startDay <= day && a.endDay >= day).reduce((s, a) => s + a.bluHours / (a.endDay - a.startDay + 1), 0))));
  const cellActs = cell ? win.filter((a) => a.discipline === cell.disc && a.startDay <= cell.day && a.endDay >= cell.day) : [];

  const startsSoon = win.filter((a) => a.startDay <= DATA_DAY + 3 && a.startDay > DATA_DAY);
  const notReady = startsSoon.filter((a) => a.ready === false);

  const shown = win.filter((a) => (disc === 'all' || a.discipline === disc) && (crit === 'all' || a.criticality === crit) && (dg === 'all' || (dg === 'delay' ? a.delayGain > 0 : dg === 'gain' ? a.delayGain < 0 : a.delayGain === 0)) && (!q || `${a.p6Id} ${a.name} ${a.area}`.toLowerCase().includes(q.toLowerCase())));

  const columns: Column<Row>[] = [
    { key: 'p6Id', header: 'Activity', render: (a) => <div><strong style={{ fontSize: 12.5 }}>{a.name}</strong><div><IdChips p6Id={a.p6Id} sapWo={a.sapWo} /></div></div>, sortValue: (a) => a.p6Id },
    { key: 'area', header: 'Area / asset', render: (a) => <span className="small">{a.area}</span> },
    { key: 'discipline', header: 'Discipline', render: (a) => <span className="small">{a.discipline}</span> },
    { key: 'contractor', header: 'Contractor', render: (a) => <span className="small">{a.contractor}</span> },
    { key: 'startDay', header: 'Start', mono: true, render: (a) => `D${a.startDay} · ${shortDate(dayToDate(a.startDay))}`, sortValue: (a) => a.startDay },
    { key: 'endDay', header: 'Finish', mono: true, render: (a) => `D${a.endDay} · ${shortDate(dayToDate(a.endDay))}`, sortValue: (a) => a.endDay },
    { key: 'pct', header: 'Progress', render: (a) => <ProgressBar value={a.pct} />, sortValue: (a) => a.pct },
    { key: 'criticality', header: 'Criticality', render: (a) => <Chip tone={a.criticality.startsWith('CP') ? 'crit' : a.criticality === 'Near-critical' ? 'warn' : 'neutral'}>{a.criticality}</Chip>, sortValue: (a) => a.criticality },
    { key: 'delayGain', header: 'Delay / gain', render: (a) => <Chip tone={a.delayGain > 0 ? 'crit' : a.delayGain < 0 ? 'good' : 'neutral'}>{a.delayGain > 0 ? `+${a.delayGain} d` : a.delayGain < 0 ? `${a.delayGain} d` : '0'}</Chip>, sortValue: (a) => a.delayGain },
    { key: 'ready', header: 'Ready to start', render: (a) => (a.ready === null ? <span className="muted small">n/a</span> : <Chip tone={a.ready ? 'good' : 'warn'}>{a.ready ? 'ready' : 'not ready'}</Chip>) },
  ];

  return (
    <div>
      <PageHeader
        title="Lookahead Plan"
        subtitle="The next two to four weeks of work by discipline and day, built from the same P6 activities used everywhere else. Spot overloaded days, work that is not ready to start, and activities slipping."
        checklist="R3 · SOW dry run 31"
        action={<FilterChips options={[{ value: '2', label: '2 weeks' }, { value: '3', label: '3 weeks' }, { value: '4', label: '4 weeks' }]} value={weeks} onChange={setWeeks} hideAll />}
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'grid', label: 'Day × discipline grid' }, { id: 'activities', label: 'Activities (filter & sort)', badge: win.length }]} />

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatTile label="Activities in window" value={String(win.length)} delta={`D${from} to D${to} · ${shortDate(dayToDate(from))} to ${shortDate(dayToDate(to))}`} />
        <StatTile label="Planned man-hours" value={win.reduce((s, a) => s + Math.round(a.bluHours * ((Math.min(a.endDay, to) - Math.max(a.startDay, from) + 1) / (a.endDay - a.startDay + 1))), 0).toLocaleString()} />
        <StatTile label="Starting in next 3 days" value={String(startsSoon.length)} tone="accent" />
        <StatTile label="Not ready to start" value={String(notReady.length)} tone={notReady.length ? 'crit' : 'good'} delta="work pack incomplete" />
      </div>

      {tab === 'grid' && (
        <div className="stack" style={{ gap: 16 }}>
          <Card>
            <CardHeader title="Activities active per day, by discipline" action={<span className="small muted">Colour = planned man-hours per day. Click a cell for the activities.</span>} />
            <div style={{ overflowX: 'auto' }}>
              <Heatmap
                rows={DISCIPLINES}
                cols={days.map((d) => `D${d}`)}
                values={grid.map((r) => r.map((v) => (v === 0 ? null : v)))}
                intensity={mhGrid}
                max={Math.max(...mhGrid.flat(), 1)}
                mode="load"
                format={(v) => String(v)}
                onCellClick={(r, c) => setCell({ disc: r, day: Number(c.slice(1)) })}
                rowLabelWidth={130}
                cellMin={days.length > 21 ? 26 : 34}
              />
            </div>
            <p className="small muted" style={{ margin: '10px 0 0' }}>Numbers are activities running that day. Darker cells carry more labour hours.</p>
          </Card>
          <Card>
            <CardHeader title="Work starting in the next three days" />
            {startsSoon.length === 0 && <p className="small muted">Nothing starts in the next three days.</p>}
            {startsSoon.map((a) => (
              <div key={a.id} className="list-row">
                <div><strong style={{ fontSize: 13 }}>{a.name}</strong><div className="small muted">{a.contractor} · starts D{a.startDay}</div><IdChips p6Id={a.p6Id} sapWo={a.sapWo} /></div>
                <Chip tone={a.ready === false ? 'crit' : 'good'}>{a.ready === false ? 'work pack not ready' : 'ready'}</Chip>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'activities' && (
        <Card>
          <div className="toolbar">
            <input type="text" placeholder="Search P6 ID, name, area" value={q} onChange={(e) => setQ(e.target.value)} />
            <FilterChips options={[...DISCIPLINES].map((d) => ({ value: d }))} value={disc} onChange={setDisc} allLabel="All disciplines" />
            <FilterChips options={['CP1', 'CP2', 'CP3', 'Near-critical', 'Non-critical'].map((v) => ({ value: v }))} value={crit} onChange={setCrit} allLabel="Any criticality" />
            <FilterChips options={[{ value: 'delay', label: 'Delayed' }, { value: 'gain', label: 'Gaining' }, { value: 'plan', label: 'On plan' }]} value={dg} onChange={setDg} allLabel="Delay / gain" />
          </div>
          <DataTable columns={columns} rows={shown} rowKey={(a) => a.id} dense pageSize={12} initialSort={{ key: 'startDay', dir: 'asc' }} />
        </Card>
      )}

      <Drawer open={Boolean(cell)} onClose={() => setCell(null)} title={cell ? `${cell.disc} · Day ${cell.day}` : ''} subtitle={cell ? shortDate(dayToDate(cell.day)) : ''}>
        <DataTable columns={columns.slice(0, 1).concat(columns.slice(4, 7))} rows={cellActs} rowKey={(a) => a.id} dense />
      </Drawer>
    </div>
  );
}
