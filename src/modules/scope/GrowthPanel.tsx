import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { BarChart } from '../../components/charts/BarChart';
import { formatMoney, type ScopeState, type VariationSummary } from '../../services/scopeService';
import { FREEZE_DATE } from '../../mocks/scopeMock';
import { longDate } from '../../mocks/_gen';

/** Pre-freeze vs post-freeze: how much the scope moved while it was still open, against how much it moved once frozen. */
export function GrowthPanel({ s, scope }: { s: VariationSummary; scope: ScopeState }) {
  const frozen = scope.stage === 'frozen';
  const k = (n: number) => Math.round(Math.max(0, n) / 1000);
  const creepTone = s.creepPct > 3 ? 'crit' : s.creepPct > 1 ? 'warn' : 'good';
  return (
    <Card>
      <CardHeader title="Pre-freeze vs post-freeze scope movement" action={<Chip tone={frozen ? 'good' : 'accent'}>{frozen ? `frozen ${longDate(scope.baseline?.frozenAt ?? FREEZE_DATE)}` : 'freeze not yet applied'}</Chip>} />
      <div className="grid grid-2" style={{ alignItems: 'center' }}>
        <BarChart
          height={210}
          stacked
          labels={['Before the freeze', 'After the freeze']}
          series={[
            { name: 'Approved', color: 'var(--s1)', data: [k(s.approvedPre), k(s.approvedPost)] },
            { name: 'Pending', color: 'var(--s3)', data: [k(s.pendingPre), k(s.pendingPost)] },
          ]}
          yFormat={(v) => `${v}K`}
        />
        <div className="stack" style={{ gap: 8 }}>
          <div className="list-row" data-testid="growth-pre">
            <span>Pre-freeze growth<div className="small muted">{s.approvedPreCount} approved, {s.pendingPreCount} pending, against the base estimate</div></span>
            <span style={{ textAlign: 'right' }}><strong className="mono">{formatMoney(s.approvedPre)}</strong><div className="small muted">{s.preGrowthPct.toFixed(1)}% of base{s.pendingPre ? ` · ${formatMoney(s.pendingPre)} pending` : ''}</div></span>
          </div>
          <div className="list-row" data-testid="growth-post">
            <span>Post-freeze growth<div className="small muted">{frozen ? `${s.approvedPostCount} approved, ${s.pendingPostCount} pending, against the frozen estimate` : 'starts counting once the scope is frozen'}</div></span>
            <span style={{ textAlign: 'right' }}><strong className="mono">{frozen ? formatMoney(s.approvedPost) : 'n/a'}</strong><div className="small muted">{frozen ? `${s.creepPct.toFixed(2)}% scope creep${s.pendingPost ? ` · ${formatMoney(s.pendingPost)} pending` : ''}` : 'no post-freeze change yet'}</div></span>
          </div>
          <div className="list-row">
            <span>Scope creep vs baseline<div className="small muted">post-freeze change as a share of the frozen estimate</div></span>
            <Chip tone={frozen ? creepTone : 'neutral'}>{frozen ? `${s.creepPct.toFixed(2)}%` : '—'}</Chip>
          </div>
          <div className="list-row">
            <span>Critical-path days added since the freeze</span>
            <Chip tone={s.cpDaysApproved ? 'warn' : 'neutral'}>{frozen ? `+${s.cpDaysApproved} d` : '—'}</Chip>
          </div>
          <div className="list-row">
            <span>Total growth against the base estimate</span>
            <Chip tone="neutral">{s.totalGrowthPct.toFixed(1)}%</Chip>
          </div>
        </div>
      </div>
    </Card>
  );
}
