import { useEffect, useState } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { Chip } from '../../components/ui/Chip';
import { ActionButton } from '../../components/ui/ActionButton';
import { SimBadge } from '../../components/ui/SimBadge';
import { bestQuote, getVendorState, inviteVendors, simulateResponses, type VendorQuote } from '../../services/scfVendorService';
import { useRole } from '../../app/RoleContext';
import { useToast } from '../../app/ToastContext';
import type { SCF } from '../../types';
import { Icon } from '../../app/icons';

export function VendorInputDrawer({ scf, onClose }: { scf: SCF | null; onClose: () => void }) {
  const { role } = useRole();
  const { showToast } = useToast();
  const [state, setState] = useState<VendorQuote[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (scf) {
      setPicked([]);
      getVendorState(scf.id).then(setState);
    }
  }, [scf]);

  if (!scf) return null;
  const invited = state.filter((q) => q.invited);
  const best = bestQuote(state);

  async function invite() {
    setBusy(true);
    setState(await inviteVendors(scf!.id, picked));
    setPicked([]);
    setBusy(false);
    showToast(`${picked.length} vendor(s) invited to give input on ${scf!.id}. They see the scope only.`, 'accent');
  }
  async function respond() {
    setBusy(true);
    setState(await simulateResponses(scf!.id, scf!.costUSD));
    setBusy(false);
    showToast('Vendor responses received (simulated)', 'good');
  }

  return (
    <Drawer open onClose={onClose} width={520} title={<span>Vendor input: {scf.id} <SimBadge kind="simulated" /></span>} subtitle={scf.title}>
      <div className="stack">
        <div className="callout">
          <strong>Privacy rules.</strong> Invited vendors see the scope description, drawings and required window only. They never see OQ's cost estimate, the approval route or other vendors' quotes. Quotes are visible to OQ commercial roles only.
        </div>
        <div className="eyebrow">1. Invite vendors before the vendor is finalised</div>
        {state.map((q) => (
          <label key={q.vendor} className="list-row" style={{ cursor: q.invited ? 'default' : 'pointer' }}>
            <span style={{ display: 'flex', gap: 10 }}>
              <input type="checkbox" disabled={q.invited} checked={q.invited || picked.includes(q.vendor)} onChange={() => setPicked((p) => (p.includes(q.vendor) ? p.filter((x) => x !== q.vendor) : [...p, q.vendor]))} />
              {q.vendor}
            </span>
            {q.invited ? <Chip tone="accent">invited</Chip> : <span className="small muted">not invited</span>}
          </label>
        ))}
        <ActionButton variant="primary" small={false} busy={busy} disabled={picked.length === 0} onClick={invite}>Invite {picked.length || ''} selected vendors</ActionButton>

        <div className="eyebrow" style={{ marginTop: 6 }}>2. Their input: cost and proposal</div>
        {invited.length === 0 && <p className="small muted" style={{ margin: 0 }}>No vendors invited yet.</p>}
        {invited.map((q) => (
          <div key={q.vendor} className="list-row" style={{ alignItems: 'flex-start' }}>
            <div><strong>{q.vendor}</strong><div className="small muted">{q.note ?? 'Awaiting response'}</div></div>
            {role === 'contractor' ? (
              <span className="restricted-value"><Icon name="lock" size={12} /> quotes restricted</span>
            ) : q.quoteOMR !== undefined ? (
              <div style={{ textAlign: 'right' }}><div className="mono" style={{ fontWeight: 700 }}>OMR {q.quoteOMR.toLocaleString()}</div><div className="small muted">{q.days} days{best?.vendor === q.vendor ? ' · lowest' : ''}</div></div>
            ) : (
              <Chip tone="warn">pending</Chip>
            )}
          </div>
        ))}
        {invited.some((q) => q.quoteOMR === undefined) && (
          <ActionButton busy={busy} onClick={respond}>Simulate vendor responses</ActionButton>
        )}
      </div>
    </Drawer>
  );
}
