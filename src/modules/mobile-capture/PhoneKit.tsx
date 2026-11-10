// Small touch-friendly controls shared by the phone screens (tool report, contractor HSE).
import type { ReactNode } from 'react';
import { Icon } from '../../app/icons';

export function Label({ children }: { children: ReactNode }) {
  return <div className="eyebrow" style={{ margin: '4px 0 2px', color: 'var(--ink-3)' }}>{children}</div>;
}

/** Row of toggle chips. `multi` lets several be on at once. */
export function Chips<T extends string>({ options, value, onChange, tone }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void; tone?: (o: T) => string | undefined; }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: `1px solid ${on ? tone?.(o) ?? 'var(--accent)' : 'var(--border)'}`,
              background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
              color: on ? 'var(--accent-strong)' : 'var(--ink-2)',
              fontWeight: 600,
              fontSize: 11.5,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Single choice from a few options, laid out in a grid of equal buttons. */
export function Choice<T extends string>({ options, value, onChange, cols, danger }: { options: readonly T[]; value: T | ''; onChange: (v: T) => void; cols?: number; danger?: (o: T) => boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols ?? options.length}, 1fr)`, gap: 6 }}>
      {options.map((o) => {
        const on = value === o;
        const bad = danger?.(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o)}
            style={{
              padding: '8px 4px',
              borderRadius: 8,
              border: `1px solid ${on ? (bad ? 'var(--crit)' : 'var(--accent)') : 'var(--border)'}`,
              background: on ? (bad ? 'var(--crit-soft)' : 'var(--accent-soft)') : 'var(--surface-2)',
              color: on ? (bad ? 'var(--crit)' : 'var(--accent-strong)') : 'var(--ink-2)',
              fontWeight: 700,
              fontSize: 11.5,
              cursor: 'pointer',
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function NumberStepper({ label, value, onChange, step = 1, min = 0, max = 9999, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  const set = (n: number) => onChange(Math.max(min, Math.min(max, n)));
  return (
    <div className="spread" style={{ gap: 8 }}>
      <span style={{ fontSize: 12.5, flex: 1 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" className="btn btn-sm" aria-label={`Decrease ${label}`} onClick={() => set(value - step)} style={{ width: 30, padding: 0 }}>−</button>
        <strong className="mono" style={{ minWidth: 44, textAlign: 'center', fontSize: 14 }}>{value}{suffix}</strong>
        <button type="button" className="btn btn-sm" aria-label={`Increase ${label}`} onClick={() => set(value + step)} style={{ width: 30, padding: 0 }}>+</button>
      </div>
    </div>
  );
}

/** Simulated camera: first tap "takes" a photo (a placeholder thumbnail with a file name), the second removes it. */
export function PhotoButton({ photo, onTake, onClear, label = 'Take photo' }: { photo: string | null; onTake: () => void; onClear: () => void; label?: string }) {
  if (photo) {
    return (
      <div className="spread" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 6, background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 44, height: 34, borderRadius: 4, background: 'linear-gradient(135deg, var(--ink-3), var(--border))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)' }}>
            <Icon name="camera" size={16} />
          </div>
          <span className="small mono">{photo}</span>
        </div>
        <button type="button" className="btn btn-sm" onClick={onClear}>Retake</button>
      </div>
    );
  }
  return (
    <button type="button" className="btn" onClick={onTake}>
      <Icon name="camera" size={14} /> {label}
    </button>
  );
}

let photoSeq = 3001;
export const nextPhotoName = () => `IMG_${photoSeq++}.jpg`;

/** Bottom-of-form block: primary submit plus the one-tap demo filler. */
export function FormActions({ submitLabel, disabled, onSubmit, onDemo, hint }: { submitLabel: string; disabled?: boolean; onSubmit: () => void; onDemo: () => void; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
      {hint && <div className="small muted">{hint}</div>}
      <button type="button" className="btn btn-primary" disabled={disabled} onClick={onSubmit}>{submitLabel}</button>
      <button type="button" className="btn btn-sm" onClick={onDemo} style={{ borderStyle: 'dashed' }}>Fill demo data</button>
    </div>
  );
}
