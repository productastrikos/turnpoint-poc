import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { FilterChips } from '../../components/ui/FilterChips';
import { Donut } from '../../components/charts/Donut';
import { getAllMaterials, advancePr, prActionLabel, monthsOf } from '../../services/materialsService';
import { useActiveTa } from '../../app/TaContext';
import type { LeadTime, MaterialItem } from '../../types';
import { taEvents } from '../../mocks/portfolioMock';
import { areaLabel } from '../../mocks/master';

const leadLabel: Record<LeadTime, string> = { long: 'Long lead (>6 months)', medium: 'Medium lead (4-6 months)', short: 'Short lead (<4 months)' };
const leadTone: Record<LeadTime, 'crit' | 'warn' | 'good'> = { long: 'crit', medium: 'warn', short: 'good' };
const prTone: Record<MaterialItem['prStatus'], 'neutral' | 'warn' | 'accent' | 'good'> = { 'not-raised': 'neutral', raised: 'warn', 'po-issued': 'accent', delivered: 'good' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "26 Aug 2026". The year is shown because the page can list several turnarounds at once. */
const needByDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

const taOf = (id: string) => taEvents.find((t) => t.id === id);

function buildConfig(ta: string, load: () => Promise<MaterialItem[]>, preface: ReactNode): TrackerConfig<MaterialItem> {
  return {
    title: 'Materials / MTO Tracker',
    subtitle:
      'Consolidated MTO for each turnaround, segregated by delivery time after PO award: Long lead (more than 6 months), Medium lead (4 to 6 months) and Short lead (less than 4 months). Pick a turnaround to see only its materials. Raise the PR and issue the PO from here.',
    checklist: 'P1',
    load,
    preface,
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
        <CardHeader title={`MTO value by lead-time category (OMR thousand)${ta === 'all' ? ' · all turnarounds' : ` · ${ta}`}`} />
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
      { key: 'taId', header: 'Turnaround', render: (m) => <span title={taOf(m.taId)?.name}><Chip tone={m.taId === 'STO-2026' ? 'accent' : 'neutral'}>{m.taId}</Chip></span>, sortValue: (m) => taOf(m.taId)?.year ?? 0 },
      { key: 'description', header: 'Description', render: (m) => <div>{m.description}<div className="small muted">{m.jobId} · {areaLabel(m.area)} · {m.qty.toLocaleString()} {m.uom}</div></div> },
      { key: 'leadTime', header: 'Lead-time category', render: (m) => <Chip tone={leadTone[m.leadTime]}>{leadLabel[m.leadTime]}</Chip>, sortValue: (m) => ['short', 'medium', 'long'].indexOf(m.leadTime) },
      { key: 'leadWeeks', header: 'Delivery after PO', mono: true, render: (m) => `${m.leadWeeks} wk · ${monthsOf(m.leadWeeks)} mo`, sortValue: (m) => m.leadWeeks },
      { key: 'estCostOMR', header: 'Est. cost', mono: true, align: 'right', render: (m) => `OMR ${m.estCostOMR.toLocaleString()}` },
      { key: 'requiredBy', header: 'Needed by', mono: true, render: (m) => needByDate(m.requiredBy) },
      { key: 'prStatus', header: 'PR / PO status', render: (m) => <Chip tone={prTone[m.prStatus]}>{m.prStatus.replace('-', ' ')}</Chip> },
    ],
    filters: [{ label: 'lead times', get: (m) => m.leadTime, options: ['long', 'medium', 'short'] }, { label: 'status', get: (m) => m.prStatus }],
    search: (m) => `${m.id} ${m.description} ${m.jobId} ${m.taId}`,
    rowAction: { label: (m) => prActionLabel(m.prStatus), run: (m) => advancePr(m.id), toast: (m) => `${m.id} moved forward. SAP MM updated (simulated).` },
    initialSort: { key: 'leadWeeks', dir: 'desc' },
    pageSize: 14,
  };
}

export default function MaterialsPage() {
  const { activeTaId } = useActiveTa();
  const [ta, setTa] = useState<string>(activeTaId);
  const [everything, setEverything] = useState<MaterialItem[]>([]);

  // follow the Active TA picker in the top bar, but let the filter below override it
  useEffect(() => setTa(activeTaId), [activeTaId]);
  useEffect(() => {
    getAllMaterials().then(setEverything);
  }, []);

  const load = useCallback(() => getAllMaterials().then((xs) => (ta === 'all' ? xs : xs.filter((m) => m.taId === ta))), [ta]);

  const withMaterials = useMemo(() => taEvents.filter((t) => everything.some((m) => m.taId === t.id)), [everything]);
  const selected = taOf(ta);
  const selectedRows = ta === 'all' ? everything : everything.filter((m) => m.taId === ta);

  const preface = (
    <Card>
      <div className="toolbar" style={{ marginBottom: selected || ta === 'all' ? 10 : 0 }}>
        <span className="eyebrow">Turnaround</span>
        <FilterChips
          allLabel="All turnarounds"
          value={ta}
          onChange={setTa}
          options={withMaterials.map((t) => ({ value: t.id, count: everything.filter((m) => m.taId === t.id).length }))}
        />
      </div>
      <div className="small muted">
        {selected
          ? `${selected.name} · ${selected.status} · starts ${needByDate(selected.startDate)} · ${selected.durationDays} days · ${selectedRows.length} MTO lines, OMR ${(selectedRows.reduce((s, m) => s + m.estCostOMR, 0) / 1e6).toFixed(2)}M`
          : `${withMaterials.length} turnarounds · ${everything.length} MTO lines, OMR ${(everything.reduce((s, m) => s + m.estCostOMR, 0) / 1e6).toFixed(2)}M. Every line belongs to one turnaround.`}
      </div>
    </Card>
  );

  return <TrackerPage config={buildConfig(ta, load, preface)} />;
}
