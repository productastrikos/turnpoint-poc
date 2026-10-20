import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { BarChart } from '../../components/charts/BarChart';
import { LineChart } from '../../components/charts/LineChart';
import { flagProductivity, listProductivity, overallProductivityOf, productivityIndex } from '../../services/executionService';
import type { ProductivityRow } from '../../mocks/executionMock';

const tone = (pi: number) => (pi >= 0.95 ? 'good' : pi >= 0.85 ? 'warn' : 'crit');
// daily overall index; the last point is the computed overall value so the trend always ends on the headline number
const trendTo = (last: number) => [0.99, 0.99, 0.98, 0.98, 0.97, 0.97, 0.96, 0.96, 0.96, 0.95, 0.95, 0.95, 0.96, Math.round(last * 100) / 100];

const config: TrackerConfig<ProductivityRow> = {
  title: 'Productivity Analysis',
  subtitle: 'Planned against actual productivity by discipline and activity type (output per man-hour). Anything under 0.85 is an under-performer; flag it and a review issue is raised with the contractor.',
  checklist: 'X7',
  load: listProductivity,
  kpis: (rows) => {
    const hrs = rows.reduce((s, r) => s + r.hours, 0);
    const overall = overallProductivityOf(rows);
    return [
      { label: 'Productivity index (overall)', value: overall.toFixed(2), tone: overall >= 0.95 ? 'good' : 'warn', delta: 'target ≥ 0.95' },
      { label: 'Activity types tracked', value: String(rows.length) },
      { label: 'Under-performing (<0.85)', value: String(rows.filter((r) => productivityIndex(r) < 0.85).length), tone: 'crit' },
      { label: 'Above plan (≥1.0)', value: String(rows.filter((r) => productivityIndex(r) >= 1).length), tone: 'good' },
      { label: 'Hours analysed', value: hrs.toLocaleString() },
    ];
  },
  top: (rows) => {
    const trend = trendTo(overallProductivityOf(rows));
    return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <Card>
        <CardHeader title="Productivity index by discipline" />
        <BarChart
          height={210}
          labels={Array.from(new Set(rows.map((r) => r.discipline))).map((d) => d.replace('Rotating Equipment', 'Rotating').replace('Instrumentation', 'Instr.'))}
          series={[{ name: 'Index', color: 'var(--accent)', data: Array.from(new Set(rows.map((r) => r.discipline))).map((d) => { const l = rows.filter((r) => r.discipline === d); return Math.round((l.reduce((s, r) => s + r.hours * productivityIndex(r), 0) / l.reduce((s, r) => s + r.hours, 0)) * 100) / 100; }) }]}
          refLine={{ value: 0.95, label: 'target 0.95' }}
          yFormat={(v) => v.toFixed(2)}
          yMax={1.2}
        />
      </Card>
      <Card>
        <CardHeader title="Overall index, TA days 1 to 14" />
        <LineChart height={210} labels={trend.map((_, i) => `D${i + 1}`)} xTickEvery={2} yMin={0.8} yMax={1.05} series={[{ name: 'Index', data: trend, color: 'var(--s2)' }, { name: 'Target', data: trend.map(() => 0.95), color: 'var(--ink-3)', dashed: true }]} yFormat={(v) => v.toFixed(2)} />
      </Card>
    </div>
    );
  },
  columns: [
    { key: 'activity', header: 'Activity', render: (r) => <div><strong>{r.activity}</strong><div className="small muted">{r.discipline} · {r.contractor}</div></div> },
    { key: 'unit', header: 'Unit', render: (r) => <span className="small mono">{r.unit}</span> },
    { key: 'planned', header: 'Planned', mono: true, align: 'right' },
    { key: 'actual', header: 'Actual', mono: true, align: 'right' },
    { key: 'pi', header: 'Index', render: (r) => <span className="row"><Chip tone={tone(productivityIndex(r))}>{productivityIndex(r).toFixed(2)}</Chip></span>, sortValue: (r) => productivityIndex(r) },
    { key: 'bar', header: 'vs plan', render: (r) => <ProgressBar value={productivityIndex(r) * 100} max={120} tone={tone(productivityIndex(r))} showLabel={false} />, sortValue: (r) => productivityIndex(r) },
    { key: 'qty', header: 'Quantity', mono: true, align: 'right', render: (r) => r.qty.toLocaleString() },
    { key: 'hours', header: 'Hours', mono: true, align: 'right', render: (r) => r.hours.toLocaleString() },
    { key: 'flagged', header: '', render: (r) => (r.flagged ? <Chip tone="accent">review raised</Chip> : null) },
  ],
  filters: [{ label: 'disciplines', get: (r) => r.discipline }, { label: 'contractors', get: (r) => r.contractor }],
  search: (r) => `${r.activity} ${r.contractor}`,
  rowAction: { label: (r) => (productivityIndex(r) < 0.9 && !r.flagged ? 'Flag for review' : null), run: (r) => flagProductivity(r.id), toast: (r) => `Review raised for "${r.activity}" and logged in Issues` },
  initialSort: { key: 'pi', dir: 'asc' },
};

export default function ProductivityPage() {
  return <TrackerPage config={config} />;
}
