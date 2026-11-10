import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { StatTile } from '../../components/ui/StatTile';

// PBC 03 item 13 asks for the interface inventory: system-by-system data flows, ownership of development and support,
// security, error handling and reconciliation, and whether Intelex, DMS and MOC are base scope. This is the proposed
// inventory. Support follows Spectrum's answer to PBC item 11: Spectrum PMO is first line, Siemens remote support is escalation.

interface Iface {
  id: string;
  system: string;
  flow: string;
  direction: 'Both ways' | 'To OQ' | 'From OQ';
  channel: string;
  trigger: string;
  dev: string;
  support: string;
  security: string;
  errors: string;
  recon: string;
  scope: 'Base';
  demo: 'Stand-in, live in this demo' | 'Simulated connector' | 'Design only, not shown';
}

const SUPPORT = 'Spectrum PMO (first line); Siemens remote support (escalation)';

const ROWS: Iface[] = [
  { id: 'IF-01', system: 'SAP S/4HANA PM', flow: 'Notifications and work orders in; scope status, order status, scope freeze (SFRZ) and costs back', direction: 'Both ways', channel: 'OData V2 (API_MAINTNOTIFICATION, API_MAINTENANCEORDER) via SAP Integration Suite and API Management', trigger: 'Event on create / change, plus 15-minute reconciliation run', dev: 'Spectrum/Astrikos build the OQ side, with the OQ SAP team: protocol, table definition, data analysis, error handling, reconciliation', support: SUPPORT, security: 'OAuth 2.0 client credentials, mTLS, technical user OQ_INT with minimum roles', errors: 'Retry with back-off, error queue in the Integration Hub, alert to the integration owner', recon: 'Order-by-order compare of status and planned cost every 15 minutes; differences listed for the planner', scope: 'Base', demo: 'Stand-in, live in this demo' },
  { id: 'IF-02', system: 'SAP S/4HANA MM / PS', flow: 'Materials, reservations, purchase orders, WBS cost: read for readiness, MTO and budget', direction: 'To OQ', channel: 'OData V2 (API_PURCHASEORDER, API_RESERVATION_DOCUMENT, WBS) via SAP Integration Suite', trigger: 'Scheduled, hourly', dev: 'Spectrum/Astrikos build the OQ side, with the OQ SAP team: protocol, table definition, data analysis, error handling, reconciliation', support: SUPPORT, security: 'As IF-01, read-only roles', errors: 'Retry, error queue, stale-data flag on the affected page', recon: 'Daily count and value compare of open POs and reservations', scope: 'Base', demo: 'Design only, not shown' },
  { id: 'IF-03', system: 'Primavera P6', flow: 'Activities, dates and float in; progress and new activities back', direction: 'Both ways', channel: 'P6 EPPM REST API; XER file as fallback', trigger: 'On F9 reschedule and on progress entry; nightly full compare', dev: 'Astrikos', support: SUPPORT, security: 'Service account, TLS, project-level access only', errors: 'Retry, error queue, XER re-import path', recon: 'Nightly compare of dates, float and % complete per activity', scope: 'Base', demo: 'Stand-in, live in this demo' },
  { id: 'IF-04', system: 'Site access control (badge system)', flow: 'Badge swipes and denials in, to build manpower on site and first-entry mobilization', direction: 'To OQ', channel: 'REST pull or CSV drop', trigger: 'Automatic poll every 5 minutes (switch on the Attendance page)', dev: 'Astrikos', support: SUPPORT, security: 'Read-only API key, network-restricted', errors: 'Missed poll is caught up on the next one; reader down is shown on the Attendance page', recon: 'Daily head count against the gate totals', scope: 'Base', demo: 'Simulated connector' },
  { id: 'IF-05', system: 'Intelex (HSE)', flow: 'Incidents, observations and permit-to-work audit results in, feeding contractor HSE KPIs and the Issues dashboard', direction: 'To OQ', channel: 'Intelex REST API (or scheduled export)', trigger: 'Scheduled, every 15 minutes', dev: 'Astrikos', support: SUPPORT, security: 'API token held in the integration vault, read-only', errors: 'Retry, error queue, KPI marked stale', recon: 'Weekly count of incidents in Intelex against OQ', scope: 'Base', demo: 'Design only, not shown' },
  { id: 'IF-06', system: 'DMS (document management)', flow: 'Close-out documents, certificates and the scope freeze certificate out to OQ shared folders; document references in', direction: 'Both ways', channel: 'DMS REST / CMIS, or SFTP drop in an open format (PDF, XLSX, CSV)', trigger: 'On close-out and on certificate issue', dev: 'Astrikos', support: SUPPORT, security: 'Service account, TLS, write access to the TA folder only', errors: 'Retry, failed transfers listed in the Integration Hub', recon: 'Handover checklist compares the document list sent with the files found in the DMS', scope: 'Base', demo: 'Design only, not shown' },
  { id: 'IF-07', system: 'MOC system', flow: 'MOC numbers and approval status in; TA change requests out where a scope change needs a MOC', direction: 'Both ways', channel: 'MOC system REST API', trigger: 'On create / status change', dev: 'Astrikos', support: SUPPORT, security: 'OAuth 2.0 service account', errors: 'Retry, error queue, change shown as "MOC status unknown"', recon: 'Daily compare of open MOCs linked to TA scope', scope: 'Base', demo: 'Design only, not shown' },
];


