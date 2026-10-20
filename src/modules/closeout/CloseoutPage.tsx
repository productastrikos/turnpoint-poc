import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { SimBadge } from '../../components/ui/SimBadge';
import { LoadingState } from '../../components/ui/EmptyState';
import { BarChart } from '../../components/charts/BarChart';
import { TABS } from '../../app/tabRegistry';
import { getBudgetLines } from '../../services/budgetService';
import { getCpDailyChanges } from '../../services/criticalPathService';
import { listIssues, listLosses, listNcrs } from '../../services/qualityService';
import { listLessons } from '../../services/closeoutService';
import { listVariations, summarise } from '../../services/scopeService';
import { listContractorKpis } from '../../services/executionService';
import { forecastByUnit } from '../../mocks/aiMock';
import { SPI } from '../../mocks/progress';
import type { BudgetLine } from '../../types';
import { shortDate } from '../../mocks/_gen';
import { useToast } from '../../app/ToastContext';
import { CompareTab } from './CompareTab';

interface Data {
  lines: BudgetLine[];
  cpChanges: number;
  nm: number;
  hipo: number;
  ncrOpen: number;
  ncrTotal: number;
  rework: number;
  delay: number;
  lessonsClosed: number;
  lessonsTotal: number;
  scope: ReturnType<typeof summarise>;
  best: string;
}

const sum = (l: BudgetLine[], k: 'plannedOMR' | 'forecastOMR' | 'actualOMR' | 'committedOMR') => l.reduce((s, x) => s + x[k], 0);
const M = (n: number) => `OMR ${(n / 1e6).toFixed(2)}M`;

function useData(): Data | null {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    Promise.all([getBudgetLines(), getCpDailyChanges(), listIssues(), listNcrs(), listLosses(), listLessons(), listVariations(), listContractorKpis()]).then(([lines, cp, issues, ncrs, loss, ll, vars, ck]) =>
      setD({
        lines,
        cpChanges: cp.reduce((s, x) => s + x.changes, 0),
        nm: issues.filter((i) => i.type === 'Near miss').length,
        hipo: issues.filter((i) => i.hipo).length,
        ncrOpen: ncrs.filter((n) => n.status !== 'Closed').length,
        ncrTotal: ncrs.length,
        rework: loss.filter((l) => l.kind === 'Rework').reduce((s, l) => s + l.hours, 0),
        delay: loss.filter((l) => l.kind === 'Delay').reduce((s, l) => s + l.hours, 0),
        lessonsClosed: ll.filter((l) => l.status === 'Closed').length,
        lessonsTotal: ll.length,
        scope: summarise(vars),
        best: [...ck].sort((a, b) => b.productivity + b.ftr / 100 - (a.productivity + a.ftr / 100))[0].contractor,
      })
    );
  }, []);
  return d;
}

function narrative(d: Data): { heading: string; text: string }[] {
  const plan = sum(d.lines, 'plannedOMR');
  const fc = sum(d.lines, 'forecastOMR');
  return [
    { heading: 'Executive summary', text: `The Major STO 2026 at Sohar Refinery covers the HCU, CDU, SRU, VDU and FCC units over a planned 32 days with an approved budget of ${M(plan)}. At the Day 14 data date the turnaround is 44% complete against a plan of 47%, a schedule performance index of ${SPI.toFixed(2)}. At the current rate the forecast finish is 5 September, two days after the contractual end of 3 September. The forecast cost at completion is ${M(fc)}, ${(((fc - plan) / plan) * 100).toFixed(1)}% above budget.` },
    { heading: 'Scope', text: `The frozen worklist grew from a base estimate of ${M(d.scope.base)} to ${M(d.scope.current)} through ${d.scope.approvedCount} approved variations (${M(d.scope.approvedPre)} before and ${M(d.scope.approvedPost)} after the freeze). ${d.scope.pendingCount} further variations worth ${M(d.scope.pendingValue)} are awaiting approval.` },
    { heading: 'Schedule', text: `The critical path changed ${d.cpChanges} times during the first 14 days. The main drivers were crane conflicts, discovery work on the R-101 internals and the 14"-P-2201 tie-in spool rework. CP1 (reactor) carries the 2-day slip; CP2 and CP3 are stable. Delay and rework captured so far total ${d.delay + d.rework} hours.` },
    { heading: 'Cost', text: `Committed spend is ${M(sum(d.lines, 'committedOMR'))} (${Math.round((sum(d.lines, 'committedOMR') / plan) * 100)}% of budget) and actual spend ${M(sum(d.lines, 'actualOMR'))}. The largest forecast overruns are Civil and Scaffolding (+14.9%) and Rotating Equipment (+7.6%).` },
    { heading: 'Safety', text: `There have been no lost-time injuries (212 days clean). ${d.nm} near misses were reported, of which ${d.hipo} were high-potential; all high-potential events were investigated and closed.` },
    { heading: 'Quality', text: `${d.ncrTotal} non-conformance reports were raised, ${d.ncrOpen} remain open. Rework accounts for ${((d.rework / 181_280) * 100).toFixed(2)}% of man-hours worked.` },
    { heading: 'Contractors and lessons', text: `${d.best} leads the contractor scorecard on quality and productivity. ${d.lessonsClosed} of ${d.lessonsTotal} lessons from the 2024 turnaround have closed actions, and the remainder are carried in the current plan.` },
  ];
}

