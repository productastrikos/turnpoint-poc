import { useEffect, useState } from 'react';
import { useToast } from '../../app/ToastContext';
import { Chip } from '../../components/ui/Chip';
import { enqueue, getMobileState } from '../../services/mobileService';
import { HSE_DAY, listHseDays, scoreContractor, subscribeHse, type HseEntryPayload, type HseScore } from '../../services/hseService';
import { HK_ITEMS, TBT_TOPICS, hseProfile } from '../../mocks/hseMock';
import { CONTRACTOR_NAMES } from '../../mocks/master';
import { scenarioNow } from '../../mocks/toolsMock';
import { Chips, FormActions, Label, NumberStepper, PhotoButton, nextPhotoName } from './PhoneKit';

type Section = 'tbt' | 'hk' | 'checks' | 'obs';
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'tbt', label: 'Toolbox talk' },
  { id: 'hk', label: 'Housekeeping' },
  { id: 'checks', label: 'Permits & PPE' },
  { id: 'obs', label: 'Observations' },
];

/** Phone screen: the contractor supervisor's daily HSE sheet (toolbox talk, housekeeping, permit and PPE checks, observations). */
export function HseScreen({ canEdit }: { canEdit: boolean }) {
  const { showToast } = useToast();
  const [contractor, setContractor] = useState('Galfar');
  const [section, setSection] = useState<Section>('tbt');
  const [score, setScore] = useState<HseScore | null>(null);
  const profile = hseProfile(contractor);

  useEffect(() => {
    const load = () => listHseDays().then((d) => setScore(scoreContractor(contractor, d)));
    load();
    return subscribeHse(load);
  }, [contractor]);

  // toolbox talk
  const [topic, setTopic] = useState('');
  const [hazards, setHazards] = useState<string[]>([]);
  const [controls, setControls] = useState<string[]>([]);
  const [attendees, setAttendees] = useState(0);
  const [time, setTime] = useState('06:15');
  const [sheet, setSheet] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  // housekeeping
  const [checks, setChecks] = useState<boolean[]>(HK_ITEMS.map(() => false));
  // permits and PPE
  const [permits, setPermits] = useState(0);
  const [permitsBad, setPermitsBad] = useState(0);
  const [ppeN, setPpeN] = useState(0);
  const [ppeBad, setPpeBad] = useState(0);
  // observations
  const [raised, setRaised] = useState(0);
  const [closed, setClosed] = useState(0);

  const tpl = TBT_TOPICS.find((t) => t.topic === topic);
  const hkScore = Math.round((checks.filter(Boolean).length / HK_ITEMS.length) * 100);

  function chooseTopic(t: string) {
    setTopic(t);
    const x = TBT_TOPICS.find((y) => y.topic === t);
    setHazards(x ? x.hazards.slice(0, 2) : []);
    setControls(x ? x.controls.slice(0, 2) : []);
  }

  async function send(payload: HseEntryPayload, label: string, detail: string) {
    const q = await enqueue({ kind: 'hse', label, detail, hse: payload });
    const now = getMobileState().queue.find((x) => x.id === q.id);
    if (now?.status === 'synced') showToast(`${now.result ?? 'Entry received.'} The Contractor KPI scorecard is updated.`, 'good');
    else showToast('Entry saved on the phone. The scorecard updates when the SIM has signal.', 'warn');
  }
  const base = () => ({ contractor, by: profile.supervisor, at: scenarioNow() });

  async function submitTbt() {
    if (!topic || attendees <= 0 || !signed) {
      showToast('Choose the topic, enter the attendance and sign off first', 'warn');
      return;
    }
    await send({ ...base(), section: 'tbt', data: { topic, hazards, controls, attendees, expected: profile.expected, time, signSheetPhoto: Boolean(sheet), signedBy: profile.supervisor } }, `Toolbox talk: ${topic}`, `${attendees} of ${profile.expected} attended · ${time}${sheet ? ' · sign-in sheet photo' : ''}`);
    setTopic('');
    setHazards([]);
    setControls([]);
    setAttendees(0);
    setSheet(null);
    setSigned(false);
  }
  async function submitHk() {
    await send({ ...base(), section: 'hk', data: { checks, score: hkScore, inspector: profile.supervisor } }, `Housekeeping inspection: ${hkScore}%`, `${checks.filter(Boolean).length} of ${HK_ITEMS.length} items passed`);
    setChecks(HK_ITEMS.map(() => false));
  }
  async function submitChecks() {
    if (permits <= 0 && ppeN <= 0) {
      showToast('Enter the permits checked and the workers sampled first', 'warn');
      return;
    }
    await send({ ...base(), section: 'checks', permit: { checked: permits, nonCompliant: Math.min(permits, permitsBad) }, ppe: { sampled: ppeN, nonCompliant: Math.min(ppeN, ppeBad) } }, 'Permit and PPE compliance', `${permits} permits (${permitsBad} non-compliant) · ${ppeN} workers (${ppeBad} without correct PPE)`);
    setPermits(0);
    setPermitsBad(0);
    setPpeN(0);
    setPpeBad(0);
  }
  async function submitObs() {
    if (raised + closed <= 0) {
      showToast('Enter the observations raised or closed first', 'warn');
      return;
    }
    await send({ ...base(), section: 'obs', data: { raised, closed } }, 'HSE observations', `${raised} raised · ${closed} closed`);
    setRaised(0);
    setClosed(0);
  }

  function demo() {
    if (section === 'tbt') {
      chooseTopic('Working at height');
      setAttendees(Math.round(profile.expected * 0.94));
      setTime('06:15');
      setSheet(nextPhotoName());
      setSigned(true);
    } else if (section === 'hk') setChecks(HK_ITEMS.map((_, i) => i !== 3));
    else if (section === 'checks') {
      setPermits(profile.permitsPerDay);
      setPermitsBad(1);
      setPpeN(48);
      setPpeBad(2);
    } else {
      setRaised(2);
      setClosed(3);
    }
  }

  const done = (ok: boolean) => <Chip tone={ok ? 'good' : 'warn'}>{ok ? 'done' : 'pending'}</Chip>;

  return (
    <>
      <div className="eyebrow">Contractor daily HSE · Day {HSE_DAY}</div>
      <select value={contractor} onChange={(e) => setContractor(e.target.value)} aria-label="Contractor">
        {CONTRACTOR_NAMES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      {score && (
        <div className="small" style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Today</span>
          <span>Talk {done(!score.todayPending)}</span>
          <span className="muted">· {score.tbtDone} of {score.tbtRequired} talks · HSE {score.composite.toFixed(1)}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => setSection(s.id)} aria-pressed={section === s.id} style={{ padding: '6px 4px', borderRadius: 6, border: '1px solid var(--border)', background: section === s.id ? 'var(--accent-soft)' : 'transparent', color: section === s.id ? 'var(--accent-strong)' : 'var(--ink-3)', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>
            {s.label}
          </button>
        ))}
      </div>

      {section === 'tbt' && (
        <>
          <Label>Topic</Label>
          <select value={topic} onChange={(e) => chooseTopic(e.target.value)} aria-label="Toolbox talk topic">
            <option value="">Select topic…</option>
            {TBT_TOPICS.map((t) => (
              <option key={t.topic}>{t.topic}</option>
            ))}
          </select>
          {tpl && (
            <>
              <Label>Hazards discussed</Label>
              <Chips options={tpl.hazards} value={hazards} onChange={setHazards} />
              <Label>Controls agreed</Label>
              <Chips options={tpl.controls} value={controls} onChange={setControls} />
            </>
          )}
          <Label>Attendance</Label>
          <NumberStepper label={`Attendees (of ${profile.expected})`} value={attendees} onChange={setAttendees} step={10} max={profile.expected + 20} />
          <div className="spread"><span style={{ fontSize: 12.5 }}>Time</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Talk time" style={{ width: 100 }} /></div>
          <PhotoButton photo={sheet} onTake={() => setSheet(nextPhotoName())} onClear={() => setSheet(null)} label="Photo of sign-in sheet" />
          <button type="button" className={`btn ${signed ? '' : 'btn-sm'}`} onClick={() => setSigned((s) => !s)} aria-pressed={signed}>
            {signed ? `Signed off by ${profile.supervisor}` : 'Supervisor sign-off'}
          </button>
          <FormActions submitLabel="Submit toolbox talk" disabled={!canEdit} onSubmit={submitTbt} onDemo={demo} />
        </>
      )}

      {section === 'hk' && (
        <>
          <Label>Housekeeping inspection</Label>
          {HK_ITEMS.map((it, i) => (
            <label key={it} className="spread" style={{ fontSize: 12.5, gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
              <span>{it}</span>
              <input type="checkbox" checked={checks[i]} onChange={() => setChecks((c) => c.map((v, j) => (j === i ? !v : v)))} aria-label={it} />
            </label>
          ))}
          <div className="spread"><span className="small">Score</span><strong className="mono" style={{ fontSize: 20 }}>{hkScore}%</strong></div>
          <FormActions submitLabel="Submit inspection" disabled={!canEdit} onSubmit={submitHk} onDemo={demo} />
        </>
      )}

      {section === 'checks' && (
        <>
          <Label>Permit-to-work compliance</Label>
          <NumberStepper label="Permits checked" value={permits} onChange={setPermits} />
          <NumberStepper label="Non-compliant" value={permitsBad} onChange={setPermitsBad} max={permits} />
          <Label>PPE compliance</Label>
          <NumberStepper label="Workers sampled" value={ppeN} onChange={setPpeN} step={5} />
          <NumberStepper label="Without correct PPE" value={ppeBad} onChange={setPpeBad} max={ppeN} />
          <div className="small muted">Permit compliance {permits ? Math.round(100 - (permitsBad / permits) * 100) : 0}% · PPE compliance {ppeN ? Math.round(100 - (ppeBad / ppeN) * 100) : 0}%</div>
          <FormActions submitLabel="Submit checks" disabled={!canEdit} onSubmit={submitChecks} onDemo={demo} />
        </>
      )}

      {section === 'obs' && (
        <>
          <Label>HSE observations today</Label>
          <NumberStepper label="Raised" value={raised} onChange={setRaised} />
          <NumberStepper label="Closed" value={closed} onChange={setClosed} />
          <FormActions submitLabel="Submit observations" disabled={!canEdit} onSubmit={submitObs} onDemo={demo} />
        </>
      )}
    </>
  );
}
