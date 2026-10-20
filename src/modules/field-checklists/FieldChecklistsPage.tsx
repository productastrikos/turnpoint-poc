import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { Field } from '../../components/ui/Field';
import { BarChart } from '../../components/charts/BarChart';
import { getTemplates, listSubmissions, submitChecklist } from '../../services/executionService';
import type { ChecklistSubmission, ChecklistTemplate } from '../../mocks/executionMock';
import { AREA_IDS } from '../../mocks/master';
import { useRole } from '../../app/RoleContext';
import { useToast } from '../../app/ToastContext';
import { useCanEdit } from '../../app/AccessContext';
import { Icon } from '../../app/icons';

type Res = 'pass' | 'fail' | 'na';

export default function FieldChecklistsPage() {
  const canEdit = useCanEdit();
  const { persona } = useRole();
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [subs, setSubs] = useState<ChecklistSubmission[]>([]);
  const [tplId, setTplId] = useState('TPL-1');
  const [results, setResults] = useState<Res[]>([]);
  const [tag, setTag] = useState('');
  const [area, setArea] = useState(AREA_IDS[0]);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState(0);
  const [errors, setErrors] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => listSubmissions().then(setSubs), []);
  useEffect(() => {
    getTemplates().then(setTemplates);
    load();
  }, [load]);

  const tpl = templates.find((t) => t.id === tplId);
  useEffect(() => {
    if (tpl) setResults(tpl.items.map(() => 'pass'));
  }, [tplId, tpl]);

  async function submit() {
    if (!tag.trim()) {
      setErrors('Equipment tag is mandatory');
      return;
    }
    const failed = results.filter((r) => r === 'fail').length;
    if (failed && !notes.trim()) {
      setErrors('Add a note explaining each failed item');
      return;
    }
    setErrors('');
    setBusy(true);
    const s = await submitChecklist({ templateId: tplId, tag: tag.trim(), area, by: persona.person, results, photos, notes });
    await load();
    setBusy(false);
    setTag('');
    setNotes('');
    setPhotos(0);
    setResults(tpl ? tpl.items.map(() => 'pass') : []);
    showToast(failed ? `${s.id} submitted with ${failed} failed item(s). An issue was raised in the Issues & Safety log.` : `${s.id} submitted and signed by ${persona.person}`, failed ? 'warn' : 'good');
  }

  const total = subs.reduce((s, x) => s + x.passed + x.failed, 0);
  const byTpl = templates.map((t) => subs.filter((s) => s.templateId === t.id).length);

  return (
    <div>
      <PageHeader title="Digital Field Checklists" subtitle="Field teams fill structured checklists on a phone or tablet instead of paper: pass / fail / N/A per item, notes, photo evidence and a signature. A failed item raises an issue automatically." checklist="X6" />
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatTile label="Submitted today" value={String(subs.length)} />
        <StatTile label="Pass rate" value={`${total ? Math.round((subs.reduce((s, x) => s + x.passed, 0) / total) * 100) : 0}%`} tone="good" />
        <StatTile label="With failed items" value={String(subs.filter((s) => s.failed > 0).length)} tone="warn" />
        <StatTile label="Photos attached" value={String(subs.reduce((s, x) => s + x.photos, 0))} />
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Fill a checklist" />
          <div className="stack">
            <div className="form-grid">
              <Field label="Template" required>
                <select value={tplId} onChange={(e) => setTplId(e.target.value)}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </Field>
              <Field label="Equipment tag" required error={errors.includes('tag') ? errors : undefined}>
                <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. E-204" />
              </Field>
              <Field label="Area"><select value={area} onChange={(e) => setArea(e.target.value)}>{AREA_IDS.map((a) => <option key={a}>{a}</option>)}</select></Field>
              <Field label="Checked by"><input type="text" value={persona.person} readOnly /></Field>
            </div>
            {tpl?.items.map((item, i) => (
              <div key={item} className="list-row">
                <span style={{ fontSize: 13 }}>{i + 1}. {item}</span>
                <span className="row" style={{ gap: 4 }}>
                  {(['pass', 'fail', 'na'] as Res[]).map((r) => (
                    <button key={r} className={`fchip ${results[i] === r ? 'active' : ''}`} style={results[i] === r && r === 'fail' ? { background: 'var(--crit-soft)', color: 'var(--crit)', borderColor: 'var(--crit)' } : undefined} disabled={!canEdit} onClick={() => setResults((a) => a.map((x, k) => (k === i ? r : x)))}>{r === 'na' ? 'N/A' : r}</button>
                  ))}
                </span>
              </div>
            ))}
            <Field label="Notes" error={errors.includes('note') ? errors : undefined}><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Findings, instructions, follow-up" /></Field>
            <div className="row">
              <button className="btn" disabled={!canEdit} onClick={() => setPhotos((p) => p + 1)}><Icon name="camera" size={14} /> Attach photo ({photos})</button>
              <span className="small muted">Photo capture is a placeholder in the web demo</span>
            </div>
            {errors && <div className="callout callout-crit" role="alert">{errors}</div>}
            <ActionButton variant="primary" small={false} busy={busy} onClick={submit}>Sign and submit as {persona.person}</ActionButton>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHeader title="Completion by template" />
            <BarChart height={200} labels={templates.map((t) => t.name.split(' ').slice(0, 2).join(' '))} series={[{ name: 'Submitted', color: 'var(--accent)', data: byTpl }]} />
          </Card>
          <Card>
            <CardHeader title="Submitted checklists" />
            <DataTable
              dense
              pageSize={8}
              rowKey={(s: ChecklistSubmission) => s.id}
              rows={subs}
              initialSort={{ key: 'at', dir: 'desc' }}
              columns={[
                { key: 'id', header: 'ID', mono: true },
                { key: 'template', header: 'Checklist', render: (s) => <div>{s.template}<div className="small muted">{s.tag} · {s.area} · {s.by}</div></div> },
                { key: 'result', header: 'Result', render: (s) => <span className="row-wrap"><Chip tone="good">{s.passed} pass</Chip>{s.failed > 0 && <Chip tone="crit">{s.failed} fail</Chip>}</span>, sortValue: (s) => s.failed },
                { key: 'at', header: 'Time', mono: true, render: (s) => s.at.slice(11, 16) },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