function Report({ d }: { d: Data }) {
  const parts = narrative(d);
  return (
    <Card style={{ maxWidth: 920, margin: '0 auto', width: '100%' }}>
      <div className="spread no-print"><span className="small muted">Built live from the same services as every other page.</span><button className="btn btn-primary btn-sm" onClick={() => window.print()}>Print / Save PDF</button></div>
      <div style={{ borderBottom: '2px solid var(--accent)', margin: '12px 0 16px', paddingBottom: 12 }}>
        <div className="eyebrow">OQ Refineries & Petrochemical Industries · Sohar Refinery</div>
        <h2 style={{ fontSize: 30, marginTop: 4 }}>Turnaround Close-Out Report</h2>
        <div className="small muted">Major STO 2026 · draft generated at Day 14 of 32 (forecast to completion) · {shortDate('2026-08-16')} 2026</div>
      </div>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card-flat"><div className="eyebrow">Progress</div><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>44%</div><div className="small muted">plan 47%</div></div>
        <div className="card-flat"><div className="eyebrow">Forecast finish</div><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>5 Sep</div><div className="small muted">+2 d vs 3 Sep</div></div>
        <div className="card-flat"><div className="eyebrow">Forecast cost</div><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{M(sum(d.lines, 'forecastOMR'))}</div></div>
        <div className="card-flat"><div className="eyebrow">LTI</div><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>0</div><div className="small muted">212 days clean</div></div>
      </div>
      {parts.map((p, i) => (
        <section key={p.heading} style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 17 }}>{i + 1}. {p.heading}</h3>
          <p style={{ margin: '4px 0 0', lineHeight: 1.75, fontSize: 13.5 }}>{p.text}</p>
        </section>
      ))}
    </Card>
  );
}

