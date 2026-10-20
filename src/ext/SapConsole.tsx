import { useEffect, useState, useSyncExternalStore } from 'react';
import { changeOrder, connectSap, createNotification, EXAMPLE_NOTIFICATIONS, funcLoc, getSapState, subscribeSap } from '../integration/sapStore';
import type { SapNotification, SapOrder } from '../integration/bus';
import { AREA_IDS, DISCIPLINES } from '../mocks/master';
import type { Discipline } from '../types';
import './ext.css';

type Tab = 'notifications' | 'orders' | 'log';
const STATUS_TONE: Record<string, string> = { Inbound: 'info', Sent: 'good', Outstanding: 'warn', 'In process': 'info', Completed: 'good', REL: 'good', CRTD: 'none', TECO: 'info', SFRZ: 'info', APRV: 'good', TPSC: 'warn', DUPL: 'crit', SCFA: 'good' };
const USER_STATUS_TEXT: Record<string, string> = { SFRZ: 'Scope frozen', APRV: 'TA approved', TPSC: 'In TA scoping', DUPL: 'Duplicate', SCFA: 'SCF approved', INIT: 'Initial' };
const omr = (v: number) => v.toLocaleString('en-US');

function Status({ code, text }: { code: string; text?: string }) {
  return <span className={`sapx-status ${STATUS_TONE[code] ?? 'none'}`} title={text}>{code}{text ? ` · ${text}` : ''}</span>;
}

const emptyForm = { ...EXAMPLE_NOTIFICATIONS[0], NotificationText: '', TechnicalObject: '', ZZ_EstCostOMR: 0, ZZ_Manhours: 0 };

function CreateDialog({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState<typeof emptyForm>(emptyForm);
  const set = <K extends keyof typeof emptyForm>(k: K, v: (typeof emptyForm)[K]) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.NotificationText.trim().length > 5 && f.TechnicalObject.trim().length > 1;
  return (
    <div className="sapx-overlay" onClick={onClose}>
      <div className="sapx-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Create maintenance notification">
        <header>Create Maintenance Notification</header>
        <div className="body">
          <div className="full">
            <label>Use an example</label>
            <select defaultValue="" onChange={(e) => e.target.value !== '' && setF({ ...EXAMPLE_NOTIFICATIONS[Number(e.target.value)] })}>
              <option value="">Choose…</option>
              {EXAMPLE_NOTIFICATIONS.map((x, i) => <option key={x.NotificationText} value={i}>{x.NotificationText}</option>)}
            </select>
          </div>
          <div className="full">
            <label>Description *</label>
            <input value={f.NotificationText} onChange={(e) => set('NotificationText', e.target.value)} placeholder="What is wrong, on which equipment" />
          </div>
          <div>
            <label>Technical object (equipment) *</label>
            <input value={f.TechnicalObject} onChange={(e) => set('TechnicalObject', e.target.value)} placeholder="e.g. E-204" />
          </div>
          <div>
            <label>Functional location</label>
            <input value={funcLoc(f.ZZ_Area, f.TechnicalObject || '')} readOnly />
          </div>
          <div>
            <label>Notification type</label>
            <select value={f.NotificationType} onChange={(e) => set('NotificationType', e.target.value as SapNotification['NotificationType'])}>
              <option value="M1">M1 · Maintenance request</option>
              <option value="M2">M2 · Malfunction report</option>
            </select>
          </div>
          <div>
            <label>Priority</label>
            <select value={f.MaintPriority} onChange={(e) => set('MaintPriority', e.target.value as SapNotification['MaintPriority'])}>
              <option value="1">1 · Very high</option>
              <option value="2">2 · High</option>
              <option value="3">3 · Medium</option>
              <option value="4">4 · Low</option>
            </select>
          </div>
          <div>
            <label>Area / unit</label>
            <select value={f.ZZ_Area} onChange={(e) => set('ZZ_Area', e.target.value)}>
              {AREA_IDS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label>Discipline</label>
            <select value={f.ZZ_Discipline} onChange={(e) => set('ZZ_Discipline', e.target.value as Discipline)}>
              {DISCIPLINES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label>Estimated cost (OMR)</label>
            <input type="number" value={f.ZZ_EstCostOMR || ''} onChange={(e) => set('ZZ_EstCostOMR', Number(e.target.value))} />
          </div>
          <div>
            <label>Planned work (hours)</label>
            <input type="number" value={f.ZZ_Manhours || ''} onChange={(e) => set('ZZ_Manhours', Number(e.target.value))} />
          </div>
          <div className="full sapx-hint">Saving raises the notification here and sends it to TURNPOINT at once (event-driven), where it becomes a scope item at Gate 1 and is checked for duplicates.</div>
        </div>
        <footer>
          <button className="sapx-btn" onClick={onClose}>Cancel</button>
          <button className="sapx-btn primary" disabled={!valid} onClick={() => { createNotification({ ...f, ReportedByUser: f.ReportedByUser || 'PLANNER01' }); onClose(); }}>Save</button>
        </footer>
      </div>
    </div>
  );
}

function OrderDialog({ order, onClose }: { order: SapOrder; onClose: () => void }) {
  const [cost, setCost] = useState(order.PlannedCostOMR);
  const [priority, setPriority] = useState(order.MaintPriority);
  const [sys, setSys] = useState(order.SystemStatusText);
  return (
    <div className="sapx-overlay" onClick={onClose}>
      <div className="sapx-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Change maintenance order ${order.MaintenanceOrder}`}>
        <header>Change Maintenance Order {order.MaintenanceOrder}</header>
        <div className="body">
          <div className="full"><label>Description</label><input value={order.MaintenanceOrderDesc} readOnly /></div>
          <div><label>Equipment</label><input value={order.Equipment} readOnly /></div>
          <div><label>Functional location</label><input value={order.FunctionalLocation} readOnly /></div>
          <div><label>Planned cost (OMR)</label><input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} /></div>
          <div>
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as SapOrder['MaintPriority'])}>
              <option value="1">1 · Very high</option><option value="2">2 · High</option><option value="3">3 · Medium</option><option value="4">4 · Low</option>
            </select>
          </div>
          <div>
            <label>System status</label>
            <select value={sys} onChange={(e) => setSys(e.target.value)}>
              <option value="CRTD">CRTD · Created</option><option value="REL">REL · Released</option><option value="TECO">TECO · Technically complete</option>
            </select>
          </div>
          <div><label>User status</label><input value={`${order.UserStatusText}${USER_STATUS_TEXT[order.UserStatusText] ? ` · ${USER_STATUS_TEXT[order.UserStatusText]}` : ''}`} readOnly /></div>
          <div className="full sapx-hint">Changes to cost, priority or status are sent to TURNPOINT on save. TURNPOINT owns scope approval and progress; SAP owns cost and order status.</div>
        </div>
        <footer>
          <button className="sapx-btn" onClick={onClose}>Cancel</button>
          <button className="sapx-btn primary" onClick={() => { changeOrder(order.MaintenanceOrder, { PlannedCostOMR: cost, MaintPriority: priority, SystemStatusText: sys }); onClose(); }}>Save</button>
        </footer>
      </div>
    </div>
  );
}

