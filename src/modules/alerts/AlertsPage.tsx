import { stamp } from '../../mocks/_gen';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { getAlerts, markRead, markAllRead } from '../../services/alertsService';
import type { AlertItem } from '../../types';
import { useToast } from '../../app/ToastContext';
import { Drawer } from '../../components/ui/Drawer';
import { SimBadge } from '../../components/ui/SimBadge';
import { Icon } from '../../app/icons';
import { getMailPreview, type MailPreview } from '../../services/mailService';

const typeLabel: Record<AlertItem['type'], string> = {
  'scf-approval': 'SCF Approval',
  'boxup-certificate': 'Box-up Certificate',
  'pssr-approval': 'PSSR Approval',
  'permit-overdue': 'Permit Overdue',
  integration: 'SAP / P6 Integration',
};

const sevTone = { info: 'accent', warn: 'warn', crit: 'crit' } as const;

export default function AlertsPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filter, setFilter] = useState<'all' | AlertItem['type']>('all');
  const [mail, setMail] = useState<{ alert: AlertItem; preview: MailPreview } | null>(null);

  useEffect(() => {
    getAlerts().then(setAlerts);
  }, []);

  const visible = (filter === 'all' ? alerts : alerts.filter((a) => a.type === filter)).sort(
    (a, b) => +new Date(b.raisedAt) - +new Date(a.raisedAt)
  );
  const unreadCount = alerts.filter((a) => !a.read).length;

  async function read(id: string) {
    const updated = await markRead(id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }

  async function openMail(a: AlertItem) {
    setMail({ alert: a, preview: await getMailPreview(a) });
  }

  async function readAll() {
    const updated = await markAllRead();
    setAlerts(updated);
    showToast('All alerts marked read', 'accent');
  }

  return (
    <div>
      <PageHeader
        title="Alerts & Notification Center"
        subtitle="Mocked real-time feed of SCF approvals, box-up certificates, PSSR approvals and overdue permits, replacing the WhatsApp and e-mail side-channels called out in the SOW. Every alert is also e-mailed to the approver of record: open any alert's e-mail to see it (simulated, nothing is sent)."
        action={<button className="btn btn-sm" onClick={readAll}>Mark all read ({unreadCount})</button>}
      />

      <div className="tabs">
        {(['all', 'scf-approval', 'boxup-certificate', 'pssr-approval', 'permit-overdue', 'integration'] as const).map((t) => (
          <button key={t} className={`tab ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>
            {t === 'all' ? 'All' : typeLabel[t]}
          </button>
        ))}
      </div>

      <Card>
        {visible.map((a) => (
          <div
            key={a.id}
            onClick={() => {
              if (!a.read) read(a.id);
              if (a.link) navigate(a.link);
            }}
            style={{
              display: 'flex',
              gap: 12,
              padding: '12px 4px',
              borderBottom: '1px solid var(--border)',
              cursor: a.read && !a.link ? 'default' : 'pointer',
              opacity: a.read ? 0.92 : 1,
            }}
          >
            <div style={{ paddingTop: 3 }}>
              {!a.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'block' }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <Chip tone={sevTone[a.severity]}>{typeLabel[a.type]}</Chip>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{stamp(a.raisedAt)}</span>
              </div>
              <div style={{ fontSize: 13 }}>{a.message}{a.link && <span className="small" style={{ color: 'var(--accent-strong)', marginLeft: 8 }}>open →</span>}</div>
            </div>
            <div>
              <button
                className="btn btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  openMail(a);
                }}
                aria-label={`Preview the e-mail for ${a.id}`}
              >
                <Icon name="mail" size={14} /> E-mail
              </button>
            </div>
          </div>
        ))}
        {visible.length === 0 && <div className="empty-state">No alerts in this category.</div>}
      </Card>

      <Drawer
        open={!!mail}
        onClose={() => setMail(null)}
        title={<span className="row">E-mail notification <SimBadge kind="simulated" /></span>}
        subtitle={mail ? `Alert ${mail.alert.id} · sent ${stamp(mail.alert.raisedAt)}` : undefined}
        width={560}
        footer={
          <>
            {mail?.preview.action && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  const to = mail.preview.action!.to;
                  setMail(null);
                  navigate(to);
                }}
              >
                {mail.preview.action.label} →
              </button>
            )}
            <button className="btn" onClick={() => setMail(null)}>Close</button>
          </>
        }
      >
        {mail && (
          <div>
            <div className="callout" style={{ marginBottom: 14 }}>
              Preview of the message OQ mail would deliver for this alert (SOW 4.75). TURNPOINT does not send mail from this demo.
            </div>
            <dl className="mail-meta">
              <dt>From</dt><dd>{mail.preview.from}</dd>
              <dt>To</dt><dd>{mail.preview.to.join('; ')}</dd>
              <dt>Cc</dt><dd>{mail.preview.cc.join('; ')}</dd>
              <dt>Subject</dt><dd><strong>{mail.preview.subject}</strong></dd>
            </dl>
            <div className="mail-body">
              <p>{mail.preview.greeting}</p>
              {mail.preview.paragraphs.map((p) => <p key={p}>{p}</p>)}
              <p className="small muted">{mail.preview.footer}</p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
