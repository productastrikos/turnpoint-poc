import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { FormDialog, type FieldDef } from '../../components/ui/FormDialog';
import { Gantt, type GanttRow } from '../../components/charts/Gantt';
import { BarChart } from '../../components/charts/BarChart';
import { addTaEvent, totals } from '../../services/portfolioService';
import { getReadiness } from '../../services/readinessService';
import { useActiveTa } from '../../app/TaContext';
import { useToast } from '../../app/ToastContext';
import { addDays, longDate, shortDate } from '../../mocks/_gen';
import type { TaEvent, TaType } from '../../types/platform';

const TYPE_COLOR: Record<TaType, string> = {
  'Major STO': 'var(--crit)',
  'Minor TA': 'var(--accent)',
  'Inspection Shutdown': 'var(--s3)',
  'Catalyst Change': 'var(--s4)',
};

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Event name', required: true, placeholder: 'e.g. Minor TA 2036: FCC' },
  { name: 'type', label: 'Type', type: 'select', options: ['Major STO', 'Minor TA', 'Inspection Shutdown', 'Catalyst Change'], required: true },
  { name: 'startDate', label: 'Planned start', type: 'date', required: true },
  { name: 'durationDays', label: 'Duration (days)', type: 'number', required: true, min: 3, max: 60 },
  { name: 'budgetOMR', label: 'Budget (OMR)', type: 'number', required: true, min: 100000 },
  { name: 'units', label: 'Units (comma separated)', required: true, placeholder: 'HCU, CDU' },
];

