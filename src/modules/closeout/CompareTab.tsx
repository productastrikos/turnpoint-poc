import { useEffect, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { SimBadge } from '../../components/ui/SimBadge';
import { LoadingState } from '../../components/ui/EmptyState';
import { BarChart } from '../../components/charts/BarChart';
import { LineChart } from '../../components/charts/LineChart';
import { getBudgetLines } from '../../services/budgetService';
import { getCpDailyChanges } from '../../services/criticalPathService';
import { listIssues, listLosses, listNcrs } from '../../services/qualityService';
import { addLesson } from '../../services/closeoutService';
import { listVariations, summarise } from '../../services/scopeService';
import { getScopeFindings } from '../../services/duplicateService';
import { CURRENT_MANHOURS_TO_DATE, PREVIOUS_TA as P } from '../../mocks/taComparisonMock';
import { FORECAST_DAYS, plannedPctAt } from '../../mocks/progress';
import { STATUS_DAY, TA_DAYS } from '../../mocks/_gen';
import { useToast } from '../../app/ToastContext';
import type { Lesson } from '../../mocks/closeoutMock';

type Verdict = 'Better' | 'Similar' | 'Worse';

interface Metric {
  key: string;
  label: string;
  unit: string;
  prev: number;
  now: number;
  decimals: number;
  lesson: string; // what STO-2024 taught us
  changed: string; // what is different in STO-2026
  carry: { category: Lesson['category']; lesson: string; recommendation: string; owner: string; impact: Lesson['impact'] };
}

/** Lower is better for every measure here. 10% either side of the old value counts as similar. */
function verdictOf(m: Metric): Verdict {
  if (m.prev === 0) return m.now === 0 ? 'Similar' : 'Worse';
  const r = (m.now - m.prev) / m.prev;
  return r <= -0.1 ? 'Better' : r >= 0.1 ? 'Worse' : 'Similar';
}
const TONE: Record<Verdict, 'good' | 'warn' | 'crit'> = { Better: 'good', Similar: 'warn', Worse: 'crit' };
const fmt = (v: number, d: number) => v.toFixed(d);
const M = (n: number) => `OMR ${(n / 1e6).toFixed(2)}M`;

interface Data {
  metrics: Metric[];
  prevCost: number;
  fcCost: number;
  budget: number;
  curveLabels: string[];
}

async function load(): Promise<Data> {
  const [lines, cp, issues, ncrs, loss, vars, scan] = await Promise.all([getBudgetLines(), getCpDailyChanges(), listIssues(), listNcrs(), listLosses(), listVariations(), getScopeFindings()]);
  const budget = lines.reduce((s, l) => s + l.plannedOMR, 0);
  const fcCost = lines.reduce((s, l) => s + l.forecastOMR, 0);
  const sc = summarise(vars);
  const cpTotal = cp.reduce((s, x) => s + x.changes, 0);
  const nm = issues.filter((i) => i.type === 'Near miss').length;
  const rework = loss.filter((l) => l.kind === 'Rework').reduce((s, l) => s + l.hours, 0);
  const dups = scan.findings.filter((f) => f.kind === 'duplicate').length;
  const per100k = (n: number) => (n / CURRENT_MANHOURS_TO_DATE) * 100_000;
  const prev100k = (n: number) => (n / P.manhoursActual) * 100_000;

  const metrics: Metric[] = [
    {
      key: 'schedule', label: 'Schedule overrun', unit: '% of planned duration', prev: ((P.actualDays - P.plannedDays) / P.plannedDays) * 100, now: ((FORECAST_DAYS - TA_DAYS) / TA_DAYS) * 100, decimals: 1,
      lesson: 'The reactor critical path had no float and finished 4 days late', changed: 'Critical path logic reviewed at T-6 months; critical path monitored live from P6',
      carry: { category: 'Planning', lesson: 'STO-2026 still forecasts a 2-day overrun on the reactor path', recommendation: 'Hold 3 days of float on the reactor critical path in the TA-2027 baseline', owner: 'M. Al-Balushi', impact: 'High' },
    },
    {
      key: 'cost', label: 'Cost overrun', unit: '% over budget', prev: ((P.finalOMR - P.budgetOMR) / P.budgetOMR) * 100, now: ((fcCost - budget) / budget) * 100, decimals: 1,
      lesson: 'Late discovery work was not budgeted', changed: 'Discovery contingency held; variations approved against the frozen estimate',
      carry: { category: 'Scope', lesson: 'Civil and scaffolding forecast is the largest overrun again', recommendation: 'Price scaffolding from the 3D model before the scope freeze', owner: 'B. Al-Rawahi', impact: 'Medium' },
    },
    {
      key: 'growth', label: 'Scope growth after freeze', unit: '% of base estimate', prev: P.scopeGrowthPostFreezePct, now: (sc.approvedPost / sc.base) * 100, decimals: 1,
      lesson: 'Scope grew 11% after freeze, mostly discovery work found at opening', changed: 'Risk-based scope challenge and a three-gate approval before the freeze',
      carry: { category: 'Scope', lesson: 'Post-freeze growth is now a fraction of 2024', recommendation: 'Keep the risk-based challenge step and the discovery contingency for TA-2027', owner: 'A. Hinai', impact: 'Medium' },
    },
    {
      key: 'dups', label: 'Duplicate scope items', unit: '% of items', prev: P.duplicateSharePct, now: (dups / Math.max(1, scan.scannedItems)) * 100, decimals: 1,
      lesson: '19% of scope items were duplicates raised from notifications and inspection findings', changed: 'AI duplicate detection checks every item as it is typed, imported or received from SAP',
      carry: { category: 'Scope', lesson: 'Duplicates are now caught before approval, not after', recommendation: 'Retrain the duplicate model on the STO-2026 merge decisions before TA-2027', owner: 'M. Al-Balushi', impact: 'Medium' },
    },
    {
      key: 'cp', label: 'Critical path changes per week', unit: 'changes / week', prev: P.cpChanges / (P.actualDays / 7), now: cpTotal / (STATUS_DAY / 7), decimals: 1,
      lesson: 'Look-ahead was built 2 weeks ahead and crane conflicts were found late', changed: 'Four-week look-ahead built from P6 and crane slots reviewed weekly',
      carry: { category: 'Planning', lesson: 'Critical path still changes about 9 times a week', recommendation: 'Freeze the 72-hour look-ahead and review crane slots twice a week', owner: 'M. Al-Balushi', impact: 'Medium' },
    },
    {
      key: 'ncr', label: 'Non-conformance reports', unit: 'per 100k man-hours', prev: prev100k(P.ncrs), now: per100k(ncrs.length), decimals: 1,
      lesson: 'Vendor hold points were missed and material was rejected on site', changed: 'ITP hold points tracked from PO issue and inspected digitally',
      carry: { category: 'Quality', lesson: 'NCR rate is lower, but vendor ITP hold-point tracking is still open', recommendation: 'Close the open ITP hold-point action before TA-2027 orders are placed', owner: 'P. Menon', impact: 'High' },
    },
    {
      key: 'nm', label: 'Near misses reported', unit: 'per 100k man-hours', prev: prev100k(P.nearMisses), now: per100k(nm), decimals: 1,
      lesson: 'Heat stress and permit delays raised incident risk in weeks 3 and 4', changed: 'Work-rest cycle, shaded areas and a second night permit issuer from day 1',
      carry: { category: 'HSE', lesson: 'More near misses are being reported than in 2024, partly a healthier reporting culture, partly heat and congestion', recommendation: 'Run the week-3 heat-stress briefing on day 1 for all contractors', owner: "L. D'Souza", impact: 'High' },
    },
    {
      key: 'rework', label: 'Rework share of man-hours', unit: '% of hours', prev: P.reworkSharePct, now: (rework / CURRENT_MANHOURS_TO_DATE) * 100, decimals: 2,
      lesson: 'Paper box-up certificates led to 14 re-inspections', changed: 'Digital box-up workflow with Operations witness and field checklists',
      carry: { category: 'Execution', lesson: 'Rework is well below 2024', recommendation: 'Keep the digital box-up and checklist workflow as standard for all contractors', owner: 'Eng. K. Al-Siyabi', impact: 'Low' },
    },
  ];

  const xs = Array.from({ length: 13 }, (_, i) => i * 10); // 0..120 % of planned duration
  return { metrics, prevCost: P.finalOMR, fcCost, budget, curveLabels: xs.map((x) => `${x}%`) };
}

function curves(labels: string[]) {
  const xs = labels.map((l) => parseInt(l, 10));
  const plan = (x: number) => plannedPctAt(Math.min(1, x / 100) * TA_DAYS);
  const stretch = (s: number) => (x: number) => plannedPctAt(Math.min(1, x / 100 / s) * TA_DAYS);
  const f24 = stretch(P.actualDays / P.plannedDays);
  const f26 = stretch(FORECAST_DAYS / TA_DAYS);
  const nowX = (STATUS_DAY / TA_DAYS) * 100; // 43.75 % of planned duration
  return {
    plan: xs.map(plan),
    prev: xs.map(f24),
    to: xs.map((x) => (x <= nowX + 5 ? f26(x) : null)),
    fc: xs.map((x) => (x >= nowX - 5 ? f26(x) : null)),
  };
}

export function CompareTab() {
  const { showToast } = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    load().then(setD);
  }, []);
  if (!d) return <LoadingState />;

  const rows = d.metrics.map((m) => ({ ...m, verdict: verdictOf(m) }));
  const better = rows.filter((r) => r.verdict === 'Better');
  const watch = rows.filter((r) => r.verdict !== 'Better');
  const cv = curves(d.curveLabels);

  async function carry(r: (typeof rows)[number]) {
    setBusy(r.key);
    await addLesson(r.carry);
    setAdded((a) => [...a, r.key]);
    setBusy(null);
    showToast(`Added to Lessons Learned for the next turnaround: "${r.carry.recommendation}"`, 'good');
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="callout callout-warn">
        <strong>Illustrative history.</strong> STO-2024 final figures are seeded stand-ins (OQ's 2024 close-out data is not digitised). STO-2026 numbers are live from this platform at Day {STATUS_DAY} of {TA_DAYS}, so rates are shown per man-hour or per week to keep the comparison fair.
      </div>

      <div className="grid grid-2">
        <Card>
          <div className="eyebrow">Previous turnaround · final</div>
          <h3 style={{ fontSize: 17, margin: '4px 0 8px' }}>{P.name}</h3>
          <div className="grid grid-3">
            <StatTile label="Duration" value={`${P.actualDays} d`} delta={`planned ${P.plannedDays} d`} tone="warn" />
            <StatTile label="Final cost" value={M(P.finalOMR)} delta={`budget ${M(P.budgetOMR)}`} tone="warn" />
            <StatTile label="Man-hours" value={`${(P.manhoursActual / 1000).toFixed(0)}k`} />
          </div>
        </Card>
        <Card>
          <div className="eyebrow">Current turnaround · forecast to completion</div>
          <h3 style={{ fontSize: 17, margin: '4px 0 8px' }}>Major STO 2026: Sohar Refinery</h3>
          <div className="grid grid-3">
            <StatTile label="Duration" value={`${FORECAST_DAYS} d`} delta={`planned ${TA_DAYS} d`} tone="warn" />
            <StatTile label="Forecast cost" value={M(d.fcCost)} delta={`budget ${M(d.budget)}`} tone="warn" />
            <StatTile label="Man-hours to date" value={`${(CURRENT_MANHOURS_TO_DATE / 1000).toFixed(0)}k`} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title={<span>What the comparison says <SimBadge kind="ai" /></span>} />
        <p style={{ margin: 0, lineHeight: 1.75, fontSize: 13.5 }}>
          STO-2026 is doing better than STO-2024 on <strong>{better.length} of {rows.length}</strong> measures.
          {better.length > 0 && <> The biggest gains are {[...better].sort((a, b) => (a.now - a.prev) / (a.prev || 1) - (b.now - b.prev) / (b.prev || 1)).slice(0, 3).map((r) => `${r.label.toLowerCase()} (${fmt(r.prev, r.decimals)} to ${fmt(r.now, r.decimals)})`).join(', ')}.</>}
          {watch.length > 0 && <> Watch {watch.map((r) => r.label.toLowerCase()).join(' and ')}: {watch.length === 1 ? 'it has' : 'they have'} not improved by 10% or more yet.</>}
          {' '}Each measure below is tied to the 2024 lesson it answers and to the change made since.
        </p>
        <p className="small muted" style={{ margin: '8px 0 0' }}>Sentences are templated from the live numbers (simulated AI); the figures are not.</p>
      </Card>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Progress curve: STO-2026 vs STO-2024 (% of planned duration)" />
          <LineChart
            height={260}
            labels={d.curveLabels}
            yMin={0}
            yMax={100}
            yFormat={(v) => `${Math.round(v)}%`}
            series={[
              { name: 'Plan', data: cv.plan, color: 'var(--ink-3)', dashed: true },
              { name: 'STO-2024 final', data: cv.prev, color: 'var(--s2)' },
              { name: 'STO-2026 to date', data: cv.to, color: 'var(--s1)' },
              { name: 'STO-2026 forecast', data: cv.fc, color: 'var(--s1)', dashed: true },
            ]}
          />
          <p className="small muted" style={{ margin: '8px 0 0' }}>STO-2024 finished at {Math.round((P.actualDays / P.plannedDays) * 100)}% of its planned time; STO-2026 is forecast to finish at {Math.round((FORECAST_DAYS / TA_DAYS) * 100)}%.</p>
        </Card>
        <Card>
          <CardHeader title="Overrun and growth (% of plan)" />
          <BarChart
            height={260}
            labels={['Schedule overrun', 'Cost overrun', 'Scope growth', 'Duplicates']}
            yFormat={(v) => `${v}%`}
            series={[
              { name: 'STO-2024', color: 'var(--s2)', data: rows.slice(0, 4).map((r) => Number(r.prev.toFixed(1))) },
              { name: 'STO-2026', color: 'var(--s1)', data: rows.slice(0, 4).map((r) => Number(r.now.toFixed(1))) },
            ]}
          />
        </Card>
      </div>

      <Card>
        <CardHeader title="Measure by measure" action={<span className="row-wrap"><Chip tone="good">{better.length} better</Chip><Chip tone="warn">{rows.filter((r) => r.verdict === 'Similar').length} similar</Chip><Chip tone="crit">{rows.filter((r) => r.verdict === 'Worse').length} worse</Chip></span>} />
        <DataTable
          dense
          rowKey={(r) => r.key}
          rows={rows}
          columns={[
            { key: 'label', header: 'Measure', render: (r) => <div><strong>{r.label}</strong><div className="small muted">{r.unit}</div></div> },
            { key: 'prev', header: 'STO-2024', mono: true, align: 'right', render: (r) => fmt(r.prev, r.decimals) },
            { key: 'now', header: 'STO-2026', mono: true, align: 'right', render: (r) => <strong>{fmt(r.now, r.decimals)}</strong> },
            { key: 'chg', header: 'Change', mono: true, align: 'right', render: (r) => { const c = r.prev === 0 ? 0 : ((r.now - r.prev) / r.prev) * 100; return <span style={{ color: r.verdict === 'Better' ? 'var(--good)' : r.verdict === 'Worse' ? 'var(--crit)' : 'var(--warn)', fontWeight: 600 }}>{c > 0 ? '+' : ''}{c.toFixed(0)}%</span>; }, sortValue: (r) => (r.prev === 0 ? 0 : (r.now - r.prev) / r.prev) },
            { key: 'verdict', header: 'Verdict', render: (r) => <Chip tone={TONE[r.verdict]}>{r.verdict}</Chip> },
            { key: 'lesson', header: 'What 2024 taught us', render: (r) => <span className="small">{r.lesson}</span>, nosort: true },
            { key: 'changed', header: 'What we changed', render: (r) => <span className="small">{r.changed}</span>, nosort: true },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Carry into the next turnaround (TA-2027)" action={<span className="small muted">Each action becomes an entry in Lessons Learned</span>} />
        {rows.map((r) => (
          <div key={r.key} className="list-row">
            <Chip tone={TONE[r.verdict]}>{r.verdict}</Chip>
            <div style={{ flex: 1 }}>
              <strong>{r.label}</strong>
              <div className="small muted">{r.carry.recommendation}</div>
            </div>
            {added.includes(r.key) ? <Chip tone="good">Added to lessons</Chip> : <ActionButton busy={busy === r.key} onClick={() => carry(r)}>Add to lessons learned</ActionButton>}
          </div>
        ))}
      </Card>
    </div>
  );
}
