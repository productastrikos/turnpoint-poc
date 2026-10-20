import { useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { ActionButton } from '../../components/ui/ActionButton';
import { DataTable } from '../../components/ui/DataTable';
import { Drawer } from '../../components/ui/Drawer';
import { StatusChip } from '../../components/ui/StatusChip';
import { FilterChips } from '../../components/ui/FilterChips';
import { OWNERSHIP } from '../../mocks/dryRunMock';
import { autoResolve, autoResolveAll, errorQueue } from '../../services/integrationService';
import type { IntegrationMessage } from '../../types/execution';
import { useToast } from '../../app/ToastContext';
import { useHub } from './useHub';

export function MonitoringTab() {
  const hub = useHub();
  const { showToast } = useToast();
  const [open, setOpen] = useState<IntegrationMessage | null>(null);
  const [sys, setSys] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);

  const msgs = hub.messages;
  const count = (s: IntegrationMessage['status']) => msgs.filter((m) => m.status === s).length;
  const queue = errorQueue(msgs);
  const shown = msgs.filter((m) => sys === 'all' || m.system === sys);
  const current = open ? msgs.find((m) => m.id === open.id) ?? open : null;

  async function resolveOne(id: string) {
    setBusy(id);
    const r = await autoResolve(id);
    setBusy(null);
    showToast(r.ok ? `${id} auto-resolved without manual intervention` : `${id} could not be auto-resolved: escalated to the owning team`, r.ok ? 'good' : 'warn');
  }

  async function resolveAll() {
    setBusy('all');
    const r = await autoResolveAll();
    setBusy(null);
    showToast(`Auto-resolve finished: ${r.resolved} resolved, ${r.escalated} escalated for a decision`, r.escalated ? 'warn' : 'good');
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4" style={{ gap: 12 }}>
        <StatTile label="Delivered" value={String(count('Delivered'))} tone="good" />
        <StatTile label="Auto-resolved" value={String(count('Auto-resolved'))} tone="accent" />
        <StatTile label="Retrying" value={String(count('Retrying'))} tone="warn" />
        <StatTile label="Failed" value={String(count('Failed'))} tone="crit" />
      </div>

      <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Message log" action={<FilterChips options={[{ value: 'P6' }, { value: 'SAP' }]} value={sys} onChange={setSys} allLabel="All systems" />} />
          <DataTable
            dense
            pageSize={9}
            rowKey={(m) => m.id}
            rows={shown}
            onRowClick={setOpen}
            activeKey={current?.id}
            initialSort={{ key: 'at', dir: 'desc' }}
            columns={[
              { key: 'at', header: 'Time', mono: true, render: (m) => m.at.slice(11, 19) },
              { key: 'system', header: 'System', render: (m) => <span className={`tag-chip ${m.system === 'P6' ? 'p6' : 'sap'}`}>{m.system}</span> },
              { key: 'direction', header: 'Dir', render: (m) => <span className="small">{m.direction === 'Inbound' ? '← in' : 'out →'}</span> },
              { key: 'object', header: 'Object', render: (m) => <span className="small">{m.object}</span> },
              { key: 'key', header: 'Key', mono: true },
              { key: 'status', header: 'Status', render: (m) => <StatusChip status={m.status} /> },
              { key: 'latencyMs', header: 'Latency', mono: true, align: 'right', render: (m) => `${m.latencyMs} ms` },
            ]}
          />
          <p className="small muted" style={{ margin: '10px 0 0' }}>Click a row to see the request and response payloads and what the platform did about it.</p>
        </Card>

        <Card>
          <CardHeader title={`Error queue (${queue.length})`} action={<ActionButton variant="primary" busy={busy === 'all'} disabled={queue.length === 0} onClick={resolveAll}>Auto-resolve all</ActionButton>} />
          {queue.length === 0 && <div className="callout callout-good">Error queue is empty. Everything delivered or auto-resolved.</div>}
          {queue.map((m) => (
            <div key={m.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-wrap">
                  <span className={`tag-chip ${m.system === 'P6' ? 'p6' : 'sap'}`}>{m.system}</span>
                  <strong className="mono small">{m.key}</strong>
                  <StatusChip status={m.status} />
                </div>
                <div className="small muted" style={{ marginTop: 4 }}>{m.note}</div>
              </div>
              <div className="stack" style={{ gap: 4 }}>
                <ActionButton busy={busy === m.id} onClick={() => resolveOne(m.id)}>Auto-resolve</ActionButton>
                <button className="btn btn-sm" onClick={() => setOpen(m)}>Payload</button>
              </div>
            </div>
          ))}
          <p className="small muted" style={{ margin: '10px 0 0' }}>Automated error handling (SOW 19.16.8): lock and period errors retry with back-off; mapping and constraint errors are escalated to the owning team.</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Who wins when systems disagree? Field ownership" />
        <div className="callout" style={{ marginBottom: 12 }}>
          Example conflict: activity <span className="tag-chip p6">CDU-1020</span> had its finish date changed in P6 by the planner and its progress changed in the STO platform by the field in the same window. Result: dates and logic come from P6, progress and actuals come from STO, nothing is overwritten.
        </div>
        <DataTable
          dense
          rowKey={(o) => o.field}
          rows={OWNERSHIP}
          columns={[
            { key: 'field', header: 'Data', render: (o) => <strong>{o.field}</strong> },
            { key: 'p6', header: 'Primavera P6', render: (o) => <Chip tone={o.p6 === 'Owner' ? 'accent' : 'neutral'}>{o.p6}</Chip> },
            { key: 'sto', header: 'TURNPOINT', render: (o) => <Chip tone={o.sto === 'Owner' ? 'accent' : 'neutral'}>{o.sto}</Chip> },
            { key: 'sap', header: 'SAP S/4HANA', render: (o) => <Chip tone={o.sap === 'Owner' ? 'accent' : 'neutral'}>{o.sap}</Chip> },
            { key: 'rule', header: 'Conflict rule', render: (o) => <span className="small">{o.rule}</span> },
          ]}
        />
      </Card>

      <Drawer open={Boolean(current)} onClose={() => setOpen(null)} width={560} title={current ? `${current.id} · ${current.object}` : ''} subtitle={current ? `${current.system} ${current.direction.toLowerCase()} · ${current.channel}` : ''}>
        {current && (
          <div className="stack">
            <div className="row-wrap"><StatusChip status={current.status} /><span className="mono small muted">{current.at.replace('T', ' ')} · {current.latencyMs} ms</span></div>
            {current.note && (
              <div className={`callout ${current.status === 'Failed' ? 'callout-crit' : current.status === 'Retrying' ? 'callout-warn' : 'callout-good'}`}>
                <strong>What we did:</strong> {current.note}
              </div>
            )}
            <div className="eyebrow">Request</div>
            <pre className="code">{current.request}</pre>
            <div className="eyebrow">Response</div>
            <pre className="code">{current.response}</pre>
            <p className="small muted">Payloads are illustrative. No real system produced them.</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
