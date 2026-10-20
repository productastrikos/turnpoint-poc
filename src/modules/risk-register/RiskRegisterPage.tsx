import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { getRisks, updateRiskStatus } from '../../services/riskService';
import type { RiskItem, RiskSeverity } from '../../types';
import { useToast } from '../../app/ToastContext';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { Card as SCard, CardHeader } from '../../components/ui/Card';
import { BarChart } from '../../components/charts/BarChart';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { TABS } from '../../app/tabRegistry';
import { shortDate } from '../../mocks/_gen';

const sevTone: Record<RiskSeverity, 'good' | 'warn' | 'crit'> = {
  low: 'good',
  medium: 'warn',
  high: 'warn',
  critical: 'crit',
};

const statusOrder: RiskItem['status'][] = ['open', 'mitigating', 'closed'];

const MITIGATION_PCT: Record<string, number> = { 'RSK-01': 55, 'RSK-02': 30, 'RSK-03': 70, 'RSK-04': 80, 'RSK-05': 60, 'RSK-06': 25, 'RSK-07': 65, 'RSK-08': 100 };
const DUE: Record<string, string> = { 'RSK-01': '2026-08-20', 'RSK-02': '2026-08-24', 'RSK-03': '2026-08-18', 'RSK-04': '2026-08-31', 'RSK-05': '2026-08-19', 'RSK-06': '2026-08-22', 'RSK-07': '2026-08-18', 'RSK-08': '2026-08-12' };

function Steerco({ risks }: { risks: RiskItem[] }) {
  const open = risks.filter((r) => r.status !== 'closed');
  const days = Array.from({ length: 14 }, (_, i) => i + 1);
  // burndown: open risks per day by severity, ending at today's real counts
  const sev = (s: RiskSeverity, day: number) => {
    const now = open.filter((r) => r.severity === s).length;
    const raisedLater = risks.filter((r) => r.severity === s && +r.raisedAt.slice(8, 10) - 2 > day).length;
    return Math.max(0, now + Math.round((14 - day) * 0.18) - raisedLater);
  };
  const exposure = (r: RiskItem) => ({ low: 1, medium: 2, high: 3, critical: 4 })[r.severity] * ({ rare: 1, possible: 2, likely: 3, certain: 4 })[r.likelihood];
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <StatTile label="Open risks" value={String(open.length)} tone="warn" />
        <StatTile label="Critical / high open" value={String(open.filter((r) => r.severity === 'critical' || r.severity === 'high').length)} tone="crit" />
        <StatTile label="Avg mitigation progress" value={`${Math.round(open.reduce((a, r) => a + (MITIGATION_PCT[r.id] ?? 0), 0) / Math.max(1, open.length))}%`} tone="accent" />
        <StatTile label="Closed this TA" value={String(risks.filter((r) => r.status === 'closed').length)} tone="good" />
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <SCard>
          <CardHeader title="Open-risk burn-down by severity" />
          <BarChart height={240} stacked labels={days.map((d) => `D${d}`)} series={(['critical', 'high', 'medium', 'low'] as RiskSeverity[]).map((s, i) => ({ name: s, color: ['var(--crit)', 'var(--warn)', 'var(--accent)', 'var(--good)'][i], data: days.map((d) => sev(s, d)) }))} />
        </SCard>
        <SCard>
          <CardHeader title="Mitigation progress and close-out" />
          {[...open].sort((a, b) => exposure(b) - exposure(a)).map((r) => (
            <div key={r.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}><strong style={{ fontSize: 13 }}>{r.id} {r.description}</strong><div className="small muted">{r.owner} · close-out target {shortDate(DUE[r.id] ?? '2026-08-31')}</div></div>
              <div style={{ width: 130 }}><ProgressBar value={MITIGATION_PCT[r.id] ?? 0} /></div>
            </div>
          ))}
        </SCard>
      </div>
      <SCard>
        <CardHeader title="For the Steering Committee" action={<button className="btn btn-sm no-print" onClick={() => window.print()}>Print pack</button>} />
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, fontSize: 13.5 }}>
          <li><strong>Decision:</strong> approve the standby catalyst-disposal contractor (RSK-01). Its modelled effect on CP1 is on AI Analytics &gt; Risk prediction.</li>
          <li><strong>Decision:</strong> release the 250 t crane for Day 17 ahead of the C-301 rotor lift (RSK-03).</li>
          <li><strong>Escalation:</strong> RSK-02 V-102 nozzle corrosion, scope extension via MOC-101 and SCF-201 awaiting approval.</li>
          <li><strong>For information:</strong> RSK-08 (manpower shortfall, Rotating Equipment) closed on Day 9.</li>
        </ul>
      </SCard>
    </div>
  );
}

