import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ActionButton } from '../../components/ui/ActionButton';
import { FilterChips } from '../../components/ui/FilterChips';
import { SimBadge } from '../../components/ui/SimBadge';
import { BarChart } from '../../components/charts/BarChart';
import { LineChart } from '../../components/charts/LineChart';
import { FunnelChart } from '../../components/charts/FunnelChart';
import {
  applySwipe,
  attendanceFeed,
  attendanceRows,
  blockers,
  checkIn,
  clearPerson,
  currentShift,
  finishSync,
  funnel,
  funnelTotal,
  getAutoSync,
  getConnector,
  getReaders,
  getRoster,
  manpowerSeries,
  noteAutoRun,
  onSiteNow,
  pullSwipes,
  resetWorkforce,
  setAutoSync,
  shiftChange,
  totals,
  tradeBreakdown,
  type AttRow,
  type CheckIn,
  type FunnelRow,
  type Person,
} from '../../services/workforceService';
import { CONTRACTOR_NAMES } from '../../mocks/master';
import { useToast } from '../../app/ToastContext';
import { useWorkforce } from './useWorkforce';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SHORT = (c: string) => c.replace('Sohar Industrial Services', 'Sohar Ind.').replace('Larsen & Toubro', 'L&T').replace('Petrofac Services', 'Petrofac');

const STATE_LABEL: Record<Person['state'], string> = { Mobilized: 'Mobilized', Badged: 'Cleared, awaiting first entry', 'Not cleared': 'Not yet cleared' };
const STATE_TONE: Record<Person['state'], 'good' | 'accent' | 'warn'> = { Mobilized: 'good', Badged: 'accent', 'Not cleared': 'warn' };

