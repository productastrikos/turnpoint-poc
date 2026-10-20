import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { clearSynced, enqueue, getMobileState, setConnectivity, subscribeMobile, sync, type QueuedAction } from '../../services/mobileService';
import { scheduleActivities } from '../../mocks/scheduleMock';
import { fieldUpdates } from '../../mocks/scheduleMock';
import { useToast } from '../../app/ToastContext';
import { useCanEdit } from '../../app/AccessContext';
import { Icon } from '../../app/icons';

const IN_PROGRESS = scheduleActivities.filter((a) => a.startDay <= 14 && a.endDay >= 14 && a.pct < 100 && !a.cp);
const APPROVALS = [
  { id: 'HW-2231', label: 'Hot-work permit HW-2231, Unit 200', note: 'Renewal, 12 h' },
  { id: 'BU-R101-2', label: 'Box-up certificate R-101 manway 2', note: 'Inspection cleared' },
  { id: 'PSSR-TB', label: 'PSSR checklist, Train B', note: 'Operations review' },
  { id: 'CSE-3310', label: 'Confined space entry CSE-3310, Unit 300', note: 'Gas test attached' },
];

function SimBars({ n }: { n: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 14 }} aria-label={`SIM signal ${n} of 4`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} style={{ width: 4, height: 3 + i * 2.6, background: i <= n ? 'var(--ink)' : 'var(--border)', borderRadius: 1 }} />
      ))}
    </span>
  );
}

const STATUS_TONE = { queued: 'warn', syncing: 'accent', synced: 'good' } as const;
const ICON: Record<QueuedAction['kind'], ReactNode> = { progress: <Icon name="chart" size={14} />, approval: <Icon name="check" size={14} />, photo: <Icon name="camera" size={14} />, gps: <Icon name="pin" size={14} />, scan: <Icon name="grid" size={14} /> };

