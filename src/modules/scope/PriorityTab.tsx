import { useMemo, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { DataTable } from '../../components/ui/DataTable';
import { Heatmap } from '../../components/charts/Heatmap';
import { BAND_TONE, DEFAULT_WEIGHTS, onCriticalPath, rankJobs, riskBand, riskScore, type PriorityWeights, type Ranked } from '../../services/scopeModel';
import type { Job } from '../../types';

const W_LABEL: Record<keyof PriorityWeights, string> = { risk: 'Risk', criticality: 'Critical-path involvement', costEfficiency: 'Cost efficiency', scheduleFit: 'Schedule fit (earlier first)' };

export function PriorityTab({ jobs }: { jobs: Job[] }) {
  const [w, setW] = useState<PriorityWeights>(DEFAULT_WEIGHTS);
  const live = jobs.filter((j) => j.status !== 'rejected');
  const ranked = useMemo(() => rankJobs(live, w), [live, w]);

  const bands: ('Extreme' | 'High' | 'Medium' | 'Low')[] = ['Extreme', 'High', 'Medium', 'Low'];
  const cols = ['On critical path', 'Long duration (10 d+)', 'Short / off path'];
  const colOf = (j: Job) => (onCriticalPath(j) ? 0 : j.durationDays >= 10 ? 1 : 2);
  const matrix = bands.map((b) => cols.map((_, ci) => live.filter((j) => riskBand(riskScore(j)) === b && colOf(j) === ci).length));

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="callout">
        <strong>Systemised prioritisation.</strong> Every item in the worklist gets a priority score from four weighted factors, so ranking is consistent and explainable instead of negotiated. Change the weights and the ranking re-computes.
      </div>
      <div className="grid grid-4">
        <StatTile label="P1 items" value={String(ranked.filter((r) => r.band === 'P1').length)} tone="crit" delta="start first, protect" />
        <StatTile label="P2 items" value={String(ranked.filter((r) => r.band === 'P2').length)} tone="warn" />
        <StatTile label="P3 items" value={String(ranked.filter((r) => r.band === 'P3').length)} tone="good" delta="candidates if time is tight" />
        <StatTile label="Items ranked" value={String(ranked.length)} />
      </div>
      <div className="grid grid-2-3" style={{ alignItems: 'start' }}>
        <div className="stack">
          <Card>
            <CardHeader title="Weights" action={<button className="btn btn-sm" onClick={() => setW(DEFAULT_WEIGHTS)}>Reset</button>} />
            {(Object.keys(W_LABEL) as (keyof PriorityWeights)[]).map((k) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <div className="spread small"><span>{W_LABEL[k]}</span><span className="mono">{w[k]}</span></div>
                <input type="range" min={0} max={100} value={w[k]} onChange={(e) => setW({ ...w, [k]: Number(e.target.value) })} style={{ width: '100%' }} aria-label={W_LABEL[k]} />
              </div>
            ))}
          </Card>
          <Card>
            <CardHeader title="Priority matrix: risk vs scheduling criticality" />
            <Heatmap rows={bands} cols={cols} values={matrix} rowLabelWidth={74} cellMin={60} />
          </Card>
        </div>
        <Card>
          <CardHeader title="Ranked worklist" />
          <DataTable
            dense
            pageSize={12}
            rowKey={(r: Ranked) => r.job.id}
            rows={ranked}
            columns={[
              { key: 'rank', header: '#', mono: true, width: 40, align: 'right' },
              { key: 'band', header: 'Band', render: (r) => <Chip tone={r.band === 'P1' ? 'crit' : r.band === 'P2' ? 'warn' : 'neutral'}>{r.band}</Chip> },
              { key: 'job', header: 'Scope item', render: (r) => <div style={{ fontSize: 12.5 }}><strong className="mono">{r.job.id}</strong> {r.job.desc}<div className="small muted">{r.job.discipline} · {r.job.area}</div></div>, sortValue: (r) => r.job.id },
              { key: 'score', header: 'Score', mono: true, align: 'right' },
              { key: 'risk', header: 'Risk', render: (r) => <Chip tone={BAND_TONE[riskBand(riskScore(r.job))]}>{riskScore(r.job)}</Chip>, sortValue: (r) => riskScore(r.job) },
              { key: 'cp', header: 'Critical path', render: (r) => (onCriticalPath(r.job) ? <Chip tone="crit">CP</Chip> : <span className="muted small">no</span>), sortValue: (r) => (onCriticalPath(r.job) ? 1 : 0) },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
