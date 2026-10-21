import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Tabs } from '../../components/ui/Tabs';
import { FormFields, initialValues, validate, type FieldDef, type FormValues } from '../../components/ui/FormDialog';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { createJob, createJobs } from '../../services/jobsService';
import { BULK_SAMPLE, EXCEL_SAMPLE, type ImportRow } from '../../mocks/scopeMock';
import { AREA_IDS, DISCIPLINES, PEOPLE } from '../../mocks/master';
import { useToast } from '../../app/ToastContext';
import { SapPullDrawer } from '../integrations/SapTab';
import { DupCheckChip } from './DuplicatePanel';
import { DurationExamples, DurationGuard } from './DurationGuard';
import type { DurationAssessment } from '../../ai/durationModel';
import type { DurationExample } from '../../services/durationService';
import { checkCandidate, checkRows, type PairScore } from '../../services/duplicateService';
import { SimBadge } from '../../components/ui/SimBadge';
import type { Discipline, Job } from '../../types';

const LEVELS = ['1', '2', '3', '4', '5'];

const FIELDS: FieldDef[] = [
  { name: 'desc', label: 'Scope description', required: true, placeholder: 'What work, on which equipment' },
  { name: 'discipline', label: 'Discipline', type: 'select', options: DISCIPLINES, required: true },
  { name: 'area', label: 'Area / unit', type: 'select', options: AREA_IDS, required: true },
  { name: 'tag', label: 'Equipment tag', required: true, placeholder: 'e.g. E-204' },
  { name: 'costOMR', label: 'Budgetary estimate (OMR)', type: 'number', required: true, min: 1 },
  { name: 'manhours', label: 'Man-hours', type: 'number', required: true, min: 1 },
  { name: 'plannedHours', label: 'Planned duration (hours)', type: 'number', required: true, min: 0.5, hint: 'Elapsed time you expect the work to take. The AI checks it below.' },
  { name: 'likelihood', label: 'Risk likelihood (1-5)', type: 'select', options: LEVELS, required: true },
  { name: 'consequence', label: 'Risk consequence (1-5)', type: 'select', options: LEVELS, required: true },
  { name: 'requestedBy', label: 'Originator', required: true, defaultValue: PEOPLE.planner },
  { name: 'justification', label: 'Justification (optional)', type: 'textarea' },
];

