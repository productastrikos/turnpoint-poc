import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { Drawer } from '../../components/ui/Drawer';
import { ActionButton } from '../../components/ui/ActionButton';
import { Timeline } from '../../components/workflow/Timeline';
import { FunnelChart } from '../../components/charts/FunnelChart';
import { getFlanges, advanceStage, getFlangeDetail, flangeKpis } from '../../services/flangesService';
import type { FlangeDetail } from '../../mocks/flangesMock';
import { FLANGE_STAGE_LABELS } from '../../types';
import type { Flange, FlangeStage } from '../../types';
import { shortDate } from '../../mocks/_gen';
import { useToast } from '../../app/ToastContext';

const stageTone = (s: FlangeStage) => (s === 6 ? 'good' : s >= 4 ? 'accent' : s >= 2 ? 'warn' : 'neutral');

export default function FlangeTrackingPage() {
  const { showToast } = useToast();
  const [flanges, setFlanges] = useState<Flange[]>([]);
  const [areaFilter, setAreaFilter] = useState<'all' | string>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<FlangeDetail | null>(null);

  useEffect(() => {
    getFlanges().then(setFlanges);
  }, []);

  const current = selected ? flanges.find((f) => f.id === selected) ?? null : null;
  useEffect(() => {
    let live = true;
    if (!selected) return;
    getFlangeDetail(selected).then((d) => live && setDetail(d));
    return () => {
      live = false;
    };
  }, [selected, flanges]);

  const areas = Array.from(new Set(flanges.map((f) => f.area)));
  const visible = areaFilter === 'all' ? flanges : flanges.filter((f) => f.area === areaFilter);
  const k = flangeKpis(flanges);

  const funnelStages = ([0, 1, 2, 3, 4, 5, 6] as FlangeStage[]).map((s) => ({
    label: FLANGE_STAGE_LABELS[s],
    value: flanges.filter((f) => f.stage >= s).length,
  }));

  async function advance(id: string) {
    const updated = await advanceStage(id);
    setFlanges((prev) => prev.map((f) => (f.id === id ? updated : f)));
    showToast(`${updated.tagNo} advanced to ${FLANGE_STAGE_LABELS[updated.stage]}`, updated.stage === 6 ? 'good' : 'accent');
  }

  return (
    <div>
      <PageHeader
        title="Digital Flange Management"
        checklist="P2"
        subtitle="QR-tagged flange lifecycle across the fleet, from Not Started to Closed. Click a flange for its specification, torque value, QA/QC sign-offs, previous TA history and audit trail. The QR scan is simulated by the QR column."
      />

      <div className="grid grid-6" style={{ marginBottom: 16, gap: 12 }}>
        <StatTile label="Flanges closed" value={`${k.closed} of ${k.total}`} tone="good" />
        <StatTile label="In progress" value={String(flanges.filter((f) => f.stage > 0 && f.stage < 6).length)} tone="accent" />
        <StatTile label="Not started" value={String(flanges.filter((f) => f.stage === 0).length)} />
        <StatTile label="Leak tested" value={String(k.leakTested)} tone="good" delta="QA/QC cleared" />
        <StatTile label="Critical joints open" value={String(k.criticalOpen)} tone={k.criticalOpen > 0 ? 'warn' : 'good'} delta="600# and flare system" />
        <StatTile label="Re-work after torque" value={String(k.reworkAfterTorque)} tone={k.reworkAfterTorque > 0 ? 'crit' : 'good'} delta="re-torqued or re-gasketed" />
      </div>

      <div style={{ marginBottom: 20 }}>
        <Card>
          <CardHeader title="Fleet funnel: flanges that have reached each stage" />
          <FunnelChart stages={funnelStages} />
        </Card>
      </div>

      <div className="tabs">
        {(['all', ...areas] as const).map((a) => (
          <button key={a} className={`tab ${areaFilter === a ? 'active' : ''}`} onClick={() => setAreaFilter(a)}>
            {a === 'all' ? 'All Areas' : a}
          </button>
        ))}
      </div>

      <Card>
        <div className="dt-scroll">
          <table className="table dt">
            <thead>
              <tr>
                <th>Tag</th>
                <th>QR</th>
                <th>Line</th>
                <th>Size / Rating</th>
                <th>Area</th>
                <th>Contractor</th>
                <th>Stage</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr
                  key={f.id}
                  className={`clickable ${selected === f.id ? 'row-active' : ''}`}
                  tabIndex={0}
                  onClick={() => setSelected(f.id)}
                  onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && setSelected(f.id)}
                >
                  <td className="mono">{f.tagNo}</td>
                  <td className="mono" style={{ color: 'var(--ink-3)' }}>{f.qrCode}</td>
                  <td>{f.line}</td>
                  <td>{f.size} / {f.rating}</td>
                  <td>{f.area}</td>
                  <td>{f.contractor}</td>
                  <td><Chip tone={stageTone(f.stage)}>{FLANGE_STAGE_LABELS[f.stage]}</Chip></td>
                  <td className="mono">{shortDate(f.updatedAt)}</td>
                  <td>
                    {f.stage < 6 && (
                      <button
                        className="btn btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void advance(f.id);
                        }}
                      >
                        Advance
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer
        open={Boolean(current)}
        onClose={() => {
          setSelected(null);
          setDetail(null);
        }}
        title={current ? `${current.tagNo} · ${FLANGE_STAGE_LABELS[current.stage]}` : ''}
        subtitle={current ? `${current.line} · ${current.size} / ${current.rating} · ${current.area} · ${current.contractor}` : undefined}
        width={520}
        footer={
          current && current.stage < 6 ? (
            <ActionButton variant="primary" small={false} onClick={() => advance(current.id)}>
              Advance to {FLANGE_STAGE_LABELS[(current.stage + 1) as FlangeStage]}
            </ActionButton>
          ) : undefined
        }
      >
        {current && detail && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="row-wrap">
              <Chip tone={stageTone(current.stage)}>{FLANGE_STAGE_LABELS[current.stage]}</Chip>
              {detail.critical && <Chip tone="warn">critical joint</Chip>}
              {detail.reworkAfterTorque && <Chip tone="crit">re-work after torque</Chip>}
              <span className="tag-chip">{current.qrCode}</span>
              <span className="tag-chip sap">WO {detail.workOrder}</span>
              <span className="tag-chip p6">P6 {detail.p6Id}</span>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Specification</div>
              <dl className="kv">
                <dt>Bolting</dt><dd>{detail.boltSpec}</dd>
                <dt>Gasket</dt><dd>{detail.gasket}</dd>
                <dt>Torque value</dt><dd className="mono">{detail.torqueNm} N·m per bolt</dd>
                <dt>Sequence</dt><dd>{detail.tighteningPattern}</dd>
              </dl>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Inspection at opening</div>
              <dl className="kv">
                <dt>Flange face</dt><dd>{detail.inspection.face}</dd>
                <dt>Bolts</dt><dd>{detail.inspection.bolts}</dd>
                <dt>Gasket</dt><dd>{detail.inspection.gasket}</dd>
              </dl>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>QA/QC sign-offs</div>
              {detail.signOffs.map((s) => (
                <div key={s.step} className="list-row">
                  <span>{s.step}<div className="small muted">{s.by}</div></span>
                  <Chip tone={s.done ? 'good' : 'neutral'}>{s.done ? 'signed' : 'pending'}</Chip>
                </div>
              ))}
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Previous TA record</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {detail.previousTa.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Audit trail (time-stamped, user-logged)</div>
              <Timeline items={detail.audit.map((a) => ({ title: a.action, sub: a.who, at: a.at, tone: 'accent' as const }))} />
            </div>
            <p className="small muted" style={{ margin: 0 }}>Specification, torque values and history are generated from the flange record for the demo. In production they come from the flange identification list verified by the OQ Quality Team (SOW 10.51.4 to 10.51.7).</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
