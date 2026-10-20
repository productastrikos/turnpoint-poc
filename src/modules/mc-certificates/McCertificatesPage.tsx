import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Stepper } from '../../components/workflow/Stepper';
import { Donut } from '../../components/charts/Donut';
import { IdChips } from '../_shared/IdChips';
import { advanceMc, listMc, MC_ACTIONS } from '../../services/executionService';
import { MC_STAGES, type McCert } from '../../mocks/executionMock';
import { areaLabel } from '../../mocks/master';

const config: TrackerConfig<McCert> = {
  title: 'Mechanical Completion Certificates',
  subtitle: 'MC certificate register by system and area. Each certificate moves from contractor declaration through inspection verification and Operations acceptance. Issuing a certificate pushes the order status to SAP (simulated) and raises a notification.',
  checklist: 'X12',
  load: listMc,
  kpis: (rows) => [
    { label: 'Systems', value: String(rows.length) },
    { label: 'Certificates issued', value: String(rows.filter((r) => r.stage === 4).length), tone: 'good' },
    { label: 'Operations accepted', value: String(rows.filter((r) => r.stage === 3).length), tone: 'accent' },
    { label: 'Punch A open', value: String(rows.reduce((s, r) => s + r.punchA, 0)), delta: `across ${rows.length} MC systems`, tone: 'crit' },
    { label: 'Punch B open', value: String(rows.reduce((s, r) => s + r.punchB, 0)), delta: `across ${rows.length} MC systems`, tone: 'warn' },
  ],
  top: (rows) => (
    <Card>
      <CardHeader title="Certificates by stage" />
      <Donut segments={MC_STAGES.map((s, i) => ({ label: s, value: rows.filter((r) => r.stage === i).length, color: `var(--s${i + 1})` }))} centerValue={String(rows.length)} centerLabel="systems" />
    </Card>
  ),
  columns: [
    { key: 'id', header: 'Certificate', mono: true },
    { key: 'system', header: 'System', render: (r) => <div><strong>{r.system}</strong><div className="small muted">{areaLabel(r.area)} · {r.contractor}</div></div> },
    { key: 'stage', header: 'Stage', render: (r) => <Chip tone={r.stage === 4 ? 'good' : r.stage >= 2 ? 'accent' : r.stage === 1 ? 'warn' : 'neutral'}>{MC_STAGES[r.stage]}</Chip>, sortValue: (r) => r.stage },
    { key: 'punchA', header: 'Punch A', mono: true, align: 'right', render: (r) => <span style={{ color: r.punchA ? 'var(--crit)' : undefined }}>{r.punchA}</span> },
    { key: 'punchB', header: 'Punch B', mono: true, align: 'right' },
    { key: 'plannedDay', header: 'Planned', mono: true, render: (r) => `D${r.plannedDay}`, sortValue: (r) => r.plannedDay },
  ],
  filters: [{ label: 'stages', get: (r) => MC_STAGES[r.stage], options: MC_STAGES }, { label: 'areas', get: (r) => r.area }],
  search: (r) => `${r.id} ${r.system}`,
  rowAction: { label: (r) => (r.stage < 4 ? MC_ACTIONS[r.stage] : null), run: (r) => advanceMc(r.id), toast: (r) => `${r.id} advanced` },
  detail: {
    title: (r) => `${r.id} · ${r.system}`,
    subtitle: (r) => `${areaLabel(r.area)} · ${r.contractor}`,
    render: (r) => (
      <div className="stack">
        <Stepper steps={MC_STAGES} current={r.stage} />
        <div style={{ border: '2px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 18, background: 'var(--surface-2)' }}>
          <div className="eyebrow">Mechanical Completion Certificate</div>
          <h3 style={{ fontSize: 20, margin: '4px 0' }}>{r.system}</h3>
          <div className="small muted">{r.id} · OQ RPI Sohar Refinery · Major STO 2026</div>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>
            {r.contractor} certifies that the construction, erection and testing of the above system is complete in accordance with the approved drawings, specifications and inspection test plans, subject to the punch list items below.
          </p>
          <div className="row-wrap"><Chip tone={r.punchA ? 'crit' : 'good'}>Punch A open: {r.punchA}</Chip><Chip tone="warn">Punch B open: {r.punchB}</Chip></div>
          <div className="eyebrow" style={{ marginTop: 14 }}>Signatures</div>
          {['Contractor', 'Inspection (QA/QC)', 'Operations'].map((s, i) => (
            <div key={s} className="list-row"><span>{s}</span>{r.stage > i ? <Chip tone="good">signed ✓</Chip> : <Chip tone="neutral">pending</Chip>}</div>
          ))}
        </div>
        <IdChips sapWo={`400003${3200 + Number(r.id.slice(4))}`} />
      </div>
    ),
  },
  initialSort: { key: 'stage', dir: 'asc' },
};

export default function McCertificatesPage() {
  return <TrackerPage config={config} />;
}
