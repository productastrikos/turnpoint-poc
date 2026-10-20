import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { CostValue } from '../../components/ui/CostValue';
import { Field } from '../../components/ui/Field';
import { getSCFs, createSCF, updateSCFStatus, deriveApprover } from '../../services/scfService';
import { SCF_COST_THRESHOLD_USD } from '../../services/scfRules';
import type { SCF } from '../../types';
import { useRole } from '../../app/RoleContext';
import { useToast } from '../../app/ToastContext';
import { useCanEdit } from '../../app/AccessContext';
import { VendorInputDrawer } from './VendorInputDrawer';

const statusTone: Record<SCF['status'], 'accent' | 'good' | 'crit' | 'neutral'> = {
  evaluating: 'accent',
  approved: 'good',
  rejected: 'crit',
  closed: 'neutral',
};

const emptyForm = {
  kind: 'SCF' as NonNullable<SCF['kind']>,
  title: '',
  requestedBy: '',
  department: 'Maintenance' as SCF['department'],
  costUSD: 10000,
  durationDays: 1,
  exceedsWindow: false,
  justification: '',
};

export default function ScfPage() {
  const canEdit = useCanEdit();
  const { role } = useRole();
  const { showToast } = useToast();
  const [items, setItems] = useState<SCF[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<'title' | 'requestedBy' | 'durationDays' | 'justification', string>>>({});
  const [vendorFor, setVendorFor] = useState<SCF | null>(null);

  useEffect(() => {
    getSCFs().then(setItems);
  }, []);

  const previewApprover = deriveApprover(form.costUSD, form.exceedsWindow);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    if (form.title.trim().length < 5) found.title = 'Title is mandatory (at least 5 characters)';
    if (!form.requestedBy.trim()) found.requestedBy = 'Name the originator of the request';
    if (!Number.isFinite(form.durationDays) || form.durationDays < 1) found.durationDays = 'Duration must be at least 1 day';
    if (form.justification.trim().length < 10) found.justification = 'Justification is mandatory (at least 10 characters)';
    setErrors(found);
    if (Object.keys(found).length) {
      showToast('Complete the mandatory fields before submitting', 'warn');
      return;
    }
    setSubmitting(true);
    const created = await createSCF(form);
    setItems((prev) => [created, ...prev]);
    setForm(emptyForm);
    setErrors({});
    setSubmitting(false);
    showToast(`${created.id} raised — routed to ${created.approver}`, 'accent');
  }

  async function setStatus(id: string, status: SCF['status']) {
    const updated = await updateSCFStatus(id, status);
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    showToast(`${id} ${status} by ${updated.approver}`, status === 'approved' ? 'good' : 'crit');
  }

  return (
    <div>
      <PageHeader
        title="Scope Change Requests (SCF) & Additional Work"
        checklist="X10 · SOW dry run 25"
        subtitle={`Approval routing applies the client's own rule live: cost < USD ${SCF_COST_THRESHOLD_USD.toLocaleString()} and within the mechanical window → TA Event Manager. Otherwise → Head of Turnaround Services.`}
      />

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Raise SCF / additional work request" />
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as NonNullable<SCF['kind']> })} aria-label="Request type">
              <option value="SCF">Scope Change Request (SCF)</option>
              <option value="Additional work request">Additional work request</option>
            </select>
            <Field label="Title" required error={errors.title}>
              <input type="text" placeholder="Title" value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors({ ...errors, title: undefined }); }} />
            </Field>
            <Field label="Requested by" required error={errors.requestedBy}>
              <input type="text" placeholder="Requested by" value={form.requestedBy} onChange={(e) => { setForm({ ...form, requestedBy: e.target.value }); setErrors({ ...errors, requestedBy: undefined }); }} />
            </Field>
            <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value as SCF['department'] })} aria-label="Requesting department">
              {(['Maintenance', 'Inspection', 'Process', 'Engineering'] as const).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              Cost (USD): <strong className="mono">{form.costUSD.toLocaleString()}</strong>
            </label>
            <input
              type="range"
              min={1000}
              max={150000}
              step={1000}
              value={form.costUSD}
              onChange={(e) => setForm({ ...form, costUSD: Number(e.target.value) })}
              aria-label="Estimated cost in USD"
            />
            <Field label="Duration (days)" required error={errors.durationDays}>
              <input
                type="number"
                min={1}
                placeholder="Duration (days)"
                value={form.durationDays}
                onChange={(e) => { setForm({ ...form, durationDays: Number(e.target.value) }); setErrors({ ...errors, durationDays: undefined }); }}
              />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.exceedsWindow}
                onChange={(e) => setForm({ ...form, exceedsWindow: e.target.checked })}
              />
              Exceeds mechanical window duration
            </label>
            <Field label="Justification" required error={errors.justification}>
              <textarea
                placeholder="Justification"
                value={form.justification}
                onChange={(e) => { setForm({ ...form, justification: e.target.value }); setErrors({ ...errors, justification: undefined }); }}
                rows={3}
                style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </Field>

            <div className="card-pad" style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="eyebrow">Routes to</span>
              <Chip tone={previewApprover === 'Head of Turnaround Services' ? 'crit' : 'accent'}>{previewApprover}</Chip>
            </div>

            <button className="btn btn-primary" type="submit" disabled={submitting || !canEdit} title={!canEdit ? 'Your role has view-only access to this page' : undefined}>
              {submitting ? 'Submitting…' : 'Submit SCF'}
            </button>
          </form>
        </Card>

        <Card>
          <CardHeader title="SCF Queue" />
          <div style={{ maxHeight: 560, overflowY: 'auto' }}>
            {items.map((s) => (
              <div key={s.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <strong style={{ fontSize: 13 }}>{s.title}</strong>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{s.id}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '0 0 8px' }}>{s.justification}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                  <Chip tone={s.kind === 'Additional work request' ? 'accent' : 'neutral'}>{s.kind ?? 'SCF'}</Chip>
                  <Chip tone="neutral">{s.department}</Chip>
                  <Chip tone="neutral"><CostValue amount={s.costUSD} currency="USD" /></Chip>
                  <Chip tone="neutral">{s.durationDays}d{s.exceedsWindow ? ' · exceeds window' : ''}</Chip>
                  <Chip tone={s.approver === 'Head of Turnaround Services' ? 'crit' : 'accent'}>{s.approver}</Chip>
                  <Chip tone={statusTone[s.status]}>{s.status}</Chip>
                </div>
                {s.status === 'evaluating' && (
                  role === 'contractor' ? (
                    <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>Approvals are restricted to OQ Staff</span>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => setStatus(s.id, 'approved')}>Approve</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setStatus(s.id, 'rejected')}>Reject</button>
                      <button className="btn btn-sm" onClick={() => setVendorFor(s)}>Vendor input</button>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
      <VendorInputDrawer scf={vendorFor} onClose={() => setVendorFor(null)} />
    </div>
  );
}
