import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatusChip } from '../../components/ui/StatusChip';
import { ActionButton } from '../../components/ui/ActionButton';
import { BarChart } from '../../components/charts/BarChart';
import { BarRow } from '../../components/charts/BarRow';
import { IdChips } from '../_shared/IdChips';
import { useToast } from '../../app/ToastContext';
import { useRole } from '../../app/RoleContext';
import { enqueue, discardQueued, getMobileState, setConnectivity, subscribeMobile, sync } from '../../services/mobileService';
import { CONTRACTOR_NAMES } from '../../mocks/master';
import { stamp } from '../../mocks/_gen';
import {
  CRIB_TOOLS,
  TOOL_ACTIVITIES,
  TOOL_CATEGORIES,
  TOOL_ISSUES,
  TOOL_SEVERITIES,
  scenarioNow,
  hoursBetween,
  type ToolIssue,
  type ToolReport,
  type ToolSeverity,
  type ToolStatus,
} from '../../mocks/toolsMock';
import { addToolReport, advanceToolReport, ago, isFreshReport, isOpen, listToolReports, nextSimulatedReport, nextToolAction, resetSimulation, resetTools, subscribeTools, summarizeTools, writeOffTool } from '../../services/toolsService';

const SEV_TONE = { High: 'crit', Medium: 'warn', Low: 'neutral' } as const;
const ISSUE_TONE = { Broken: 'crit', Missing: 'crit', Damaged: 'warn', 'Needs calibration': 'accent' } as const;

const toolOptions = CRIB_TOOLS.map((t) => `${t.tag} ${t.name}`);
const activityOptions = TOOL_ACTIVITIES.map((a) => `${a.p6Id} ${a.name}`);

