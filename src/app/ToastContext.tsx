import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type ToastTone = 'good' | 'warn' | 'crit' | 'accent';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastCtx {
  showToast: (message: string, tone?: ToastTone) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(1);

  const showToast = useCallback((message: string, tone: ToastTone = 'accent') => {
    const id = seq.current++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    // long messages (integration events, AI results) stay up long enough to read
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, Math.min(9000, Math.max(3800, message.length * 45)));
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} onClick={() => dismiss(t.id)}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
