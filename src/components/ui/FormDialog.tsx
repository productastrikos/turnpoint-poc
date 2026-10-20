import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Field } from './Field';
import { ProgressBar } from './ProgressBar';
import { useCanEdit } from '../../app/AccessContext';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'textarea' | 'date';
  options?: readonly string[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  hint?: string;
  min?: number;
  max?: number;
}

export type FormValues = Record<string, string>;

export function initialValues(fields: readonly FieldDef[]): FormValues {
  return Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? (f.type === 'select' && f.options ? '' : '')]));
}

export function validate(fields: readonly FieldDef[], values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = (values[f.name] ?? '').trim();
    if (f.required && !v) errors[f.name] = `${f.label} is mandatory`;
    else if (v && f.type === 'number') {
      const n = Number(v);
      if (Number.isNaN(n)) errors[f.name] = 'Enter a number';
      else if (f.min !== undefined && n < f.min) errors[f.name] = `Minimum ${f.min}`;
      else if (f.max !== undefined && n > f.max) errors[f.name] = `Maximum ${f.max}`;
    }
  }
  return errors;
}

export function FormFields({
  fields,
  values,
  errors,
  onChange,
}: {
  fields: readonly FieldDef[];
  values: FormValues;
  errors: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <div className="form-grid">
      {fields.map((f) => (
        <div key={f.name} className={f.type === 'textarea' ? 'span-2' : ''}>
          <Field label={f.label} required={f.required} error={errors[f.name]} hint={f.hint}>
            {f.type === 'select' ? (
              <select value={values[f.name] ?? ''} onChange={(e) => onChange(f.name, e.target.value)}>
                <option value="">Select…</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea rows={3} placeholder={f.placeholder} value={values[f.name] ?? ''} onChange={(e) => onChange(f.name, e.target.value)} />
            ) : (
              <input
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                placeholder={f.placeholder}
                min={f.min}
                max={f.max}
                value={values[f.name] ?? ''}
                onChange={(e) => onChange(f.name, e.target.value)}
              />
            )}
          </Field>
        </div>
      ))}
    </div>
  );
}

export function FormDialog({
  open,
  onClose,
  title,
  fields,
  submitLabel = 'Save',
  onSubmit,
  intro,
  showCompleteness,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: readonly FieldDef[];
  submitLabel?: string;
  onSubmit: (values: FormValues) => Promise<void>;
  intro?: ReactNode;
  showCompleteness?: boolean;
}) {
  const canEdit = useCanEdit();
  const [values, setValues] = useState<FormValues>(() => initialValues(fields));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const required = fields.filter((f) => f.required);
  const filled = required.filter((f) => (values[f.name] ?? '').trim() !== '').length;

  async function submit() {
    const errs = validate(fields, values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    await onSubmit(values);
    setBusy(false);
    setValues(initialValues(fields));
    setErrors({});
  }

  function close() {
    setErrors({});
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <button className="btn" onClick={close}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !canEdit} title={!canEdit ? 'Your role has view-only access to this page' : undefined}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </>
      }
    >
      {intro}
      {showCompleteness && required.length > 0 && (
        <div className="completeness">
          <span className="eyebrow">Mandatory-field completeness</span>
          <ProgressBar value={filled} max={required.length} label="complete" />
        </div>
      )}
      <FormFields fields={fields} values={values} errors={errors} onChange={(n, v) => setValues((prev) => ({ ...prev, [n]: v }))} />
    </Modal>
  );
}
