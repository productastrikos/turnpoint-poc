import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { getKPIs } from '../../services/dashboardService';
import { getCriticalPathActivities } from '../../services/criticalPathService';
import { getAlerts } from '../../services/alertsService';
import { getRisks } from '../../services/riskService';
import { getAttendance } from '../../services/workforceService';
import type { KPI, CriticalPathActivity, AlertItem, RiskItem } from '../../types';

export default function DailyReportPage() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [cp, setCp] = useState<CriticalPathActivity[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [att, setAtt] = useState<Awaited<ReturnType<typeof getAttendance>> | null>(null);

  useEffect(() => {
    getKPIs().then(setKpis);
    getCriticalPathActivities().then(setCp);
    getAlerts().then(setAlerts);
    getRisks().then(setRisks);
    getAttendance().then(setAtt);
  }, []);

  const today = new Date('2026-08-16T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' · TA Day 14 of 32';
  const delayed = cp.filter((a) => a.status === 'delayed');
  const atRisk = cp.filter((a) => a.status === 'at-risk');
  const critAlerts = alerts.filter((a) => a.severity === 'crit');
  const openCritRisks = risks.filter((r) => r.severity === 'critical' && r.status !== 'closed');

  return (
    <div>
      <PageHeader
        title="Daily Turnaround Newsletter"
        checklist="G7"
        subtitle="System-generated daily report — pulled live from the same data every module reads, so this replaces manual end-of-day reporting rather than duplicating it."
        action={<button className="btn btn-primary btn-sm" onClick={() => window.print()}>Print / Export PDF</button>}
      />

      <Card style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ borderBottom: '2px solid var(--accent)', paddingBottom: 16, marginBottom: 20 }}>
          <span className="eyebrow">TURNPOINT — Daily TA Report</span>
          <h2 style={{ fontSize: 22, marginTop: 4 }}>{today}</h2>
        </div>

        <CardHeader title="Headline KPIs" />
        <div className="grid grid-4" style={{ marginBottom: 24 }}>
          {kpis.slice(0, 4).map((k) => (
            <div key={k.label} style={{ fontSize: 12.5 }}>
              <div style={{ color: 'var(--ink-3)' }}>{k.label}</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {att && (
          <>
            <CardHeader title="Manpower: plan vs actual (both shifts)" />
            <table className="table" style={{ marginBottom: 24 }}>
              <thead><tr><th>Contractor</th><th style={{ textAlign: 'right' }}>Day plan / actual</th><th style={{ textAlign: 'right' }}>Night plan / actual</th><th style={{ textAlign: 'right' }}>Variance</th></tr></thead>
              <tbody>
                {att.rows.map((r) => (
                  <tr key={r.contractor}><td>{r.contractor}</td><td className="mono" style={{ textAlign: 'right' }}>{r.planDay} / {r.actDay}</td><td className="mono" style={{ textAlign: 'right' }}>{r.planNight} / {r.actNight}</td><td className="mono" style={{ textAlign: 'right', color: 'var(--warn)' }}>{r.actDay + r.actNight - r.planDay - r.planNight}</td></tr>
                ))}
                <tr style={{ fontWeight: 700 }}><td>Total</td><td className="mono" style={{ textAlign: 'right' }}>{att.totals.planDay} / {att.totals.actDay}</td><td className="mono" style={{ textAlign: 'right' }}>{att.totals.planNight} / {att.totals.actNight}</td><td className="mono" style={{ textAlign: 'right', color: 'var(--crit)' }}>{att.totals.actual - att.totals.plan}</td></tr>
              </tbody>
            </table>
          </>
        )}

        <div style={{ marginTop: 22 }}><CardHeader title="Critical Path Exceptions" /></div>
        {delayed.length === 0 && atRisk.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>No exceptions — all critical path activities on track.</p>}
        {[...delayed, ...atRisk].map((a) => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
            <span>{a.path} · {a.name} ({a.owner})</span>
            <Chip tone={a.status === 'delayed' ? 'crit' : 'warn'}>{a.status}</Chip>
          </div>
        ))}

        <div style={{ marginTop: 22 }}><CardHeader title="Critical Alerts (last 24h)" /></div>
        {critAlerts.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>No critical alerts.</p>}
        {critAlerts.map((a) => (
          <div key={a.id} style={{ padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{a.message}</div>
        ))}

        <div style={{ marginTop: 22 }}><CardHeader title="Open Critical Risks" /></div>
        {openCritRisks.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>No open critical risks.</p>}
        {openCritRisks.map((r) => (
          <div key={r.id} style={{ padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
            <strong>{r.description}</strong> — owner {r.owner}
          </div>
        ))}

        <p style={{ marginTop: 24, fontSize: 11, color: 'var(--ink-3)' }}>
          Auto-generated by TURNPOINT from mock data. In production this report would be system-generated with no manual compilation — satisfying the "no duplicate reporting" requirement in the SOW.
        </p>
      </Card>
    </div>
  );
}
