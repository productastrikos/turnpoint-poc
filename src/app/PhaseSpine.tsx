import { useNavigate } from 'react-router-dom';
import { PHASES, PHASE_LANDING } from './moduleRegistry';
import { usePhase } from './PhaseContext';

export function PhaseSpine() {
  const { activePhase, setActivePhase } = usePhase();
  const navigate = useNavigate();
  const activeIdx = PHASES.findIndex((p) => p.id === activePhase);

  function selectPhase(id: (typeof PHASES)[number]['id']) {
    setActivePhase(id);
    navigate(PHASE_LANDING[id]);
  }

  return (
    <nav className="phase-spine" aria-label="Turnaround lifecycle">
      {PHASES.map((p, i) => (
        <button
          key={p.id}
          className={`phase-step ${activePhase === p.id ? 'active' : ''} ${i < activeIdx ? 'done' : ''}`}
          onClick={() => selectPhase(p.id)}
          title={`Jump to ${p.label}`}
          aria-current={activePhase === p.id ? 'step' : undefined}
        >
          <span className="num">{i < activeIdx ? '✓' : i + 1}</span>
          {p.label}
        </button>
      ))}
    </nav>
  );
}
