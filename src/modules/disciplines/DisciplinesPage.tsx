import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { StatusChip } from '../../components/ui/StatusChip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { LoadingState } from '../../components/ui/EmptyState';
import { TABS } from '../../app/tabRegistry';
import { getJobs } from '../../services/jobsService';
import { getDiscoveryJobs } from '../../services/discoveryService';
import { listWorkPacks } from '../../services/workPackService';
import { listNcrs, listLosses } from '../../services/qualityService';
import { listProductivity, productivityIndex } from '../../services/executionService';
import { listPostTa, listDocs } from '../../services/closeoutService';
import { getAttendance } from '../../services/workforceService';
import { scheduleActivities } from '../../mocks/scheduleMock';
import { DISCIPLINES, DISCIPLINE_CONTRACTOR } from '../../mocks/master';
import type { Discipline, DiscoveryJob, Job } from '../../types';
import type { WorkPack } from '../../mocks/workPackMock';
import type { Ncr, LossEvent } from '../../mocks/qualityMock';
import type { ProductivityRow } from '../../mocks/executionMock';
import type { PostTaItem, HandoverDoc } from '../../mocks/closeoutMock';
import { CostValue } from '../../components/ui/CostValue';
import { useRole } from '../../app/RoleContext';

interface Data {
  jobs: Job[];
  dj: DiscoveryJob[];
  packs: WorkPack[];
  ncrs: Ncr[];
  prod: ProductivityRow[];
  post: PostTaItem[];
  docs: HandoverDoc[];
  loss: LossEvent[];
  headcount: { plan: number; actual: number };
}

const FOCUS = {
  'pre-ta': 'Pre-TA focus: work pack readiness, materials, contractor mobilisation and the enabling work (scaffold, isolation, rigging).',
  execution: 'Execution focus: progress against plan, critical activities, quality, productivity and open discovery work.',
  'post-ta': 'Post-TA focus: remaining post-TA work, handover documentation and the rework to learn from.',
} as const;

