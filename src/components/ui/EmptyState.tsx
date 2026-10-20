import type { ReactNode } from 'react';

export function EmptyState({ title = 'Nothing to show', hint, action }: { title?: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div style={{ fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>{title}</div>
      {hint && <div style={{ fontSize: 12.5 }}>{hint}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}