function Performance({ d }: { d: Data }) {
  const plan = sum(d.lines, 'plannedOMR');
  const fc = sum(d.lines, 'forecastOMR');
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <StatTile label="Planned end" value="3 Sep" delta="Day 32" />
        <StatTile label="Forecast end" value="5 Sep" tone="warn" delta="+2 days" />
        <StatTile label="Budget" value={M(plan)} />
        <StatTile label="Forecast final cost" value={M(fc)} tone="warn" delta={`${fc > plan ? '+' : ''}${(((fc - plan) / plan) * 100).toFixed(1)}% vs budget`} />
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Cost by Sub-WBS: budget vs forecast (OMR thousand)" />
          <BarChart height={290} labels={d.lines.map((l) => l.id.replace('WBS-', ''))} series={[{ name: 'Budget', color: 'var(--s6)', data: d.lines.map((l) => Math.round(l.plannedOMR / 1000)) }, { name: 'Forecast', color: 'var(--s2)', data: d.lines.map((l) => Math.round(l.forecastOMR / 1000)) }]} />
        </Card>
        <Card>
          <CardHeader title="Schedule by unit" />
          <DataTable
            dense
            rowKey={(r) => r.unit}
            rows={forecastByUnit}
            columns={[
              { key: 'unit', header: 'Unit', render: (r) => <strong>{r.unit}</strong> },
              { key: 'planned', header: 'Planned', mono: true, render: (r) => shortDate(r.planned) },
              { key: 'forecast', header: 'Forecast', mono: true, render: (r) => shortDate(r.forecast) },
              { key: 'v', header: 'Variance', render: (r) => { const v = Math.round((+new Date(r.forecast) - +new Date(r.planned)) / 86_400_000); return <Chip tone={v > 0 ? 'crit' : 'good'}>{v > 0 ? `+${v} d` : 'on plan'}</Chip>; } },
            ]}
          />
        </Card>
      </div>
      <Card>
        <CardHeader title="Variance by Sub-WBS" />
        <DataTable
          dense
          rowKey={(l: BudgetLine) => l.id}
          rows={d.lines}
          columns={[
            { key: 'subWbs', header: 'Sub-WBS', render: (l) => <div>{l.subWbs}<div className="small muted mono">{l.id}</div></div> },
            { key: 'plannedOMR', header: 'Budget', mono: true, align: 'right', render: (l) => l.plannedOMR.toLocaleString() },
            { key: 'forecastOMR', header: 'Forecast final', mono: true, align: 'right', render: (l) => l.forecastOMR.toLocaleString() },
            { key: 'v', header: 'Variance', mono: true, align: 'right', render: (l) => { const v = l.forecastOMR - l.plannedOMR; return <span style={{ color: v > 0 ? 'var(--crit)' : 'var(--good)', fontWeight: 600 }}>{v > 0 ? '+' : ''}{v.toLocaleString()} ({((v / l.plannedOMR) * 100).toFixed(1)}%)</span>; }, sortValue: (l) => l.forecastOMR - l.plannedOMR },
          ]}
        />
        <p className="small muted" style={{ margin: '10px 0 0' }}>Final figures replace the forecast once the last invoices are posted from SAP (simulated link).</p>
      </Card>
    </div>
  );
}

/** Shown before the first generation: the sections of the draft (same names as narrative()) and the live data each one reads. */
function DraftPreview({ d }: { d: Data }) {
  const sections: { name: string; covers: string; sources: string[] }[] = [
    { name: 'Executive summary', covers: 'Progress vs plan, SPI, forecast finish and cost at completion', sources: ['P6 schedule and CP log', 'Budget and SAP actuals'] },
    { name: 'Scope', covers: `${d.scope.approvedCount} approved and ${d.scope.pendingCount} pending variations since the base estimate`, sources: ['Scope and variations'] },
    { name: 'Schedule', covers: `${d.cpChanges} critical path changes over the first 14 days`, sources: ['P6 schedule and CP log'] },
    { name: 'Cost', covers: `Committed, actual and forecast spend across ${d.lines.length} Sub-WBS lines`, sources: ['Budget and SAP actuals'] },
    { name: 'Safety', covers: `${d.nm} near misses, ${d.hipo} of them high-potential`, sources: ['Issues and safety log'] },
    { name: 'Quality', covers: `${d.ncrTotal} non-conformance reports, ${d.ncrOpen} still open`, sources: ['NCR register'] },
    { name: 'Contractors and lessons', covers: `${d.best} leads the scorecard; ${d.lessonsClosed} of ${d.lessonsTotal} lessons from 2024 have closed actions`, sources: ['Contractor KPIs', 'Lessons learned'] },
  ];
  const sourceCount = new Set(sections.flatMap((s) => s.sources)).size;
  return (
    <Card>
      <CardHeader title="What the draft will contain" action={<span className="small muted">{sections.length} sections from {sourceCount} data sources</span>} />
      {sections.map((s) => (
        <div key={s.name} className="list-row">
          <strong style={{ width: 200 }}>{s.name}</strong>
          <span className="small muted" style={{ flex: 1 }}>{s.covers}</span>
          <div className="row-wrap" style={{ justifyContent: 'flex-end' }}>{s.sources.map((x) => <Chip key={x}>{x}</Chip>)}</div>
        </div>
      ))}
      <p className="small muted" style={{ margin: '10px 0 0' }}>Figures come from live data on this platform (the P6 and SAP links are simulated); the sentences are template-based (simulated AI). Nothing is drafted until you press Generate with AI.</p>
    </Card>
  );
}

