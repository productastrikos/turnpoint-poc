import type { ReactNode } from 'react';

export function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className={`field ${error ? 'field-error' : ''}`}>
      <span className="field-label">
        {label}
        {required && (
          <span className="field-req" title="Mandatory field">
            {' '}*
          </span>
        )}
      </span>
      {children}
      {error ? <span className="field-msg">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
