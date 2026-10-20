import type { ReactNode } from 'react';
import { useRole } from '../../app/RoleContext';
import { Icon } from '../../app/icons';

export function CostValue({ amount, currency = 'OMR' }: { amount: number; currency?: string }) {
  const { role } = useRole();
  if (role === 'contractor') {
    return (
      <span className="restricted-value" title="Cost figures are restricted to the OQ Staff view (SOW §4.17 role-based access)">
        <Icon name="lock" size={12} /> restricted
      </span>
    );
  }
  return <span className="mono">{currency} {amount.toLocaleString()}</span>;
}

/** Contractor-safe wrapper for any block that shows cost: children for OQ staff, a restricted note otherwise. */
export function CostGuard({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { role } = useRole();
  if (role !== 'contractor') return <>{children}</>;
  return <>{fallback ?? <span className="restricted-value"><Icon name="lock" size={12} /> restricted</span>}</>;
}