export default function PortfolioPage() {
  const { tas, activeTaId, setActiveTaId, refreshTas } = useActiveTa();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(activeTaId);
  const [liveReadiness, setLiveReadiness] = useState<number | null>(null);

  // the running event (STO-2026) shows the same composite as Executive Summary and Overall STO Readiness, so closing a gap there is reflected here
  useEffect(() => {
    getReadiness().then((r) => setLiveReadiness(r.composite));
  }, []);
  const events = useMemo(() => tas.map((x) => (x.status === 'active' && liveReadiness !== null ? { ...x, readinessPct: liveReadiness } : x)), [tas, liveReadiness]);
  // until the composite arrives the active event shows a placeholder, so the baseline seed never flashes as a stale number
  const readinessBar = (x: TaEvent) => (x.status === 'active' && liveReadiness === null ? <span className="small muted">…</span> : <ProgressBar value={x.readinessPct} />);

  const t = totals(tas.filter((x) => x.status !== 'completed'));
  const next = tas.find((x) => x.status === 'planned');
  const sel = events.find((x) => x.id === selected) ?? events.find((x) => x.id === activeTaId);

  const rows: GanttRow[] = tas.map((x) => ({
    id: x.id,
    label: `${x.id} · ${x.type}`,
    start: x.startDate,
    end: addDays(x.startDate, x.durationDays),
    color: TYPE_COLOR[x.type],
    progress: x.status === 'completed' ? 100 : x.status === 'active' ? 44 : 0,
    tag: `${x.durationDays} d · OMR ${(x.budgetOMR / 1e6).toFixed(1)}M`,
  }));

  const years = useMemo(() => {
    const ys = Array.from(new Set(tas.map((x) => x.year))).sort();
    return ys;
  }, [tas]);

  async function create(v: Record<string, string>) {
    const year = Number(v.startDate.slice(0, 4));
    const ev = await addTaEvent({
      name: v.name,
      year,
      type: v.type as TaType,
      units: v.units.split(',').map((u) => u.trim()).filter(Boolean),
      startDate: v.startDate,
      durationDays: Number(v.durationDays),
      budgetOMR: Number(v.budgetOMR),
    });
    refreshTas();
    setSelected(ev.id);
    setOpen(false);
    showToast(`${ev.id} added to the 10-year business plan`, 'good');
  }

  function activate(x: TaEvent) {
    setActiveTaId(x.id);
    showToast(`Active TA set to ${x.id}. Dashboard and Executive Summary now show this event.`, 'accent');
    navigate('/');
  }

  return (
    <div>
      <PageHeader
        title="Multi-TA Portfolio"
        subtitle="OQ RPI 10-year turnaround business plan with budget and estimated duration per event. Selecting an event sets the Active TA in the top bar and rescales the dashboard."
        badges={['illustrative']}
        checklist="G1"
        action={<ActionButton variant="primary" small={false} onClick={() => setOpen(true)}>Plan a TA event</ActionButton>}
      />

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatTile label="TA events 2026-2035" value={String(t.count)} />
        <StatTile label="10-year budget" value={`OMR ${(t.budgetOMR / 1e6).toFixed(1)}M`} tone="accent" />
        <StatTile label="Planned downtime" value={`${t.durationDays} days`} />
        <StatTile label="Next event" value={next ? next.id : '—'} delta={next ? `${shortDate(next.startDate)} ${next.startDate.slice(0, 4)}` : undefined} />
      </div>

      <Card>
        <CardHeader
          title="10-year TA Business Plan"
          action={
            <div className="chart-legend" style={{ margin: 0 }}>
              {(Object.keys(TYPE_COLOR) as TaType[]).map((k) => (
                <span key={k}><i style={{ background: TYPE_COLOR[k] }} />{k}</span>
              ))}
            </div>
          }
        />
        <Gantt rows={rows} from="2023-12-01" to="2036-01-31" tickMode="year" today="2026-08-16" rowHeight={26} labelWidth={210} onRowClick={(r) => setSelected(r.id)} />
      </Card>

      <div className="grid grid-3-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <Card>
          <CardHeader title="Events" />
          <DataTable
            dense
            rowKey={(x: TaEvent) => x.id}
            rows={events}
            activeKey={sel?.id}
            onRowClick={(x) => setSelected(x.id)}
            columns={[
              { key: 'id', header: 'Event', render: (x) => <div><strong className="mono">{x.id}</strong><div className="small muted">{x.name.replace(/^[^—]*— ?/, '')}</div></div>, sortValue: (x) => x.startDate },
              { key: 'type', header: 'Type', render: (x) => <span className="small">{x.type}</span> },
              { key: 'startDate', header: 'Start', mono: true, render: (x) => `${shortDate(x.startDate)} ${x.startDate.slice(0, 4)}` },
              { key: 'durationDays', header: 'Days', mono: true, align: 'right' },
              { key: 'budgetOMR', header: 'Budget', mono: true, align: 'right', render: (x) => `OMR ${(x.budgetOMR / 1e6).toFixed(1)}M` },
              { key: 'status', header: 'Status', render: (x) => <Chip tone={x.status === 'active' ? 'accent' : x.status === 'completed' ? 'good' : 'neutral'}>{x.status}</Chip> },
              { key: 'readinessPct', header: 'Readiness', render: readinessBar },
            ]}
          />
        </Card>

        <div className="stack">
          {sel && (
            <Card>
              <CardHeader title={sel.id} action={<Chip tone={sel.status === 'active' ? 'accent' : sel.status === 'completed' ? 'good' : 'neutral'}>{sel.status}</Chip>} />
              <div style={{ fontWeight: 600, marginBottom: 10 }}>{sel.name}</div>
              <dl className="kv">
                <dt>Start</dt><dd className="mono">{longDate(sel.startDate)}</dd>
                <dt>Duration</dt><dd>{sel.durationDays} days</dd>
                <dt>Budget</dt><dd className="mono">OMR {sel.budgetOMR.toLocaleString()}</dd>
                <dt>Man-hours</dt><dd className="mono">{sel.manhours.toLocaleString()}</dd>
                <dt>Units</dt><dd>{sel.units.join(', ')}</dd>
                <dt>Complexity</dt><dd>{sel.complexity} · T-{sel.prepMonths} months preparation (SOW 13)</dd>
                <dt>Readiness</dt><dd>{readinessBar(sel)}</dd>
              </dl>
              {sel.note && <p className="small muted">{sel.note}</p>}
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn btn-primary" onClick={() => activate(sel)}>
                  {sel.id === activeTaId ? 'Open dashboard' : 'Set as Active TA'}
                </button>
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Budget by year (OMR M)" />
            <BarChart
              height={200}
              labels={years.map(String)}
              series={[{ name: 'Budget', data: years.map((y) => Math.round((tas.filter((x) => x.year === y).reduce((s, x) => s + x.budgetOMR, 0) / 1e6) * 10) / 10), color: 'var(--accent)' }]}
              yFormat={(v) => v.toFixed(0)}
            />
          </Card>
        </div>
      </div>

      <FormDialog open={open} onClose={() => setOpen(false)} title="Plan a TA event" fields={FIELDS} submitLabel="Add to business plan" onSubmit={create} />
    </div>
  );
}
