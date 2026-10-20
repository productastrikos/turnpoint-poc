import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Donut } from '../../components/charts/Donut';
import { getMaterials, advancePr, prActionLabel, monthsOf } from '../../services/materialsService';
import type { LeadTime, MaterialItem } from '../../types';
import { areaLabel } from '../../mocks/master';
import { shortDate } from '../../mocks/_gen';

const leadLabel: Record<LeadTime, string> = { long: 'Long lead (>6 months)', medium: 'Medium lead (4-6 months)', short: 'Short lead (<4 months)' };
const leadTone: Record<LeadTime, 'crit' | 'warn' | 'good'> = { long: 'crit', medium: 'warn', short: 'good' };
const prTone: Record<MaterialItem['prStatus'], 'neutral' | 'warn' | 'accent' | 'good'> = { 'not-raised': 'neutral', raised: 'warn', 'po-issued': 'accent', delivered: 'good' };

const config: TrackerConfig<MaterialItem> = {
  title: 'Materials / MTO Tracker',
  subtitle:
    'Consolidated MTO segregated by delivery time after PO award: Long lead (more than 6 months), Medium lead (4 to 6 months) and Short lead (less than 4 months). Raise the PR and issue the PO from here.',
  checklist: 'P1',
  load: getMaterials,
  kpis: (rows) => {
    const by = (t: LeadTime) => rows.filter((r) => r.leadTime === t);
    const val = (xs: MaterialItem[]) => xs.reduce((s, r) => s + r.estCostOMR, 0);
    return [
      { label: 'Long lead (>6 months)', value: String(by('long').length), delta: `OMR ${(val(by('long')) / 1e6).toFixed(2)}M`, tone: 'crit' },
      { label: 'Medium lead (4-6 months)', value: String(by('medium').length), delta: `OMR ${(val(by('medium')) / 1e6).toFixed(2)}M`, tone: 'warn' },
      { label: 'Short lead (<4 months)', value: String(by('short').length), delta: `OMR ${(val(by('short')) / 1e6).toFixed(2)}M`, tone: 'good' },
      { label: 'PR not yet raised', value: String(rows.filter((r) => r.prStatus === 'not-raised').length), tone: 'warn', delta: 'procurement alert' },
    ];
  },
  top: (rows) => (
    <Card>
      <CardHeader title="MTO value by lead-time category (OMR thousand)" />
      <Donut
        size={150}
        segments={(['long', 'medium', 'short'] as LeadTime[]).map((t) => ({ label: leadLabel[t], value: Math.round(rows.filter((r) => r.leadTime === t).reduce((s, r) => s + r.estCostOMR, 0) / 1000), color: `var(--${leadTone[t]})` }))}
        centerValue={String(rows.length)}
        centerLabel="MTO lines"
      />
    </Card>
  ),
  columns: [
    { key: 'id', header: 'ID', mono: true },
    { key: 'description', header: 'Description', render: (m) => <div>{m.description}<div className="small muted">{m.jobId} · {areaLabel(m.area)} · {m.qty.toLocaleString()} {m.uom}</div></div> },
    { key: 'leadTime', header: 'Lead-time category', render: (m) => <Chip tone={leadTone[m.leadTime]}>{leadLabel[m.leadTime]}</Chip>, sortValue: (m) => ['short', 'medium', 'long'].indexOf(m.leadTime) },
    { key: 'leadWeeks', header: 'Delivery after PO', mono: true, render: (m) => `${m.leadWeeks} wk · ${monthsOf(m.leadWeeks)} mo`, sortValue: (m) => m.leadWeeks },
    { key: 'estCostOMR', header: 'Est. cost', mono: true, align: 'right', render: (m) => `OMR ${m.estCostOMR.toLocaleString()}` },
    { key: 'requiredBy', header: 'Needed by', mono: true, render: (m) => shortDate(m.requiredBy) },
    { key: 'prStatus', header: 'PR / PO status', render: (m) => <Chip tone={prTone[m.prStatus]}>{m.prStatus.replace('-', ' ')}</Chip> },
  ],
  filters: [{ label: 'lead times', get: (m) => m.leadTime, options: ['long', 'medium', 'short'] }, { label: 'status', get: (m) => m.prStatus }],
  search: (m) => `${m.id} ${m.description} ${m.jobId}`,
  rowAction: { label: (m) => prActionLabel(m.prStatus), run: (m) => advancePr(m.id), toast: (m) => `${m.id} moved forward. SAP MM updated (simulated).` },
  initialSort: { key: 'leadWeeks', dir: 'desc' },
  pageSize: 14,
};

export default function MaterialsPage() {
  return <TrackerPage config={config} />;
}
