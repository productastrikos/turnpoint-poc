import { useEffect, type ReactNode } from 'react';
import { useDialogFocus } from './useDialogFocus';

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 460,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const ref = useDialogFocus(open);
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <aside ref={ref} tabIndex={-1} className="drawer card" style={{ width }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="drawer-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <div className="drawer-sub">{subtitle}</div>}
          </div>
          <button className="btn btn-sm" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </div>
  );
}
