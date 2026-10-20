import { useSyncExternalStore } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatusChip } from '../../components/ui/StatusChip';
import { SimBadge } from '../../components/ui/SimBadge';
import { getPresence, sendToSystems, subscribePresence } from '../../services/integrationService';
import { useToast } from '../../app/ToastContext';
import { useHub, useTick } from './useHub';

const FIRST_SESSION_MSG = 413; // seeded log ends at MSG-0412

function ago(ms?: number) {
  if (!ms) return 'not opened yet';
  const s = Math.round((Date.now() - ms) / 1000);
  return s < 60 ? `seen ${s}s ago` : `seen ${Math.round(s / 60)} min ago`;
}

function SystemCard({ title, seen, path, split, steps }: { title: string; seen?: number; path: string; split: string; steps: string[] }) {
  const live = Boolean(seen && Date.now() - seen < 5 * 60_000);
  return (
    <Card>
      <CardHeader title={<span>{title} <SimBadge kind="simulated" title="A stand-in console for the demo, not the client's system" /></span>} action={<Chip tone={live ? 'good' : 'neutral'}>{live ? 'connected' : ago(seen)}</Chip>} />
      <div className="row-wrap" style={{ marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => window.open(path, path, 'width=1440,height=900')}>Open in its own window ↗</button>
        <a className="btn" href={split} target="_blank" rel="noreferrer">Side by side with TURNPOINT ↗</a>
      </div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>Try this</div>
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
        {steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
    </Card>
  );
}

/** Live two-way sync with the SAP and P6 stand-in consoles (checklist D5, D6, G5). */
export function LiveSyncTab() {
  const { showToast } = useToast();
  const hub = useHub();
  const presence = useSyncExternalStore(subscribePresence, getPresence, getPresence);
  useTick(5000);
  const session = hub.messages.filter((m) => Number(m.id.slice(4)) >= FIRST_SESSION_MSG).slice(0, 14);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="callout">
        The two consoles stand in for the client's SAP S/4HANA and Primavera P6. Each opens as a separate system with its own data, and exchanges messages with TURNPOINT over a local integration bus using the real interface field names (SAP API_MAINTNOTIFICATION / API_MAINTENANCEORDER, P6 activity dates and float). A change made there shows up here within a second, and approvals, the scope freeze, merges and field progress made here show up there. In production the same messages travel through SAP Integration Suite (OData) and the P6 EPPM REST API.
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <SystemCard
          title="SAP S/4HANA · maintenance"
          seen={presence.SAP}
          path="/ext/sap"
          split="/ext/split?left=/scope&right=sap"
          steps={[
            'SAP: Notifications > Create > example "V-102 nozzle N4 corrosion" > Save. TURNPOINT raises a new scope item at Gate 1 and the AI flags it as a likely duplicate of J-2207.',
            'SAP: Maintenance orders > 4000031187 (E-204 retube) > raise the planned cost > Save. The J-2202 estimate and the scope budget roll-up change in TURNPOINT.',
            'TURNPOINT: Scope > 3-gate approvals > approve J-2232 at Gate 3. SAP shows order 4000033232 released with user status APRV, changed by TURNPOINT_INT.',
            'TURNPOINT: Scope > Worklist > merge J-2235 into J-2230. SAP notification 100051988 is completed as a duplicate.',
          ]}
        />
        <SystemCard
          title="Primavera P6 · schedule"
          seen={presence.P6}
          path="/ext/p6"
          split="/ext/split?left=/critical-path&right=p6"
          steps={[
            'P6: double-click Rem Dur on CDU-2020 (E-204 Retube), change 4 to 7, Enter, then Schedule (F9). TURNPOINT moves CPA-005 / 014 / 010, the TA end goes from 05 Sep to 07 Sep, the critical path switches from CP1 to CP2 and the change counter goes up.',
            'TURNPOINT: Mobile field app > record progress on T-201 Tray Repair. P6 shows the new % complete and remaining duration; Schedule (F9) sends the recalculated dates back.',
            'TURNPOINT: AI Analytics > Risk prediction recomputes from the new dates.',
          ]}
        />
      </div>
      <Card>
        <CardHeader
          title="Messages this session"
          action={
            <button
              className="btn btn-sm"
              onClick={() => {
                sendToSystems({ type: 'reset' });
                showToast('Stand-in consoles reset to their seed data. Use Reset demo data (profile menu) to reset TURNPOINT too.', 'accent');
              }}
            >
              Reset stand-ins
            </button>
          }
        />
        {session.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>No messages yet. Open a console and try one of the steps above; every message is also in Monitoring &amp; error handling.</p>
        ) : (
          session.map((m) => (
            <div key={m.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div className="row-wrap" style={{ gap: 6 }}>
                  <span className={`tag-chip ${m.system === 'SAP' ? 'sap' : 'p6'}`}>{m.system}</span>
                  <Chip tone={m.direction === 'Inbound' ? 'accent' : 'neutral'}>{m.direction === 'Inbound' ? `${m.system} → TURNPOINT` : `TURNPOINT → ${m.system}`}</Chip>
                  <strong style={{ fontSize: 13 }}>{m.object}</strong>
                  <span className="mono small muted">{m.key}</span>
                </div>
                {m.note && <div className="small" style={{ marginTop: 3 }}>{m.note}</div>}
              </div>
              <StatusChip status={m.status} />
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
