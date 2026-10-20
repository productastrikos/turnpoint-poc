import { useCallback, useEffect, useRef } from 'react';

/** Moves focus into a dialog when it opens and returns it to the trigger when it closes. Pass the result as `ref`. */
export function useDialogFocus(open: boolean) {
  const el = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    el.current?.focus();
    return () => prev?.focus?.();
  }, [open]);
  return useCallback((node: HTMLElement | null) => {
    el.current = node;
  }, []);
}