import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { freezeScope, type Certificate } from '../../services/scopeService';
import { peekJobs } from '../../services/jobsService';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** "Generating certificate..." then the freeze itself. The freeze is applied once the animation reaches the issue step. */
export function FreezeDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (cert: Certificate) => void }) {
  const [step, setStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const approved = peekJobs().filter((j) => j.status === 'approved' && j.taClass === 'TA');
  const labels = [
    'Validating the readiness checklist',
    `Snapshotting the baseline: ${approved.length} items, OMR ${approved.reduce((s, j) => s + j.costOMR, 0).toLocaleString()}, ${approved.reduce((s, j) => s + j.manhours, 0).toLocaleString()} man-hours`,
    'Collecting the three gate signatures (Area Ops Focal Point, Head of Area Ops, VP Asset Ops)',
    'Countersigning: TA Event Manager and Head of Turnaround Services',
    'Issuing Scope Freeze Certificate, Revision A',
    `Pushing user status SFRZ to SAP for ${approved.length} maintenance orders (simulated)`,
  ];

  useEffect(() => {
    if (!open) {
      started.current = false;
      return;
    }
    if (started.current) return;
    started.current = true;
    setStep(0);
    setError(null);
    (async () => {
      try {
        for (let i = 0; i < 4; i++) {
          await wait(620);
          setStep(i + 1);
        }
        await wait(300);
        const cert = await freezeScope();
        setStep(5);
        await wait(750);
        setStep(6);
        await wait(550);
        onDone(cert);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The freeze failed');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal open={open} onClose={step >= 6 || error ? onClose : () => undefined} title="Freezing the scope" width={620}>
      <div className="stack" style={{ gap: 6 }} aria-live="polite">
        <div className="small muted" style={{ marginBottom: 6 }}>Generating certificate…</div>
        {labels.map((l, i) => {
          const state = step > i ? 'done' : step === i ? 'active' : 'todo';
          return (
            <div key={l} className="row" style={{ gap: 10, alignItems: 'flex-start', opacity: state === 'todo' ? 0.45 : 1 }}>
              <span style={{ width: 20, flexShrink: 0, textAlign: 'center', marginTop: 1 }}>
                {state === 'done' ? <span style={{ color: 'var(--good)', fontWeight: 700 }}>✓</span> : state === 'active' ? <span className="spinner" style={{ display: 'inline-block' }} /> : <span className="muted">○</span>}
              </span>
              <span style={{ fontSize: 13, fontWeight: state === 'active' ? 600 : 400 }}>{l}</span>
            </div>
          );
        })}
        {error && <div className="callout callout-crit" style={{ marginTop: 8 }}>{error}</div>}
      </div>
    </Modal>
  );
}
