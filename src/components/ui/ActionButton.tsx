import type { ButtonHTMLAttributes } from 'react';
import { useCanEdit } from '../../app/AccessContext';

type Variant = 'default' | 'primary' | 'danger';

/** A button that changes data. Disabled (with an explanatory tooltip) when the signed-in role is view-only here. */
export function ActionButton({
  variant = 'default',
  small = true,
  busy,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean; busy?: boolean }) {
  const canEdit = useCanEdit();
  const cls = ['btn', small ? 'btn-sm' : '', variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : '', className ?? ''].join(' ').trim();
  return (
    <button {...rest} className={cls} disabled={disabled || busy || !canEdit} title={!canEdit ? 'Your role has view-only access to this page' : rest.title}>
      {busy ? 'Working…' : children}
    </button>
  );
}
