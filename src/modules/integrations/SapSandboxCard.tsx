import { useEffect, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { SimBadge } from '../../components/ui/SimBadge';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { relayStatus } from '../../ai/assistant/useAssistant';
import { API_URL } from '../../config';

// Read-only calls to SAP's public Business Accelerator Hub sandbox (sample data owned by SAP, not OQ's system), through
// the local relay in vite-relay.ts. The key lives in .env.local; it can also be typed here for this tab session only.
type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? '' : String(v));
const date = (v: unknown) => {
  const m = /\/Date\((\d+)/.exec(str(v));
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : str(v).slice(0, 10);
};

const NOTIF = `${API_URL}/api/sap/API_MAINTNOTIFICATION/MaintenanceNotification?$top=8&$format=json`;
const ORDER = `${API_URL}/api/sap/API_MAINTENANCEORDER/MaintenanceOrder?$top=8&$format=json`;

async function read(url: string, key: string): Promise<Row[]> {
  const r = await fetch(url, { headers: key ? { 'x-sap-key': key } : {} });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error?.message ?? `SAP sandbox returned ${r.status}`);
  const d = body.d ?? body;
  return (d.results ?? d.value ?? []) as Row[];
}

export function SapSandboxCard() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notifs, setNotifs] = useState<Row[] | null>(null);
  const [orders, setOrders] = useState<Row[] | null>(null);
  const [at, setAt] = useState('');

  useEffect(() => {
    void relayStatus().then((s) => setConfigured(Boolean(s?.sap)));
  }, []);

  async function load() {
    setBusy(true);
    setErr('');
    try {
      const [n, o] = await Promise.all([read(NOTIF, key), read(ORDER, key)]);
      setNotifs(n);
      setOrders(o);
      setAt(new Date().toLocaleTimeString());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not reach the SAP sandbox');
    } finally {
      setBusy(false);
    }
  }

  const ready = configured || key.trim().length > 0;
  return (
    <Card>
      <CardHeader title={<span>SAP sandbox: live read <SimBadge kind="live" title="Real read-only HTTPS calls to SAP's public API sandbox. The data is SAP's sample data, not OQ RPI's system." /></span>} />
      <p className="small muted" style={{ margin: '-6px 0 10px' }}>
        Reads maintenance notifications and orders from SAP Business Accelerator Hub (S/4HANA Cloud sandbox) through a local relay. It is sample data owned by SAP and read-only, so
        write-back is shown with the SAP stand-in console instead.
      </p>
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <ActionButton variant="primary" small={false} busy={busy} disabled={!ready} onClick={load}>
          Read from SAP sandbox
        </ActionButton>
        {configured === false && (
          <input
            type="password"
            style={{ width: 260 }}
            placeholder="SAP API key (or set SAP_API_KEY in .env.local)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            aria-label="SAP sandbox API key"
            autoComplete="off"
          />
        )}
        {at && <span className="small muted">Fetched {at}</span>}
        {configured === true && !at && <Chip tone="good">Key configured on the relay</Chip>}
      </div>
      {configured === false && !key && <p className="small muted">No SAP key is configured, so this panel is in demo mode. The Pull from SAP drawer above still works against the simulated feed.</p>}
      {err && <p className="small" style={{ color: 'var(--crit, #c0392b)' }}>{err}</p>}
      {notifs && (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div>
            <strong className="small">Notifications ({notifs.length})</strong>
            <DataTable
              dense
              rowKey={(r) => str(r.MaintenanceNotification)}
              rows={notifs}
              columns={[
                { key: 'n', header: 'Number', mono: true, render: (r) => <span className="tag-chip sap">{str(r.MaintenanceNotification)}</span> },
                { key: 't', header: 'Text', render: (r) => <span className="small">{str(r.NotificationText) || str(r.MaintNotifLongText) || '(no text)'}</span> },
                { key: 'l', header: 'Technical object', render: (r) => <span className="small mono">{str(r.TechnicalObject) || str(r.FunctionalLocation) || str(r.Equipment)}</span> },
                { key: 'd', header: 'Created', render: (r) => <span className="small">{date(r.CreationDate)}</span> },
              ]}
            />
          </div>
          <div>
            <strong className="small">Maintenance orders ({orders?.length ?? 0})</strong>
            <DataTable
              dense
              rowKey={(r) => str(r.MaintenanceOrder)}
              rows={orders ?? []}
              columns={[
                { key: 'o', header: 'Order', mono: true, render: (r) => <span className="tag-chip sap">{str(r.MaintenanceOrder)}</span> },
                { key: 't', header: 'Description', render: (r) => <span className="small">{str(r.MaintenanceOrderDesc) || '(no text)'}</span> },
                { key: 'y', header: 'Type', render: (r) => <span className="small mono">{str(r.MaintenanceOrderType)}</span> },
                { key: 'd', header: 'Created', render: (r) => <span className="small">{date(r.CreationDate)}</span> },
              ]}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
