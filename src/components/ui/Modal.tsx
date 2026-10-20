import { useEffect, type ReactNode } from 'react';
import { useDialogFocus } from './useDialogFocus';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
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
    <div className="overlay overlay-center" onClick={onClose}>
      <div ref={ref} tabIndex={-1} className="modal card" style={{ width }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="drawer-head">
          <h3>{title}</h3>
          <button className="btn btn-sm" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </div>
  );
}
