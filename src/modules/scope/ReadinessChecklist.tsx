import { Chip } from '../../components/ui/Chip';
import type { FreezeReadiness } from '../../services/scopeService';

/** The five things that must be true before the scope can be frozen. Each row turns green as the demo clears it. */
export function ReadinessChecklist({ readiness, onFix }: { readiness: FreezeReadiness | null; onFix?: (id: string) => void }) {
  if (!readiness) return <div className="small muted">Checking readiness…</div>;
  const done = readiness.checks.filter((c) => c.ok).length;
  return (
    <div>
      <div className="spread" style={{ marginBottom: 6 }}>
        <span className="eyebrow">Readiness to freeze</span>
        <Chip tone={readiness.ok ? 'good' : 'warn'}>{done} of {readiness.checks.length} ready</Chip>
      </div>
      {readiness.checks.map((c) => (
        <div key={c.id} className="list-row" style={{ alignItems: 'flex-start' }} data-testid={`ready-${c.id}`} data-ok={c.ok ? 'yes' : 'no'}>
          <span style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: 20,
                height: 20,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                marginTop: 1,
                color: c.ok ? '#fff' : 'var(--warn)',
                background: c.ok ? 'var(--good)' : 'var(--warn-soft)',
                border: c.ok ? '1px solid var(--good)' : '1px solid var(--warn)',
              }}
            >
              {c.ok ? '✓' : '!'}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{c.label}</span>
              <div className="small muted">{c.detail}</div>
              {!c.ok && <div className="small" style={{ color: 'var(--warn)' }}>{c.fix}</div>}
            </span>
          </span>
          {!c.ok && onFix && (
            <button className="btn btn-sm" onClick={() => onFix(c.id)}>Go there</button>
          )}
        </div>
      ))}
    </div>
  );
}
