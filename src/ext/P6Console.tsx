import { useEffect, useState, useSyncExternalStore } from 'react';
import { connectP6, editActivity, getP6State, P6_PROJECT_ID, runSchedule, subscribeP6, WBS, type P6Activity } from '../integration/p6Store';
import { dayToDate, STATUS_DAY } from '../mocks/_gen';
import './ext.css';

const T0 = 9; // Gantt window: Day 9 (11 Aug) to Day 39 (10 Sep)
const T1 = 39;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** TA day to P6's date style, e.g. "21-Aug-26". */
function p6Date(day: number) {
  const [y, m, d] = dayToDate(day).split('-');
  return `${d}-${MON[Number(m) - 1]}-${y.slice(2)}`;
}
const x = (day: number) => `${((Math.min(T1, Math.max(T0, day)) - T0) / (T1 - T0)) * 100}%`;
const w = (from: number, to: number) => `${(Math.max(0, Math.min(T1, to) - Math.max(T0, from)) / (T1 - T0)) * 100}%`;
const fmtDur = (v: number) => (Number.isInteger(v) ? `${v}d` : `${v.toFixed(1)}d`);

function Bar({ a, es, ef, tf }: { a: P6Activity; es: number; ef: number; tf: number }) {
  const crit = tf <= 0;
  if (a.milestone) return <div className={`p6x-ms ${crit ? 'crit' : ''}`} style={{ left: `calc(${x(ef)} - 6px)` }} title={`${a.name}: ${p6Date(Math.ceil(ef))}`} />;
  const planStart = a.startOnOrAfter;
  const planFinish = planStart !== undefined ? planStart + a.origDur : undefined;
  return (
    <>
      {planStart !== undefined && planFinish !== undefined && <div className="p6x-gbar base" style={{ left: x(planStart), width: w(planStart, planFinish) }} title="Baseline" />}
      {a.actualStart !== undefined && <div className="p6x-gbar done" style={{ left: x(a.actualStart), width: w(a.actualStart, STATUS_DAY) }} title="Actual" />}
      <div className={`p6x-gbar ${crit ? 'crit' : 'rem'}`} style={{ left: x(es), width: w(es, ef) }} title={`${a.id} ${p6Date(Math.floor(es) + 1)} to ${p6Date(Math.ceil(ef))}, total float ${tf.toFixed(1)}d`} />
    </>
  );
}

