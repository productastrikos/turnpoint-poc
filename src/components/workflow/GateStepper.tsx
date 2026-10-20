import type { GateApproval } from '../../types';

export function GateStepper({ approvals }: { approvals: GateApproval[] }) {
  return (
    <div className="gate-stepper" title={approvals.map((a) => `Gate ${a.gate}: ${a.role} — ${a.status}`).join(' / ')}>
      {approvals.map((a, i) => (
        <span key={a.gate} style={{ display: 'flex', alignItems: 'center' }}>
          <span className={`gate-dot ${a.status}`}>G{a.gate}</span>
          {i < approvals.length - 1 && <span className="gate-line" />}
        </span>
      ))}
    </div>
  );
}
