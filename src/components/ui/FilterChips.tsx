export interface FilterOption {
  value: string;
  label?: string;
  count?: number;
}

export function FilterChips({
  options,
  value,
  onChange,
  allLabel = 'All',
  hideAll = false,
}: {
  options: readonly FilterOption[];
  value: string;
  onChange: (v: string) => void;
  allLabel?: string;
  /** for a single-choice switch with no "all" state (e.g. 2 / 3 / 4 weeks): no leading All chip. */
  hideAll?: boolean;
}) {
  return (
    <div className="filter-chips" role="group">
      {!hideAll && (
        <button className={`fchip ${value === 'all' ? 'active' : ''}`} aria-pressed={value === 'all'} onClick={() => onChange('all')}>
          {allLabel}
        </button>
      )}
      {options.map((o) => (
        <button key={o.value} className={`fchip ${value === o.value ? 'active' : ''}`} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label ?? o.value}
          {o.count !== undefined && <span className="mono fchip-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
