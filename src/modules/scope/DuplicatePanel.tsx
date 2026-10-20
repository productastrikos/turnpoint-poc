import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { ActionButton } from '../../components/ui/ActionButton';
import { Drawer } from '../../components/ui/Drawer';
import { SimBadge } from '../../components/ui/SimBadge';
import { StatTile } from '../../components/ui/StatTile';
import { ExplainBars } from '../../components/charts/ExplainBars';
import {
  bundleFinding,
  dismissFinding,
  explainFinding,
  getDupModelCard,
  getScopeFindings,
  markNotDuplicate,
  mergeFinding,
  type PairScore,
  type ScanResult,
  type ScopeFinding,
} from '../../services/duplicateService';
import { fmtOMR } from '../../mocks/_gen';
import { useToast } from '../../app/ToastContext';
import { useRole } from '../../app/RoleContext';
import type { Job } from '../../types';

const pct = (p: number) => `${Math.round(p * 100)}%`;

function DupChip({ p }: { p: Pick<PairScore, 'kind' | 'probability'> }) {
  if (p.kind === 'bundle') return <Chip tone="accent">Bundle</Chip>;
  return <Chip tone={p.probability >= 0.8 ? 'crit' : 'warn'}>{pct(p.probability)} {p.probability >= 0.8 ? 'duplicate' : 'likely duplicate'}</Chip>;
}

/** One-line result of the duplicate check for an import / SAP row. */
export function DupCheckChip({ match }: { match?: PairScore }) {
  if (!match) return <Chip tone="good">Unique</Chip>;
  if (match.kind === 'duplicate') return <span title={match.reasons.join(' · ')}><Chip tone={match.probability >= 0.8 ? 'crit' : 'warn'}>Duplicate of {match.b.id} · {pct(match.probability)}</Chip></span>;
  return <span title={match.reasons.join(' · ')}><Chip tone="accent">Same work front as {match.b.id}</Chip></span>;
}

function ItemLine({ j, cost }: { j: Job; cost: boolean }) {
  const where = j.status === 'approved' ? 'approved' : j.status === 'pending' ? `Gate ${j.gate}` : j.status;
  return (
    <div style={{ minWidth: 0 }}>
      <div><strong className="mono">{j.id}</strong> {j.desc}</div>
      <div className="small muted">{j.source} · {j.discipline} · {where}{cost ? ` · ${fmtOMR(j.costOMR)}` : ''} · {j.manhours.toLocaleString()} man-hours</div>
    </div>
  );
}

