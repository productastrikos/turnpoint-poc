import { useState } from 'react';
import { useLang } from '../i18n/lang';
import { useNavigate } from 'react-router-dom';

interface Step {
  to: string;
  title: string;
  caption: string;
}

// One continuous storyline across modules, using the same seeded entities on every screen.
export const DEMO_STEPS: Step[] = [
  { to: '/executive-summary', title: 'Start at the top', caption: 'Executive summary: STO 2026 at Day 14 of 32. Schedule, cost, safety, quality and readiness on one screen, with the top risks.' },
  { to: '/integrations?tab=sap', title: 'SAP notifications become scope', caption: 'Pull open SAP PM notifications and work orders into the scope worklist. They arrive with an SAP source chip and their SAP number. (Simulated)' },
  { to: '/scope?tab=approvals', title: 'Three-gate approval', caption: 'Each item passes Area Ops Focal Point, Head of Area Ops and VP Asset Ops. Gate 1 also diverts non-TA work to routine maintenance.' },
  { to: '/scope?tab=freeze', title: 'Scope freeze certificate', caption: 'The approved scope is frozen and a digital certificate is issued. The freeze status is pushed back to SAP. (Simulated)' },
  { to: '/work-packs', title: 'Work packs', caption: 'Each approved job becomes a work pack with a readiness checklist, its SAP work order and its P6 Activity ID.' },
  { to: '/integrations?tab=p6', title: 'Primavera P6 round trip', caption: 'Import the P6 XER, apply field updates, recalculate ALU/RLU and the critical path, then export an updated XER. (Simulated)' },
  { to: '/mobile-capture', title: 'Field progress, offline', caption: 'Switch the phone to offline, record progress and take photos, then sync when the signal returns.' },
  { to: '/critical-path', title: 'Critical path moves', caption: 'Dependencies, float and the running count of how many times the critical path has changed.' },
  { to: '/what-if', title: 'What-if analysis', caption: 'Drop a job, add a crew or shift the start and see the new finish date and cost against baseline.' },
  { to: '/', title: 'Dashboard and S-curve', caption: 'Progress, man-hours and budget roll up from the same data. Switch the Active TA in the top bar to rescale the headline numbers.' },
  { to: '/closeout', title: 'Close-out', caption: 'Final cost and schedule performance, lessons learned, and an AI-drafted close-out report. (Simulated)' },
];

export function GuidedDemoButton() {
  const { t } = useLang();
  const [step, setStep] = useState<number | null>(null);
  const navigate = useNavigate();

  function go(i: number | null) {
    setStep(i);
    if (i !== null) navigate(DEMO_STEPS[i].to);
  }

  const current = step !== null ? DEMO_STEPS[step] : null;
  return (
    <>
      <button className="btn btn-ghost" onClick={() => go(step === null ? 0 : null)} title="Walk through the end-to-end storyline">
        {t(step === null ? 'Guided demo' : 'Exit demo')}
      </button>
      {current && step !== null && (
        <div className="guide-bar" role="status">
          <span className="guide-step">STEP {step + 1} / {DEMO_STEPS.length}</span>
          <div className="guide-text">
            <strong>{current.title}.</strong> {current.caption}
          </div>
          <button className="btn btn-sm" disabled={step === 0} onClick={() => go(step - 1)}>{t('Back')}</button>
          {step < DEMO_STEPS.length - 1 ? (
            <button className="btn btn-sm btn-primary" onClick={() => go(step + 1)}>{t('Next')}</button>
          ) : (
            <button className="btn btn-sm btn-primary" onClick={() => setStep(null)}>{t('Finish')}</button>
          )}
        </div>
      )}
    </>
  );
}
