import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface TabDef<T extends string = string> {
  id: T;
  label: string;
  badge?: string | number;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly TabDef<T>[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.badge !== undefined && <span className="tab-badge mono">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/** Tab state mirrored into ?tab= so /coverage can deep-link straight to a tab. */
export function useTabParam<T extends string>(ids: readonly T[], fallback: T): [T, (t: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const value = (raw && (ids as readonly string[]).includes(raw) ? raw : fallback) as T;
  const set = useCallback(
    (t: T) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('tab', t);
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );
  return [value, set];
}