function FindingRow({ f, busy, onMerge, onNotDup, onBundle, onDismiss }: {
  f: ScopeFinding;
  busy: boolean;
  onMerge: () => void;
  onNotDup: () => void;
  onBundle: () => void;
  onDismiss: () => void;
}) {
  const { role } = useRole();
  const cost = role !== 'contractor';
  const [why, setWhy] = useState(false);
  const dup = f.kind === 'duplicate';
  return (
    <div className="list-row" style={{ alignItems: 'flex-start', gap: 16 }}>
      <div style={{ width: 150, flexShrink: 0, paddingTop: 2 }}><DupChip p={f} /></div>
      <div className="stack" style={{ flex: 1, gap: 6, minWidth: 0 }}>
        <ItemLine j={f.keep} cost={cost} />
        <ItemLine j={f.drop} cost={cost} />
        <div className="row-wrap" style={{ gap: 6 }}>
          {f.reasons.map((r) => <span key={r} className="reason-chip">{r}</span>)}
        </div>
        {f.evidence && <div className="callout callout-warn" style={{ padding: '6px 10px' }}>{f.evidence}</div>}
        <div className="small" style={{ color: 'var(--good)' }}>
          {dup
            ? `Merging ${f.drop.id} into ${f.keep.id} removes ${cost ? `${fmtOMR(f.saving.omr)} and ` : ''}${f.saving.manhours.toLocaleString()} man-hours counted twice, and one SAP notification.`
            : `One scaffold, isolation and permit instead of two: about ${cost ? `${fmtOMR(f.saving.omr)}, ` : ''}${f.saving.manhours.toLocaleString()} man-hours and ${f.saving.days} day of access set-up.`}
        </div>
        {f.bundledNote && <div className="small"><Chip tone="good">Bundled</Chip> {f.bundledNote}</div>}
        {why && (
          <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Why the model says {pct(f.probability)} (log-odds contribution of each signal)</div>
            <ExplainBars items={explainFinding(f).slice(0, 8)} labels={['pushes towards different work', 'pushes towards duplicate']} />
          </div>
        )}
      </div>
      <div className="stack" style={{ gap: 4, flexShrink: 0, width: 190 }}>
        {dup ? (
          <>
            <ActionButton variant="primary" busy={busy} onClick={onMerge}>Merge {f.drop.id} into {f.keep.id}</ActionButton>
            <ActionButton busy={busy} onClick={onNotDup}>Not a duplicate</ActionButton>
          </>
        ) : f.bundledNote ? null : (
          <>
            <ActionButton variant="primary" busy={busy} onClick={onBundle}>Bundle work front</ActionButton>
            <ActionButton busy={busy} onClick={onDismiss}>Dismiss</ActionButton>
          </>
        )}
        <button className="btn btn-sm" onClick={() => setWhy((w) => !w)} aria-expanded={why}>{why ? 'Hide explanation' : `Why ${dup ? pct(f.probability) : 'a bundle'}?`}</button>
      </div>
    </div>
  );
}

function DupModelDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const card = getDupModelCard();
  const maxW = Math.max(...card.weights.map((w) => Math.abs(w.weight)));
  const h = card.holdout;
  return (
    <Drawer open={open} onClose={onClose} width={640} title={<span>Duplicate detection model <SimBadge kind="model" /></span>} subtitle="Pairwise classifier running in this browser on the live worklist">
      <div className="stack" style={{ gap: 14 }}>
        <div className="eyebrow">How it works</div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
          <li><strong>Read</strong> every description: equipment and line tags (R-101, 24"-P-2001), component, work type, damage mechanism, with refinery synonyms (overlay = build-up, CUI = corrosion under insulation, PSV = relief valve).</li>
          <li><strong>Compare</strong> each pair on 10 signals: TF-IDF and character similarity, same equipment, component, work type, mechanism, discipline, area, time window, estimate size.</li>
          <li><strong>Classify</strong> with a logistic model: probability that both items are the same work. Same equipment but different work in the same window is a bundling opportunity, not a duplicate.</li>
          <li><strong>Learn</strong>: every "merge" and "not a duplicate" is added to the training set (weight 8) and the model retrains on the spot.</li>
        </ol>
        <div className="grid grid-4">
          <StatTile label="Training pairs" value={card.trainedOn.toLocaleString()} delta={`${card.decisions} planner decision${card.decisions === 1 ? '' : 's'}`} />
          <StatTile label="Hold-out AUC" value={h.auc.toFixed(2)} tone="good" delta={`${h.n} pairs not used in training`} />
          <StatTile label="Precision" value={pct(h.precision)} delta={`at ${pct(card.threshold)} threshold`} />
          <StatTile label="Recall" value={pct(h.recall)} delta={`trained in ${card.trainMs} ms`} />
        </div>
        <div className="eyebrow">Learned weights (log-odds per unit of each signal)</div>
        <div className="stack" style={{ gap: 6 }}>
          {[...card.weights].sort((a, b) => b.weight - a.weight).map((w) => (
            <div key={w.feature} style={{ display: 'grid', gridTemplateColumns: '250px 1fr 52px', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
              <span style={{ color: 'var(--ink-2)' }}>{w.label}</span>
              <div style={{ background: 'var(--surface-2)', borderRadius: 5, height: 12 }}>
                <div style={{ width: `${(Math.abs(w.weight) / maxW) * 100}%`, height: '100%', borderRadius: 5, background: w.weight >= 0 ? 'var(--s4)' : 'var(--ink-3)' }} />
              </div>
              <span className="mono" style={{ textAlign: 'right' }}>{w.weight >= 0 ? '+' : ''}{w.weight.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="callout">
          Training data: {card.historyPairs.toLocaleString()} labelled pairs generated to stand in for six previous turnarounds (paraphrased duplicates, same equipment with different work, sister-unit work, unrelated pairs, 3 % label noise), because OQ RPI's past worklists are not digitised yet. The model, the features and every score on this page are computed live in the browser; with OQ's history loaded it retrains the same way.
        </div>
      </div>
    </Drawer>
  );
}

/** AI duplicate scope detection over the live worklist (checklist S9). */
export function DuplicatePanel({ refreshKey, onChanged }: { refreshKey: unknown; onChanged: () => void }) {
  const { showToast } = useToast();
  const { role } = useRole();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [card, setCard] = useState(false);

  const load = useCallback(() => getScopeFindings().then(setScan), []);
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!scan) return null;
  const dups = scan.findings.filter((f) => f.kind === 'duplicate');
  const bundles = scan.findings.filter((f) => f.kind === 'bundle');
  const omr = dups.reduce((s, f) => s + f.saving.omr, 0);
  const mh = dups.reduce((s, f) => s + f.saving.manhours, 0);

  async function act(f: ScopeFinding, fn: (f: ScopeFinding) => Promise<void>, msg: string, tone: 'good' | 'accent') {
    setBusy(f.key);
    await fn(f);
    await load();
    onChanged();
    setBusy(null);
    showToast(msg, tone);
  }

  return (
    <Card>
      <CardHeader
        title={<span>AI duplicate scope detection <SimBadge kind="model" /></span>}
        action={
          <span className="row-wrap">
            <Chip tone={dups.length ? 'crit' : 'good'}>{dups.length} duplicate{dups.length === 1 ? '' : 's'}</Chip>
            <Chip tone="accent">{bundles.length} bundle opportunit{bundles.length === 1 ? 'y' : 'ies'}</Chip>
            <button className="btn btn-sm" onClick={() => setCard(true)}>How it works</button>
          </span>
        }
      />
      <p className="small muted" style={{ margin: '-6px 0 8px' }}>
        Scanned {scan.scannedItems} active items ({scan.scannedPairs.toLocaleString()} pairs) in {scan.ms} ms on this device. New items are also checked as they are typed, imported or received from SAP.
        {dups.length > 0 && <> Avoidable double counting: <strong style={{ color: 'var(--ink)' }}>{role === 'contractor' ? '' : `${fmtOMR(omr)} and `}{mh.toLocaleString()} man-hours</strong>.</>}
      </p>
      {scan.findings.length === 0 && <div className="small muted" style={{ padding: '10px 0' }}>No duplicates or bundling opportunities among the open items.</div>}
      {scan.findings.map((f) => (
        <FindingRow
          key={f.key}
          f={f}
          busy={busy === f.key}
          onMerge={() => act(f, mergeFinding, `${f.drop.id} merged into ${f.keep.id}. Estimate and man-hours consolidated, SAP notification closed, model retrained.`, 'good')}
          onNotDup={() => act(f, markNotDuplicate, `Recorded: ${f.a.id} and ${f.b.id} are different work. The model retrained on your decision.`, 'accent')}
          onBundle={() => act(f, bundleFinding, `${f.a.id} and ${f.b.id} bundled: one scaffold, isolation and permit.`, 'good')}
          onDismiss={() => act(f, dismissFinding, `Suggestion dismissed: ${f.a.id} / ${f.b.id}`, 'accent')}
        />
      ))}
      <DupModelDrawer open={card} onClose={() => setCard(false)} />
    </Card>
  );
}
