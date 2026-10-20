import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { ActionButton } from '../../components/ui/ActionButton';
import { LoadingState } from '../../components/ui/EmptyState';
import { approveStrategy, getStrategy } from '../../services/closeoutService';
import type { StrategySection, StrategyVersion } from '../../mocks/closeoutMock';
import { useToast } from '../../app/ToastContext';
import { longDate } from '../../mocks/_gen';

export default function StrategyPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<{ sections: StrategySection[]; versions: StrategyVersion[] } | null>(null);
  const [active, setActive] = useState('s1');
  const load = useCallback(() => getStrategy().then(setData), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!data) return <div><PageHeader title="TA Strategy Document" subtitle="" checklist="I5" /><LoadingState /></div>;

  const current = data.versions[data.versions.length - 1];
  const sec = data.sections.find((s) => s.id === active) ?? data.sections[0];

  async function approve() {
    await approveStrategy();
    await load();
    showToast('Strategy v1.2 approved by the steering committee (simulated). The approval stamp is now on the document.', 'good');
  }

  return (
    <div>
      <PageHeader
        title="TA Strategy Document"
        subtitle="The turnaround strategy as a structured, versioned digital document: sections, version history, approval stamp and the KPIs each section is measured by."
        checklist="I5"
        action={<div className="row"><button className="btn" onClick={() => showToast('PDF export is a placeholder in this demo', 'accent')}>Download PDF</button>{current.status === 'Draft' && <ActionButton variant="primary" small={false} onClick={approve}>Approve {current.v}</ActionButton>}</div>}
      />
      <div className="grid grid-2-3" style={{ alignItems: 'start' }}>
        <div className="stack">
          <Card>
            <CardHeader title="Contents" />
            {data.sections.map((s) => (
              <button key={s.id} className={`sidebar-link ${s.id === active ? 'active' : ''}`} style={{ width: '100%', background: s.id === active ? undefined : 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => setActive(s.id)}>{s.title}</button>
            ))}
          </Card>
          <Card>
            <CardHeader title="Version history" />
            {[...data.versions].reverse().map((v) => (
              <div key={v.v} className="list-row" style={{ alignItems: 'flex-start' }}>
                <div><strong className="mono">{v.v}</strong> <span className="small muted">{longDate(v.date)} · {v.author}</span><div className="small muted">{v.note}</div></div>
                <Chip tone={v.status === 'Approved' ? 'good' : 'warn'}>{v.status}</Chip>
              </div>
            ))}
          </Card>
        </div>
        <Card style={{ minHeight: 420 }}>
          <div className="spread" style={{ marginBottom: 12 }}>
            <div>
              <div className="eyebrow">Major STO 2026 · Turnaround Strategy · {current.v}</div>
              <h2 style={{ fontSize: 24, marginTop: 4 }}>{sec.title}</h2>
            </div>
            {current.status === 'Approved' ? (
              <div style={{ border: '3px solid var(--good)', color: 'var(--good)', borderRadius: 8, padding: '6px 12px', transform: 'rotate(-4deg)', fontFamily: 'var(--font-display)', fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>
                APPROVED<div style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>Steering Committee · {longDate(current.date)}</div>
              </div>
            ) : (
              <Chip tone="warn">{current.v} draft, awaiting approval</Chip>
            )}
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.8 }}>{sec.body}</p>
          {sec.kpi && (
            <div className="callout" style={{ marginTop: 16 }}>
              <strong>Measured by:</strong> {sec.kpi}. See the <Link to="/kpis" style={{ fontWeight: 700 }}>KPI scorecard</Link>.
            </div>
          )}
          <div className="row" style={{ marginTop: 18 }}>
            <button className="btn btn-sm" disabled={sec.id === data.sections[0].id} onClick={() => setActive(data.sections[data.sections.findIndex((s) => s.id === sec.id) - 1].id)}>← Previous</button>
            <button className="btn btn-sm" disabled={sec.id === data.sections[data.sections.length - 1].id} onClick={() => setActive(data.sections[data.sections.findIndex((s) => s.id === sec.id) + 1].id)}>Next →</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
