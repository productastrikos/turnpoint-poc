import type { ReactNode } from 'react';
import type { KPI } from '../../types';
import type { FieldDef } from '../../components/ui/FormDialog';
import type { Column } from '../../components/ui/DataTable';
import { BarChart } from '../../components/charts/BarChart';
import { Donut } from '../../components/charts/Donut';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { AREA_IDS, CONTRACTOR_NAMES, PEOPLE } from '../../mocks/master';
import type { PreTaRow, PreTaSlug } from '../../mocks/preTaMock';

export interface PreTaDef {
  slug: PreTaSlug;
  title: string;
  subtitle: string;
  checklist: string;
  stages: string[];
  verbs: string[]; // action label to move from stage i to i+1
  metricCols: Column<PreTaRow>[];
  kpis: (rows: PreTaRow[]) => KPI[];
  chart?: (rows: PreTaRow[], stages: string[]) => ReactNode;
  fields: FieldDef[];
  build: (v: Record<string, string>) => Omit<PreTaRow, 'id' | 'slug'>;
  /** metric column keys and KPI labels that show cost; hidden for the Contractor Supervisor (SOW 4.17). */
  costKeys?: string[];
  costKpis?: string[];
}

const n = (x: number | string) => Number(x);
const sum = (rows: PreTaRow[], key: string) => rows.reduce((s, r) => s + n(r.metrics[key] ?? 0), 0);
const at = (rows: PreTaRow[], stage: number) => rows.filter((r) => r.stage === stage).length;
const atLeast = (rows: PreTaRow[], stage: number) => rows.filter((r) => r.stage >= stage).length;
const pct = (a: number, b: number) => `${b ? Math.round((a / b) * 100) : 0}%`;

function stageChart(title: string) {
  return (rows: PreTaRow[], stages: string[]): ReactNode => {
    const areas = AREA_IDS.filter((a) => rows.some((r) => r.area === a));
    return (
      <Card>
        <CardHeader title={title} />
        <BarChart height={210} stacked labels={areas.map((a) => a.replace('Unit ', 'U').replace('Pipe Rack 4', 'PR4').replace('Flare System', 'Flare'))} series={stages.map((s, i) => ({ name: s, data: areas.map((a) => rows.filter((r) => r.area === a && r.stage === i).length), color: `var(--s${i + 1})` }))} />
      </Card>
    );
  };
}

function donut(title: string, label: (r: PreTaRow) => string) {
  return (rows: PreTaRow[]): ReactNode => {
    const keys = Array.from(new Set(rows.map(label)));
    return (
      <Card>
        <CardHeader title={title} />
        <Donut segments={keys.map((k) => ({ label: k, value: rows.filter((r) => label(r) === k).length }))} centerValue={String(rows.length)} centerLabel="items" />
      </Card>
    );
  };
}

const common = (extra: FieldDef[]): FieldDef[] => [
  { name: 'title', label: 'Description', required: true },
  { name: 'area', label: 'Area', type: 'select', options: AREA_IDS, required: true },
  { name: 'contractor', label: 'Contractor', type: 'select', options: CONTRACTOR_NAMES, required: true },
  ...extra,
  { name: 'plannedDay', label: 'Planned TA day', type: 'number', required: true, min: -30, max: 40 },
];

const mk = (prefix: string, v: Record<string, string>, metrics: Record<string, number | string>, owner = PEOPLE.planner): Omit<PreTaRow, 'id' | 'slug'> => ({
  ref: `${prefix}-${Math.floor(9000 + Math.random() * 900)}`,
  title: v.title,
  area: v.area,
  contractor: v.contractor,
  stage: 0,
  plannedDay: Number(v.plannedDay),
  owner,
  metrics,
});

