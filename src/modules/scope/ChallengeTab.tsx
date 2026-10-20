import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { Bubble, type BubblePoint } from '../../components/charts/Bubble';
import { BAND_TONE, onCriticalPath, riskBand, riskScore } from '../../services/scopeModel';
import { decideChallenge, getChallenges } from '../../services/scopeService';
import { deferJob } from '../../services/jobsService';
import { useToast } from '../../app/ToastContext';
import type { Job } from '../../types';

export function ChallengeTab({ jobs, reload }: { jobs: Job[]; reload: () => void }) {
  const { showToast } = useToast();
  const [decisions, setDecisions] = useState<Record<string, 'Keep' | 'Defer'>>({});
  const [focus, setFocus] = useState<string | null>(null);
  const load = useCallback(() => getChallenges().then(setDecisions), []);
  useEffect(() => {
    load();
  }, [load]);

  const live = jobs.filter((j) => j.status !== 'rejected');
  const maxCost = Math.max(...live.map((j) => j.costOMR), 1);
  const SPLIT_COST = 60_000;
  const SPLIT_RISK = 9;
  const challengeList = live.filter((j) => j.costOMR >= SPLIT_COST && riskScore(j) <= SPLIT_RISK && !onCriticalPath(j)).sort((a, b) => b.costOMR - a.costOMR);

  const points: BubblePoint[] = live.map((j) => ({
    id: j.id,
    x: j.costOMR / 1000,
    y: riskScore(j),
    r: j.manhours / 5200,
    label: j.id.slice(2),
    tone: j.costOMR >= SPLIT_COST && riskScore(j) <= SPLIT_RISK && !onCriticalPath(j) ? 'warn' : BAND_TONE[riskBand(riskScore(j))] === 'crit' ? 'crit' : 'accent',
    title: `${j.id} ${j.desc}: risk ${riskScore(j)}, OMR ${j.costOMR.toLocaleString()}, ${j.manhours.toLocaleString()} h`,
  }));
  const f = live.find((j) => j.id === focus);

  async function decide(j: Job, d: 'Keep' | 'Defer') {
    await decideChallenge(j.id, d);
    if (d === 'Defer') {
      await deferJob(j.id, 'Deferred after scope challenge (cost not justified by risk)');
      reload();
    }
    await load();
    showToast(d === 'Keep' ? `${j.id} challenged and kept: justification recorded` : `${j.id} deferred after challenge. Saves OMR ${j.costOMR.toLocaleString()}.`, d === 'Keep' ? 'accent' : 'good');
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="callout">
        <strong>Scope challenge basis:</strong> risk against cost estimate and man-hours. Every bubble is a scope item: horizontal = estimate, vertical = risk score, size = man-hours. Items in the bottom-right (costly, low risk, off the critical path) are the ones to challenge first.
      </div>
      <div className="grid grid-4">
        <StatTile label="Items to challenge" value={String(challengeList.length)} tone="warn" delta={`≥ OMR ${SPLIT_COST / 1000}K and risk ≤ ${SPLIT_RISK}`} />
        <StatTile label="Value under challenge" value={`OMR ${(challengeList.reduce((s, j) => s + j.costOMR, 0) / 1000).toFixed(0)}K`} />
        <StatTile label="Man-hours under challenge" value={challengeList.reduce((s, j) => s + j.manhours, 0).toLocaleString()} />
        <StatTile label="Decided" value={`${Object.keys(decisions).length}`} tone="good" />
      </div>
      <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Risk vs cost vs man-hours" />
          <Bubble
            points={points}
            xLabel="Budgetary estimate (OMR thousand)"
            yLabel="Risk score"
            xMax={Math.ceil(maxCost / 1000 / 40) * 40}
            yMax={24}
            splitX={SPLIT_COST / 1000}
            splitY={SPLIT_RISK}
            onPointClick={(p) => setFocus(p.id)}
          />
          <div className="chart-legend" style={{ marginTop: 6 }}>
            <span><i style={{ background: 'var(--warn)' }} />Challenge first</span>
            <span><i style={{ background: 'var(--crit)' }} />Extreme risk</span>
            <span><i style={{ background: 'var(--accent)' }} />Other</span>
          </div>
          {f && (
            <div className="card-flat" style={{ marginTop: 10 }}>
              <strong>{f.id}</strong> {f.desc}
              <div className="small muted">Risk {riskScore(f)} · OMR {f.costOMR.toLocaleString()} · {f.manhours.toLocaleString()} h · {onCriticalPath(f) ? 'on the critical path' : 'off the critical path'}</div>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Challenge list" />
          {challengeList.length === 0 && <p className="small muted">Nothing left to challenge.</p>}
          <DataTable
            dense
            rowKey={(j: Job) => j.id}
            rows={challengeList}
            columns={[
              { key: 'desc', header: 'Item', render: (j) => <div style={{ fontSize: 12.5 }}><strong className="mono">{j.id}</strong> {j.desc}<div className="small muted">OMR {j.costOMR.toLocaleString()} · {j.manhours.toLocaleString()} h · risk {riskScore(j)}</div></div> },
              {
                key: 'd',
                header: '',
                nosort: true,
                render: (j) =>
                  decisions[j.id] ? (
                    <Chip tone={decisions[j.id] === 'Keep' ? 'accent' : 'good'}>{decisions[j.id]}</Chip>
                  ) : (
                    <span className="row" style={{ gap: 4 }}>
                      <ActionButton onClick={() => decide(j, 'Keep')}>Keep</ActionButton>
                      <ActionButton variant="danger" onClick={() => decide(j, 'Defer')}>Defer</ActionButton>
                    </span>
                  ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