const SUPPORT_MODEL: { who: string; tone: 'accent' | 'good' | 'neutral'; role: string; items: string[] }[] = [
  { who: 'Spectrum', tone: 'accent', role: 'Overall implementation and first-line support', items: ['Oversees design, execution, monitoring and deployment in the OQ environment', 'PMO tracks progress and the issues faced on the platform', 'First-line technical support, change management, governance reports', 'Checks the platform is installed as contracted: accuracy, functionality, availability'] },
  { who: 'Siemens', tone: 'good', role: 'Platform customization and escalation', items: ['Customization and configuration as per the approved design documents', 'Remote support for escalations from the Spectrum PMO', 'Supports testing and UAT', 'Bug fixes after implementation'] },
  { who: 'Astrikos', tone: 'neutral', role: 'Turnaround application and integrations', items: ['Builds the OQ application: scoping, critical path, QA/QC, dashboards', 'Builds the integration side with the OQ SAP team', 'Intelex, DMS and MOC interfaces (base scope)'] },
];

const DIR_TONE = { 'Both ways': 'accent', 'To OQ': 'neutral', 'From OQ': 'neutral' } as const;

/** PBC 03 item 13: the proposed interface inventory. */
export function InterfaceInventoryTab() {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <StatTile label="Interfaces" value={String(ROWS.length)} delta="all in base scope" tone="good" />
        <StatTile label="SAP interfaces" value="2" delta="PM, and MM / PS" tone="accent" />
        <StatTile label="Intelex, DMS, MOC" value="3" delta="included in base scope" tone="good" />
        <StatTile label="Shown live in this demo" value="2" delta="SAP and P6 stand-ins" tone="accent" />
      </div>
      <div className="callout callout-warn">
        Interface inventory for PBC 03 item 13. Spectrum confirms that Intelex, DMS and MOC are in base scope, and that the SAP integration is carried out by the bidder together with the OQ SAP team (protocol, table definition, data analysis, error handling and reconciliation). Intelex, DMS and MOC are described here only: no stand-in for them is built in this demo.
      </div>

      <Card>
        <CardHeader title="Support model: who does what (PBC item 11)" />
        <div className="grid grid-3" style={{ alignItems: 'start' }}>
          {SUPPORT_MODEL.map((m) => (
            <div key={m.who} className="stack" style={{ gap: 6 }}>
              <Chip tone={m.tone}>{m.who}</Chip>
              <strong style={{ fontSize: 13 }}>{m.role}</strong>
              <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                {m.items.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ margin: '12px 0 0' }}>
          PMO and field engineers are deployed by Spectrum and trained and certified on the turnaround platform by Siemens. Escalations go from the Spectrum PMO to the Siemens remote support team.
        </p>
      </Card>
      <Card>
        <CardHeader title="Interface inventory: data flows, ownership, security, error handling, reconciliation" />
        <DataTable
          dense
          rowKey={(r: Iface) => r.id}
          rows={ROWS}
          columns={[
            { key: 'id', header: 'ID', mono: true },
            { key: 'system', header: 'System', render: (r) => <strong>{r.system}</strong> },
            { key: 'direction', header: 'Direction', render: (r) => <Chip tone={DIR_TONE[r.direction]}>{r.direction}</Chip> },
            { key: 'flow', header: 'Data flow', render: (r) => <div style={{ maxWidth: 260 }}>{r.flow}</div>, nosort: true },
            { key: 'channel', header: 'Channel', render: (r) => <div className="small" style={{ maxWidth: 220 }}>{r.channel}</div>, nosort: true },
            { key: 'trigger', header: 'Trigger', render: (r) => <div className="small" style={{ maxWidth: 160 }}>{r.trigger}</div>, nosort: true },
            { key: 'dev', header: 'Built by', render: (r) => <div className="small" style={{ maxWidth: 170 }}>{r.dev}</div>, nosort: true },
            { key: 'support', header: 'Supported by', render: (r) => <div className="small" style={{ maxWidth: 130 }}>{r.support}</div>, nosort: true },
            { key: 'security', header: 'Security', render: (r) => <div className="small" style={{ maxWidth: 190 }}>{r.security}</div>, nosort: true },
            { key: 'errors', header: 'Error handling', render: (r) => <div className="small" style={{ maxWidth: 190 }}>{r.errors}</div>, nosort: true },
            { key: 'recon', header: 'Reconciliation', render: (r) => <div className="small" style={{ maxWidth: 190 }}>{r.recon}</div>, nosort: true },
            { key: 'scope', header: 'Scope', render: (r) => <Chip tone="good">{r.scope}</Chip> },
            { key: 'demo', header: 'In this demo', render: (r) => <Chip tone={r.demo === 'Design only, not shown' ? 'warn' : 'accent'}>{r.demo}</Chip>, nosort: true },
          ]}
        />
      </Card>
    </div>
  );
}
