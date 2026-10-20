import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { ActionButton } from '../../components/ui/ActionButton';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { LoadingState } from '../../components/ui/EmptyState';
import { Stepper } from '../../components/workflow/Stepper';
import { LineChart } from '../../components/charts/LineChart';
import {
  EXPORT_FILENAME,
  buildXer,
  commitRecalc,
  getFieldUpdates,
  getImportSummary,
  getPreviewRows,
  getResources,
  logExport,
  recalculate,
  type FieldUpdateRow,
  type PreviewRow,
  type RecalcResult,
  type RecalcRow,
} from '../../services/p6Service';
import { P6_ENDPOINTS, P6_PROJECT, P6_SAMPLE_REQUEST, P6_SAMPLE_RESPONSE } from '../../mocks/integrationMock';
import { shortDate } from '../../mocks/_gen';
import { useToast } from '../../app/ToastContext';
import { Icon } from '../../app/icons';

const STEPS = ['1 Import XER', '2 Field updates', '3 Recalculate', '4 Export XER'];

type Summary = Awaited<ReturnType<typeof getImportSummary>>;

export function P6Tab() {
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parsePct, setParsePct] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [updates, setUpdates] = useState<FieldUpdateRow[]>([]);
  const [result, setResult] = useState<RecalcResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [exported, setExported] = useState<{ name: string; bytes: number; preview: string } | null>(null);
  const [showRes, setShowRes] = useState(false);
  const [showRest, setShowRest] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    getFieldUpdates().then(setUpdates);
  }, []);

  async function useSample() {
    setParsing(true);
    setParsePct(0);
    const timer = setInterval(() => setParsePct((p) => Math.min(95, p + 9)), 120);
    const [s, r] = await Promise.all([getImportSummary(), getPreviewRows()]);
    clearInterval(timer);
    setParsePct(100);
    setSummary(s);
    setRows(r);
    setParsing(false);
    showToast(`Imported ${s.activities.toLocaleString()} activities from ${s.file} (simulated)`, 'good');
  }

  async function runRecalc() {
    setStep(2);
    setCalculating(true);
    setResult(await recalculate());
    setCalculating(false);
  }

  async function commit() {
    if (!result) return;
    const r = await commitRecalc(result);
    setCommitted(true);
    showToast(r.cpChanged ? 'Applied to schedule: critical path changed 1 time (logged on Critical Path)' : 'Applied to schedule', r.cpChanged ? 'warn' : 'good');
  }

  async function doExport() {
    if (!result) return;
    const text = buildXer();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = EXPORT_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    await logExport(result.rows.length);
    setExported({ name: EXPORT_FILENAME, bytes: blob.size, preview: text.split('\n').slice(0, 14).join('\n') });
    showToast(`${EXPORT_FILENAME} downloaded (generated sample file)`, 'good');
  }

  const previewCols: Column<PreviewRow>[] = [
    { key: 'p6Id', header: 'P6 Activity ID', mono: true, render: (r) => <span className="tag-chip p6">{r.p6Id}</span> },
    { key: 'name', header: 'Activity', render: (r) => <span>{r.name}{r.cp && <> <Chip tone="crit">{r.cp}</Chip></>}</span> },
    { key: 'wbs', header: 'WBS', mono: true },
    { key: 'calendar', header: 'Calendar' },
    { key: 'start', header: 'Start', mono: true, render: (r) => shortDate(r.start) },
    { key: 'finish', header: 'Finish', mono: true, render: (r) => shortDate(r.finish) },
    { key: 'duration', header: 'Dur (d)', mono: true, align: 'right' },
    { key: 'blu', header: 'BLU (h)', mono: true, align: 'right', render: (r) => r.blu.toLocaleString() },
    { key: 'resources', header: 'Resources', render: (r) => <span className="small"><Icon name="lock" size={12} /> {r.resources}</span> },
    { key: 'constraint', header: 'Constraint', render: (r) => <span className="small muted">{r.constraint}</span> },
  ];

  const filtered = useMemo(() => rows.filter((r) => !q || `${r.p6Id} ${r.name}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);

  const recalcCols: Column<RecalcRow>[] = [
    { key: 'p6Id', header: 'P6 ID', mono: true, render: (r) => <span className="tag-chip p6">{r.p6Id}</span> },
    { key: 'name', header: 'Activity' },
    { key: 'plannedPct', header: 'Planned %', mono: true, align: 'right', render: (r) => `${r.plannedPct}%` },
    { key: 'actualPct', header: 'Actual %', mono: true, align: 'right', render: (r) => `${r.actualPct}%` },
    { key: 'blu', header: 'BLU', mono: true, align: 'right', render: (r) => r.blu.toLocaleString() },
    { key: 'alu', header: 'ALU', mono: true, align: 'right', render: (r) => r.alu.toLocaleString() },
    { key: 'rlu', header: 'RLU', mono: true, align: 'right', render: (r) => r.rlu.toLocaleString() },
    { key: 'remainingDur', header: 'Remaining (d)', mono: true, align: 'right' },
    { key: 'estEnd', header: 'Est. end', mono: true, render: (r) => shortDate(r.estEnd) },
    { key: 'delayGain', header: 'Delay / gain', sortValue: (r) => r.delayGain, render: (r) => <Chip tone={r.delayGain > 0 ? 'crit' : r.delayGain < 0 ? 'good' : 'neutral'}>{r.delayGain > 0 ? `+${r.delayGain} d delay` : r.delayGain < 0 ? `${r.delayGain} d gain` : 'on plan'}</Chip> },
    { key: 'succ', header: 'Successors moved', nosort: true, render: (r) => (r.successors.length ? <span className="small mono">{r.successors.map((s) => `${s.p6Id} ${s.shift > 0 ? '+' : ''}${s.shift}d`).join(', ')}</span> : <span className="muted small">none</span>) },
  ];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <Stepper steps={STEPS} current={step} onSelect={(i) => (i <= 1 || result ? setStep(i) : undefined)} />
      </Card>

      {step === 0 && (
        <>
          {!summary && !parsing && (
            <Card>
              <div className="empty-state" style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: 34, marginBottom: 6 }}>⇪</div>
                <div style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Drop a Primavera P6 .xer file here</div>
                <div className="small" style={{ margin: '4px 0 14px' }}>
                  Tasks, timestamps, relationships, constraints, resources and calendars are imported (SOW dry run #2). The demo runs on a bundled sample, not on your own file.
                </div>
                <ActionButton variant="primary" small={false} onClick={useSample}>Use sample {P6_PROJECT.file}</ActionButton>
              </div>
            </Card>
          )}
          {parsing && (
            <Card>
              <CardHeader title={`Parsing ${P6_PROJECT.file}`} />
              <ProgressBar value={parsePct} tone="accent" height={12} />
              <p className="small muted" style={{ margin: '10px 0 0' }}>Reading PROJECT, CALENDAR, PROJWBS, TASK, TASKPRED, RSRC and TASKRSRC tables…</p>
            </Card>
          )}
          {summary && (
            <>
              <div className="grid grid-6" style={{ gap: 12 }}>
                <StatTile label="Activities" value={summary.activities.toLocaleString()} />
                <StatTile label="Relationships" value={summary.relationships.toLocaleString()} />
                <StatTile label="Resources" value={String(summary.resources)} />
                <StatTile label="Calendars" value={String(summary.calendars)} />
                <StatTile label="Baselines" value={String(summary.baselines)} />
                <StatTile label="Data date" value={shortDate(summary.dataDate)} />
              </div>
              <div className="stack" style={{ gap: 16 }}>
                <Card>
                  <CardHeader
                    title="Activities with P6 Activity IDs"
                    action={<input type="text" placeholder="Filter by ID or name" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />}
                  />
                  <p className="small muted" style={{ margin: '-6px 0 10px' }}>Preview of {rows.length} of {summary.activities.toLocaleString()} imported activities. The same IDs appear on Critical Path, Lookahead, Scope and Work Packs.</p>
                  <DataTable columns={previewCols} rows={filtered} rowKey={(r) => r.p6Id} pageSize={10} dense />
                </Card>
                <div className="grid grid-2" style={{ alignItems: 'start' }}>
                  <Card>
                    <CardHeader title="Calendars" />
                    {summary.calendarList.map((c) => (
                      <div key={c.name} className="list-row">
                        <div><strong>{c.name}</strong><div className="small muted">{c.detail}</div></div>
                        <span className="mono small">{c.activities.toLocaleString()}</span>
                      </div>
                    ))}
                  </Card>
                  <Card>
                    <CardHeader title="WBS" />
                    {summary.wbs.map((w) => (
                      <div key={w.code} className="list-row" style={{ paddingLeft: w.level * 14 }}>
                        <span style={{ fontWeight: w.level === 0 ? 700 : 500 }}>{w.name}</span>
                        <span className="mono small muted">{w.code}</span>
                      </div>
                    ))}
                  </Card>
                </div>
              </div>
              <Card>
                <CardHeader
                  title="Resource master (read-only)"
                  action={<button className="btn btn-sm" onClick={() => setShowRes((s) => !s)}>{showRes ? 'Hide' : `Show ${getResources().length} resources`}</button>}
                />
                <div className="callout"><Icon name="lock" size={14} /> Labour and non-labour resources are owned by P6 and are read-only in TURNPOINT (SOW dry run #6). There are no edit controls here by design.</div>
                {showRes && (
                  <div style={{ marginTop: 12 }}>
                    <DataTable
                      dense
                      pageSize={12}
                      rowKey={(r) => r.id}
                      rows={getResources()}
                      columns={[
                        { key: 'id', header: 'Resource ID', mono: true, render: (r) => <span><Icon name="lock" size={12} /> {r.id}</span> },
                        { key: 'name', header: 'Name' },
                        { key: 'type', header: 'Type', render: (r) => <Chip tone={r.type === 'Labour' ? 'accent' : 'neutral'}>{r.type}</Chip> },
                        { key: 'unit', header: 'Unit', mono: true },
                        { key: 'rate', header: 'Rate (USD / unit)', mono: true, align: 'right' },
                      ]}
                    />
                  </div>
                )}
              </Card>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => setStep(1)}>Next: field updates →</button>
              </div>
            </>
          )}
        </>
      )}

      {step === 1 && (
        <Card>
          <CardHeader title="Field progress received since the last sync" action={<Chip tone="accent">{updates.length} updates</Chip>} />
          <p className="small muted" style={{ margin: '-6px 0 12px' }}>Entered by supervisors in the mobile app (some captured offline and synced later). This is what the Execution team did, replayed here as the "field simulate updates" step of the SOW dry run.</p>
          <DataTable
            rowKey={(u) => u.activity.id}
            rows={updates}
            dense
            columns={[
              { key: 'p6', header: 'P6 ID', render: (u) => <span className="tag-chip p6">{u.activity.p6Id}</span>, sortValue: (u) => u.activity.p6Id },
              { key: 'name', header: 'Activity', render: (u) => u.activity.name, sortValue: (u) => u.activity.name },
              { key: 'pct', header: 'Progress entered', render: (u) => <ProgressBar value={u.pct} />, sortValue: (u) => u.pct },
              { key: 'by', header: 'By' },
              { key: 'at', header: 'Time', mono: true, render: (u) => u.at.slice(11, 16) },
              { key: 'via', header: 'Source', render: (u) => <span className="small">{u.via}</span> },
            ]}
          />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
            <button className="btn" onClick={() => setStep(0)}>← Back</button>
            <button className="btn btn-primary" disabled={!summary} title={!summary ? 'Import the XER first' : undefined} onClick={runRecalc}>Recalculate ALU / RLU and forecast →</button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <>
          {calculating && <Card><LoadingState label="Recalculating BLU / ALU / RLU, remaining duration and successor impact…" /></Card>}
          {result && !calculating && (
            <>
              <div className="callout">
                <strong>Formulas (SOW dry run #12-13):</strong> remaining duration = (1 − % progress) × planned duration · est. end = data date ({shortDate(P6_PROJECT.dataDate)}) + remaining duration · delay/gain = est. end − planned end, propagated to linked successors and to the end task of the asset.
              </div>
              <div className="grid grid-4" style={{ gap: 12 }}>
                <StatTile label="BLU (budgeted)" value={`${result.totals.blu.toLocaleString()} h`} />
                <StatTile label="ALU (actual)" value={`${result.totals.alu.toLocaleString()} h`} tone="accent" />
                <StatTile label="RLU (remaining)" value={`${result.totals.rlu.toLocaleString()} h`} />
                <StatTile label="Critical path" value={result.cpChangeCount ? 'Changed' : 'Unchanged'} delta={result.newlyCritical.length ? `${result.newlyCritical.length} activities now critical` : 'no change'} trend={result.cpChangeCount ? 'up' : 'flat'} tone={result.cpChangeCount ? 'crit' : 'good'} />
              </div>
              <Card>
                <CardHeader title="Recalculated activities" action={<Chip tone="accent">{result.rows.length} activities updated</Chip>} />
                <DataTable columns={recalcCols} rows={result.rows} rowKey={(r) => r.id} dense initialSort={{ key: 'delayGain', dir: 'desc' }} />
              </Card>
              <div className="grid grid-2" style={{ alignItems: 'start' }}>
                <Card>
                  <CardHeader title="Critical path impact" />
                  {result.newlyCritical.length === 0 && <p className="small muted">No activity became critical.</p>}
                  {result.newlyCritical.map((n) => (
                    <div key={n.id} className="list-row">
                      <div><strong>{n.name}</strong><div className="small muted mono">{n.id} · float {n.floatBefore} d → {n.floatAfter} d</div></div>
                      <Chip tone="crit">Newly critical</Chip>
                    </div>
                  ))}
                  <h4 style={{ margin: '14px 0 6px', fontSize: 14 }}>Asset end-task delay / gain</h4>
                  {result.assetEnds.map((a) => (
                    <div key={a.asset} className="list-row">
                      <div><strong>{a.asset}</strong><div className="small muted">{a.endTask}</div></div>
                      <Chip tone={a.shift > 0 ? 'crit' : a.shift < 0 ? 'good' : 'neutral'}>{a.shift > 0 ? `+${a.shift} d` : a.shift < 0 ? `${a.shift} d` : '0 d'}</Chip>
                    </div>
                  ))}
                </Card>
                <Card>
                  <CardHeader title="S-curve: planned vs actual (man-hours %)" />
                  <LineChart
                    height={230}
                    labels={result.scurve.map((p) => String(p.day))}
                    xTickEvery={4}
                    yMax={100}
                    series={[
                      { name: 'Planned', data: result.scurve.map((p) => p.planned), color: 'var(--ink-3)', dashed: true },
                      { name: 'Actual before import', data: result.scurve.map((p) => (Number.isNaN(p.before) ? null : p.before)), color: 'var(--s2)' },
                      { name: 'Actual after recalculation', data: result.scurve.map((p) => p.after), color: 'var(--accent)' },
                    ]}
                  />
                </Card>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <button className="btn" onClick={() => setStep(1)}>← Back</button>
                <div className="row">
                  <ActionButton small={false} disabled={committed} onClick={commit}>{committed ? 'Applied to schedule ✓' : 'Apply to schedule'}</ActionButton>
                  <button className="btn btn-primary" onClick={() => setStep(3)}>Next: export XER →</button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {step === 3 && result && (
        <>
          <Card>
            <CardHeader title="What will be written back to P6" action={<Chip tone="accent">{result.rows.length} activities</Chip>} />
            <DataTable
              dense
              rowKey={(r) => r.id}
              rows={result.rows}
              columns={[
                { key: 'p6Id', header: 'P6 ID', render: (r) => <span className="tag-chip p6">{r.p6Id}</span> },
                { key: 'name', header: 'Activity' },
                { key: 'pct', header: '% complete', mono: true, render: (r) => <span>{updates.find((u) => u.activity.id === r.id)?.activity.pct ?? 0}% → <strong>{r.actualPct}%</strong></span> },
                { key: 'rem', header: 'Remaining duration', mono: true, render: (r) => `${r.remainingDur} d` },
                { key: 'alu', header: 'ALU (h)', mono: true, align: 'right', render: (r) => r.alu.toLocaleString() },
                { key: 'rlu', header: 'RLU (h)', mono: true, align: 'right', render: (r) => r.rlu.toLocaleString() },
                { key: 'as', header: 'Actual start', mono: true, render: () => 'set' },
                { key: 'fin', header: 'Forecast finish', mono: true, render: (r) => shortDate(r.estEnd) },
              ]}
            />
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
              <button className="btn" onClick={() => setStep(2)}>← Back</button>
              <ActionButton variant="primary" small={false} onClick={doExport}>Export updated .XER</ActionButton>
            </div>
          </Card>
          {exported && (
            <Card>
              <div className="callout callout-good" style={{ marginBottom: 12 }}>
                ✓ {exported.name} downloaded · {exported.bytes.toLocaleString()} bytes. This is a generated sample file in XER structure (SIMULATED), not an export from a real P6 database. Re-validation against P6 by the OQ team is the next step in the real dry run.
              </div>
              <pre className="code">{exported.preview}</pre>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader title="P6 REST API (alternative to XER)" action={<button className="btn btn-sm" onClick={() => setShowRest((s) => !s)}>{showRest ? 'Hide' : 'Show endpoints and sample JSON'}</button>} />
        <p className="small muted" style={{ margin: 0 }}>Illustrative: confirm endpoint paths and field names against the client's P6 v24.21 documentation before quoting them.</p>
        {showRest && (
          <div className="grid grid-2" style={{ marginTop: 12, alignItems: 'start' }}>
            <DataTable
              dense
              rowKey={(e) => e.method + e.path}
              rows={P6_ENDPOINTS}
              columns={[
                { key: 'method', header: 'Verb', render: (e) => <Chip tone={e.method === 'GET' ? 'accent' : 'warn'}>{e.method}</Chip> },
                { key: 'path', header: 'Path', mono: true },
                { key: 'use', header: 'Used for' },
              ]}
            />
            <div className="stack">
              <pre className="code">{P6_SAMPLE_REQUEST}</pre>
              <pre className="code">{P6_SAMPLE_RESPONSE}</pre>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
