import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Gauge } from '../../components/charts/Gauge';
import { Chip } from '../../components/ui/Chip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ActionButton } from '../../components/ui/ActionButton';
import { DataTable } from '../../components/ui/DataTable';
import { LoadingState } from '../../components/ui/EmptyState';
import { closeGap, getReadiness, type ReadinessSnapshot } from '../../services/readinessService';
import { useToast } from '../../app/ToastContext';
import { shortDate } from '../../mocks/_gen';

const STAGES = ['Scoping', 'Planning', 'Pre-TA', 'Execution'];
const DISCIPLINE_READY = [
  { name: 'Inspection', score: 91 },
  { name: 'Rotating Equipment', score: 84 },
  { name: 'Process', score: 86 },
  { name: 'Instrumentation', score: 90 },
  { name: 'Civil', score: 88 },
  { name: 'Electrical', score: 93 },
];

export default function ReadinessPage() {
  const { showToast } = useToast();
  const [snap, setSnap] = useState<ReadinessSnapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => getReadiness().then(setSnap), []);
  useEffect(() => {
    load();
  }, [load]);

  async function toggle(id: string, closed: boolean) {
    setBusy(id);
    await closeGap(id);
    await load();
    setBusy(null);
    showToast(closed ? `${id} re-opened` : `${id} closed. Readiness score updated.`, closed ? 'warn' : 'good');
  }

  if (!snap) {
    return (
      <div>
        <PageHeader title="Overall STO Readiness" subtitle="Composite readiness across the whole turnaround lifecycle." checklist="G11" />
        <LoadingState />
      </div>
    );
  }

  const open = snap.gaps.filter((g) => !g.closed);
  const stageScore = (stage: string) => {
    const comps = snap.components.filter((c) => c.stage === stage);
    const w = comps.reduce((s, c) => s + c.weight, 0);
    return Math.round(comps.reduce((s, c) => s + c.effective * c.weight, 0) / (w || 1));
  };

  return (
    <div>
      <PageHeader
        title="Overall STO Readiness"
        subtitle="One composite score for the whole turnaround, not only scoping, planning and scheduling. Eight weighted components, rolled up by stage and discipline, with the gaps that move the score most. Close a gap to see the score change."
        checklist="G11"
      />

      <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
        <Card>
          <div className="row" style={{ gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <Gauge value={snap.composite} label="Composite STO readiness" size={230} good={85} warn={70} />
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="eyebrow">By stage</div>
              {STAGES.map((s) => (
                <div key={s} className="list-row">
                  <span>{s}</span>
                  <span style={{ width: 160 }}><ProgressBar value={stageScore(s)} /></span>
                </div>
              ))}
              <div className="callout" style={{ marginTop: 10 }}>
                {open.length} open gaps. Closing all of them would lift the score to {Math.min(100, snap.composite + Math.round(open.reduce((s, g) => s + g.lift, 0) / 8))}%.
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="By discipline" />
          <div className="grid grid-3" style={{ gap: 4 }}>
            {DISCIPLINE_READY.map((d) => (
              <Gauge key={d.name} value={d.score} size={110} label={d.name} />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <Card>
          <CardHeader title="Components and weights" />
          {snap.components.map((c) => (
            <div key={c.id} className="list-row">
              <div style={{ flex: 1 }}>
                <Link to={c.link} style={{ fontWeight: 600, textDecoration: 'none', color: 'inherit' }}>{c.name}</Link>
                <div className="small muted">{c.stage} · weight {c.weight}%</div>
              </div>
              <span style={{ width: 150 }}><ProgressBar value={c.effective} /></span>
            </div>
          ))}
        </Card>

        <Card>
          <CardHeader title="Gaps that move the score" action={<Chip tone={open.length ? 'warn' : 'good'}>{open.length} open</Chip>} />
          <DataTable
            dense
            rowKey={(g) => g.id}
            rows={snap.gaps}
            columns={[
              { key: 'title', header: 'Gap', render: (g) => <div style={{ opacity: g.closed ? 0.5 : 1, textDecoration: g.closed ? 'line-through' : 'none' }}>{g.title}<div className="small muted">{g.id} · {g.owner} · due {shortDate(g.due)}</div></div> },
              { key: 'lift', header: 'Lift', mono: true, align: 'right', render: (g) => `+${g.lift}` },
              { key: 'a', header: '', nosort: true, render: (g) => <ActionButton busy={busy === g.id} variant={g.closed ? 'default' : 'primary'} onClick={() => toggle(g.id, g.closed)}>{g.closed ? 'Re-open' : 'Close gap'}</ActionButton> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