/** Banner: reports that were recorded on the operator's phone but have not synced yet. */
function PhonePending() {
  const m = useSyncExternalStore(subscribeMobile, getMobileState, getMobileState);
  const { showToast } = useToast();
  const waiting = m.queue.filter((q) => q.kind === 'tool-report' && q.status !== 'synced').length;
  if (!waiting) return null;
  return (
    <div className="card card-pad" style={{ borderColor: 'var(--warn)', background: 'var(--warn-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13 }}>
        <strong>{waiting} report{waiting > 1 ? 's' : ''} recorded on the operator's phone, waiting for signal.</strong> {m.online ? 'Syncing now.' : 'The phone is offline (SIM: no signal).'} They appear in the list below once the phone syncs.
      </span>
      <ActionButton
        variant="primary"
        onClick={async () => {
          setConnectivity(true);
          const n = await sync();
          if (n) showToast(`Signal restored: ${n} queued item${n > 1 ? 's' : ''} synced from the phone`, 'good');
        }}
      >
        Restore signal and sync
      </ActionButton>
    </div>
  );
}

function LiveFeed({ rows }: { rows: ToolReport[] }) {
  const feed = rows.filter((r) => r.source === 'Mobile app').sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 5);
  return (
    <Card>
      <CardHeader title="Report from mobile: live feed" action={<Chip tone="good">live</Chip>} />
      {feed.length === 0 && <p className="small muted" style={{ margin: 0 }}>No operator reports yet.</p>}
      {feed.map((r) => (
        <div key={r.id} className="list-row" style={{ alignItems: 'flex-start' }}>
          <span>
            <strong style={{ fontSize: 13 }}>{r.toolName}</strong> {isFreshReport(r.id) && <Chip tone="accent">new</Chip>}
            <div className="small muted">{r.reportedBy} · {r.p6Id} · {r.issue.toLowerCase()} · {ago(r.receivedAt)}</div>
          </span>
          <Chip tone={SEV_TONE[r.severity]}>{r.severity}</Chip>
        </div>
      ))}
      <p className="small muted" style={{ margin: '8px 0 0' }}>Reports sent from the Mobile Field App (Tools tab) land here as soon as the phone syncs.</p>
    </Card>
  );
}

function Charts({ rows }: { rows: ToolReport[] }) {
  const byCat = TOOL_CATEGORIES.map((c) => ({ c, n: rows.filter((r) => r.category === c).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const top = Math.max(1, ...byCat.map((x) => x.n));
  const contractors = CONTRACTOR_NAMES.filter((c) => rows.some((r) => r.contractor === c));
  return (
    <>
      <Card>
        <CardHeader title="Issues by tool category" />
        {byCat.map((x) => (
          <BarRow key={x.c} label={x.c} value={x.n} max={top} formatted={String(x.n)} showPct={false} labelWidth={130} tone="accent" />
        ))}
      </Card>
      <Card>
        <CardHeader title="Issues by contractor" />
        <BarChart
          height={210}
          stacked
          labels={contractors.map((c) => c.split(' ')[0])}
          series={[
            { name: 'Open', color: 'var(--crit)', data: contractors.map((c) => rows.filter((r) => r.contractor === c && isOpen(r)).length) },
            { name: 'Closed', color: 'var(--good)', data: contractors.map((c) => rows.filter((r) => r.contractor === c && !isOpen(r)).length) },
          ]}
        />
      </Card>
    </>
  );
}

const TOAST_FOR: Record<string, (r: ToolReport) => string> = {
  Reported: (r) => `${r.toolTag} confirmed at the tool crib. Replacement can be ordered for ${r.p6Id}.`,
  'Crib confirmed': (r) => `Replacement ordered for ${r.toolName}. ETA 18 Aug, procurement notified.`,
  'Replacement ordered': (r) => `${r.toolName} replaced. ${r.p6Id} can continue, ${r.critical ? 'critical activity unblocked' : 'crew released'}.`,
};

export default function ToolsTrackingPage() {
  const { showToast } = useToast();
  const { role, persona } = useRole();
  const [version, setVersion] = useState(0);
  const own = role === 'contractor' ? CONTRACTOR_NAMES.find((n) => persona.org.startsWith(n)) : undefined;

  useEffect(
    () =>
      subscribeTools((e) => {
        setVersion((v) => v + 1);
        if (e.type === 'received') showToast(`Operator report received from the mobile app: ${e.report.toolName} ${e.report.issue.toLowerCase()} on ${e.report.p6Id}. Tool crib notified${e.report.critical ? ', it blocks a critical activity' : ''}.`, e.report.critical ? 'warn' : 'accent');
      }),
    [showToast]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => listToolReports().then((r) => (own ? r.filter((x) => x.contractor === own) : r)), [version, own]);

  async function simulate() {
    const s = nextSimulatedReport();
    const { label, ...input } = s;
    const q = await enqueue({ kind: 'tool-report', label: `Tool report: ${label}`, detail: `${input.toolTag} · ${input.severity} severity · photo`, tool: { ...input, reportedAt: scenarioNow() } });
    if (getMobileState().queue.find((x) => x.id === q.id)?.status !== 'synced') showToast('The simulated phone is offline: the report is queued on the device. Restore signal to send it.', 'warn');
  }
  function reset() {
    discardQueued(['tool-report']);
    resetSimulation();
    resetTools();
    showToast('Demo reset: tool reports are back to the seeded list', 'accent');
  }

  const config: TrackerConfig<ToolReport> = useMemo(
    () => ({
      title: 'Broken & Missing Tools',
      subtitle: 'Operators report a broken, missing or damaged tool from the mobile app. The tool crib confirms it, a replacement is ordered and the activity is released. The faulty list shows what is slowing the crews right now.',
      badges: ['simulated'],
      checklist: 'PBC 7',
      load,
      kpis: (rows) => {
        const s = summarizeTools(rows);
        return [
          { label: 'Faulty now', value: String(s.faulty), tone: s.faulty > 6 ? 'crit' : 'warn', delta: 'broken, damaged, due calibration' },
          { label: 'Missing', value: String(s.missing), tone: s.missing > 0 ? 'crit' : 'good', delta: 'not found by the crib' },
          { label: 'Awaiting replacement', value: String(s.awaiting), tone: 'warn', delta: 'not yet replaced' },
          { label: 'Replaced', value: String(s.replaced), tone: 'good', delta: 'back in service' },
          { label: 'Avg replacement time', value: s.avgReplacementHrs === null ? 'n/a' : `${s.avgReplacementHrs.toFixed(0)} h`, tone: 'neutral', delta: 'report to replaced' },
          { label: 'Blocking critical work', value: String(s.blockingCritical), tone: s.blockingCritical > 0 ? 'crit' : 'good', delta: `~${s.lostCrewHrs} crew-hours idle` },
        ];
      },
      kpiColumns: 6,
      preface: <PhonePending />,
      top: (rows) => (
        <div className="grid grid-3" style={{ alignItems: 'start' }}>
          <LiveFeed rows={rows} />
          <Charts rows={rows} />
        </div>
      ),
      columns: [
        { key: 'tool', header: 'Tool', sortValue: (r) => r.toolName, render: (r) => (<div><strong>{r.toolName}</strong><div className="small muted mono">{r.toolTag} · {r.id}</div></div>) },
        { key: 'contractor', header: 'Contractor' },
        { key: 'reportedBy', header: 'Reported by', render: (r) => (<div>{r.reportedBy}<div className="small muted">{r.source}</div></div>) },
        { key: 'when', header: 'When', sortValue: (r) => r.reportedAt, render: (r) => (<div>{ago(r.reportedAt)}<div className="small muted">{stamp(r.reportedAt)}</div></div>) },
        { key: 'issue', header: 'Issue', render: (r) => <Chip tone={ISSUE_TONE[r.issue]}>{r.issue}</Chip> },
        { key: 'activity', header: 'Affected activity', sortValue: (r) => r.p6Id, render: (r) => (<div><IdChips p6Id={r.p6Id} /><div className="small">{r.activityName.length > 30 ? `${r.activityName.slice(0, 29)}…` : r.activityName} {r.critical && <Chip tone="crit">critical</Chip>}</div></div>) },
        { key: 'severity', header: 'Severity', sortValue: (r) => ['High', 'Medium', 'Low'].indexOf(r.severity), render: (r) => <Chip tone={SEV_TONE[r.severity]}>{r.severity}</Chip> },
        { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} tone={r.status === 'Replaced' ? 'good' : r.status === 'Written off' ? 'neutral' : r.status === 'Reported' ? 'warn' : 'accent'} /> },
        { key: 'eta', header: 'ETA', mono: true, sortValue: (r) => r.replacedAt ?? r.eta ?? '9', render: (r) => (r.replacedAt ? `done ${stamp(r.replacedAt)}` : r.eta ? stamp(`${r.eta}T00:00:00`).slice(0, 6) : '—') },
      ],
      filters: [
        { label: 'status', get: (r) => r.status, options: ['Reported', 'Crib confirmed', 'Replacement ordered', 'Replaced', 'Written off'] as ToolStatus[] },
        { label: 'issues', get: (r) => r.issue, options: TOOL_ISSUES },
        ...(own ? [] : [{ label: 'contractors', get: (r: ToolReport) => r.contractor }]),
      ],
      search: (r) => `${r.toolName} ${r.toolTag} ${r.contractor} ${r.reportedBy} ${r.p6Id} ${r.activityName}`,
      initialSort: { key: 'when', dir: 'desc' },
      pageSize: 10,
      rowAction: {
        label: (r) => nextToolAction(r),
        run: (r) => advanceToolReport(r.id),
        toast: (r) => TOAST_FOR[r.status]?.(r) ?? 'Updated',
        tone: 'good',
      },
      create: {
        label: 'Log tool issue',
        title: 'Log a tool issue (office or crib)',
        fields: [
          { name: 'tool', label: 'Tool', type: 'select', options: toolOptions, required: true },
          { name: 'issue', label: 'Issue', type: 'select', options: TOOL_ISSUES, required: true, defaultValue: 'Broken' },
          { name: 'activity', label: 'Affected activity', type: 'select', options: activityOptions, required: true },
          { name: 'severity', label: 'Severity', type: 'select', options: TOOL_SEVERITIES, required: true, defaultValue: 'Medium' },
          { name: 'note', label: 'Note', type: 'textarea' },
        ],
        submit: (v) => {
          const tag = v.tool.split(' ')[0];
          const act = TOOL_ACTIVITIES.find((a) => `${a.p6Id} ${a.name}` === v.activity)!;
          return addToolReport({ toolTag: tag, issue: v.issue as ToolIssue, activityId: act.id, severity: v.severity as ToolSeverity, reportedBy: 'Tool crib', note: v.note || `${v.issue} logged by the crib.`, replacementRequested: true, source: 'Tool crib' });
        },
        toast: (r) => `${r.id} logged: ${r.toolName} ${r.issue.toLowerCase()} on ${r.p6Id}`,
      },
      extraAction: (
        <>
          <ActionButton onClick={simulate} small={false}>Simulate operator report</ActionButton>
          <ActionButton onClick={reset} small={false}>Reset demo</ActionButton>
        </>
      ),
      detail: {
        title: (r) => r.toolName,
        subtitle: (r) => `${r.toolTag} · ${r.id} · ${r.contractor}`,
        render: (r) => <ToolDetail r={r} onWriteOff={async () => { await writeOffTool(r.id); showToast(`${r.toolTag} written off and removed from the crib list`, 'warn'); }} />,
      },
    }),
    // simulate/reset/showToast are stable in behaviour; load changes with the data version
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load, own]
  );

  return <TrackerPage config={config} />;
}

function ToolDetail({ r, onWriteOff }: { r: ToolReport; onWriteOff: () => void }) {
  const idleHrs = isOpen(r) && r.severity !== 'Low' ? Math.round(hoursBetween(r.reportedAt, scenarioNow()) * (r.severity === 'High' ? 6 : 3)) : 0;
  return (
    <div className="stack">
      <div className="row-wrap">
        <Chip tone={ISSUE_TONE[r.issue]}>{r.issue}</Chip>
        <Chip tone={SEV_TONE[r.severity]}>{r.severity} severity</Chip>
        {r.critical && <Chip tone="crit">critical or near-critical activity</Chip>}
        <StatusChip status={r.status} />
      </div>
      <p style={{ margin: 0, fontSize: 13.5 }}>{r.note}</p>
      {r.photo && <div className="small muted mono">Photo attached: {r.photo}</div>}
      <div className="small">
        Affects <IdChips p6Id={r.p6Id} /> {r.activityName}. Reported by {r.reportedBy} ({r.source}), {stamp(r.reportedAt)}.
        {r.replacementRequested ? ' Replacement requested.' : ' No replacement requested.'}
      </div>
      {idleHrs > 0 && <div className="card card-pad" style={{ background: 'var(--warn-soft)' }}><strong>About {idleHrs} crew-hours idle so far</strong><div className="small muted">Estimate from the crew size on the activity and the time since the report (illustrative).</div></div>}
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>History</div>
        {r.history.map((h, i) => (
          <div key={i} className="list-row"><span>{h.status}<span className="small muted"> · {h.by}</span></span><span className="small mono">{stamp(h.at)}</span></div>
        ))}
      </div>
      {isOpen(r) && <ActionButton variant="danger" small={false} onClick={onWriteOff}>Write off tool</ActionButton>}
    </div>
  );
}
