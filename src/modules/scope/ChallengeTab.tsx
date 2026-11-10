import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { DataTable } from '../../components/ui/DataTable';
import { ActionButton } from '../../components/ui/ActionButton';
import { Bubble, type BubblePoint } from '../../components/charts/Bubble';
import { BAND_TONE, challengeScore, onCriticalPath, riskBand, riskScore } from '../../services/scopeModel';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { PhaseChip } from './PhaseChip';
import { phaseOf, useScope } from './useScope';
import { decideChallenge, getChallenges, removeFromScope } from '../../services/scopeService';
import { useToast } from '../../app/ToastContext';
import type { Job } from '../../types';

export function ChallengeTab({ jobs, reload }: { jobs: Job[]; reload: () => void }) {
  const { showToast } = useToast();
  const [decisions, setDecisions] = useState<Record<string, 'Keep' | 'Defer'>>({});
  const [focus, setFocus] = useState<string | null>(null);
  const scope = useScope();
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

  // items that came in through a bulk upload or an Excel import: ranked by what they cost against the risk they remove
  const bulk = live
    .filter((j) => j.source === 'Bulk upload' || j.source === 'Excel import')
    .map((j) => ({ job: j, score: challengeScore(j, live) }))
    .sort((a, b) => b.score - a.score);
  const verdict = (s: number) => (s >= 60 ? { label: 'Challenge first', tone: 'crit' as const } : s >= 40 ? { label: 'Review', tone: 'warn' as const } : { label: 'Justified', tone: 'good' as const });
  const bulkFlagged = bulk.filter((b) => b.score >= 60);

  async function decide(j: Job, d: 'Keep' | 'Defer') {
    await decideChallenge(j.id, d);
    let note = '';
    if (d === 'Defer') {
      const r = await removeFromScope(j.id, 'Deferred after scope challenge (cost not justified by risk)');
      reload();
      if (r.variation) note = ` The scope is frozen, so this is deletion variation ${r.variation.id} awaiting ${r.variation.approver}.`;
    }
    await load();
    showToast(d === 'Keep' ? `${j.id} challenged and kept: justification recorded` : `${j.id} deferred after challenge. Saves OMR ${j.costOMR.toLocaleString()} and ${j.manhours.toLocaleString()} man-hours.${note}`, d === 'Keep' ? 'accent' : 'good');
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="callout">
        <strong>Scope challenge basis:</strong> risk against cost estimate and man-hours. Every bubble is a scope item: horizontal = estimate, vertical = risk score, size = man-hours. Items in the bottom-right (costly, low risk, off the critical path) are the ones to challenge first.
      </div>
      <Card>
        <CardHeader title={<span>Bulk-loaded items, ranked for challenge <Chip tone="accent">{bulk.length} loaded by bulk upload or Excel</Chip></span>} />
        <p className="small muted" style={{ margin: '-6px 0 10px' }}>
          Items arrive in bulk without the scrutiny a single request gets, so each is scored on the money and labour it asks for against the risk it removes (cost 40%, man-hours 30%, low risk 30%, minus a credit when it is on the critical path). Highest score first. {bulkFlagged.length} of {bulk.length} are flagged to challenge first, worth OMR {bulkFlagged.reduce((s, b) => s + b.job.costOMR, 0).toLocaleString()} and {bulkFlagged.reduce((s, b) => s + b.job.manhours, 0).toLocaleString()} man-hours. Import more from Worklist, New scope item, Bulk upload / Excel import.
        </p>
        <DataTable
          dense
          rowKey={(b: { job: Job; score: number }) => b.job.id}
          rows={bulk}
          columns={[
            { key: 'rank', header: '#', mono: true, nosort: true, render: (b) => bulk.indexOf(b) + 1 },
            { key: 'item', header: 'Item', render: (b) => <div style={{ maxWidth: 360, fontSize: 12.5 }}><strong className="mono">{b.job.id}</strong> {b.job.desc}<div className="small muted">{b.job.source} · {b.job.tag} · {b.job.discipline}</div></div>, sortValue: (b) => b.job.id },
            { key: 'phase', header: 'Phase', nosort: true, render: (b) => <PhaseChip phase={phaseOf(b.job, scope)} /> },
            { key: 'cost', header: 'Estimate', mono: true, align: 'right', render: (b) => (b.job.costOMR ? `OMR ${b.job.costOMR.toLocaleString()}` : 'none'), sortValue: (b) => b.job.costOMR },
            { key: 'hours', header: 'Man-hours', mono: true, align: 'right', render: (b) => b.job.manhours.toLocaleString(), sortValue: (b) => b.job.manhours },
            { key: 'risk', header: 'Risk', render: (b) => <Chip tone={BAND_TONE[riskBand(riskScore(b.job))]}>{riskScore(b.job)} {riskBand(riskScore(b.job))}</Chip>, sortValue: (b) => riskScore(b.job) },
            { key: 'per', header: 'OMR per risk point', mono: true, align: 'right', render: (b) => Math.round(b.job.costOMR / Math.max(1, riskScore(b.job))).toLocaleString(), sortValue: (b) => b.job.costOMR / Math.max(1, riskScore(b.job)) },
            { key: 'score', header: 'Challenge score', render: (b) => <div style={{ minWidth: 130 }}><ProgressBar value={b.score} label={String(b.score)} /><Chip tone={verdict(b.score).tone}>{verdict(b.score).label}</Chip></div>, sortValue: (b) => b.score },
            {
              key: 'd',
              header: '',
              nosort: true,
              render: (b) =>
                decisions[b.job.id] ? (
                  <Chip tone={decisions[b.job.id] === 'Keep' ? 'accent' : 'good'}>{decisions[b.job.id]}</Chip>
                ) : (
                  <span className="row" style={{ gap: 4 }}>
                    <ActionButton onClick={() => decide(b.job, 'Keep')} data-testid={`keep-${b.job.id}`}>Keep</ActionButton>
                    <ActionButton variant="danger" onClick={() => decide(b.job, 'Defer')} data-testid={`defer-${b.job.id}`}>Defer</ActionButton>
                  </span>
                ),
            },
          ]}
        />
        {scope.stage === 'frozen' && <p className="small muted" style={{ margin: '8px 0 0' }}>Deferring a baseline item after the freeze raises a deletion variation; it leaves the scope only when change control approves it.</p>}
      </Card>
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
