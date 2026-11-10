import { useState } from 'react';
import { useToast } from '../../app/ToastContext';
import { Icon } from '../../app/icons';
import { enqueue, getMobileState } from '../../services/mobileService';
import { CRIB_BY_TAG, CRIB_TOOLS, TOOL_ACTIVITIES, TOOL_ISSUES, TOOL_SEVERITIES, isCriticalActivity, scenarioNow, type ToolIssue, type ToolSeverity } from '../../mocks/toolsMock';
import { Choice, FormActions, Label, PhotoButton, nextPhotoName } from './PhoneKit';

const OPERATOR = 'Khalid Al-Rashdi';
const SCAN_ORDER = ['TL-9101', 'TL-9105', 'TL-9115', 'TL-9106'];

/** Phone screen: an operator reports a broken, missing or damaged tool and requests a replacement. */
export function ReportToolScreen({ canEdit }: { canEdit: boolean }) {
  const { showToast } = useToast();
  const [tag, setTag] = useState('');
  const [typed, setTyped] = useState('');
  const [scanned, setScanned] = useState(false);
  const [issue, setIssue] = useState<ToolIssue | ''>('');
  const [activityId, setActivityId] = useState('');
  const [severity, setSeverity] = useState<ToolSeverity | ''>('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [replace, setReplace] = useState(true);
  const [scanN, setScanN] = useState(0);

  const tool = tag ? CRIB_BY_TAG[tag] : undefined;
  const act = TOOL_ACTIVITIES.find((a) => a.id === activityId);
  const ready = Boolean(tool && issue && act && severity);

  function pickTag(t: string, viaScan = false) {
    setTag(t);
    setTyped(t);
    setScanned(viaScan);
  }
  function typeTag(v: string) {
    setTyped(v);
    const t = v.trim().toUpperCase();
    if (CRIB_BY_TAG[t]) {
      setTag(t);
      setScanned(false);
    } else setTag('');
  }
  function scan() {
    pickTag(SCAN_ORDER[scanN % SCAN_ORDER.length], true);
    setScanN((n) => n + 1);
  }
  function demo() {
    pickTag('TL-9101', true);
    setIssue('Broken');
    setActivityId('ACT-231');
    setSeverity('High');
    setPhoto(nextPhotoName());
    setNote('Hydraulic hose burst at the wrench head, cannot hold pressure. Tray bolting stopped.');
    setReplace(true);
  }

  async function submit() {
    if (!ready || !tool || !act || !issue || !severity) {
      showToast('Pick the tool, the issue, the affected activity and the severity first', 'warn');
      return;
    }
    const q = await enqueue({
      kind: 'tool-report',
      label: `Tool report: ${tool.name}, ${issue.toLowerCase()}`,
      detail: `${tool.tag} · ${act.p6Id} · ${severity} severity${photo ? ' · photo' : ''}${replace ? ' · replacement requested' : ''}`,
      tool: { toolTag: tool.tag, issue, activityId: act.id, severity, reportedBy: OPERATOR, reportedAt: scenarioNow(), note: note.trim() || `${issue} reported from the field.`, replacementRequested: replace, photo: photo ?? undefined, source: 'Mobile app' },
    });
    const now = getMobileState().queue.find((x) => x.id === q.id);
    if (now?.status === 'synced') showToast(`${now.result ?? 'Report received.'} It is now in Broken & Missing Tools.`, 'good');
    else showToast(`Report saved on the phone. It reaches the tool crib and the dashboard when the SIM has signal.`, 'warn');
    setTag('');
    setTyped('');
    setScanned(false);
    setIssue('');
    setActivityId('');
    setSeverity('');
    setPhoto(null);
    setNote('');
    setReplace(true);
  }

  return (
    <>
      <div className="eyebrow">Report a tool problem</div>

      <Label>Tool</Label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="text" value={typed} onChange={(e) => typeTag(e.target.value)} placeholder="Type tag, e.g. TL-9101" aria-label="Tool tag" style={{ flex: 1, minWidth: 0 }} />
        <button type="button" className="btn btn-sm" onClick={scan} aria-label="Scan tool tag"><Icon name="grid" size={14} /> Scan</button>
      </div>
      <select value={tag} onChange={(e) => pickTag(e.target.value)} aria-label="Crib catalogue">
        <option value="">or pick from the crib catalogue…</option>
        {CRIB_TOOLS.map((t) => (
          <option key={t.tag} value={t.tag}>{t.tag} {t.name}</option>
        ))}
      </select>
      {tool && (
        <div className="small" style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '6px 10px' }}>
          <strong>{tool.name}</strong>
          <div className="muted">{scanned ? 'Scanned' : 'Selected'} {tool.tag} · {tool.category} · {tool.crib}</div>
        </div>
      )}

      <Label>What is wrong</Label>
      <Choice options={TOOL_ISSUES} value={issue} onChange={setIssue} cols={2} danger={(o) => o === 'Missing' || o === 'Broken'} />

      <Label>Work it affects</Label>
      <select value={activityId} onChange={(e) => setActivityId(e.target.value)} aria-label="Affected activity">
        <option value="">Select activity…</option>
        {TOOL_ACTIVITIES.map((a) => (
          <option key={a.id} value={a.id}>{a.p6Id} {a.name.length > 26 ? `${a.name.slice(0, 25)}…` : a.name}{isCriticalActivity(a.id) ? ' (critical)' : ''}</option>
        ))}
      </select>

      <Label>Severity</Label>
      <Choice options={TOOL_SEVERITIES} value={severity} onChange={setSeverity} danger={(o) => o === 'High'} />
      {severity === 'High' && <div className="small muted">High means the crew cannot continue the task.</div>}

      <Label>Photo and note</Label>
      <PhotoButton photo={photo} onTake={() => setPhoto(nextPhotoName())} onClear={() => setPhoto(null)} />
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened?" aria-label="Note" style={{ resize: 'none' }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Request a replacement
      </label>

      <FormActions submitLabel="Send to tool crib" disabled={!canEdit} onSubmit={submit} onDemo={demo} />
    </>
  );
}
