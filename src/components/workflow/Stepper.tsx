/** Horizontal stage stepper. `current` is the index of the active step; earlier steps render as done. Steps are clickable if onSelect is given. */
export function Stepper({
  steps,
  current,
  onSelect,
  failedIndex,
}: {
  steps: readonly string[];
  current: number;
  onSelect?: (i: number) => void;
  failedIndex?: number;
}) {
  return (
    <div className="stepper">
      {steps.map((s, i) => {
        const state = failedIndex === i ? 'failed' : i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <div key={s} className="stepper-step" style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : undefined }}>
            <button className={`stp ${state}`} onClick={onSelect ? () => onSelect(i) : undefined} disabled={!onSelect} title={s}>
              <span className="stp-dot">{state === 'done' ? '✓' : state === 'failed' ? '!' : i + 1}</span>
              <span className="stp-label">{s}</span>
            </button>
            {i < steps.length - 1 && <span className={`stp-line ${i < current ? 'done' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}
