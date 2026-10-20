import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { Chip } from '../../components/ui/Chip';
import { logShift, listShifts, signShift } from '../../services/executionService';
import type { ShiftEntry } from '../../mocks/executionMock';
import { dayToDate, shortDate } from '../../mocks/_gen';

const list = (items: string[], empty: string) => (items.length ? <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 13 }}>{items.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="small muted" style={{ margin: 0 }}>{empty}</p>);

const config: TrackerConfig<ShiftEntry> = {
  title: 'Day / Night Shift Handover Log',
  subtitle: 'What the outgoing shift completed, left in progress, hit as issues and safety events, and the carry-over items. The outgoing supervisor signs the handover, the incoming supervisor signs the takeover.',
  checklist: 'X31',
  load: listShifts,
  kpis: (rows) => [
    { label: 'Handovers logged', value: String(rows.length) },
    { label: 'Awaiting sign-off', value: String(rows.filter((r) => !r.signedOut || !r.takenOver).length), tone: 'warn' },
    { label: 'Carry-over items (latest)', value: String(rows[0]?.carryOver ?? 0), tone: 'accent' },
    { label: 'Galfar on site (latest day shift)', value: String(rows.find((r) => r.shift === 'Day')?.onSite.galfar ?? 0) },
    { label: 'L&T on site (latest day shift)', value: String(rows.find((r) => r.shift === 'Day')?.onSite.lnt ?? 0) },
  ],
  columns: [
    { key: 'id', header: 'Handover', render: (r) => <div><strong>Day {r.day} · {r.shift} shift</strong><div className="small muted">{shortDate(dayToDate(r.day))}</div></div>, sortValue: (r) => r.day * 2 + (r.shift === 'Day' ? 1 : 0) },
    { key: 'who', header: 'Outgoing → incoming', render: (r) => <span className="small">{r.outgoing} → {r.incoming}</span> },
    { key: 'done', header: 'Completed', mono: true, align: 'right', render: (r) => r.completed.length },
    { key: 'prog', header: 'In progress', mono: true, align: 'right', render: (r) => r.inProgress.length },
    { key: 'issues', header: 'Issues', mono: true, align: 'right', render: (r) => r.issues.length },
    { key: 'carry', header: 'Carry-over', mono: true, align: 'right', render: (r) => r.carryOver },
    { key: 'sign', header: 'Signatures', render: (r) => <span className="row-wrap"><Chip tone={r.signedOut ? 'good' : 'warn'}>handover {r.signedOut ? 'signed' : 'pending'}</Chip><Chip tone={r.takenOver ? 'good' : 'neutral'}>takeover {r.takenOver ? 'signed' : 'pending'}</Chip></span>, sortValue: (r) => (r.signedOut ? 1 : 0) + (r.takenOver ? 1 : 0) },
  ],
  filters: [{ label: 'shifts', get: (r) => r.shift }],
  rowAction: { label: (r) => (!r.signedOut ? `Sign handover (${r.outgoing})` : !r.takenOver ? `Sign takeover (${r.incoming})` : null), run: (r) => signShift(r.id), toast: (r) => (r.signedOut ? `Takeover signed by ${r.incoming}` : `Handover signed by ${r.outgoing}`) },
  create: {
    label: 'Log handover',
    title: 'Log a shift handover',
    fields: [
      { name: 'shift', label: 'Shift', type: 'select', options: ['Day', 'Night'], required: true },
      { name: 'outgoing', label: 'Outgoing supervisor', required: true, defaultValue: 'A. Al-Ghafri' },
      { name: 'incoming', label: 'Incoming supervisor', required: true, defaultValue: 'Z. Al-Hajri' },
      { name: 'completed', label: 'Completed (one per line)', type: 'textarea' },
      { name: 'inProgress', label: 'In progress (one per line)', type: 'textarea', required: true },
      { name: 'issues', label: 'Issues (one per line)', type: 'textarea' },
      { name: 'carryOver', label: 'Carry-over items', type: 'number', required: true, min: 0, max: 99 },
    ],
    submit: (v) => {
      const lines = (s: string | undefined) => (s ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
      return logShift({ day: 14, shift: v.shift as 'Day' | 'Night', outgoing: v.outgoing, incoming: v.incoming, completed: lines(v.completed), inProgress: lines(v.inProgress), issues: lines(v.issues), safety: [], carryOver: Number(v.carryOver), onSite: { galfar: 418, lnt: 226 } });
    },
    toast: (s) => `${s.id} logged: waiting for the outgoing supervisor to sign`,
  },
  detail: {
    title: (r) => `Day ${r.day} · ${r.shift} shift handover`,
    subtitle: (r) => `${r.outgoing} → ${r.incoming} · Galfar ${r.onSite.galfar}, L&T ${r.onSite.lnt} on site`,
    render: (r) => (
      <div className="stack">
        <div className="eyebrow">Completed</div>{list(r.completed, 'Nothing completed yet this shift.')}
        <div className="eyebrow">In progress / carry-over ({r.carryOver} items)</div>{list(r.inProgress, 'Nothing in progress.')}
        <div className="eyebrow">Issues</div>{list(r.issues, 'No issues.')}
        <div className="eyebrow">Safety</div>{list(r.safety, 'No safety events.')}
      </div>
    ),
  },
  initialSort: { key: 'id', dir: 'desc' },
};

export default function ShiftLogPage() {
  return <TrackerPage config={config} />;
}