/** Stand-in for the client's Primavera P6 EPPM (activities view with Gantt). Demo only, talks to TURNPOINT over the local bus. */
export default function P6Console() {
  const s = useSyncExternalStore(subscribeP6, getP6State, getP6State);
  const [sel, setSel] = useState<string>('CDU-2020');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [critOnly, setCritOnly] = useState(false);
  useEffect(() => connectP6(), []);
  useEffect(() => {
    document.title = 'Primavera P6 EPPM (demo stand-in)';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        runSchedule();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { es, ef, tf } = s.cpm;
  const selected = s.acts.find((a) => a.id === sel);
  const commit = (a: P6Activity) => {
    const v = Number(draft);
    if (Number.isFinite(v) && v >= 0 && v !== a.remDur) editActivity(a.id, a.status === 'Not Started' ? { remDur: v, origDur: v } : { remDur: v });
    setEditing(null);
  };
  const ticks = Array.from({ length: Math.floor((T1 - T0) / 2) }, (_, i) => T0 + 1 + i * 2);
  const end = ef['TA-END'];
  const endFloat = tf['TA-END'];

  return (
    <div className="p6x">
      <div className="p6x-head">
        <span className="p6x-brand">P6 EPPM<small>Activities · demo stand-in</small></span>
        <span className="p6x-chip">{P6_PROJECT_ID} · Major STO 2026, Sohar</span>
        <span className="p6x-chip">Data date {p6Date(STATUS_DAY)}</span>
        <span className="grow" />
        <span className="p6x-chip" title="Messages to and from TURNPOINT travel over the local integration bus"><span className={`p6x-dot ${s.connected ? 'on' : ''}`} />TURNPOINT {s.connected ? 'connected' : 'waiting'}</span>
      </div>
      <div className="p6x-bar">
        <button className={`p6x-btn primary ${s.dirty ? 'warn' : ''}`} onClick={() => runSchedule()} title="Recalculate dates and float (CPM), then send changes to TURNPOINT">Schedule (F9)</button>
        {s.dirty ? <span className="p6x-note warn">Changes not yet scheduled</span> : <span className="p6x-note">Last scheduled {s.lastScheduledAt}</span>}
        <label className="p6x-note" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={critOnly} onChange={(e) => setCritOnly(e.target.checked)} /> Critical only</label>
        <span className="grow" />
        <span className="p6x-note">Project finish <strong>{p6Date(Math.ceil(end))}</strong> · total float <strong className={endFloat < 0 ? 'p6x-neg' : ''}>{fmtDur(endFloat)}</strong> against the {p6Date(32)} must-finish</span>
      </div>
      <div className="p6x-grid">
        <div className="p6x-row head">
          <div>Activity ID</div><div>Activity Name</div><div className="p6x-num">Orig Dur</div><div className="p6x-num">Rem Dur</div><div className="p6x-num">% Comp</div><div>Start</div><div>Finish</div><div className="p6x-num">Total Float</div>
          <div className="p6x-scale">{ticks.map((t) => <span key={t} style={{ left: x(t) }}>{p6Date(t).slice(0, 6)}</span>)}</div>
        </div>
        {WBS.map((wbs) => {
          const rows = s.acts.filter((a) => a.wbs === wbs && (!critOnly || tf[a.id] <= 0)).sort((a, b) => es[a.id] - es[b.id] || a.id.localeCompare(b.id));
          if (!rows.length) return null;
          return (
            <div key={wbs}>
              <div className="p6x-row wbs"><div>{wbs.split(' ')[0] === 'Milestones' ? 'MS' : wbs.split(' · ')[1] ?? ''}</div><div>{wbs}</div><div /><div /><div /><div /><div /><div /><div className="p6x-gantt" /></div>
              {rows.map((a) => {
                const started = a.status !== 'Not Started';
                return (
                  <div key={a.id} className={`p6x-row act ${sel === a.id ? 'sel' : ''} ${a.dirty ? 'dirty' : ''} ${s.flash.includes(a.id) ? 'flash' : ''}`} onClick={() => setSel(a.id)}>
                    <div className="p6x-num" style={{ textAlign: 'left' }}>{a.id}</div>
                    <div title={a.name}>{a.name}</div>
                    <div className="p6x-num">{fmtDur(a.origDur)}</div>
                    <div className="p6x-num" onDoubleClick={() => { if (!a.milestone) { setEditing(a.id); setDraft(String(a.remDur)); } }} title="Double-click to edit">
                      {editing === a.id ? (
                        <input className="p6x-edit" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => commit(a)} onKeyDown={(e) => { if (e.key === 'Enter') commit(a); if (e.key === 'Escape') setEditing(null); }} aria-label={`Remaining duration of ${a.id}`} />
                      ) : (
                        fmtDur(a.remDur)
                      )}
                    </div>
                    <div className="p6x-num">{a.milestone ? '' : `${a.pct}%`}</div>
                    <div>{a.milestone ? '' : `${p6Date(started && a.actualStart !== undefined ? a.actualStart + 1 : Math.floor(es[a.id]) + 1)}${started ? ' A' : ''}`}</div>
                    <div>{p6Date(Math.ceil(ef[a.id]))}</div>
                    <div className={`p6x-num ${tf[a.id] < 0 ? 'p6x-neg' : ''}`}>{fmtDur(Math.round(tf[a.id] * 10) / 10)}</div>
                    <div className="p6x-gantt">
                      <div className="p6x-dd" style={{ left: x(STATUS_DAY) }} title="Data date" />
                      <Bar a={a} es={es[a.id]} ef={ef[a.id]} tf={tf[a.id]} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="p6x-lower">
        <div className="p6x-panel">
          <h4>Activity details</h4>
          {selected ? (
            <dl className="p6x-kv">
              <dt>Activity</dt><dd><strong>{selected.id}</strong> {selected.name}</dd>
              <dt>TURNPOINT activity</dt><dd>{selected.tpId ?? '—'}{selected.path ? ` · ${selected.path}` : ''}</dd>
              <dt>Durations</dt><dd>original {fmtDur(selected.origDur)} · remaining {fmtDur(selected.remDur)} · {selected.pct}% complete</dd>
              <dt>Dates</dt><dd>{p6Date(Math.floor(es[selected.id]) + 1)} to {p6Date(Math.ceil(ef[selected.id]))} · total float <span className={tf[selected.id] < 0 ? 'p6x-neg' : ''}>{fmtDur(Math.round(tf[selected.id] * 10) / 10)}</span></dd>
              <dt>Predecessors</dt><dd>{selected.preds.length ? selected.preds.map((p) => `${p.id} FS${p.lag ? ` ${p.lag > 0 ? '+' : ''}${p.lag}d` : ''}`).join(', ') : 'none'}</dd>
              <dt>Constraint</dt><dd>{selected.finishOnOrBefore !== undefined ? `Finish on or before ${p6Date(selected.finishOnOrBefore)}` : selected.startOnOrAfter !== undefined ? `Start on or after ${p6Date(selected.startOnOrAfter + 1)}` : 'none'}</dd>
              <dt>Last changed</dt><dd>{selected.changedBy ? `${selected.changedBy} · ${selected.changedAt}` : 'baseline load'}</dd>
              <dt>Try</dt><dd className="p6x-note">Double-click Rem Dur, type a new value, Enter, then Schedule (F9). The new dates and float go to TURNPOINT.</dd>
            </dl>
          ) : (
            <div className="p6x-note">Select an activity.</div>
          )}
        </div>
        <div className="p6x-panel">
          <h4>Integration with TURNPOINT</h4>
          <div className="p6x-log">
            {s.log.length === 0 && <div className="p6x-note">No messages yet. Field progress from TURNPOINT appears here; Schedule (F9) sends changed dates back.</div>}
            {s.log.map((l, i) => (
              <div key={`${l.at}-${i}`}><span className={l.dir === 'in' ? 'p6x-in' : 'p6x-out'}>{l.dir === 'in' ? 'IN ' : 'OUT'}</span> <span className="p6x-num" style={{ display: 'inline' }}>{l.at.slice(11)}</span> {l.text}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="ext-ribbon">Demo stand-in for the client's Primavera P6, not Oracle software. Real CPM scheduling over the TA network; data lives in this browser and syncs with TURNPOINT over a local bus. Production: P6 EPPM REST API and XER.</div>
    </div>
  );
}