export default function DisciplinesPage() {
  const { role } = useRole();
  const [tab, setTab] = useTabParam(TABS.disciplines, 'execution');
  const [active, setActive] = useState<Discipline>('Inspection');
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    Promise.all([getJobs(), getDiscoveryJobs(), listWorkPacks(), listNcrs(), listProductivity(), listPostTa(), listDocs(), listLosses(), getAttendance()]).then(([jobs, dj, packs, ncrs, prod, post, docs, loss, att]) => {
      const contractor = DISCIPLINE_CONTRACTOR[active];
      const row = att.rows.find((r) => r.contractor === contractor);
      setD({ jobs, dj, packs, ncrs, prod, post, docs, loss, headcount: { plan: row ? row.planDay + row.planNight : 0, actual: row ? row.actDay + row.actNight : 0 } });
    });
  }, [active]);

  const acts = useMemo(() => scheduleActivities.filter((a) => a.discipline === active), [active]);
  if (!d) return <div><PageHeader title="Discipline-wise Dashboards" subtitle="" checklist="R14" /><LoadingState /></div>;

  const jobs = d.jobs.filter((j) => j.discipline === active);
  const packs = d.packs.filter((p) => p.discipline === active);
  const ready = packs.filter((p) => Object.values(p.ready).every(Boolean)).length;
  const blu = acts.reduce((s, a) => s + a.bluHours, 0) || 1;
  const actual = Math.round((acts.reduce((s, a) => s + a.bluHours * (a.pct / 100), 0) / blu) * 100);
  const planned = Math.round((acts.reduce((s, a) => s + a.bluHours * (a.endDay <= 14 ? 1 : a.startDay > 14 ? 0 : (14 - a.startDay + 1) / (a.endDay - a.startDay + 1)), 0) / blu) * 100);
  const ncrs = d.ncrs.filter((n) => n.discipline === active && n.status !== 'Closed');
  const prod = d.prod.filter((p) => p.discipline === active);
  const pi = prod.length ? prod.reduce((s, p) => s + p.hours * productivityIndex(p), 0) / prod.reduce((s, p) => s + p.hours, 0) : 0;
  const dj = d.dj.filter((x) => x.discipline === active);
  const post = d.post.filter((p) => p.discipline === active);
  const docs = d.docs.filter((x) => x.discipline === active);
  const loss = d.loss.filter((l) => l.discipline === active);
  const approvedCost = jobs.filter((j) => j.status === 'approved').reduce((s, j) => s + j.costOMR, 0);

  return (
    <div>
      <PageHeader title="Discipline-wise Dashboards" subtitle={`Customised views per discipline for Pre-TA, TA execution and post-TA, each highlighting that phase's priorities. ${FOCUS[tab]}`} checklist="R14" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'pre-ta', label: 'Pre-TA' }, { id: 'execution', label: 'TA execution' }, { id: 'post-ta', label: 'Post-TA' }]} />
      <div className="toolbar"><FilterChips options={DISCIPLINES.map((x) => ({ value: x }))} value={active} onChange={(v) => setActive(v as Discipline)} hideAll /></div>

      {tab === 'pre-ta' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid grid-4">
            <StatTile label="Work packs" value={String(packs.length)} delta={`${ready} fully ready`} />
            <StatTile label="Readiness to release" value={`${packs.length ? Math.round((ready / packs.length) * 100) : 0}%`} tone={ready === packs.length ? 'good' : 'warn'} />
            <StatTile label={`${DISCIPLINE_CONTRACTOR[active]} on site`} value={`${d.headcount.actual}`} delta={`plan ${d.headcount.plan}`} tone="accent" />
            <StatTile label="Approved scope value" value={role === 'oq-staff' ? `OMR ${approvedCost.toLocaleString()}` : 'Restricted'} tone="good" />
          </div>
          <Card>
            <CardHeader title={`${active}: work pack readiness`} />
            <DataTable
              dense
              rowKey={(p: WorkPack) => p.id}
              rows={packs}
              columns={[
                { key: 'id', header: 'Pack', mono: true },
                { key: 'title', header: 'Work', render: (p) => p.title },
                { key: 'ready', header: 'Readiness', render: (p) => <ProgressBar value={Object.values(p.ready).filter(Boolean).length} max={5} />, sortValue: (p) => Object.values(p.ready).filter(Boolean).length },
                { key: 'mat', header: 'Materials', render: (p) => (p.materials.length === 0 ? <span className="muted small">stock</span> : <Chip tone={p.ready.materials ? 'good' : 'warn'}>{p.materials.filter((m) => m.status === 'delivered').length}/{p.materials.length} delivered</Chip>) },
                { key: 'stage', header: 'Stage', render: (p) => <StatusChip status={p.stage} /> },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'execution' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid grid-5">
            <StatTile label="Progress (man-hour)" value={`${actual}%`} delta={`planned ${planned}%`} tone={actual >= planned ? 'good' : 'warn'} />
            <StatTile label="Jobs in scope" value={String(jobs.length)} />
            <StatTile label="Open NCRs" value={String(ncrs.length)} tone={ncrs.length ? 'crit' : 'good'} />
            <StatTile label="Productivity index" value={prod.length ? pi.toFixed(2) : '—'} tone={pi >= 0.95 ? 'good' : 'warn'} />
            <StatTile label="Open discovery jobs" value={String(dj.filter((x) => ['identified', 'evaluating'].includes(x.state)).length)} tone="warn" />
          </div>
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <Card>
              <CardHeader title={`${active}: activities`} />
              {acts.filter((a) => a.startDay <= 20 && a.endDay >= 14).slice(0, 8).map((a) => (
                <div key={a.id} className="list-row"><span style={{ fontSize: 13 }}>{a.name}<div className="small muted">{a.p6Id} · D{a.startDay}-D{a.endDay}{a.cp ? ` · ${a.cp}` : ''}</div></span><span style={{ width: 120 }}><ProgressBar value={a.pct} /></span></div>
              ))}
            </Card>
            <Card>
              <CardHeader title={`${active}: jobs`} />
              {jobs.length === 0 && <div className="empty-state">No jobs for this discipline.</div>}
              {jobs.slice(0, 8).map((j) => (
                <div key={j.id} className="list-row"><span style={{ fontSize: 13 }}>{j.desc}<div className="small muted mono">{j.id} · <CostValue amount={j.costOMR} /></div></span><Chip tone={j.status === 'approved' ? 'good' : j.status === 'rejected' ? 'crit' : 'warn'}>{j.status}</Chip></div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {tab === 'post-ta' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid grid-4">
            <StatTile label="Post-TA items" value={String(post.length)} delta={`${post.filter((p) => p.status === 'Complete').length} complete`} />
            <StatTile label="Open items" value={String(post.filter((p) => p.status !== 'Complete').length)} tone="warn" />
            <StatTile label="Handover documents" value={`${docs.length ? Math.round((docs.reduce((s, x) => s + x.received, 0) / docs.reduce((s, x) => s + x.expected, 0)) * 100) : 0}%`} delta="received vs expected" tone="accent" />
            <StatTile label="Rework to learn from" value={`${loss.filter((l) => l.kind === 'Rework').reduce((s, l) => s + l.hours, 0)} h`} tone="crit" />
          </div>
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <Card>
              <CardHeader title={`${active}: post-TA work`} />
              {post.length === 0 && <div className="empty-state">No post-TA work for this discipline.</div>}
              {post.map((p) => (
                <div key={p.id} className="list-row"><span style={{ fontSize: 13 }}>{p.description}<div className="small muted">T+{p.dueDay} d · {p.contractor}</div></span><StatusChip status={p.status} tone={p.status === 'Complete' ? 'good' : p.status === 'In progress' ? 'accent' : 'warn'} /></div>
              ))}
            </Card>
            <Card>
              <CardHeader title={`${active}: handover documents`} />
              {docs.length === 0 && <div className="empty-state">No document sets.</div>}
              {docs.slice(0, 8).map((x) => (
                <div key={x.id} className="list-row"><span style={{ fontSize: 13 }}>{x.type}<div className="small muted">{x.asset} · {x.received}/{x.expected}</div></span><StatusChip status={x.status} tone={x.status === 'Missing' ? 'crit' : x.status === 'Archived' ? 'good' : 'warn'} /></div>
              ))}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