export default function MobileCapturePage() {
  const canEdit = useCanEdit();
  const { showToast } = useToast();
  const m = useSyncExternalStore(subscribeMobile, getMobileState, getMobileState);
  const [screen, setScreen] = useState<'progress' | 'approvals' | 'capture'>('progress');
  const [actId, setActId] = useState(IN_PROGRESS[0].id);
  const [pct, setPct] = useState(IN_PROGRESS[0].pct);
  const [photos, setPhotos] = useState(0);
  const [done, setDone] = useState<string[]>([]);

  const act = IN_PROGRESS.find((a) => a.id === actId)!;
  const queued = m.queue.filter((q) => q.status === 'queued').length;
  const statusText = !m.online ? 'SIM: no signal. Working offline' : m.mode === 'low' ? 'SIM: 1 bar. Low network, syncing slowly' : 'SIM: 4G, connected';

  async function submitProgress() {
    const prev = fieldUpdates.find((u) => u.activityId === actId)?.pct ?? act.pct;
    const q = await enqueue({ kind: 'progress', label: `${act.p6Id} ${act.name}`, detail: `${prev}% → ${pct}%`, activityId: act.id, pct });
    showToast(q.status === 'synced' ? `Progress ${pct}% synced to P6 (simulated)` : `Progress saved on the device: ${pct}%. It will sync when the SIM has signal.`, q.status === 'synced' ? 'good' : 'warn');
  }
  async function approve(a: (typeof APPROVALS)[number]) {
    setDone((d) => [...d, a.id]);
    await enqueue({ kind: 'approval', label: a.label, detail: 'Approved by you' });
    showToast(m.online && m.mode === 'normal' ? `${a.id} approved and synced` : `${a.id} approved on the device. Queued for sync.`, m.online ? 'good' : 'warn');
  }
  async function capture(kind: 'photo' | 'gps' | 'scan') {
    if (kind === 'photo') setPhotos((p) => p + 1);
    await enqueue({
      kind,
      label: kind === 'photo' ? 'Photo evidence, R-101 manway 3' : kind === 'gps' ? 'GPS pin, as-found location' : 'QR scan FLG-1042',
      detail: kind === 'gps' ? '23.6781° N, 58.0974° E' : kind === 'scan' ? 'Flange 8"-P-2201 tag FL-1042' : `IMG_${1000 + photos}.jpg, 2.1 MB`,
    });
  }
  async function doSync() {
    const n = await sync();
    if (n) showToast(`${n} queued action${n > 1 ? 's' : ''} synced`, 'good');
  }
  // SOW 4.69: the device synchronises automatically as soon as the network is available again.
  async function connect(online: boolean, mode: 'normal' | 'low' = 'normal') {
    setConnectivity(online, mode);
    if (online && queued > 0) {
      showToast(`Signal restored: syncing ${queued} queued action${queued > 1 ? 's' : ''} automatically`, 'accent');
      await doSync();
    }
  }

  return (
    <div>
      <PageHeader
        title="Mobile Field App: Offline"
        subtitle="The field app keeps working with no network. Progress, approvals and captures are stored on the device, shown in a queue, and synced over the SIM when signal returns. Toggle the connection to see it."
        badges={['simulated']}
        checklist="G6 · X13"
      />

      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div className="phone-frame">
          <div className="phone-screen" style={{ padding: 0, gap: 0, minHeight: 600 }}>
            <div style={{ background: 'var(--ink)', color: 'var(--bg)', padding: '6px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
              <span>{m.online ? 'Omantel 4G' : 'No service'}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><SimBars n={m.signal} /><span className="mono">09:41</span></span>
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <span className="eyebrow">TURNPOINT Field</span>
              <Chip tone={!m.online ? 'crit' : queued ? 'warn' : 'good'}>{!m.online ? 'offline' : queued ? `${queued} to sync` : 'synced'}</Chip>
            </div>

            <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {screen === 'progress' && (
                <>
                  <div className="eyebrow">Update progress</div>
                  <select value={actId} onChange={(e) => { const a = IN_PROGRESS.find((x) => x.id === e.target.value)!; setActId(a.id); setPct(a.pct); }} aria-label="Activity">
                    {IN_PROGRESS.map((a) => (
                      <option key={a.id} value={a.id}>{a.p6Id} {a.name.length > 28 ? `${a.name.slice(0, 27)}…` : a.name}</option>
                    ))}
                  </select>
                  <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
                    <div className="small muted">{act.contractor} · {act.area}</div>
                    <div className="spread" style={{ margin: '6px 0' }}><span className="small">Physical progress</span><strong className="mono" style={{ fontSize: 22 }}>{pct}%</strong></div>
                    <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} style={{ width: '100%' }} aria-label="Progress percent" />
                  </div>
                  <button className="btn btn-primary" disabled={!canEdit} onClick={submitProgress}>Submit progress</button>
                </>
              )}
              {screen === 'approvals' && (
                <>
                  <div className="eyebrow">Approvals waiting for you</div>
                  {APPROVALS.map((a) => (
                    <div key={a.id} className="card card-pad" style={{ padding: 10 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.label}</div>
                      <div className="small muted">{a.note}</div>
                      <button className="btn btn-sm btn-primary" style={{ marginTop: 6 }} disabled={done.includes(a.id) || !canEdit} onClick={() => approve(a)}>{done.includes(a.id) ? 'Approved' : 'Approve'}</button>
                    </div>
                  ))}
                </>
              )}
              {screen === 'capture' && (
                <>
                  <div className="eyebrow">Capture</div>
                  <div className="card card-pad" style={{ background: 'var(--surface-2)', textAlign: 'center', padding: 10 }}>
                    <div className="small muted">Work order</div>
                    <strong style={{ fontSize: 12.5 }}>J-2201 R-101 internals inspection</strong>
                  </div>
                  <button className="btn btn-primary" disabled={!canEdit} onClick={() => capture('photo')}><Icon name="camera" size={14} /> Capture photo ({photos})</button>
                  <button className="btn" disabled={!canEdit} onClick={() => capture('gps')}><Icon name="pin" size={14} /> Drop GPS pin</button>
                  <button className="btn" disabled={!canEdit} onClick={() => capture('scan')}><Icon name="grid" size={14} /> Scan QR / barcode</button>
                </>
              )}
            </div>

            <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
              {(['progress', 'approvals', 'capture'] as const).map((s) => (
                <button key={s} onClick={() => setScreen(s)} style={{ flex: 1, padding: '10px 0', border: 'none', background: screen === s ? 'var(--accent-soft)' : 'transparent', color: screen === s ? 'var(--accent-strong)' : 'var(--ink-3)', fontWeight: 600, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 380 }} className="stack">
          <Card>
            <CardHeader title="Connection (SIM)" />
            <div className="row-wrap" style={{ marginBottom: 10 }}>
              <button className={`btn ${m.online && m.mode === 'normal' ? 'btn-primary' : ''}`} onClick={() => connect(true)}>Online · 4G</button>
              <button className={`btn ${m.online && m.mode === 'low' ? 'btn-primary' : ''}`} onClick={() => connect(true, 'low')}>Low network</button>
              <button className={`btn ${!m.online ? 'btn-danger' : ''}`} onClick={() => connect(false)}>Offline · no signal</button>
            </div>
            <div className="row" style={{ gap: 12 }}><SimBars n={m.signal} /><span className="small">{statusText}</span></div>
          </Card>

          <Card>
            <CardHeader
              title={`Sync queue (${m.queue.length})`}
              action={
                <div className="row">
                  <button className="btn btn-sm" onClick={clearSynced}>Clear synced</button>
                  <button className="btn btn-sm btn-primary" disabled={!m.online || queued === 0 || m.syncing} onClick={doSync}>{m.syncing ? 'Syncing…' : `Sync now (${queued})`}</button>
                </div>
              }
            />
            {m.syncing && <ProgressBar value={m.queue.filter((q) => q.status === 'synced').length} max={Math.max(1, m.queue.length)} tone="accent" showLabel={false} />}
            {m.queue.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nothing recorded yet. Go offline, record some progress or approvals on the phone, then come back online.</p>}
            {m.queue.map((q) => (
              <div key={q.id} className="list-row">
                <span><span style={{ marginRight: 8 }}>{ICON[q.kind]}</span><strong style={{ fontSize: 13 }}>{q.label}</strong><div className="small muted" style={{ paddingLeft: 26 }}>{q.detail} · captured {q.at}</div></span>
                <Chip tone={STATUS_TONE[q.status]}>{q.status}</Chip>
              </div>
            ))}
            {m.lastSyncAt && <p className="small muted" style={{ margin: '8px 0 0' }}>Last sync {m.lastSyncAt}. Synced progress appears in the P6 round trip (Integration Hub, step 2).</p>}
          </Card>

          <Card>
            <CardHeader title="What this demonstrates" />
            <ul style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
              <li>100% offline operation: every action is stored on the device first</li>
              <li>SIM-based connectivity with a visible signal state and a low-network mode</li>
              <li>Progress updates, approvals and data capture (photo, GPS, QR) in one app</li>
              <li>Ordered, visible sync when signal returns, with a log of what was sent</li>
            </ul>
            <p className="small muted" style={{ margin: '12px 0 0' }}>A styled web screen standing in for the native app. The SIM and the network are simulated by the toggle above.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