export default function RiskRegisterPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useTabParam(TABS['risk-register'], 'register');
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [sevFilter, setSevFilter] = useState<'all' | RiskSeverity>('all');

  useEffect(() => {
    getRisks().then(setRisks);
  }, []);

  const counts = (['critical', 'high', 'medium', 'low'] as RiskSeverity[]).map((sev) => ({
    sev,
    count: risks.filter((r) => r.severity === sev && r.status !== 'closed').length,
  }));

  const visible = sevFilter === 'all' ? risks : risks.filter((r) => r.severity === sevFilter);

  async function advance(r: RiskItem) {
    const next = statusOrder[(statusOrder.indexOf(r.status) + 1) % statusOrder.length];
    const updated = await updateRiskStatus(r.id, next);
    setRisks((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
    showToast(`${r.id} moved to ${next}`, next === 'closed' ? 'good' : next === 'mitigating' ? 'accent' : 'warn');
  }

  return (
    <div>
      <PageHeader
        title="Risk Register"
        subtitle="Turnaround risks by severity, with mitigation owner and close-out tracking, plus a Steering Committee view with burn-down, mitigation progress and decisions needed. Click a severity tile to filter, click Status to cycle a risk through Open → Mitigating → Closed."
        checklist="I2"
      />

      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'register', label: 'Risk register' }, { id: 'steerco', label: 'Steering Committee view' }]} />
      {tab === 'steerco' ? <Steerco risks={risks} /> : (
        <>
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {counts.map((c) => (
          <button
            key={c.sev}
            onClick={() => setSevFilter((f) => (f === c.sev ? 'all' : c.sev))}
            style={{
              all: 'unset',
              cursor: 'pointer',
              outline: sevFilter === c.sev ? `2px solid var(--accent)` : 'none',
              outlineOffset: 2,
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <StatTile label={`${c.sev} (open)`} value={String(c.count)} tone={sevTone[c.sev]} />
          </button>
        ))}
      </div>

      {sevFilter !== 'all' && (
        <div className="phase-focus-banner">
          Showing <strong style={{ textTransform: 'capitalize' }}>{sevFilter}</strong> severity only
          <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSevFilter('all')}>Clear filter</button>
        </div>
      )}

      <Card>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Description</th>
              <th>Category</th>
              <th>Severity</th>
              <th>Likelihood</th>
              <th>Owner</th>
              <th>Mitigation</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.id}</td>
                <td style={{ maxWidth: 240 }}>{r.description}</td>
                <td>{r.category}</td>
                <td><Chip tone={sevTone[r.severity]}>{r.severity}</Chip></td>
                <td style={{ textTransform: 'capitalize' }}>{r.likelihood}</td>
                <td>{r.owner}</td>
                <td style={{ maxWidth: 220, color: 'var(--ink-2)' }}>{r.mitigation}</td>
                <td>
                  <button
                    className={`chip chip-${r.status === 'closed' ? 'good' : r.status === 'mitigating' ? 'accent' : 'crit'}`}
                    style={{ cursor: 'pointer', border: 'none' }}
                    onClick={() => advance(r)}
                  >
                    {r.status}
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-state">No risks match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
        </>
      )}
    </div>
  );
}