export const PRETA_DEFS: Record<PreTaSlug, PreTaDef> = {
  scaffold: {
    slug: 'scaffold',
    title: 'Scaffold Management',
    subtitle: 'Scaffold requests through erection, inspection and tagging, use and dismantling. Red-tagged scaffolds cannot be used. Advance a scaffold through its stages.',
    checklist: 'R1',
    stages: ['Requested', 'Erected', 'Inspected & tagged', 'In use', 'Dismantled'],
    verbs: ['Mark erected', 'Inspect and tag green', 'Hand over for use', 'Dismantle'],
    metricCols: [
      { key: 'type', header: 'Type', render: (r) => <span className="small">{r.metrics.type}</span> },
      { key: 'height', header: 'Height', mono: true, align: 'right', render: (r) => `${r.metrics.height} m` },
      { key: 'volume', header: 'Volume', mono: true, align: 'right', render: (r) => `${r.metrics.volume} m³` },
      { key: 'tag', header: 'Tag', render: (r) => <Chip tone={String(r.metrics.tag).startsWith('Green') ? 'good' : String(r.metrics.tag).startsWith('Red') ? 'crit' : 'neutral'}>{r.metrics.tag}</Chip> },
    ],
    kpis: (rows) => [
      { label: 'Scaffolds', value: String(rows.length) },
      { label: 'Erected or beyond', value: pct(atLeast(rows, 1), rows.length), tone: 'accent' },
      { label: 'Red-tagged (not inspected)', value: String(rows.filter((r) => String(r.metrics.tag).startsWith('Red')).length), tone: 'crit' },
      { label: 'In use', value: String(at(rows, 3)), tone: 'good' },
      { label: 'Erected volume', value: `${sum(rows.filter((r) => r.stage >= 1), 'volume').toLocaleString()} m³` },
    ],
    chart: stageChart('Scaffolds by area and stage'),
    fields: common([{ name: 'type', label: 'Type', type: 'select', options: ['Tube and clamp', 'System scaffold', 'Hanging scaffold', 'Mobile tower'], required: true }, { name: 'height', label: 'Height (m)', type: 'number', required: true, min: 1, max: 60 }]),
    build: (v) => mk('SC', v, { type: v.type, height: n(v.height), volume: n(v.height) * 25, tag: '—', load: 'General' }),
  },
  isolation: {
    slug: 'isolation',
    title: 'Isolation Management',
    subtitle: 'Isolation plans from identification of points to lock-out, zero-energy verification and de-isolation, linked to permits to work. Isolation certificates feed the permit and readiness views.',
    checklist: 'R2',
    stages: ['Planned', 'Points identified', 'Isolated & locked', 'Verified zero energy', 'De-isolated'],
    verbs: ['Identify points', 'Apply isolation and lock', 'Verify zero energy', 'De-isolate'],
    metricCols: [
      { key: 'kind', header: 'Method', render: (r) => <span className="small">{r.metrics.kind}</span> },
      { key: 'points', header: 'Points', mono: true, align: 'right' },
      { key: 'certificate', header: 'Certificate', mono: true, render: (r) => String(r.metrics.certificate) },
      { key: 'permit', header: 'Permit', mono: true, render: (r) => String(r.metrics.permit) },
    ],
    kpis: (rows) => [
      { label: 'Isolations', value: String(rows.length) },
      { label: 'Isolated or verified', value: String(at(rows, 2) + at(rows, 3)), tone: 'accent' },
      { label: 'Verified zero energy', value: String(at(rows, 3)), tone: 'good' },
      { label: 'Isolation points (active)', value: String(sum(rows.filter((r) => r.stage >= 2 && r.stage < 4), 'points')) },
      { label: 'Not yet planned', value: String(at(rows, 0)), tone: 'warn' },
    ],
    chart: donut('By isolation method', (r) => String(r.metrics.kind)),
    fields: common([{ name: 'kind', label: 'Method', type: 'select', options: ['Blind / spade', 'Valve lock-out', 'Electrical LOTO', 'Double block and bleed'], required: true }, { name: 'points', label: 'Isolation points', type: 'number', required: true, min: 1, max: 40 }]),
    build: (v) => mk('ISO', v, { kind: v.kind, points: n(v.points), permit: 'PTW-pending', certificate: 'IC-new' }, PEOPLE.process),
  },
  insulation: {
    slug: 'insulation',
    title: 'Insulation Management',
    subtitle: 'Insulation removal and reinstatement by line and equipment in square metres, with an asbestos / hazardous material check before removal.',
    checklist: 'R5',
    stages: ['Planned', 'Removal in progress', 'Removed', 'Reinstating', 'Complete'],
    verbs: ['Start removal', 'Complete removal', 'Start reinstatement', 'Complete'],
    metricCols: [
      { key: 'total', header: 'Total m²', mono: true, align: 'right' },
      { key: 'removed', header: 'Removed', mono: true, align: 'right', render: (r) => `${r.metrics.removed} m²` },
      { key: 'reinstalled', header: 'Reinstated', mono: true, align: 'right', render: (r) => `${r.metrics.reinstalled} m²` },
      { key: 'asbestos', header: 'Hazmat check', render: (r) => <Chip tone={r.metrics.asbestos === 'Clear' ? 'good' : 'warn'}>{r.metrics.asbestos}</Chip> },
    ],
    kpis: (rows) => [
      { label: 'Packages', value: String(rows.length) },
      { label: 'Removed', value: `${sum(rows, 'removed').toLocaleString()} m²`, tone: 'accent' },
      { label: 'Reinstated', value: `${sum(rows, 'reinstalled').toLocaleString()} m²`, tone: 'good' },
      { label: 'Removed vs total', value: pct(sum(rows, 'removed'), sum(rows, 'total')) },
      { label: 'Hazmat samples pending', value: String(rows.filter((r) => r.metrics.asbestos !== 'Clear').length), tone: 'warn' },
    ],
    chart: stageChart('Insulation packages by area and stage'),
    fields: common([{ name: 'total', label: 'Area (m²)', type: 'number', required: true, min: 1 }]),
    build: (v) => mk('INS', v, { total: n(v.total), removed: 0, reinstalled: 0, asbestos: 'Sample pending' }),
  },
  weld: {
    slug: 'weld',
    title: 'Weld Management',
    subtitle: 'Weld-map style tracking: joints planned, welded, NDT passed and repaired, by package and WPS. Repair rate is watched against the 5% alert level.',
    checklist: 'R6',
    stages: ['Planned', 'Fit-up', 'Welded', 'NDT done', 'Accepted'],
    verbs: ['Start fit-up', 'Complete welding', 'Complete NDT', 'Accept'],
    metricCols: [
      { key: 'wps', header: 'WPS', mono: true, render: (r) => String(r.metrics.wps) },
      { key: 'joints', header: 'Joints', mono: true, align: 'right' },
      { key: 'welded', header: 'Welded', mono: true, align: 'right' },
      { key: 'ndtPassed', header: 'NDT passed', mono: true, align: 'right' },
      { key: 'repairs', header: 'Repairs', mono: true, align: 'right', render: (r) => <span style={{ color: n(r.metrics.repairs) / Math.max(1, n(r.metrics.welded)) > 0.05 ? 'var(--crit)' : undefined }}>{r.metrics.repairs}</span> },
    ],
    kpis: (rows) => {
      const welded = sum(rows, 'welded');
      const rep = sum(rows, 'repairs');
      const ndt = sum(rows, 'ndtPassed') + rep;
      return [
        { label: 'Joints total', value: sum(rows, 'joints').toLocaleString() },
        { label: 'Welded', value: welded.toLocaleString(), tone: 'accent', delta: pct(welded, sum(rows, 'joints')) },
        { label: 'NDT passed', value: sum(rows, 'ndtPassed').toLocaleString(), tone: 'good' },
        { label: 'Repair rate', value: pct(rep, ndt), tone: rep / Math.max(1, ndt) > 0.05 ? 'crit' : 'good', delta: 'alert above 5%' },
        { label: 'Packages accepted', value: String(at(rows, 4)) },
      ];
    },
    chart: stageChart('Weld packages by area and stage'),
    fields: common([{ name: 'joints', label: 'Joints', type: 'number', required: true, min: 1 }, { name: 'wps', label: 'WPS', type: 'select', options: ['WPS-CS-01', 'WPS-CS-04', 'WPS-SS-02', 'WPS-P91-01', 'WPS-CR-05'], required: true }]),
    build: (v) => mk('WLD', v, { wps: v.wps, joints: n(v.joints), welded: 0, ndtPassed: 0, repairs: 0 }, PEOPLE.inspection),
  },
  rigging: {
    slug: 'rigging',
    title: 'Rigging & Lift Management',
    subtitle: 'Lift plans by load, crane and radius, with critical lifts flagged for approval before the crane is mobilised.',
    checklist: 'R7',
    stages: ['Plan drafted', 'Plan approved', 'Crane mobilised', 'Lift complete'],
    verbs: ['Approve lift plan', 'Mobilise crane', 'Complete lift'],
    metricCols: [
      { key: 'class', header: 'Class', render: (r) => <Chip tone={r.metrics.class === 'Critical lift' ? 'crit' : 'neutral'}>{r.metrics.class}</Chip> },
      { key: 'load', header: 'Load', mono: true, align: 'right', render: (r) => `${r.metrics.load} t` },
      { key: 'crane', header: 'Crane', render: (r) => <span className="small">{r.metrics.crane}</span> },
      { key: 'radius', header: 'Radius', mono: true, align: 'right', render: (r) => `${r.metrics.radius} m` },
    ],
    kpis: (rows) => [
      { label: 'Lift plans', value: String(rows.length) },
      { label: 'Critical lifts', value: String(rows.filter((r) => r.metrics.class === 'Critical lift').length), tone: 'crit' },
      { label: 'Critical, plan not approved', value: String(rows.filter((r) => r.metrics.class === 'Critical lift' && r.stage === 0).length), tone: 'warn' },
      { label: 'Lifts complete', value: String(at(rows, 3)), tone: 'good' },
      { label: 'Heaviest lift', value: `${Math.max(...rows.map((r) => n(r.metrics.load)))} t` },
    ],
    chart: donut('By crane', (r) => String(r.metrics.crane)),
    fields: common([{ name: 'load', label: 'Load (t)', type: 'number', required: true, min: 0.1 }, { name: 'crane', label: 'Crane', type: 'select', options: ['250 t crawler', '80 t mobile', '50 t mobile'], required: true }, { name: 'class', label: 'Class', type: 'select', options: ['Ordinary lift', 'Critical lift'], required: true }]),
    build: (v) => mk('LP', v, { load: n(v.load), crane: v.crane, radius: 18, class: v.class, rigger: 'Appointed person' }, PEOPLE.rotating),
  },
  tools: {
    slug: 'tools',
    title: 'Tools Management',
    subtitle: 'Special tools and equipment from request to issue and return, with calibration due dates. Anything due within 7 days is flagged.',
    checklist: 'R8',
    stages: ['Requested', 'Available', 'Issued', 'Returned'],
    verbs: ['Confirm availability', 'Issue to crew', 'Receive return'],
    metricCols: [
      { key: 'qty', header: 'Qty', mono: true, align: 'right' },
      { key: 'serial', header: 'Serial', mono: true, render: (r) => String(r.metrics.serial) },
      { key: 'crib', header: 'Crib' },
      { key: 'calibrationDue', header: 'Calibration due', render: (r) => <Chip tone={n(r.metrics.calibrationDue) <= 7 ? 'crit' : n(r.metrics.calibrationDue) <= 30 ? 'warn' : 'good'}>{r.metrics.calibrationDue} d</Chip>, sortValue: (r) => n(r.metrics.calibrationDue) },
    ],
    kpis: (rows) => [
      { label: 'Tool requests', value: String(rows.length) },
      { label: 'Issued now', value: String(at(rows, 2)), tone: 'accent' },
      { label: 'Not yet available', value: String(at(rows, 0)), tone: 'warn' },
      { label: 'Calibration due ≤ 7 days', value: String(rows.filter((r) => n(r.metrics.calibrationDue) <= 7 && r.stage < 3).length), tone: 'crit' },
      { label: 'Returned', value: String(at(rows, 3)), tone: 'good' },
    ],
    chart: stageChart('Tools by area and stage'),
    fields: common([{ name: 'qty', label: 'Quantity', type: 'number', required: true, min: 1 }]),
    build: (v) => mk('TL', v, { qty: n(v.qty), calibrationDue: 60, crib: 'Crib A', serial: 'SN-new' }, 'Tool crib'),
  },
  'bagging-tagging': {
    slug: 'bagging-tagging',
    title: 'Bagging & Tagging Progress',
    subtitle: 'Protection and identification of instruments, valves and cables before work starts, tracked by item counts per package until verified.',
    checklist: 'R9',
    stages: ['Not started', 'Bagged', 'Tagged', 'Verified'],
    verbs: ['Complete bagging', 'Complete tagging', 'Verify'],
    metricCols: [
      { key: 'items', header: 'Items', mono: true, align: 'right' },
      { key: 'bagged', header: 'Bagged', mono: true, align: 'right', render: (r) => `${r.metrics.bagged} (${pct(n(r.metrics.bagged), n(r.metrics.items))})` },
      { key: 'tagged', header: 'Tagged', mono: true, align: 'right', render: (r) => `${r.metrics.tagged} (${pct(n(r.metrics.tagged), n(r.metrics.items))})` },
    ],
    kpis: (rows) => [
      { label: 'Packages', value: String(rows.length) },
      { label: 'Items in scope', value: sum(rows, 'items').toLocaleString() },
      { label: 'Bagged', value: pct(sum(rows, 'bagged'), sum(rows, 'items')), tone: 'accent' },
      { label: 'Tagged', value: pct(sum(rows, 'tagged'), sum(rows, 'items')), tone: 'good' },
      { label: 'Verified packages', value: String(at(rows, 3)), tone: 'good' },
    ],
    chart: stageChart('Bagging and tagging packages by area and stage'),
    fields: common([{ name: 'items', label: 'Items', type: 'number', required: true, min: 1 }]),
    build: (v) => mk('BT', v, { items: n(v.items), bagged: 0, tagged: 0 }, PEOPLE.instr),
  },
  'heavy-equipment': {
    slug: 'heavy-equipment',
    title: 'Heavy Equipment Management',
    subtitle: 'Cranes, manlifts, forklifts and other heavy equipment from request through mobilisation to demobilisation, with operator certificate expiry and hours used.',
    checklist: 'R10',
    stages: ['Requested', 'Mobilised', 'In use', 'Demobilised'],
    verbs: ['Mobilise', 'Put into service', 'Demobilise'],
    metricCols: [
      { key: 'plate', header: 'Plate', mono: true, render: (r) => String(r.metrics.plate) },
      { key: 'hours', header: 'Hours', mono: true, align: 'right' },
      { key: 'certDays', header: 'Certificate', render: (r) => <Chip tone={n(r.metrics.certDays) <= 14 ? 'crit' : n(r.metrics.certDays) <= 45 ? 'warn' : 'good'}>{r.metrics.certDays} d left</Chip>, sortValue: (r) => n(r.metrics.certDays) },
      { key: 'rate', header: 'Rate/day', mono: true, align: 'right', render: (r) => `OMR ${r.metrics.rate}` },
    ],
    kpis: (rows) => [
      { label: 'Units', value: String(rows.length) },
      { label: 'On site', value: String(at(rows, 1) + at(rows, 2)), tone: 'accent' },
      { label: 'In use', value: String(at(rows, 2)), tone: 'good' },
      { label: 'Certificate expiring ≤ 14 d', value: String(rows.filter((r) => n(r.metrics.certDays) <= 14 && r.stage < 3).length), tone: 'crit' },
      { label: 'Daily hire (on site)', value: `OMR ${rows.filter((r) => r.stage === 1 || r.stage === 2).reduce((s, r) => s + n(r.metrics.rate), 0).toLocaleString()}` },
    ],
    chart: donut('By stage', (r) => ['Requested', 'Mobilised', 'In use', 'Demobilised'][r.stage]),
    fields: common([{ name: 'rate', label: 'Daily rate (OMR)', type: 'number', required: true, min: 1 }]),
    build: (v) => mk('HE', v, { plate: 'OM pending', hours: 0, certDays: 120, rate: n(v.rate) }, PEOPLE.rotating),
    costKeys: ['rate'],
    costKpis: ['Daily hire (on site)'],
  },
  prefab: {
    slug: 'prefab',
    title: 'Fabricated Material & Pre-fabrication',
    subtitle: 'Spool pre-fabrication status from drawing issue to delivery on site, in spools, weight and weld inch-diameter.',
    checklist: 'R11',
    stages: ['Drawing issued', 'Cutting', 'Fabricated', 'NDT & tested', 'Delivered to site'],
    verbs: ['Start cutting', 'Complete fabrication', 'Pass NDT and test', 'Deliver to site'],
    metricCols: [
      { key: 'spools', header: 'Spools', mono: true, align: 'right' },
      { key: 'weightKg', header: 'Weight', mono: true, align: 'right', render: (r) => `${Number(r.metrics.weightKg).toLocaleString()} kg` },
      { key: 'diaInch', header: 'Inch-dia', mono: true, align: 'right' },
      { key: 'shop', header: 'Shop' },
    ],
    kpis: (rows) => [
      { label: 'Spool sets', value: String(rows.length) },
      { label: 'Spools total', value: sum(rows, 'spools').toLocaleString() },
      { label: 'Fabricated or beyond', value: pct(rows.filter((r) => r.stage >= 2).reduce((s, r) => s + n(r.metrics.spools), 0), sum(rows, 'spools')), tone: 'accent', delta: 'by spool count' },
      { label: 'Delivered to site', value: String(at(rows, 4)), tone: 'good' },
      { label: 'Weight fabricated', value: `${Math.round(rows.filter((r) => r.stage >= 2).reduce((s, r) => s + n(r.metrics.weightKg), 0) / 1000)} t` },
    ],
    chart: stageChart('Spool sets by area and stage'),
    fields: common([{ name: 'spools', label: 'Spools', type: 'number', required: true, min: 1 }]),
    build: (v) => mk('SP', v, { spools: n(v.spools), weightKg: n(v.spools) * 400, diaInch: n(v.spools) * 50, shop: 'Fab shop 1' }),
  },
  waste: {
    slug: 'waste',
    title: 'Waste Management',
    subtitle: 'Waste by stream with tonnes, hazard class, manifest and disposal certificate. A load cannot leave site without a manifest.',
    checklist: 'R12',
    stages: ['Generated', 'Segregated', 'Manifested', 'Transported', 'Disposed (certificate)'],
    verbs: ['Segregate', 'Issue manifest', 'Dispatch', 'Confirm disposal'],
    metricCols: [
      { key: 'tonnes', header: 'Tonnes', mono: true, align: 'right', render: (r) => Number(r.metrics.tonnes).toFixed(1) },
      { key: 'hazard', header: 'Class', render: (r) => <Chip tone={r.metrics.hazard === 'Hazardous' ? 'crit' : 'good'}>{r.metrics.hazard}</Chip> },
      { key: 'manifest', header: 'Manifest', mono: true, render: (r) => (r.stage >= 2 ? String(r.metrics.manifest) : <span className="muted">not issued</span>) },
      { key: 'disposer', header: 'Disposal route', render: (r) => <span className="small">{r.metrics.disposer}</span> },
    ],
    kpis: (rows) => [
      { label: 'Waste tonnes', value: sum(rows, 'tonnes').toFixed(0), tone: 'accent' },
      { label: 'Hazardous', value: `${rows.filter((r) => r.metrics.hazard === 'Hazardous').reduce((s, r) => s + n(r.metrics.tonnes), 0).toFixed(0)} t`, tone: 'crit' },
      { label: 'Disposed with certificate', value: `${rows.filter((r) => r.stage === 4).reduce((s, r) => s + n(r.metrics.tonnes), 0).toFixed(0)} t`, tone: 'good' },
      { label: 'Awaiting manifest', value: String(rows.filter((r) => r.stage === 1).length), tone: 'warn' },
      { label: 'Recycled / reclaimed', value: pct(rows.filter((r) => /reclaim|Recycler/.test(String(r.metrics.disposer))).reduce((s, r) => s + n(r.metrics.tonnes), 0), sum(rows, 'tonnes')) },
    ],
    chart: (rows) => {
      const streams = Array.from(new Set(rows.map((r) => String(r.metrics.stream))));
      return (
        <Card>
          <CardHeader title="Tonnes by stream" />
          <BarChart height={210} labels={streams.map((s) => s.split(' ').slice(0, 2).join(' '))} series={[{ name: 'Tonnes', color: 'var(--accent)', data: streams.map((s) => Math.round(rows.filter((r) => r.metrics.stream === s).reduce((a, r) => a + n(r.metrics.tonnes), 0))) }]} />
        </Card>
      );
    },
    fields: common([{ name: 'stream', label: 'Stream', type: 'select', options: ['Spent hydrocracking catalyst', 'Hydrocarbon sludge', 'Scrap carbon steel', 'Used insulation (mineral wool)', 'Chemical cleaning effluent', 'Refractory debris', 'General site waste'], required: true }, { name: 'tonnes', label: 'Tonnes', type: 'number', required: true, min: 0.1 }]),
    build: (v) => mk('WM', v, { stream: v.stream, tonnes: n(v.tonnes), hazard: /catalyst|sludge|effluent/i.test(v.stream) ? 'Hazardous' : 'Non-hazardous', manifest: `WCM-${Math.floor(10000 + Math.random() * 80000)}`, disposer: 'Licensed contractor' }, PEOPLE.hse),
  },
  'equipment-inspection': {
    slug: 'equipment-inspection',
    title: 'Inspection of Equipment & Tools',
    subtitle: 'Third-party and site inspection of lifting gear, cranes, safety equipment and instruments before use. Failed items are quarantined and cannot be certified.',
    checklist: 'R13',
    stages: ['Due', 'Inspected', 'Certified'],
    verbs: ['Record inspection', 'Issue certificate'],
    metricCols: [
      { key: 'inspector', header: 'Inspector', render: (r) => <span className="small">{r.metrics.inspector}</span> },
      { key: 'result', header: 'Result', render: (r) => <Chip tone={String(r.metrics.result).startsWith('Failed') ? 'crit' : r.metrics.result === 'Passed' ? 'good' : 'neutral'}>{r.metrics.result}</Chip> },
      { key: 'cert', header: 'Certificate', mono: true, render: (r) => String(r.metrics.cert) },
      { key: 'validDays', header: 'Valid for', mono: true, align: 'right', render: (r) => (n(r.metrics.validDays) ? `${r.metrics.validDays} d` : '—') },
    ],
    kpis: (rows) => [
      { label: 'Items', value: String(rows.length) },
      { label: 'Certified', value: pct(at(rows, 2), rows.length), tone: 'good' },
      { label: 'Due for inspection', value: String(at(rows, 0)), tone: 'warn' },
      { label: 'Failed, quarantined', value: String(rows.filter((r) => String(r.metrics.result).startsWith('Failed')).length), tone: 'crit' },
      { label: 'Overdue (planned day passed)', value: String(rows.filter((r) => r.stage === 0 && r.plannedDay < 0).length), tone: 'crit' },
    ],
    chart: stageChart('Equipment inspections by area and stage'),
    fields: common([{ name: 'inspector', label: 'Inspector', type: 'select', options: ['Third party: Bureau Veritas', 'Third party: TUV', 'Site inspector'], required: true }]),
    build: (v) => mk('EI', v, { cert: '—', inspector: v.inspector, result: 'Pending', validDays: 0 }, PEOPLE.qaqc),
  },
};