export default function AttendancePage() {
  const { showToast } = useToast();
  useWorkforce();
  const [who, setWho] = useState(CONTRACTOR_NAMES[0]);
  const [shift, setShift] = useState<'Day' | 'Night'>('Day');
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fresh, setFresh] = useState<string[]>([]);
  const [delta, setDelta] = useState<{ heads: number; mobilized: number; denied: number } | null>(null);
  const [rosterFilter, setRosterFilter] = useState('all');
  const [tradeFor, setTradeFor] = useState('Galfar');
  const alive = useRef(true);
  const syncingRef = useRef(false);
  const nextRef = useRef(0);
  const [, setTick] = useState(0);
  const autoCfg = getAutoSync();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const rows = attendanceRows();
  const feed = attendanceFeed();
  const t = totals();
  const now = onSiteNow();
  const conn = getConnector();
  const readers = getReaders();
  const roster = getRoster();
  const fun = funnel();
  const funT = funnelTotal(fun);
  const series = manpowerSeries().filter((s) => s.day >= 1 && s.day <= 14);
  const pct = (a: number, b: number) => `${((a / b) * 100).toFixed(1)}%`;
  const trades = tradeBreakdown(tradeFor);

  async function sync(automatic = false) {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setDelta(null);
    const before = totals().actual;
    const batch = pullSwipes();
    const who = automatic ? 'Automatic sync' : 'Attendance system';
    showToast(`${who}: ${batch.length} badge events waiting, pulling now.`, 'accent');
    if (automatic) noteAutoRun();
    let mobilized = 0;
    let denied = 0;
    for (const ev of batch) {
      await sleep(240);
      if (!alive.current) break;
      applySwipe(ev);
      setFresh((f) => [...f.slice(-5), `${ev.at}${ev.who}`]);
      if (ev.result === 'Denied') denied++;
      else if (ev.firstEntry) mobilized++;
    }
    finishSync(batch.length);
    syncingRef.current = false;
    const heads = totals().actual - before;
    setDelta({ heads, mobilized, denied });
    setSyncing(false);
    const gaps = funnel().reduce((s, r) => s + r.blocked, 0);
    showToast(`${automatic ? 'Automatic sync: ' : ''}Synced ${batch.length} swipes: ${mobilized} contractors marked Mobilized on first badge-in, ${denied} entries denied (induction, medical or training not valid). On site +${heads}, shortfall now ${(totals().plan - totals().actual).toLocaleString()}.${gaps ? ` ${gaps} people still not cleared.` : ''}`, denied ? 'warn' : 'good');
  }

  // Automatic sync: while switched on, poll the attendance system on the chosen interval and show the countdown.
  useEffect(() => {
    if (!autoCfg.on) return;
    if (nextRef.current <= Date.now()) nextRef.current = Date.now() + autoCfg.everySec * 1000;
    const t = setInterval(() => {
      setTick((x) => x + 1);
      if (Date.now() >= nextRef.current && !syncingRef.current) {
        nextRef.current = Date.now() + getAutoSync().everySec * 1000;
        void sync(true);
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [autoCfg.on, autoCfg.everySec]);

  function toggleAuto(on: boolean) {
    setAutoSync(on);
    nextRef.current = on ? Date.now() + getAutoSync().everySec * 1000 : 0;
    showToast(on ? `Automatic sync is on: the attendance system is polled every ${getAutoSync().everySec} s (5 minutes in production). No button press needed.` : 'Automatic sync is off. Use the button to sync by hand.', on ? 'good' : 'accent');
  }

  function changeShift() {
    const r = shiftChange();
    showToast(`Shift change: ${r.from} shift badged out (${r.out.toLocaleString()}), ${r.to} shift in (${r.inn.toLocaleString()} of ${r.planIn.toLocaleString()} planned${r.short ? `, ${r.short} short` : ''}). On-site now follows the ${r.to} shift.`, r.short > 20 ? 'warn' : 'good');
  }

  async function simulate() {
    setBusy(true);
    const made = await checkIn(who, shift, 6);
    setBusy(false);
    showToast(`${made.length} badge check-ins from ${who} (${shift} shift). Actual manpower and today's man-hours updated.`, 'good');
  }

  function clear(p: Person) {
    const done = clearPerson(p.id);
    if (done) showToast(`${p.name} (${p.contractor}): ${blockers(p).join(', ')} resolved, badge ${done.badge} issued. Next sync lets them in as Mobilized.`, 'good');
  }

  function reset() {
    resetWorkforce();
    setDelta(null);
    setFresh([]);
    showToast('Attendance and mobilization demo data restored to the 16 Aug 06:10 starting point.', 'accent');
  }

  const shown = roster
    .filter((p) => rosterFilter === 'all' || p.state === rosterFilter)
    .sort((a, b) => ['Not cleared', 'Badged', 'Mobilized'].indexOf(a.state) - ['Not cleared', 'Badged', 'Mobilized'].indexOf(b.state));
  const counts = (s: Person['state']) => roster.filter((p) => p.state === s).length;

  return (
    <div>
      <style>{`
        @keyframes swipe-in { from { opacity: 0; transform: translateY(-8px); background: var(--accent-soft); } to { opacity: 1; transform: none; background: transparent; } }
        .swipe-new { animation: swipe-in 0.9s ease-out; }
        @keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        .live-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; background: var(--good); }
        .live-dot.syncing { background: var(--warn); animation: pulse-dot 0.7s infinite; }
        .live-dot.degraded { background: var(--warn); }
      `}</style>
      <PageHeader
        title="Attendance & Manpower"
        subtitle="Manpower on site comes from the site access-control (badge) system: a contractor submits its manpower list, HSE inducts, a badge is issued, and the first badge-in at the gate marks the person as mobilized. Actuals by contractor, shift and trade update as swipes arrive, and feed Mobilization, the Daily Newsletter and the Command Dashboard."
        checklist="G7 · PBC 7"
        badges={['integration']}
        action={<ActionButton onClick={reset}>Reset demo</ActionButton>}
      />

      <div className="grid grid-6" style={{ marginBottom: 16 }}>
        <StatTile label={`On site now (${now.shift} shift)`} value={now.actual.toLocaleString()} delta={`plan ${now.plan.toLocaleString()} · clock ${now.clock}`} tone={now.actual >= now.plan * 0.97 ? 'good' : 'warn'} />
        <StatTile label="Day shift on site" value={t.actDay.toLocaleString()} delta={`plan ${t.planDay.toLocaleString()} · ${pct(t.actDay, t.planDay)}`} tone="warn" trend="down" />
        <StatTile label="Night shift on site" value={t.actNight.toLocaleString()} delta={`plan ${t.planNight.toLocaleString()} · ${pct(t.actNight, t.planNight)}`} tone="warn" trend="down" />
        <StatTile label="Total on site today" value={t.actual.toLocaleString()} delta={delta ? `+${delta.heads} since sync · plan ${t.plan.toLocaleString()}` : `plan ${t.plan.toLocaleString()}`} tone="accent" trend={delta ? 'up' : undefined} />
        <StatTile label="Man-hours today (actual)" value={t.actualMh.toLocaleString()} delta={`plan ${t.planMh.toLocaleString()}`} tone="warn" />
        <StatTile label="Shortfall" value={(t.plan - t.actual).toLocaleString()} delta="heads vs plan" tone={t.plan - t.actual > 60 ? 'crit' : 'warn'} />
      </div>

      <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader
            title={<span>Attendance system (access control) <SimBadge kind="integration" title="Simulated connector. The real system is read through its REST or CSV export; no live connection is made here." /></span>}
            action={
              <span className="row-wrap">
                <ActionButton variant="primary" busy={syncing} onClick={() => sync(false)}>Sync from attendance system</ActionButton>
                <ActionButton onClick={changeShift} disabled={syncing}>Simulate shift change ({currentShift()} to {currentShift() === 'Day' ? 'Night' : 'Day'})</ActionButton>
              </span>
            }
          />
          <dl className="kv" style={{ marginBottom: 12 }}>
            <dt>System</dt><dd>{conn.system}</dd>
            <dt>Status</dt>
            <dd><span className={`live-dot ${conn.status === 'Syncing' ? 'syncing' : ''}`} /><strong>{conn.status === 'Syncing' ? 'Syncing…' : 'Connected'}</strong> <span className="muted small">· {conn.protocol}</span></dd>
            <dt>Automatic sync</dt>
            <dd>
              <label className="row" style={{ gap: 6, display: 'inline-flex' }}><input type="checkbox" checked={autoCfg.on} onChange={(e) => toggleAuto(e.target.checked)} aria-label="Automatic sync" /> <strong>{autoCfg.on ? 'On' : 'Off'}</strong></label>
              {' · every '}
              <select value={autoCfg.everySec} onChange={(e) => { setAutoSync(autoCfg.on, Number(e.target.value)); nextRef.current = autoCfg.on ? Date.now() + Number(e.target.value) * 1000 : 0; }} aria-label="Automatic sync interval">
                <option value={15}>15 s (demo)</option>
                <option value={60}>1 min</option>
                <option value={300}>5 min (production)</option>
              </select>
              {autoCfg.on && <span className="muted small mono"> · {syncing ? 'syncing now' : `next in ${Math.max(0, Math.ceil((nextRef.current - Date.now()) / 1000))} s`} · {autoCfg.runs} automatic run{autoCfg.runs === 1 ? '' : 's'}</span>}
              <div className="muted small">In production this is a server job that polls the access-control system; here it runs while this page is open.</div>
            </dd>
            <dt>Last sync</dt>
            <dd className="mono">16 Aug {conn.lastSync}{conn.syncs > 0 ? <span className="muted small"> · {conn.lastCount} swipes{delta ? `, ${delta.mobilized} newly mobilized, ${delta.denied} denied` : ''}</span> : <span className="muted small"> · automatic poll</span>}</dd>
          </dl>
          <DataTable
            dense
            rowKey={(r) => r.id}
            rows={readers}
            columns={[
              { key: 'name', header: 'Reader (gate)', render: (r) => <span><span className={`live-dot ${r.status === 'Degraded' ? 'degraded' : ''}`} />{r.name}</span> },
              { key: 'lanes', header: 'Lanes', mono: true, align: 'right' },
              { key: 'swipes', header: 'Swipes today', mono: true, align: 'right', render: (r) => r.swipes.toLocaleString() },
              { key: 'denied', header: 'Denied', mono: true, align: 'right', render: (r) => <span style={{ color: r.denied > 6 ? 'var(--warn)' : undefined }}>{r.denied}</span> },
              { key: 'last', header: 'Last swipe', mono: true, align: 'right' },
              { key: 'status', header: 'Status', render: (r) => <Chip tone={r.status === 'Online' ? 'good' : 'warn'}>{r.status === 'Online' ? 'online' : '1 lane down'}</Chip>, nosort: true },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title={`Gate swipe feed${syncing ? ' · receiving…' : ''}`} />
          <div style={{ maxHeight: 318, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px' }} tabIndex={0} aria-label="Recent gate swipes (scrollable)">
            {feed.slice(0, 20).map((f: CheckIn, i) => {
              const isNew = fresh.includes(`${f.at}${f.who}`);
              return (
                <div key={`${f.at}-${f.who}-${i}`} className={`list-row ${isNew ? 'swipe-new' : ''}`}>
                  <span style={{ fontSize: 12.5 }}>
                    {f.system ? <strong>{f.who}</strong> : f.who}
                    <div className="small muted">{f.contractor}{f.trade ? ` · ${f.trade}` : ''} · {f.gate}{f.reason ? ` · ${f.reason}` : ''}</div>
                  </span>
                  <span className="row">
                    {f.result === 'Denied' ? <Chip tone="crit">Denied</Chip> : f.firstEntry ? <Chip tone="good">Mobilized</Chip> : <Chip tone={f.shift === 'Night' ? 'accent' : 'neutral'}>{f.shift}</Chip>}
                    <span className="mono small muted">{f.at}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="row-wrap" style={{ marginTop: 10 }}>
            <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Contractor">{CONTRACTOR_NAMES.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={shift} onChange={(e) => setShift(e.target.value as 'Day' | 'Night')} aria-label="Shift"><option>Day</option><option>Night</option></select>
            <ActionButton busy={busy} onClick={simulate}>Simulate 6 check-ins</ActionButton>
          </div>
        </Card>
      </div>

      <div className="grid grid-3-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <Card>
          <CardHeader title="Pre-TA mobilization arrival: new crew batch" action={<FilterChips options={[{ value: 'Not cleared', label: 'Not yet cleared', count: counts('Not cleared') }, { value: 'Badged', label: 'Awaiting entry', count: counts('Badged') }, { value: 'Mobilized', count: counts('Mobilized') }]} value={rosterFilter} onChange={setRosterFilter} allLabel="All" />} />
          <DataTable
            dense
            pageSize={8}
            rowKey={(p: Person) => p.id}
            rows={shown}
            columns={[
              { key: 'name', header: 'Person', render: (p) => <div><strong>{p.name}</strong><div className="small muted">{p.contractor} · {p.trade} · {p.shift}</div></div>, sortValue: (p) => p.name },
              { key: 'ind', header: 'Induction', render: (p) => <Chip tone={p.induction === 'Done' ? 'good' : 'warn'}>{p.induction === 'Done' ? 'inducted' : 'pending'}</Chip>, sortValue: (p) => p.induction },
              { key: 'med', header: 'Medical', render: (p) => <Chip tone={p.medical === 'Valid' ? 'good' : 'crit'}>{p.medical.toLowerCase()}</Chip>, sortValue: (p) => p.medical },
              { key: 'trn', header: 'Training', render: (p) => <Chip tone={p.training === 'Valid' ? 'good' : 'crit'}>{p.training.toLowerCase()}</Chip>, sortValue: (p) => p.training },
              { key: 'state', header: 'Status', render: (p) => <div><Chip tone={STATE_TONE[p.state]}>{STATE_LABEL[p.state]}</Chip>{p.firstEntry && <div className="small muted mono">first entry {p.firstEntry} · {p.gate}</div>}</div>, sortValue: (p) => p.state },
              { key: 'act', header: '', nosort: true, render: (p) => (p.state === 'Not cleared' ? <ActionButton onClick={() => clear(p)} title={`Resolve: ${blockers(p).join(', ')}`}>Clear &amp; badge</ActionButton> : <span className="small muted mono">{p.badge}</span>) },
            ]}
          />
          <p className="small muted" style={{ margin: '8px 0 0' }}>First badge-in of a cleared person marks them Mobilized. A swipe from a person who is not cleared is denied at the gate and appears in red in the feed.</p>
        </Card>
        <Card>
          <CardHeader title="Mobilization funnel: all contractors" />
          <FunnelChart
            stages={[
              { label: 'Planned (peak)', value: funT.planned },
              { label: 'Submitted by contractors', value: funT.submitted },
              { label: 'HSE inducted', value: funT.inducted },
              { label: 'Badge issued', value: funT.badged },
              { label: 'On site today', value: funT.onSite },
            ]}
          />
          <DataTable
            dense
            rowKey={(r: FunnelRow) => r.contractor}
            rows={fun}
            columns={[
              { key: 'contractor', header: 'Contractor', render: (r) => SHORT(r.contractor) },
              { key: 'submitted', header: 'Subm.', mono: true, align: 'right' },
              { key: 'inducted', header: 'Induct.', mono: true, align: 'right' },
              { key: 'badged', header: 'Badged', mono: true, align: 'right' },
              { key: 'onSite', header: 'On site', mono: true, align: 'right' },
              { key: 'blocked', header: 'Blocked', mono: true, align: 'right', render: (r) => <span style={{ color: r.blocked ? 'var(--warn)' : undefined }}>{r.blocked}</span> },
            ]}
          />
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <Card>
          <CardHeader title="Plan vs actual by contractor and shift" />
          <BarChart
            height={260}
            labels={rows.map((r) => SHORT(r.contractor))}
            series={[
              { name: 'Day plan', color: 'var(--s6)', data: rows.map((r) => r.planDay) },
              { name: 'Day actual', color: 'var(--s1)', data: rows.map((r) => r.actDay) },
              { name: 'Night plan', color: 'var(--s7)', data: rows.map((r) => r.planNight) },
              { name: 'Night actual', color: 'var(--s4)', data: rows.map((r) => r.actNight) },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Total manpower, TA days 1 to 14" />
          <LineChart
            height={260}
            labels={series.map((s) => `D${s.day}`)}
            xTickEvery={2}
            series={[
              { name: 'Planned', data: series.map((s) => s.plan), color: 'var(--ink-3)', dashed: true },
              { name: 'Actual', data: series.map((s) => s.actual), color: 'var(--accent)' },
            ]}
            yMin={0}
            yFormat={(v) => Math.round(v).toLocaleString()}
          />
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <Card>
          <CardHeader title="By contractor" />
          <DataTable
            dense
            rowKey={(r: AttRow) => r.contractor}
            rows={rows}
            columns={[
              { key: 'contractor', header: 'Contractor', render: (r) => <div><strong>{r.contractor}</strong><div className="small muted">{r.discipline}</div></div> },
              { key: 'day', header: 'Day (act / plan)', mono: true, render: (r) => `${r.actDay} / ${r.planDay}`, sortValue: (r) => r.actDay },
              { key: 'night', header: 'Night (act / plan)', mono: true, render: (r) => `${r.actNight} / ${r.planNight}`, sortValue: (r) => r.actNight },
              { key: 'att', header: 'Attendance', render: (r) => <ProgressBar value={r.actDay + r.actNight} max={r.planDay + r.planNight} />, sortValue: (r) => (r.actDay + r.actNight) / (r.planDay + r.planNight) },
              { key: 'var', header: 'Variance', mono: true, align: 'right', render: (r) => { const v = r.actDay + r.actNight - (r.planDay + r.planNight); return <span style={{ color: v < -20 ? 'var(--crit)' : v < 0 ? 'var(--warn)' : 'var(--good)' }}>{v}</span>; }, sortValue: (r) => r.actDay + r.actNight - (r.planDay + r.planNight) },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="By trade" action={<select value={tradeFor} onChange={(e) => setTradeFor(e.target.value)} aria-label="Contractor for trade breakdown">{CONTRACTOR_NAMES.map((c) => <option key={c}>{c}</option>)}</select>} />
          <DataTable
            dense
            rowKey={(r) => r.trade}
            rows={trades}
            columns={[
              { key: 'trade', header: 'Trade' },
              { key: 'day', header: 'Day (act / plan)', mono: true, render: (r) => `${r.actDay} / ${r.planDay}`, sortValue: (r) => r.actDay },
              { key: 'night', header: 'Night (act / plan)', mono: true, render: (r) => `${r.actNight} / ${r.planNight}`, sortValue: (r) => r.actNight },
              { key: 'att', header: 'Of plan', render: (r) => <ProgressBar value={r.actDay + r.actNight} max={r.planDay + r.planNight} />, sortValue: (r) => (r.actDay + r.actNight) / (r.planDay + r.planNight) },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