/** Stand-in for the client's SAP S/4HANA maintenance apps (Fiori-style). Demo only, talks to TURNPOINT over the local bus. */
export default function SapConsole() {
  const s = useSyncExternalStore(subscribeSap, getSapState, getSapState);
  const [tab, setTab] = useState<Tab>('notifications');
  const [q, setQ] = useState('');
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<SapOrder | null>(null);
  useEffect(() => connectSap(), []);
  useEffect(() => {
    document.title = 'S/4HANA Maintenance (demo stand-in)';
  }, []);

  const match = (t: string) => !q || t.toLowerCase().includes(q.toLowerCase());
  const notifs = s.notifications.filter((n) => match(`${n.MaintenanceNotification} ${n.NotificationText} ${n.TechnicalObject} ${n.ZZ_TurnpointRef ?? ''}`));
  const orders = s.orders.filter((o) => match(`${o.MaintenanceOrder} ${o.MaintenanceOrderDesc} ${o.Equipment} ${o.ZZ_TurnpointRef ?? ''}`));
  const byTp = s.log.filter((l) => l.user === 'TURNPOINT_INT').length;

  return (
    <div className="sapx">
      <div className="sapx-shell">
        <span className="sapx-logo">S/4</span>
        <span className="sapx-title">Maintenance Planning</span>
        <span className="sapx-sub">S/4HANA · Plant SOH1 Sohar Refinery</span>
        <span style={{ flex: 1 }} />
        <span className="sapx-pill" title="Messages to and from TURNPOINT travel over the local integration bus"><span className={`sapx-dot ${s.connected ? 'on' : ''}`} /> TURNPOINT {s.connected ? 'connected' : 'waiting'}</span>
        <span className="sapx-avatar" title="PLANNER01, maintenance planner">PL</span>
      </div>
      <div className="sapx-page">
        <div className="sapx-head">
          <h1>Turnaround STO-2026: notifications and orders</h1>
          <p>Planner view of the maintenance backlog feeding the turnaround. Create a notification or change an order and watch TURNPOINT react; approvals and the scope freeze in TURNPOINT come back here.</p>
        </div>
        <div className="sapx-kpis">
          <div className="sapx-kpi"><div className="k">Outstanding notifications</div><div className="v">{s.notifications.filter((n) => n.NotifProcessingPhaseDesc === 'Outstanding').length}</div></div>
          <div className="sapx-kpi"><div className="k">Orders in TA scope</div><div className="v">{s.orders.length}</div></div>
          <div className="sapx-kpi"><div className="k">Scope frozen (SFRZ)</div><div className="v">{s.orders.filter((o) => o.UserStatusText === 'SFRZ').length}</div></div>
          <div className="sapx-kpi"><div className="k">Changes from TURNPOINT today</div><div className="v">{byTp}</div></div>
        </div>
        <div className="sapx-tabs" role="tablist">
          <button className={`sapx-tab ${tab === 'notifications' ? 'on' : ''}`} onClick={() => setTab('notifications')}>Notifications<span className="n">({s.notifications.length})</span></button>
          <button className={`sapx-tab ${tab === 'orders' ? 'on' : ''}`} onClick={() => setTab('orders')}>Maintenance orders<span className="n">({s.orders.length})</span></button>
          <button className={`sapx-tab ${tab === 'log' ? 'on' : ''}`} onClick={() => setTab('log')}>Change log<span className="n">({s.log.length})</span></button>
        </div>
        <div className="sapx-card">
          {tab !== 'log' && (
            <div className="sapx-toolbar">
              <span className="t">{tab === 'notifications' ? 'Maintenance notifications' : 'Maintenance orders'}</span>
              <span className="grow" />
              <input className="sapx-search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
              {tab === 'notifications' && <button className="sapx-btn primary" onClick={() => setCreate(true)}>Create</button>}
            </div>
          )}
          {tab === 'notifications' && (
            <table className="sapx-table">
              <thead><tr><th>Notification</th><th>Description</th><th>Type</th><th>Priority</th><th>Technical object</th><th>Reported by</th><th>Created</th><th>Status</th><th>TURNPOINT</th></tr></thead>
              <tbody>
                {notifs.map((n) => (
                  <tr key={n.MaintenanceNotification} className={s.flash.includes(n.MaintenanceNotification) ? 'flash' : ''}>
                    <td className="sapx-mono sapx-link">{n.MaintenanceNotification}</td>
                    <td>{n.NotificationText}<div className="sapx-hint sapx-mono">{n.FunctionalLocation}</div></td>
                    <td>{n.NotificationType}</td>
                    <td>{n.MaintPriority}</td>
                    <td className="sapx-mono">{n.TechnicalObject}</td>
                    <td>{n.ReportedByUser}</td>
                    <td className="sapx-mono">{n.CreationDate.split('-').reverse().join('.')}</td>
                    <td><Status code={n.NotifProcessingPhaseDesc} /></td>
                    <td>{n.ZZ_TurnpointRef ? <span className="sapx-tpref">{n.ZZ_TurnpointRef}</span> : <span className="sapx-hint">not in TA scope</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'orders' && (
            <table className="sapx-table">
              <thead><tr><th>Order</th><th>Description</th><th>Type</th><th>Equipment</th><th>Prio</th><th>System status</th><th>User status</th><th style={{ textAlign: 'right' }}>Planned cost (OMR)</th><th>Last changed by</th><th>TURNPOINT</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.MaintenanceOrder} className={`click ${s.flash.includes(o.MaintenanceOrder) ? 'flash' : ''}`} onClick={() => setEdit(o)}>
                    <td className="sapx-mono sapx-link">{o.MaintenanceOrder}</td>
                    <td>{o.MaintenanceOrderDesc}<div className="sapx-hint sapx-mono">{o.FunctionalLocation} · {o.WBSElement}</div></td>
                    <td>{o.MaintenanceOrderType}</td>
                    <td className="sapx-mono">{o.Equipment}</td>
                    <td>{o.MaintPriority}</td>
                    <td><Status code={o.SystemStatusText} /></td>
                    <td>{o.UserStatusText ? <Status code={o.UserStatusText} text={USER_STATUS_TEXT[o.UserStatusText]} /> : null}</td>
                    <td className="sapx-mono" style={{ textAlign: 'right' }}>{omr(o.PlannedCostOMR)}</td>
                    <td><span className={o.LastChangedBy === 'TURNPOINT_INT' ? 'sapx-tpref' : ''}>{o.LastChangedBy}</span><div className="sapx-hint sapx-mono">{o.LastChangeDateTime}</div></td>
                    <td>{o.ZZ_TurnpointRef ? <span className="sapx-tpref">{o.ZZ_TurnpointRef}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'log' && (
            s.log.length === 0 ? <div className="sapx-empty">No changes yet in this session. Create a notification, change an order, or approve / freeze scope in TURNPOINT.</div> : (
              <table className="sapx-table">
                <thead><tr><th>Time</th><th>User</th><th>Direction</th><th>Object</th><th>Change</th></tr></thead>
                <tbody>
                  {s.log.map((l, i) => (
                    <tr key={`${l.at}-${i}`}>
                      <td className="sapx-mono">{l.at}</td>
                      <td><span className={l.user === 'TURNPOINT_INT' ? 'sapx-tpref' : ''}>{l.user}</span></td>
                      <td>{l.dir === 'in' ? <Status code="Inbound" /> : <Status code="Sent" />}</td>
                      <td className="sapx-mono">{l.object}</td>
                      <td>{l.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
      {create && <CreateDialog onClose={() => setCreate(false)} />}
      {edit && <OrderDialog order={edit} onClose={() => setEdit(null)} />}
      <div className="ext-ribbon">Demo stand-in for the client's SAP S/4HANA, not SAP software. Data lives in this browser and syncs with TURNPOINT over a local bus using the API_MAINTNOTIFICATION / API_MAINTENANCEORDER field names. Production: OData via SAP Integration Suite.</div>
    </div>
  );
}
