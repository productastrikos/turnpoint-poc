import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { Gantt, type GanttRow } from '../../components/charts/Gantt';
import { LineChart } from '../../components/charts/LineChart';
import { TABS } from '../../app/tabRegistry';
import { LOAD_TARGET_USERS, SLA_MS, loadSeries, loadTransactions, roadmap, roadmapMilestones } from '../../mocks/platformMock';
import { useToast } from '../../app/ToastContext';
import { shortDate } from '../../mocks/_gen';

const COLOR = { platform: 'var(--accent)', integration: 'var(--s4)', ta: 'var(--crit)' } as const;
const SERIES = loadSeries();

function Roadmap() {
  const rows: GanttRow[] = roadmap.map((p) => ({ id: p.id, label: p.name, start: p.start, end: p.end, color: COLOR[p.kind], tag: p.kind === 'ta' ? 'TA' : undefined }));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <StatTile label="Programme" value="26 months" delta="Nov 2026 to Dec 2028" />
        <StatTile label="Turnarounds covered" value="2" delta="TA-2027 pilot, STO-2028 roll-out" tone="accent" />
        <StatTile label="Dry run (SOW 16)" value="Sep 2027" delta="34 scenarios" />
        <StatTile label="Go-live" value="Oct 2027" delta="pilot on TA-2027" tone="good" />
      </div>
      <Card>
        <CardHeader
          title="Implementation plan to 2028, aligned with the upcoming turnarounds"
          action={
            <div className="chart-legend" style={{ margin: 0 }}>
              <span><i style={{ background: COLOR.platform }} />Platform</span>
              <span><i style={{ background: COLOR.integration }} />Integration</span>
              <span><i style={{ background: COLOR.ta }} />Turnaround event</span>
            </div>
          }
        />
        <Gantt rows={rows} from="2026-10-01" to="2029-01-15" milestones={roadmapMilestones.map((m) => ({ ...m, color: 'var(--warn)' }))} tickMode="month" rowHeight={28} labelWidth={270} />
        <div className="chart-legend" style={{ marginTop: 8 }}>
          {roadmapMilestones.map((m) => (
            <span key={m.label}><i style={{ background: 'var(--warn)', width: 8, height: 8, transform: 'rotate(45deg)' }} />{m.label} · {shortDate(m.date)} {m.date.slice(0, 4)}</span>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="Phases and deliverables" />
        <DataTable
          dense
          rowKey={(p) => p.id}
          rows={roadmap}
          columns={[
            { key: 'id', header: 'Phase', mono: true },
            { key: 'name', header: 'Name', render: (p) => <strong>{p.name}</strong> },
            { key: 'start', header: 'Start', mono: true, render: (p) => `${shortDate(p.start)} ${p.start.slice(2, 4)}` },
            { key: 'end', header: 'End', mono: true, render: (p) => `${shortDate(p.end)} ${p.end.slice(2, 4)}` },
            { key: 'kind', header: 'Type', render: (p) => <Chip tone={p.kind === 'ta' ? 'crit' : p.kind === 'integration' ? 'accent' : 'neutral'}>{p.kind}</Chip> },
            { key: 'deliverable', header: 'Key deliverable', render: (p) => <span className="small">{p.deliverable}</span> },
          ]}
        />
      </Card>
    </div>
  );
}

function Performance() {
  const { showToast } = useToast();
  const [upTo, setUpTo] = useState(SERIES.length - 1);
  const [running, setRunning] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
    },
    []
  );

  function run() {
    setRunning(true);
    setUpTo(0);
    let i = 0;
    timer.current = window.setInterval(() => {
      i += 1;
      setUpTo(i);
      if (i >= SERIES.length - 1) {
        if (timer.current) window.clearInterval(timer.current);
        setRunning(false);
        showToast('Illustrative load test complete: 1,640 concurrent users, p95 within 1 s. p99 outliers are listed for tuning. Not a measured result.', 'accent');
      }
    }, 90);
  }

  const shown = SERIES.slice(0, upTo + 1);
  const peak = shown.reduce((m, p) => (p.users > m.users ? p : m), shown[0]);
  const worstP95 = Math.max(...shown.map((p) => p.p95));
  const pad = <T,>(arr: T[]): (T | null)[] => [...arr, ...Array(SERIES.length - arr.length).fill(null)];
  const pass = peak.users >= LOAD_TARGET_USERS && worstP95 <= SLA_MS;
  const p99Over = loadTransactions.filter((x) => x.p99 > SLA_MS).length;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="callout callout-warn">
        <strong>Illustrative evidence, not a measured test.</strong> Real load-test evidence will be produced on a production-like environment during the UAT phase of the roadmap. This page shows the report format and the pass / fail logic against the SLAs.
      </div>
      <div className="grid grid-5">
        <StatTile label="Peak concurrent users" value={peak.users.toLocaleString()} tone={peak.users >= LOAD_TARGET_USERS ? 'good' : 'warn'} delta={`target ${LOAD_TARGET_USERS.toLocaleString()}+`} />
        <StatTile label="p95 response" value={`${worstP95} ms`} tone={worstP95 <= SLA_MS ? 'good' : 'crit'} delta={`SLA ≤ ${SLA_MS} ms`} />
        <StatTile label="p50 response" value={`${Math.max(...shown.map((p) => p.p50))} ms`} tone="good" />
        <StatTile label="Error rate (max)" value={`${Math.max(...shown.map((p) => p.errPct)).toFixed(2)}%`} tone="good" delta="SLA < 0.5%" />
        <StatTile label="Verdict" value={pass ? 'PASS on p95' : running ? 'running…' : 'FAIL'} tone={pass ? 'good' : 'warn'} delta={pass && p99Over > 0 ? `p99 over 1 s on ${p99Over} transactions` : 'against SLAs (illustrative)'} />
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Concurrent users ramp" action={<ActionButton variant="primary" busy={running} onClick={run}>Run illustrative test</ActionButton>} />
          <LineChart height={240} labels={SERIES.map((p) => `${p.minute}m`)} xTickEvery={5} yMax={1800} series={[{ name: 'Concurrent users', data: pad(shown.map((p) => p.users)), color: 'var(--accent)', area: true }]} yFormat={(v) => Math.round(v).toLocaleString()} markers={[]} />
        </Card>
        <Card>
          <CardHeader title="Response time vs the 1-second SLA" />
          <LineChart
            height={240}
            labels={SERIES.map((p) => `${p.minute}m`)}
            xTickEvery={5}
            yMax={1500}
            series={[
              { name: 'p50', data: pad(shown.map((p) => p.p50)), color: 'var(--s3)' },
              { name: 'p95', data: pad(shown.map((p) => p.p95)), color: 'var(--s2)' },
              { name: 'p99', data: pad(shown.map((p) => p.p99)), color: 'var(--s5)' },
              { name: 'SLA 1,000 ms', data: SERIES.map(() => SLA_MS), color: 'var(--crit)', dashed: true, width: 1.4 },
            ]}
            yFormat={(v) => `${Math.round(v)}`}
          />
        </Card>
      </div>
      <Card>
        <CardHeader title="By transaction at peak load" />
        <DataTable
          dense
          rowKey={(t) => t.name}
          rows={loadTransactions}
          columns={[
            { key: 'name', header: 'Transaction', render: (t) => <strong>{t.name}</strong> },
            { key: 'p50', header: 'p50 (ms)', mono: true, align: 'right' },
            { key: 'p95', header: 'p95 (ms)', mono: true, align: 'right', render: (t) => <span style={{ color: t.p95 > SLA_MS ? 'var(--crit)' : undefined }}>{t.p95}</span> },
            { key: 'p99', header: 'p99 (ms)', mono: true, align: 'right', render: (t) => <span style={{ color: t.p99 > SLA_MS ? 'var(--warn)' : undefined }}>{t.p99.toLocaleString()}</span> },
            { key: 'rps', header: 'Req/s', mono: true, align: 'right' },
            { key: 'err', header: 'Errors', mono: true, align: 'right', render: (t) => `${t.err.toFixed(2)}%` },
            { key: 'sla', header: 'p95 ≤ 1 s', nosort: true, render: (t) => <Chip tone={t.p95 <= SLA_MS ? 'good' : 'crit'}>{t.p95 <= SLA_MS ? 'pass' : 'fail'}</Chip> },
          ]}
        />
        <p className="small muted" style={{ margin: '10px 0 0' }}>Pass logic used here: p95 at or under 1,000 ms and errors under 0.5% at 1,500+ users. The SOW (4.25) asks for 1 second or less for every transaction at peak load, so the {p99Over} transactions whose p99 is above 1,000 ms (and the p99 line crossing the SLA line in the chart) stay on the tuning list before UAT sign-off. All numbers on this page are illustrative.</p>
      </Card>
    </div>
  );
}

export default function PlatformPage() {
  const [tab, setTab] = useTabParam(TABS.platform, 'roadmap');
  return (
    <div>
      <PageHeader
        title="Platform, Performance & Roadmap"
        subtitle="The implementation plan through 2028 and the performance evidence format for 1,500+ concurrent users and sub-second response. SAP and P6 integration lives in the Integration Hub."
        badges={['illustrative']}
        checklist="D1 · D2 · D3 · D4"
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'roadmap', label: 'Implementation roadmap to 2028' }, { id: 'performance', label: 'Performance & load test' }]} />
      {tab === 'roadmap' ? <Roadmap /> : <Performance />}
    </div>
  );
}
