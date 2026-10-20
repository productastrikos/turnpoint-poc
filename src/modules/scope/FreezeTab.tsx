import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { ActionButton } from '../../components/ui/ActionButton';
import { SimBadge } from '../../components/ui/SimBadge';
import { getCertificate, listVariations, reissueCertificate, summarise } from '../../services/scopeService';
import { FREEZE_DATE, SIGNATORIES } from '../../mocks/scopeMock';
import { sapWoForJob } from '../../mocks/sapKeys';
import { longStamp, shortDate } from '../../mocks/_gen';
import { useToast } from '../../app/ToastContext';
import { useHub } from '../integrations/useHub';
import type { Job } from '../../types';

export function FreezeTab({ jobs }: { jobs: Job[] }) {
  const { showToast } = useToast();
  const hub = useHub();
  const [cert, setCert] = useState({ revision: 'A', revisedAt: '2026-06-12T10:20:00' });
  const [s, setS] = useState<ReturnType<typeof summarise> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setCert(await getCertificate());
    setS(summarise(await listVariations()));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const frozen = jobs.filter((j) => j.inBaseline);
  const pushes = hub.messages.filter((m) => m.system === 'SAP' && m.direction === 'Outbound' && m.object === 'Maintenance Order status').slice(0, 4);
  const sample = frozen.slice(0, 5);

  async function reissue() {
    setBusy(true);
    const r = await reissueCertificate();
    await load();
    setBusy(false);
    showToast(`Revision ${r.revision} issued and signed. Freeze status pushed to SAP for ${r.pushed} orders (simulated).`, 'good');
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row no-print" style={{ justifyContent: 'space-between' }}>
        <div className="callout" style={{ flex: 1 }}>Digitally approved turnaround scope and its freeze certificate. Re-issue a revision after approved post-freeze variations; each revision is re-signed and pushed to SAP as the order status.</div>
        <div className="row">
          <ActionButton busy={busy} onClick={reissue}>Re-issue revision {String.fromCharCode(cert.revision.charCodeAt(0) + 1)}</ActionButton>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>

      <Card style={{ maxWidth: 900, margin: '0 auto', width: '100%', borderTop: '6px solid var(--accent)' }}>
        <div className="spread" style={{ borderBottom: '2px solid var(--border)', paddingBottom: 14, marginBottom: 16 }}>
          <div>
            <div className="eyebrow">OQ Refineries & Petrochemical Industries · Sohar Refinery</div>
            <h2 style={{ fontSize: 28, marginTop: 4 }}>Turnaround Scope Freeze Certificate</h2>
            <div className="small muted">Major STO 2026 · Certificate TFC-STO2026-001 · Revision {cert.revision}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Chip tone="good">FROZEN</Chip>
            <div className="mono small muted" style={{ marginTop: 6 }}>Freeze date {shortDate(FREEZE_DATE)} 2026</div>
            <div className="mono small muted">Revised {shortDate(cert.revisedAt.slice(0, 10))} 2026</div>
          </div>
        </div>

        <p style={{ fontSize: 13.5, lineHeight: 1.7 }}>
          This certifies that the scope of work for the Major Shutdown / Turnaround 2026 has passed the three-stage gating process (Area Operations Focal Point, Head of Area Operations, VP Asset Operations) and is frozen as the approved baseline. Any addition, deletion or change after this date is tracked as a variation and requires formal approval.
        </p>

        <div className="grid grid-4" style={{ margin: '16px 0' }}>
          <div className="card-flat"><div className="eyebrow">Frozen items (POC subset)</div><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{frozen.length}</div><div className="small muted">of 1,184 work orders in 140 work packs</div></div>
          <div className="card-flat"><div className="eyebrow">Base estimate</div><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>OMR {s ? (s.base / 1e6).toFixed(2) : '…'}M</div></div>
          <div className="card-flat"><div className="eyebrow">Frozen estimate</div><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>OMR {s ? (s.frozen / 1e6).toFixed(2) : '…'}M</div></div>
          <div className="card-flat"><div className="eyebrow">Variations since freeze</div><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{s ? `+${(s.approvedPost / 1e6).toFixed(2)}M` : '…'}</div><div className="small muted">now OMR {s ? (s.current / 1e6).toFixed(2) : '…'}M</div></div>
        </div>

        <div className="eyebrow" style={{ marginBottom: 6 }}>Digital signatures</div>
        <div className="grid grid-3" style={{ gap: 10 }}>
          {SIGNATORIES.map((g) => (
            <div key={g.role} className="card-flat" style={{ borderLeft: '3px solid var(--good)' }}>
              <div style={{ fontFamily: 'cursive', fontSize: 18, color: 'var(--accent-strong)' }}>{g.name}</div>
              <div className="small" style={{ fontWeight: 600 }}>{g.role}</div>
              <div className="mono small muted">{longStamp(g.at)}</div>
              <div className="mono small muted">sig {g.hash} · verified ✓</div>
            </div>
          ))}
        </div>

        <div className="eyebrow" style={{ margin: '16px 0 6px' }}>Status pushed to SAP <SimBadge kind="simulated" /></div>
        <div className="row-wrap">
          {sample.map((j) => (
            <span key={j.id} className="tag-chip sap" title="User status SFRZ set on the SAP maintenance order (simulated)">WO {sapWoForJob(j)} → SFRZ</span>
          ))}
          <span className="small muted">+ {Math.max(0, frozen.length - sample.length)} more orders</span>
        </div>
        {pushes.length > 0 && <div className="small muted" style={{ marginTop: 6 }}>Latest push: {pushes[0].note}</div>}

        <div className="spread" style={{ marginTop: 22, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <span className="small muted">Digitally signed. Certificate hash 9e41c07a. Valid until superseded by a later revision.</span>
          <svg width={54} height={54} viewBox="0 0 54 54" aria-label="Verification code placeholder">
            {Array.from({ length: 49 }, (_, i) => ((i * 7 + 3) % 5 < 2 ? <rect key={i} x={(i % 7) * 7 + 3} y={Math.floor(i / 7) * 7 + 3} width={6} height={6} fill="var(--ink)" /> : null))}
          </svg>
        </div>
      </Card>
    </div>
  );
}
