import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Stepper } from '../../components/workflow/Stepper';
import { BarChart } from '../../components/charts/BarChart';
import { advanceBoxup, listBoxups, BOXUP_ACTIONS } from '../../services/executionService';
import { BOXUP_STAGES, type BoxUp } from '../../mocks/executionMock';
import { areaLabel } from '../../mocks/master';

const config: TrackerConfig<BoxUp> = {
  title: 'Box-Up Management',
  subtitle: 'Closure of every manway, cover and casing: checklist, inspection, Operations witness, then the box-up certificate. A certificate cannot be issued until the previous stage is signed. Issued certificates raise a notification.',
  checklist: 'X8',
  load: listBoxups,
  kpis: (rows) => [
    { label: 'Box-up items', value: String(rows.length) },
    { label: 'Certificates issued', value: String(rows.filter((r) => r.stage === 3).length), tone: 'good' },
    { label: 'Awaiting Operations witness', value: String(rows.filter((r) => r.stage === 2).length), tone: 'accent' },
    { label: 'Waiting for inspection', value: String(rows.filter((r) => r.stage === 1).length), tone: 'warn' },
    { label: 'Held up', value: String(rows.filter((r) => r.hold).length), tone: 'crit' },
  ],
  top: (rows) => (
    <Card>
      <CardHeader title="Box-up status by area" />
      <BarChart
        height={200}
        stacked
        labels={Array.from(new Set(rows.map((r) => r.area))).map((a) => a.replace('Unit ', 'U'))}
        series={BOXUP_STAGES.map((s, i) => ({ name: s, color: ['var(--s6)', 'var(--s2)', 'var(--s1)', 'var(--s3)'][i], data: Array.from(new Set(rows.map((r) => r.area))).map((a) => rows.filter((r) => r.area === a && r.stage === i).length) }))}
      />
    </Card>
  ),
  columns: [
    { key: 'id', header: 'ID', mono: true },
    { key: 'item', header: 'Item', render: (r) => <div><strong>{r.tag}</strong> {r.item}<div className="small muted">{areaLabel(r.area)} · {r.contractor}</div></div> },
    { key: 'checklist', header: 'Checklist', render: (r) => <ProgressBar value={r.itemsDone} max={r.items} />, sortValue: (r) => r.itemsDone / r.items },
    { key: 'stage', header: 'Stage', render: (r) => <Chip tone={r.stage === 3 ? 'good' : r.hold ? 'crit' : r.stage === 0 ? 'neutral' : 'accent'}>{BOXUP_STAGES[r.stage]}</Chip>, sortValue: (r) => r.stage },
    { key: 'planned', header: 'Planned', mono: true },
    { key: 'hold', header: 'Hold', render: (r) => (r.hold ? <span className="small" style={{ color: 'var(--crit)' }}>{r.hold}</span> : null) },
  ],
  filters: [{ label: 'stages', get: (r) => BOXUP_STAGES[r.stage], options: BOXUP_STAGES }, { label: 'areas', get: (r) => r.area }],
  search: (r) => `${r.id} ${r.tag} ${r.item}`,
  rowAction: { label: (r) => BOXUP_ACTIONS[r.stage], run: (r) => advanceBoxup(r.id), toast: (r) => `${r.tag} ${r.item}: step completed` },
  detail: {
    title: (r) => `${r.tag} · ${r.item}`,
    subtitle: (r) => `${r.id} · ${areaLabel(r.area)} · ${r.contractor}`,
    render: (r) => (
      <div className="stack">
        <Stepper steps={BOXUP_STAGES} current={r.stage} />
        <dl className="kv"><dt>Checklist</dt><dd>{r.itemsDone} of {r.items} items closed</dd><dt>Planned</dt><dd className="mono">{r.planned}</dd></dl>
        {r.hold && <div className="callout callout-crit">Held: {r.hold}</div>}
        <div className="callout">Typical checklist: internals clean and free of foreign objects, gasket and studs verified, torque recorded, tag removed, photographs attached.</div>
      </div>
    ),
  },
  initialSort: { key: 'planned', dir: 'asc' },
};

export default function BoxUpPage() {
  return <TrackerPage config={config} />;
}
