import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { getPresence, relativeTime, subscribePresence } from '../../services/integrationService';
import { useHub, useTick } from './useHub';

const LIVE_MS = 5 * 60_000;

/**
 * Top bar indicator for the SAP / P6 story. With the stand-in consoles open it shows them as live (they are real
 * windows exchanging messages with TURNPOINT); otherwise the status is simulated. Either way the label says which.
 */
export function SyncPill() {
  const hub = useHub();
  const presence = useSyncExternalStore(subscribePresence, getPresence, getPresence);
  useTick();
  const now = Date.now();
  const live = (['SAP', 'P6'] as const).filter((s) => (presence[s] ?? 0) > now - LIVE_MS);
  const last = Math.max(hub.p6.lastSyncAt, hub.sap.lastSyncAt);
  if (live.length) {
    const label = `${live.join(' · ')} stand-in${live.length > 1 ? 's' : ''} live`;
    return (
      <Link to="/integrations?tab=live" className="sync-pill" title="SAP / P6 stand-in consoles are open and exchanging messages with TURNPOINT over the local integration bus (demo stand-ins, not the client's systems)." aria-label={`${label}. Open the live sync tab.`}>
        <span className="sync-dot live" />
        <span className="sync-name">P6 · SAP</span>
        <span className="sync-state">{label.replace('P6 · SAP ', '')}</span>
        <span className="sync-short">live</span>
      </Link>
    );
  }
  const note = 'Simulated integration status. There is no live SAP or P6 connection. Open the Integration Hub.';
  return (
    <Link to="/integrations" className="sync-pill" title={note} aria-label={`P6 and SAP sync status, simulated. ${hub.running ? 'Syncing now.' : `Last simulated sync ${relativeTime(last)}.`} Open the Integration Hub.`}>
      <span className={`sync-dot ${hub.running ? 'busy' : ''}`} />
      <span className="sync-name">P6 · SAP</span>
      <span className="sync-state">{hub.running ? 'syncing (simulated)…' : `simulated · ${relativeTime(last)}`}</span>
      <span className="sync-short">sim</span>
    </Link>
  );
}
