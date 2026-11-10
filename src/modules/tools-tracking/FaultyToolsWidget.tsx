import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { useRole } from '../../app/RoleContext';
import { CONTRACTOR_NAMES } from '../../mocks/master';
import { ago, listToolReports, subscribeTools, summarizeTools, type ToolsSummary } from '../../services/toolsService';

const SEV_TONE = { High: 'crit', Medium: 'warn', Low: 'neutral' } as const;

/**
 * Faulty and missing tools at a glance: counts plus the three worst open items, with a link to /tools-tracking.
 * Embed it on the Mobilization page or the Command Dashboard: `import { FaultyToolsWidget } from '../tools-tracking/FaultyToolsWidget'`.
 * Reloads by itself when a report arrives from the mobile app.
 */
export function FaultyToolsWidget({ title = 'Faulty & missing tools' }: { title?: string }) {
  const { role, persona } = useRole();
  const own = role === 'contractor' ? CONTRACTOR_NAMES.find((n) => persona.org.startsWith(n)) : undefined;
  const [sum, setSum] = useState<ToolsSummary | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => listToolReports().then((r) => live && setSum(summarizeTools(own ? r.filter((x) => x.contractor === own) : r)));
    load();
    const off = subscribeTools(load);
    return () => {
      live = false;
      off();
    };
  }, [own]);

  return (
    <Card>
      <CardHeader title={title} action={<Link to="/tools-tracking" className="small" style={{ fontWeight: 600 }}>Open tools tracking</Link>} />
      {!sum ? (
        <p className="small muted" style={{ margin: 0 }}>Loading…</p>
      ) : (
        <>
          <div className="row-wrap" style={{ gap: 18, marginBottom: 8 }}>
            <div><strong className="mono" style={{ fontSize: 26, color: 'var(--crit)' }}>{sum.faulty}</strong><div className="small muted">faulty</div></div>
            <div><strong className="mono" style={{ fontSize: 26, color: 'var(--crit)' }}>{sum.missing}</strong><div className="small muted">missing</div></div>
            <div><strong className="mono" style={{ fontSize: 26, color: 'var(--warn)' }}>{sum.awaiting}</strong><div className="small muted">awaiting replacement</div></div>
            <div><strong className="mono" style={{ fontSize: 26 }}>{sum.blockingCritical}</strong><div className="small muted">block critical work</div></div>
          </div>
          {sum.top.map((r) => (
            <div key={r.id} className="list-row">
              <span>
                <strong style={{ fontSize: 13 }}>{r.toolName}</strong>
                <div className="small muted">{r.issue} · {r.contractor} · {r.p6Id} · {ago(r.reportedAt)}</div>
              </span>
              <Chip tone={SEV_TONE[r.severity]}>{r.severity}</Chip>
            </div>
          ))}
          {sum.top.length === 0 && <p className="small muted" style={{ margin: 0 }}>No open tool problems.</p>}
        </>
      )}
    </Card>
  );
}

export default FaultyToolsWidget;
