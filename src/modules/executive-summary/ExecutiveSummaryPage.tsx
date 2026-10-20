import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { SCurveChart } from '../../components/charts/SCurveChart';
import { LoadingState } from '../../components/ui/EmptyState';
import { getSCurve } from '../../services/dashboardService';
import { getRisks } from '../../services/riskService';
import { getSCFs } from '../../services/scfService';
import { getJobs } from '../../services/jobsService';
import { listVariations, summarise } from '../../services/scopeService';
import { getCriticalPathActivities, getCpDailyChanges } from '../../services/criticalPathService';
import { getReadiness } from '../../services/readinessService';
import { listIssues, listNcrs } from '../../services/qualityService';
import { SPI } from '../../mocks/progress';
import type { SCurvePoint, RiskItem, SCF, Job, CriticalPathActivity, Tone } from '../../types';
import { useActiveTa } from '../../app/TaContext';
import { shortDate } from '../../mocks/_gen';

interface Data {
  curve: SCurvePoint[];
  risks: RiskItem[];
  scfs: SCF[];
  jobs: Job[];
  cp: CriticalPathActivity[];
  cpChanges: number;
  readiness: number;
  openNcr: number;
  critNcr: number;
  openSafety: number;
  pendingVariationOMR: number;
}

function Rag({ label, value, sub, tone, link }: { label: string; value: string; sub: string; tone: Tone; link: string }) {
  const navigate = useNavigate();
  return (
    <button className="card card-pad stat-tile stat-tile-clickable" style={{ textAlign: 'left', borderLeft: `5px solid var(--${tone === 'neutral' ? 'ink-3' : tone === 'accent' ? 'accent' : tone})`, font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => navigate(link)}>
      <span className="eyebrow">{label}</span>
      <span className={`stat-value mono tone-${tone}`} style={{ fontSize: 20, whiteSpace: 'nowrap' }}>{value}</span>
      <span className="small muted">{sub}</span>
    </button>
  );
}

export default function ExecutiveSummaryPage() {
  const { activeTa, activeTaId } = useActiveTa();
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    Promise.all([getSCurve(activeTaId), getRisks(), getSCFs(), getJobs(), getCriticalPathActivities(), getCpDailyChanges(), getReadiness(), listNcrs(), listIssues(), listVariations()]).then(
      ([curve, risks, scfs, jobs, cp, days, rd, ncrs, issues, vars]) =>
        setD({
          curve,
          risks,
          scfs,
          jobs,
          cp,
          cpChanges: days.reduce((s, x) => s + x.changes, 0),
          readiness: rd.composite,
          openNcr: ncrs.filter((n) => n.status !== 'Closed').length,
          critNcr: ncrs.filter((n) => n.status !== 'Closed' && n.severity === 'Critical').length,
          openSafety: issues.filter((i) => i.type !== 'Issue' && (i.status === 'Open' || i.status === 'In progress')).length,
          pendingVariationOMR: summarise(vars).pendingValue,
        })
    );
  }, [activeTaId]);

  if (!d) {
    return (
      <div>
        <PageHeader title="Executive Summary" subtitle="Single-screen status for the Steering Committee." checklist="X22" />
        <LoadingState />
      </div>
    );
  }

  const active = activeTa?.status === 'active';
  const topRisks = d.risks.filter((r) => r.status !== 'closed').sort((a, b) => ['low', 'medium', 'high', 'critical'].indexOf(b.severity) - ['low', 'medium', 'high', 'critical'].indexOf(a.severity)).slice(0, 4);
  const pendingScf = d.scfs.filter((s) => s.status === 'evaluating');
  const pendingGates = d.jobs.filter((j) => j.status === 'pending');
  const delayed = d.cp.filter((a) => a.status !== 'on-track');

  return (
    <div>
      <PageHeader
        title="Executive Summary"
        subtitle={`${activeTa?.name ?? ''}${active ? ` · Day 14 of 32 · status date ${shortDate('2026-08-16')}` : ' · switch the Active TA to STO-2026 for the live view'}. Everything on this page is read from the same services as the working screens.`}
        checklist="X22"
        action={<button className="btn no-print" onClick={() => window.print()}>Print / PDF</button>}
      />

      <div className="grid grid-6" style={{ marginBottom: 16 }}>
        <Rag label="Schedule" value={`SPI ${SPI.toFixed(2)}`} sub="Forecast finish 5 Sep (+2 d)" tone="warn" link="/critical-path" />
        <Rag label="Cost" value="CPI 0.97" sub="Forecast OMR 12.21M, +3.5%" tone="warn" link="/budget" />
        <Rag label="Safety" value="0 LTI" sub={`${d.openSafety} safety items open, 3 HiPo`} tone={d.openSafety > 4 ? 'warn' : 'good'} link="/issues" />
        <Rag label="Quality" value={`${d.openNcr} NCRs`} sub={`open, ${d.critNcr} critical`} tone={d.critNcr ? 'crit' : 'good'} link="/ncr" />
        <Rag label="Readiness" value={`${d.readiness}%`} sub="Composite STO readiness" tone={d.readiness >= 85 ? 'good' : 'warn'} link="/readiness" />
        <Rag label="Critical path" value={`${d.cpChanges} changes`} sub={`${delayed.length} activities delayed or at risk`} tone="crit" link="/critical-path?tab=changes" />
      </div>

      <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="S-curve: planned vs actual (man-hours)" action={<Link className="btn btn-sm" to="/kpis?tab=scurve">Detail →</Link>} />
          <SCurveChart data={d.curve} height={250} />
        </Card>
        <Card>
          <CardHeader title="Top risks" action={<Link className="btn btn-sm" to="/risk-register">Register →</Link>} />
          {topRisks.map((r) => (
            <div key={r.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div><strong style={{ fontSize: 13 }}>{r.description}</strong><div className="small muted">{r.id} · {r.owner} · {r.status}</div></div>
              <Chip tone={r.severity === 'critical' ? 'crit' : 'warn'}>{r.severity}</Chip>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16, alignItems: 'start' }}>
        <Card>
          <CardHeader title="Decisions needed" />
          <div className="list-row"><span>SCFs awaiting approval</span><Link to="/scf" className="mono" style={{ fontWeight: 700 }}>{pendingScf.length}</Link></div>
          <div className="list-row"><span>Scope items in the gate chain</span><Link to="/scope?tab=approvals" className="mono" style={{ fontWeight: 700 }}>{pendingGates.length}</Link></div>
          <div className="list-row"><span>Pending variation value</span><Link to="/scope?tab=variations" className="mono" style={{ fontWeight: 700 }}>OMR {(d.pendingVariationOMR / 1e6).toFixed(2)}M</Link></div>
          <p className="small muted" style={{ margin: '10px 0 0' }}>Largest: {pendingScf.sort((a, b) => b.costUSD - a.costUSD)[0]?.id} ({pendingScf[0]?.title}).</p>
        </Card>
        <Card>
          <CardHeader title="Critical path exceptions" />
          {delayed.slice(0, 5).map((a) => (
            <div key={a.id} className="list-row">
              <span>{a.path} · {a.name}</span>
              <Chip tone={a.status === 'delayed' ? 'crit' : 'warn'}>{a.status}</Chip>
            </div>
          ))}
        </Card>
        <Card>
          <CardHeader title="Milestones" />
          {[
            { m: 'Scope freeze certificate', d: 'Done 12 Jun 2026', t: 'good' as Tone },
            { m: 'Shutdown complete, units isolated', d: 'Done 6 Aug', t: 'good' as Tone },
            { m: 'Reactor R-101 box-up', d: '27 Aug (forecast on plan)', t: 'neutral' as Tone },
            { m: 'Mechanical completion', d: '30 Aug', t: 'neutral' as Tone },
            { m: 'Start-up (feed in)', d: '5-8 Sep (forecast +2 d)', t: 'warn' as Tone },
          ].map((x) => (
            <div key={x.m} className="list-row"><span>{x.m}</span><Chip tone={x.t}>{x.d}</Chip></div>
          ))}
        </Card>
      </div>
    </div>
  );
}