function AiReport({ d }: { d: Data }) {
  const { showToast } = useToast();
  const [phase, setPhase] = useState<'idle' | 'reading' | 'writing' | 'done'>('idle');
  const [text, setText] = useState('');
  const timer = useRef<number | null>(null);
  const parts = narrative(d);
  const full = parts.map((p) => `${p.heading.toUpperCase()}\n${p.text}`).join('\n\n');

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
    },
    []
  );

  function generate() {
    setText('');
    setPhase('reading');
    window.setTimeout(() => {
      setPhase('writing');
      const words = full.split(/(\s+)/);
      let i = 0;
      timer.current = window.setInterval(() => {
        i += 6;
        setText(words.slice(0, i).join(''));
        if (i >= words.length) {
          if (timer.current) window.clearInterval(timer.current);
          setPhase('done');
          showToast('Draft close-out report generated (simulated AI). Review before issuing.', 'accent');
        }
      }, 45);
    }, 1300);
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="callout callout-warn">
        <strong>Simulated.</strong> No language model is called. The text is assembled from templates and the live numbers on this platform, to show the intended behaviour: an automated close-out report that is drafted for you to review.
      </div>
      <Card>
        <div className="spread">
          <div><h3 style={{ fontSize: 17 }}>Automated close-out report <SimBadge kind="ai" /></h3><p className="small muted" style={{ margin: '4px 0 0' }}>Reads scope, schedule, cost, safety, quality, contractor and lessons-learned data and drafts the narrative.</p></div>
          <ActionButton variant="primary" small={false} busy={phase === 'reading' || phase === 'writing'} onClick={generate}>{phase === 'done' ? 'Regenerate' : 'Generate with AI'}</ActionButton>
        </div>
        {phase !== 'idle' && (
          <div className="row-wrap" style={{ marginTop: 12 }}>
            {['Scope and variations', 'P6 schedule and CP log', 'Budget and SAP actuals', 'Issues and safety log', 'NCR register', 'Contractor KPIs', 'Lessons learned'].map((s) => <Chip key={s} tone={phase === 'reading' ? 'neutral' : 'good'}>{s}</Chip>)}
          </div>
        )}
      </Card>
      {phase === 'idle' && <DraftPreview d={d} />}
      {phase === 'reading' && <Card><LoadingState label="Reading 7 data sources…" /></Card>}
      {(phase === 'writing' || phase === 'done') && (
        <Card>
          <div className="eyebrow">Draft v0.1 · generated by TURNPOINT AI (simulated)</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: 13.5, lineHeight: 1.75, margin: '8px 0 0', minHeight: 200 }}>{text}{phase === 'writing' && <span className="mono" style={{ opacity: 0.6 }}>▍</span>}</pre>
          {phase === 'done' && (
            <div className="row" style={{ marginTop: 12 }}>
              <ActionButton variant="primary" onClick={() => showToast('Draft saved to the close-out folder for review', 'good')}>Save draft</ActionButton>
              <button className="btn btn-sm" onClick={() => window.print()}>Print</button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default function CloseoutPage() {
  const [tab, setTab] = useTabParam(TABS.closeout, 'report');
  const d = useData();
  return (
    <div>
      <PageHeader title="Close-Out Report" subtitle="The digital turnaround close-out report, built from live data, the final cost and schedule performance report, a comparison with the previous turnaround, and an AI-drafted version." checklist="C3 · C4 · C5 · X28" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'report', label: 'Digital close-out report' }, { id: 'performance', label: 'Final cost & schedule performance' }, { id: 'compare', label: 'Compare with previous TA' }, { id: 'ai', label: 'Generate with AI' }]} />
      {tab === 'compare' ? <CompareTab /> : !d ? <LoadingState /> : tab === 'report' ? <Report d={d} /> : tab === 'performance' ? <Performance d={d} /> : <AiReport d={d} />}
    </div>
  );
}
