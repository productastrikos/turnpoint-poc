import { useEffect } from 'react';
import { AssistantChat } from '../ai/assistant/AssistantChat';
import { Icon } from './icons';
import { useLang } from '../i18n/lang';

/** Assistant side panel (checklist G13), opened from the header. Claude with tools when a key is set, else on-device. */
export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <aside className="chat-panel no-print" role="dialog" aria-label="TURNPOINT assistant">
      <div className="chat-head">
        <strong>{t('Ask TURNPOINT')}</strong>
        <button className="icon-btn" onClick={onClose} aria-label="Close assistant">
          <Icon name="close" size={16} />
        </button>
      </div>
      <AssistantChat onNavigate={onClose} />
    </aside>
  );
}
