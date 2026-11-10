import { useEffect, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { ActionButton } from '../../components/ui/ActionButton';
import { SimBadge } from '../../components/ui/SimBadge';
import { StatTile } from '../../components/ui/StatTile';
import { DataTable } from '../../components/ui/DataTable';
import { StatusChip } from '../../components/ui/StatusChip';
import { sapWoForJob } from '../../mocks/sapKeys';
import { longDate, longStamp } from '../../mocks/_gen';
import { computeDiff, fastForwardDemo, formatHours, formatMoney, summarise, type DiffItem, type Certificate } from '../../services/scopeService';
import { useToast } from '../../app/ToastContext';
import { useHub } from '../integrations/useHub';
import type { Job } from '../../types';
import type { Variation } from '../../mocks/scopeMock';
import { downloadCertificate } from './certificateExport';
import { ReadinessChecklist } from './ReadinessChecklist';
import { useReadiness, useScope } from './useScope';

export function FreezeTab({ jobs, reload, onFreeze, goTo }: { jobs: Job[]; reload: () => void; onFreeze: () => void; goTo: (tab: string) => void }) {
  const { showToast } = useToast();
  const scope = useScope();
  const hub = useHub();
  const ready = useReadiness(jobs);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const latest = scope.certs[scope.certs.length - 1];
  // jump to the newest revision whenever one is issued
  useEffect(() => {
    setSel(null);
  }, [latest?.revision]);

  // ------------------------------------------------------------------ before the freeze
  if (scope.stage === 'pre-freeze' || !latest) {
    const fast = async () => {
      setBusy(true);
      try {
        await fastForwardDemo();
        reload();
        showToast('Everything that was open has been approved. The scope is ready to freeze.', 'good');
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="stack" style={{ gap: 16 }}>
        <Card style={{ maxWidth: 900, margin: '0 auto', width: '100%', borderTop: '6px dashed var(--border)' }}>
          <div className="empty-state" data-testid="cert-empty">
            <div className="eyebrow">Turnaround Scope Freeze Certificate</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--ink-2)', margin: '8px 0 4px' }}>Certificate not yet generated</div>
            <div style={{ fontSize: 12.5, maxWidth: 560, margin: '0 auto' }}>
              The certificate is issued the moment the scope is frozen: it carries the three gate signatures plus the TA Event Manager and the Head of Turnaround Services, and sets status SFRZ on every frozen order in SAP. Clear the checklist below, then freeze.
            </div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
              <span title={ready?.ok ? 'Freeze the scope and generate certificate Rev A' : `Not ready: ${ready?.blockers ?? 'checking'}`}>
                <ActionButton variant="primary" small={false} disabled={!ready?.ok} onClick={onFreeze}>Freeze scope and generate certificate</ActionButton>
              </span>
              <ActionButton small={false} busy={busy} onClick={fast}>Fast-forward demo (approve all remaining)</ActionButton>
            </div>
            {ready && !ready.ok && <div className="small" style={{ marginTop: 8, color: 'var(--warn)' }}>Blocked: {ready.blockers}.</div>}
          </div>
        </Card>
        <Card style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <ReadinessChecklist readiness={ready} onFix={(id) => goTo(id === 'duplicates' || id === 'fields' ? 'worklist' : id === 'variations' ? 'variations' : 'approvals')} />
        </Card>
      </div>
    );
  }

  // ------------------------------------------------------------------ frozen
  const cert: Certificate = scope.certs.find((c) => c.revision === sel) ?? latest;
  const isLatest = cert.revision === latest.revision;
  const frozenJobs = jobs.filter((j) => j.inBaseline);
  const sample = frozenJobs.slice(0, 5);
  const pushes = hub.messages.filter((m) => m.system === 'SAP' && m.direction === 'Outbound' && m.object === 'Maintenance Order status').slice(0, 4);
  const diff = computeDiff(jobs, scope.baseline, scope.variations);
  const sumV = summarise(scope.variations);
  const base = scope.baseline!;
  const post = scope.variations.filter((v) => v.phase === 'Post-freeze');
  const diffRows: DiffItem[] = [...diff.added, ...diff.removed, ...diff.changed];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row no-print" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="callout" style={{ flex: 1, minWidth: 320 }}>
          Digitally approved turnaround scope and its freeze certificate. After the freeze, every approved variation re-issues the certificate as the next revision, re-signed and pushed to SAP as the order status.
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={() => { downloadCertificate(cert, scope.baseline, isLatest); showToast(`${cert.number}_Rev${cert.revision}.html downloaded`, 'accent'); }} data-testid="cert-download">Download</button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>

      <div className="row-wrap no-print" aria-label="Certificate revisions">
        <span className="eyebrow">Revisions</span>
        {[...scope.certs].reverse().map((c) => (
          <button key={c.revision} className={`btn btn-sm ${c.revision === cert.revision ? 'btn-primary' : ''}`} onClick={() => setSel(c.revision)} data-testid={`rev-${c.revision}`}>
            Rev {c.revision}{c.revision === latest.revision ? ' (current)' : ''}
          </button>
        ))}
      </div>

      <Card style={{ maxWidth: 900, margin: '0 auto', width: '100%', borderTop: `6px solid ${isLatest ? 'var(--accent)' : 'var(--ink-3)'}` }}>
        <div className="spread" style={{ borderBottom: '2px solid var(--border)', paddingBottom: 14, marginBottom: 16 }}>
          <div>
            <div className="eyebrow">OQ Refineries & Petrochemical Industries · Sohar Refinery</div>
            <h2 style={{ fontSize: 28, marginTop: 4 }}>Turnaround Scope Freeze Certificate</h2>
            <div className="small muted" data-testid="cert-title">Major STO 2026 · Certificate {cert.number} · Revision {cert.revision}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Chip tone={isLatest ? 'good' : 'neutral'}>{isLatest ? 'FROZEN · CURRENT' : 'SUPERSEDED'}</Chip>
            <div className="mono small muted" style={{ marginTop: 6 }}>Freeze date {longDate(base.frozenAt)}</div>
            <div className="mono small muted">Revision issued {longStamp(cert.issuedAt)}</div>
          </div>
        </div>

        <p style={{ fontSize: 13.5, lineHeight: 1.7 }}>
          This certifies that the scope of work for the Major Shutdown / Turnaround 2026 has passed the three-stage gating process (Area Operations Focal Point, Head of Area Operations, VP Asset Operations) and is frozen as the approved baseline. Any addition, deletion or change after this date is tracked as a variation and requires formal approval.
          {cert.revision !== 'A' && <> <strong>This revision:</strong> {cert.reason}.</>}
        </p>

        <div className="grid grid-4" style={{ margin: '16px 0' }}>
          <div className="card-flat"><div className="eyebrow">Scope items (POC subset)</div><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{cert.items}</div><div className="small muted">baseline {base.items.length} · of 1,184 work orders in 140 work packs</div></div>
          <div className="card-flat"><div className="eyebrow">Man-hours</div><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{cert.manhours.toLocaleString()}</div><div className="small muted">baseline {base.manhours.toLocaleString()}</div></div>
          <div className="card-flat"><div className="eyebrow">Baseline estimate</div><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>OMR {(base.estimateOMR / 1e6).toFixed(2)}M</div><div className="small muted">frozen {longDate(base.frozenAt)}</div></div>
          <div className="card-flat"><div className="eyebrow">Estimate at this revision</div><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>OMR {(cert.estimateOMR / 1e6).toFixed(2)}M</div><div className="small muted">{cert.revision === 'A' ? 'no change since freeze' : `${formatMoney(cert.estimateOMR - base.estimateOMR)} since freeze`}</div></div>
        </div>

        <div className="eyebrow" style={{ marginBottom: 6 }}>Digital signatures</div>
        <div className="grid grid-3" style={{ gap: 10 }}>
          {cert.signatures.map((g) => (
            <div key={`${g.role}-${g.at}`} className="card-flat" style={{ borderLeft: `3px solid ${g.carried ? 'var(--ink-3)' : 'var(--good)'}` }}>
              <div style={{ fontFamily: 'cursive', fontSize: 18, color: 'var(--accent-strong)' }}>{g.name}</div>
              <div className="small" style={{ fontWeight: 600 }}>{g.role}</div>
              <div className="mono small muted">{longStamp(g.at)}</div>
              <div className="mono small muted">sig {g.hash} · verified ✓{g.carried ? ' · carried from Rev A' : ''}</div>
            </div>
          ))}
        </div>

        <div className="eyebrow" style={{ margin: '16px 0 6px' }}>Status pushed to SAP <SimBadge kind="simulated" /></div>
        <div className="row-wrap">
          {sample.map((j) => (
            <span key={j.id} className="tag-chip sap" title="User status SFRZ set on the SAP maintenance order (simulated)">WO {sapWoForJob(j)} → SFRZ</span>
          ))}
          <span className="small muted">+ {Math.max(0, frozenJobs.length - sample.length)} more orders</span>
        </div>
        {pushes.length > 0 && <div className="small muted" style={{ marginTop: 6 }}>Latest push: {pushes[0].note}</div>}

        <div className="spread" style={{ marginTop: 22, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <span className="small muted">Digitally signed. Certificate hash {cert.hash}. {isLatest ? 'Valid until superseded by a later revision.' : `Superseded by Rev ${latest.revision}.`}</span>
          <svg width={54} height={54} viewBox="0 0 54 54" aria-label="Verification code placeholder">
            {Array.from({ length: 49 }, (_, i) => ((i * 7 + 3 + cert.revision.charCodeAt(0)) % 5 < 2 ? <rect key={i} x={(i % 7) * 7 + 3} y={Math.floor(i / 7) * 7 + 3} width={6} height={6} fill="var(--ink)" /> : null))}
          </svg>
        </div>
      </Card>

      {/* ---------------- baseline vs current ---------------- */}
      <Card>
        <CardHeader title={<span>Baseline (Rev A) vs current scope {latest.revision !== 'A' && <Chip tone="warn">Rev {latest.revision}</Chip>}</span>} />
        <div className="grid grid-5" style={{ marginBottom: 12 }}>
          <StatTile label="Items added" value={String(diff.added.length)} tone={diff.added.length ? 'warn' : 'neutral'} delta="since the freeze" />
          <StatTile label="Items removed" value={String(diff.removed.length)} tone={diff.removed.length ? 'good' : 'neutral'} />
          <StatTile label="Items changed" value={String(diff.changed.length)} tone={diff.changed.length ? 'accent' : 'neutral'} />
          <StatTile label="Cost movement (items)" value={formatMoney(diff.totals.costOMR)} tone={diff.totals.costOMR > 0 ? 'warn' : 'neutral'} />
          <StatTile label="Man-hour movement" value={formatHours(diff.totals.manhours)} tone={diff.totals.manhours > 0 ? 'warn' : 'neutral'} />
        </div>
        {diffRows.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>{sumV.approvedPostCount > 0 ? 'The loaded variation history is not tied to individual scope items in this proof of concept, so the item list is unchanged.' : 'The current scope is identical to the baseline. Raise a post-freeze request (Simulate post-freeze request) and approve it to see Rev B and this table.'}</p>
        ) : (
          <DataTable
            dense
            rowKey={(d: DiffItem) => `${d.kind}-${d.id}`}
            rows={diffRows}
            columns={[
              { key: 'kind', header: 'Movement', render: (d) => <Chip tone={d.kind === 'added' ? 'warn' : d.kind === 'removed' ? 'good' : 'accent'}>{d.kind}</Chip> },
              { key: 'id', header: 'Item', render: (d) => <div><strong className="mono">{d.id}</strong> {d.desc}</div> },
              { key: 'before', header: 'Baseline', mono: true, render: (d) => (d.before ? `OMR ${d.before.costOMR.toLocaleString()} · ${d.before.manhours.toLocaleString()} h` : '—') },
              { key: 'after', header: 'Current', mono: true, render: (d) => (d.after ? `OMR ${d.after.costOMR.toLocaleString()} · ${d.after.manhours.toLocaleString()} h` : '—') },
              { key: 'cost', header: 'Cost', mono: true, align: 'right', render: (d) => <span style={{ color: d.costDelta < 0 ? 'var(--good)' : 'var(--warn)' }}>{formatMoney(d.costDelta)}</span> },
              { key: 'hours', header: 'Hours', mono: true, align: 'right', render: (d) => formatHours(d.hoursDelta) },
              { key: 'var', header: 'Variation', mono: true, render: (d) => d.variation ?? '—' },
            ]}
          />
        )}
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          Programme estimate: base OMR {(sumV.base / 1e6).toFixed(2)}M, frozen OMR {(base.estimateOMR / 1e6).toFixed(2)}M, current OMR {(sumV.current / 1e6).toFixed(2)}M ({formatMoney(sumV.approvedPost)} since the freeze, scope creep {sumV.creepPct.toFixed(1)}%).
        </p>
      </Card>

      {/* ---------------- revision history + variation log ---------------- */}
      <Card>
        <CardHeader title="Revision history" />
        <DataTable
          dense
          rowKey={(c: Certificate) => c.revision}
          rows={[...scope.certs].reverse()}
          columns={[
            { key: 'revision', header: 'Rev', mono: true, render: (c) => <strong>{c.revision}</strong> },
            { key: 'issuedAt', header: 'Issued', mono: true, render: (c) => longStamp(c.issuedAt) },
            { key: 'reason', header: 'Reason', render: (c) => <span style={{ fontSize: 12.5 }}>{c.reason}</span> },
            { key: 'vars', header: 'Variations', mono: true, render: (c) => c.variationIds.join(', ') || '—' },
            { key: 'est', header: 'Estimate', mono: true, align: 'right', render: (c) => `OMR ${(c.estimateOMR / 1e6).toFixed(3)}M` },
            { key: 'sig', header: 'Signed by', render: (c) => <span className="small">{c.signatures.filter((s) => !s.carried).map((s) => s.name).join(', ')}</span> },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Variation log since the freeze (who, when, why)" action={<button className="btn btn-sm" onClick={() => goTo('variations')}>Open variations</button>} />
        {post.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>No variation has been raised since the freeze.</p>
        ) : (
          <DataTable
            dense
            rowKey={(v: Variation) => v.id}
            rows={post}
            columns={[
              { key: 'id', header: 'ID', mono: true },
              { key: 'raised', header: 'Raised', render: (v) => <div><span className="mono small">{longDate(v.raisedAt)}</span><div className="small muted">{v.originator}</div></div> },
              { key: 'title', header: 'What and why', render: (v) => <div style={{ maxWidth: 380, fontSize: 12.5 }}>{v.title}<div className="small muted">{v.reason ?? '—'}</div></div> },
              { key: 'impact', header: 'Impact', render: (v) => <div className="mono small">{formatMoney(v.costOMR)} · {formatHours(v.manhours)}<div className="muted">{v.cpDays ? `critical path +${v.cpDays} d` : 'no critical-path impact'}</div></div> },
              { key: 'status', header: 'Decision', render: (v) => <div><StatusChip status={v.status} />{v.revision && <Chip tone="accent">Rev {v.revision}</Chip>}<div className="small muted">{v.status === 'Pending' ? `Awaiting ${v.approver}` : v.decidedBy}</div></div> },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
