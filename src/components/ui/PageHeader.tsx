import type { ReactNode } from 'react';
import { SimBadge, type BadgeKind } from './SimBadge';
import { Icon } from '../../app/icons';

export function PageHeader({
  title,
  subtitle,
  action,
  oos,
  badges,
  checklist,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Legacy: label for something deliberately not integrated. */
  oos?: string;
  badges?: BadgeKind[];
  /** Checklist item ids this page answers, e.g. "X3 · X21 · X30". */
  checklist?: string;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>
          {title}
          {oos && <span className="oos-badge"><Icon name="alert" size={12} /> Not integrated — {oos}</span>}
          {badges?.map((b) => (
            <SimBadge key={b} kind={b} />
          ))}
        </h1>
        {subtitle && <p>{subtitle}</p>}
        {checklist && <div className="checklist-ref" title="Checklist items this page demonstrates">Checklist {checklist}</div>}
      </div>
      {action}
    </div>
  );
}