const TABS = [
  { id: 'manual', label: 'Manual entry' },
  { id: 'bulk', label: 'Bulk upload' },
  { id: 'excel', label: 'Excel import' },
  { id: 'sap', label: 'SAP notifications / orders' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function rowProblem(r: ImportRow & { problem?: string }): string | undefined {
  if (r.problem) return r.problem;
  if (!r.tag) return 'Equipment tag missing';
  if (!r.costOMR) return 'Cost estimate missing';
  return undefined;
}

export function CreateScopeDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<TabId>('manual');
  const [values, setValues] = useState<FormValues>(() => initialValues(FIELDS));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState<'bulk' | 'excel' | null>(null);
  const [sapOpen, setSapOpen] = useState(false);
  const [matches, setMatches] = useState<PairScore[]>([]);
  const [duration, setDuration] = useState<DurationAssessment | null>(null);
  const [rowChecks, setRowChecks] = useState<Record<string, PairScore | undefined>>({});

  // as-you-type duplicate check (S9): debounced, against the live worklist
  useEffect(() => {
    if (tab !== 'manual') return;
    const t = setTimeout(() => {
      checkCandidate({ desc: values.desc ?? '', tag: values.tag ?? '', area: values.area ?? '', discipline: values.discipline ?? '', costOMR: Number(values.costOMR) || undefined }).then(setMatches);
    }, 250);
    return () => clearTimeout(t);
  }, [tab, values.desc, values.tag, values.area, values.discipline, values.costOMR]);

  const required = FIELDS.filter((f) => f.required);
  const filled = required.filter((f) => (values[f.name] ?? '').trim() !== '').length;

  async function submit() {
    const errs = validate(FIELDS, values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      showToast(`${Object.keys(errs).length} mandatory field(s) missing. The item cannot be created incomplete.`, 'crit');
      return;
    }
    setBusy(true);
    const planned = Number(values.plannedHours);
    const underEstimated = duration !== null && duration.verdict !== 'ok';
    const job = await createJob({
      desc: values.desc,
      discipline: values.discipline as Discipline,
      area: values.area,
      tag: values.tag,
      requestedBy: values.requestedBy,
      costOMR: Number(values.costOMR),
      manhours: Number(values.manhours),
      likelihood: Number(values.likelihood) as Job['likelihood'],
      consequence: Number(values.consequence) as Job['consequence'],
      source: 'Manual',
      plannedHours: planned,
      aiDuration: duration
        ? { expectedHours: duration.expectedHours, p80Hours: duration.p80Hours, verdict: duration.verdict, withinPct: duration.withinPct, accepted: planned >= duration.expectedHours }
        : undefined,
    });
    setBusy(false);
    setValues(initialValues(FIELDS));
    setErrors({});
    onCreated();
    onClose();
    const dup = matches.find((m) => m.kind === 'duplicate');
    if (underEstimated && duration && planned < duration.expectedHours) {
      showToast(`${job.id} created with ${planned} h, but the AI expects about ${duration.expectedHours} h. The gap is flagged in the worklist.`, 'warn');
      return;
    }
    showToast(dup ? `${job.id} created at Gate 1 and flagged as a possible duplicate of ${dup.b.id}: it is listed for review in the worklist.` : `${job.id} created at Gate 1. Completeness 100%.`, dup ? 'warn' : 'good');
  }

  async function importRows(rows: (ImportRow & { problem?: string })[], source: Job['source']) {
    setBusy(true);
    const dupRows = rows.filter((r) => !rowProblem(r) && rowChecks[r.desc]?.kind === 'duplicate');
    const ok = rows.filter((r) => !rowProblem(r) && !dupRows.includes(r));
    await createJobs(
      ok.map((r) => ({
        desc: r.desc,
        discipline: r.discipline as Discipline,
        area: r.area,
        tag: r.tag,
        requestedBy: PEOPLE.planner,
        costOMR: r.costOMR,
        manhours: r.manhours,
        likelihood: r.likelihood as Job['likelihood'],
        consequence: r.consequence as Job['consequence'],
        source,
      }))
    );
    setBusy(false);
    setLoaded(null);
    onCreated();
    onClose();
    const invalid = rows.length - ok.length - dupRows.length;
    const dupNote = dupRows.length ? ` ${dupRows.length} skipped as duplicate${dupRows.length === 1 ? '' : 's'} of ${dupRows.map((r) => rowChecks[r.desc]!.b.id).join(', ')}.` : '';
    showToast(`${ok.length} rows imported as scope items at Gate 1.${invalid ? ` ${invalid} rejected for missing mandatory fields.` : ''}${dupNote}`, invalid || dupRows.length ? 'warn' : 'good');
  }

  function applyExample(ex: DurationExample) {
    setValues((p) => ({ ...p, desc: ex.desc, discipline: ex.discipline, area: ex.area, tag: ex.tag, plannedHours: String(ex.plannedHours), manhours: String(ex.manhours), costOMR: String(ex.costOMR), likelihood: p.likelihood || '3', consequence: p.consequence || '3' }));
    setErrors({});
  }

  const sample = loaded === 'bulk' ? BULK_SAMPLE : loaded === 'excel' ? EXCEL_SAMPLE : [];

  useEffect(() => {
    if (!loaded) return;
    const rows = loaded === 'bulk' ? BULK_SAMPLE : EXCEL_SAMPLE;
    checkRows(rows.map((r) => ({ id: r.desc, desc: r.desc, tag: r.tag, area: r.area, discipline: r.discipline, costOMR: r.costOMR, manhours: r.manhours }))).then(setRowChecks);
  }, [loaded]);
  const top = matches[0];
  const dupWarning = top?.kind === 'duplicate';

  return (
    <>
      <Modal open={open} onClose={onClose} title="New scope item" width={760}>
        <Tabs tabs={TABS} value={tab} onChange={(t) => { setTab(t); setLoaded(null); }} />

        {tab === 'manual' && (
          <>
            <div className="completeness">
              <span className="eyebrow">Mandatory-field completeness</span>
              <ProgressBar value={filled} max={required.length} label="complete" />
              <span className="mono small">{filled}/{required.length}</span>
            </div>
            <DurationExamples onPick={applyExample} />
            <FormFields fields={FIELDS} values={values} errors={errors} onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))} />
            <DurationGuard
              desc={values.desc ?? ''}
              tag={values.tag ?? ''}
              area={values.area ?? ''}
              discipline={values.discipline ?? ''}
              plannedHours={values.plannedHours ?? ''}
              onUseHours={(h) => setValues((p) => ({ ...p, plannedHours: String(h) }))}
              onResult={setDuration}
            />
            {top && (
              <div className={`callout ${dupWarning ? 'callout-crit' : ''}`} style={{ marginTop: 14 }} role="status">
                <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
                  <strong>{dupWarning ? `Possible duplicate of ${top.b.id} (${Math.round(top.probability * 100)}%)` : `Same work front as ${top.b.id}: consider bundling`}</strong>
                  <SimBadge kind="model" />
                </div>
                <div style={{ marginTop: 4, color: 'var(--ink)' }}><span className="mono">{top.b.id}</span> {top.b.desc}</div>
                <div className="small" style={{ marginTop: 4 }}>{top.reasons.slice(0, 5).join(' · ')}</div>
              </div>
            )}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={onClose}>{dupWarning ? 'Cancel, it is a duplicate' : 'Cancel'}</button>
              <ActionButton variant={dupWarning ? 'danger' : 'primary'} small={false} busy={busy} onClick={submit}>{dupWarning ? 'Create anyway' : 'Create at Gate 1'}</ActionButton>
            </div>
          </>
        )}

        {(tab === 'bulk' || tab === 'excel') && (
          <>
            {!loaded && (
              <div className="empty-state" style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: 30 }}>⇪</div>
                <div style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{tab === 'bulk' ? 'Drop a bulk upload file (CSV)' : 'Drop an Excel workbook (.xlsx)'}</div>
                <div className="small" style={{ margin: '4px 0 12px' }}>The demo uses a bundled sample, not your file. Every row is validated against the mandatory fields before it can enter the worklist.</div>
                <button className="btn btn-primary" onClick={() => setLoaded(tab)}>Use sample {tab === 'bulk' ? 'TA2026_bulk_scope.csv' : 'TA2026_Scope_Additions.xlsx'}</button>
              </div>
            )}
            {loaded && (
              <>
                <DataTable
                  dense
                  rowKey={(r: ImportRow & { problem?: string }) => r.desc}
                  rows={sample}
                  columns={[
                    { key: 'desc', header: 'Description' },
                    { key: 'area', header: 'Area' },
                    { key: 'tag', header: 'Tag', mono: true },
                    { key: 'costOMR', header: 'Est. (OMR)', mono: true, align: 'right', render: (r) => r.costOMR.toLocaleString() },
                    { key: 'manhours', header: 'Man-hours', mono: true, align: 'right' },
                    { key: 'v', header: 'Validation', nosort: true, render: (r) => (rowProblem(r) ? <Chip tone="crit">{rowProblem(r)}</Chip> : <Chip tone="good">Valid</Chip>) },
                    { key: 'dup', header: 'AI duplicate check', nosort: true, render: (r) => (rowProblem(r) ? <span className="small muted">not checked</span> : <DupCheckChip match={rowChecks[r.desc]} />) },
                  ]}
                />
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
                  <button className="btn" onClick={() => setLoaded(null)}>Back</button>
                  <ActionButton variant="primary" small={false} busy={busy} onClick={() => importRows(sample, loaded === 'bulk' ? 'Bulk upload' : 'Excel import')}>
                    Import {sample.filter((r) => !rowProblem(r) && rowChecks[r.desc]?.kind !== 'duplicate').length} valid rows
                  </ActionButton>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'sap' && (
          <div className="empty-state">
            <div style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Pull open notifications and work orders from SAP S/4HANA PM</div>
            <div className="small" style={{ margin: '4px 0 12px' }}>Simulated OData read. Imported items arrive at Gate 1 with their SAP number and a SAP source chip.</div>
            <button className="btn btn-primary" onClick={() => setSapOpen(true)}>Open SAP pull</button>
          </div>
        )}
      </Modal>
      <SapPullDrawer open={sapOpen} onClose={() => setSapOpen(false)} onImported={() => { onCreated(); onClose(); }} />
    </>
  );
}
