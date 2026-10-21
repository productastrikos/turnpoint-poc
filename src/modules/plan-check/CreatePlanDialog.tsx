import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Field } from '../../components/ui/Field';
import { Chip } from '../../components/ui/Chip';
import { SimBadge } from '../../components/ui/SimBadge';
import { ActionButton } from '../../components/ui/ActionButton';
import { addTaEvent, getTaEvents } from '../../services/portfolioService';
import { applyFixes, defaultExtras, evaluate, getHistory, submitPlan, type History, type PlanDraft, type Severity } from '../../services/planCheckService';
import { useToast } from '../../app/ToastContext';
import { useAuth } from '../../app/AuthContext';
import { PERSONAS } from '../../app/access';
import type { TaEvent, TaType } from '../../types/platform';

const TYPES: TaType[] = ['Major STO', 'Minor TA', 'Inspection Shutdown', 'Catalyst Change'];
const TONE: Record<Severity, 'good' | 'warn' | 'crit'> = { pass: 'good', warn: 'warn', block: 'crit' };

interface Form { name: string; type: TaType; units: string; startDate: string; durationDays: string; budgetOMR: string; manhours: string; contingencyPct: string; freezeDate: string }
const EMPTY: Form = { name: '', type: 'Minor TA', units: '', startDate: '', durationDays: '', budgetOMR: '', manhours: '', contingencyPct: '', freezeDate: '' };

/** One-click cases that fill the form: three plans with typical mistakes the check should catch, and one sound plan. */
const EXAMPLES: { label: string; hint: string; form: Form }[] = [
  { label: 'Rushed minor TA', hint: 'short, thin, late', form: { name: 'Minor TA 2028: FCC & SRU', type: 'Minor TA', units: 'FCC, SRU', startDate: '2028-03-06', durationDays: '10', budgetOMR: '4100000', manhours: '126000', contingencyPct: '4', freezeDate: '2028-01-10' } },
  { label: 'Budget does not match hours', hint: 'typo in budget', form: { name: 'Major STO 2031: CDU / VDU / HCU', type: 'Major STO', units: 'CDU, VDU, HCU', startDate: '2031-09-01', durationDays: '35', budgetOMR: '31400000', manhours: '330000', contingencyPct: '12', freezeDate: '2030-11-30' } },
  { label: 'Summer start, tight crews', hint: 'heat, congestion', form: { name: 'Major STO 2032: Full refinery', type: 'Major STO', units: 'HCU, CDU, SRU, VDU, FCC', startDate: '2032-07-05', durationDays: '24', budgetOMR: '14500000', manhours: '505000', contingencyPct: '12', freezeDate: '2031-10-05' } },
  { label: 'Sound plan', hint: 'passes the checks', form: { name: 'Inspection Shutdown 2036: CDU / VDU', type: 'Inspection Shutdown', units: 'CDU, VDU', startDate: '2036-03-24', durationDays: '24', budgetOMR: '5600000', manhours: '158000', contingencyPct: '15', freezeDate: '2035-09-24' } },
];

export function CreatePlanDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (ev: TaEvent) => void }) {
  const { showToast } = useToast();
  const { personaId } = useAuth();
  const by = PERSONAS.find((p) => p.id === personaId)?.person ?? 'TA planner';
  const [f, setF] = useState<Form>(EMPTY);
  const [hist, setHist] = useState<History | null>(null);
  const [events, setEvents] = useState<TaEvent[]>([]);
  const [override, setOverride] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(EMPTY);
    setOverride('');
    Promise.all([getHistory(), getTaEvents()]).then(([h, e]) => { setHist(h); setEvents(e); });
  }, [open]);

  const set = (k: keyof Form, v: string) => setF((p) => ({ ...p, [k]: v }));
  const units = f.units.split(',').map((u) => u.trim().toUpperCase()).filter(Boolean);
  const complete = Boolean(f.name.trim() && f.startDate && units.length && Number(f.durationDays) > 0 && Number(f.budgetOMR) > 0 && Number(f.manhours) > 0);

  const draft: PlanDraft | null = complete
    ? { taId: 'NEW', type: f.type, units, startDate: f.startDate, durationDays: Number(f.durationDays), budgetOMR: Number(f.budgetOMR), manhours: Number(f.manhours), contingencyPct: f.contingencyPct === '' ? 0 : Number(f.contingencyPct), freezeDate: f.freezeDate || defaultExtras({ startDate: f.startDate, type: f.type }).freezeDate }
    : null;
  const r = draft && hist ? evaluate(draft, hist, events) : null;
  const issues = r?.findings.filter((x) => x.severity !== 'pass') ?? [];

  function fixAll() {
    if (!draft || !hist) return;
    const d = applyFixes(draft, hist, events);
    setF((p) => ({ ...p, durationDays: String(d.durationDays), budgetOMR: String(d.budgetOMR), contingencyPct: String(d.contingencyPct), freezeDate: d.freezeDate, startDate: d.startDate }));
  }
  function fixOne(patch: Partial<PlanDraft>) {
    setF((p) => ({
      ...p,
      ...(patch.durationDays !== undefined && { durationDays: String(patch.durationDays) }),
      ...(patch.budgetOMR !== undefined && { budgetOMR: String(patch.budgetOMR) }),
      ...(patch.contingencyPct !== undefined && { contingencyPct: String(patch.contingencyPct) }),
      ...(patch.freezeDate !== undefined && { freezeDate: patch.freezeDate }),
      ...(patch.startDate !== undefined && { startDate: patch.startDate }),
    }));
  }

  const blocked = (r?.blocks ?? 0) > 0;
  const needReason = blocked && override.trim().length < 15;

  async function create() {
    if (!draft || !r) return;
    setBusy(true);
    try {
      const ev = await addTaEvent({ name: f.name.trim(), year: Number(draft.startDate.slice(0, 4)), type: draft.type, units: draft.units, startDate: draft.startDate, durationDays: draft.durationDays, budgetOMR: draft.budgetOMR, manhours: draft.manhours });
      await submitPlan({ ...draft, taId: ev.id }, r, by, blocked ? override : undefined);
      showToast(blocked ? `${ev.id} created with an override. The reason is in the review log.` : `${ev.id} created and added to the 10-year plan.`, blocked ? 'warn' : 'good');
      onCreated(ev);
      onClose();
    } catch (e) {
      showToast((e as Error).message, 'crit');
    } finally {
      setBusy(false);
    }
  }

  const o = r?.outcome;
  const likely = o ? Math.max(o.capacityDays, o.p50Days) : 0;
  const gap = draft && o ? likely - draft.durationDays : 0;
  const tone = !r ? 'neutral' : r.gate === 'ready' ? 'good' : r.gate === 'review' ? 'warn' : 'crit';

  return (
    <Modal open={open} onClose={onClose} title="Create turnaround plan" width={820}>
      <div className="row-wrap" style={{ gap: 8, marginBottom: 12 }}>
        <span className="eyebrow">Try an example</span>
        {EXAMPLES.map((ex) => (
          <button key={ex.label} type="button" className="fchip" onClick={() => setF(ex.form)}>{ex.label}<span className="fchip-count">{ex.hint}</span></button>
        ))}
      </div>
      <div className="form-grid">
        <div className="span-2"><Field label="Event name" required><input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Minor TA 2028: FCC & SRU" /></Field></div>
        <Field label="Type" required><select value={f.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Units (comma separated)" required><input value={f.units} onChange={(e) => set('units', e.target.value)} placeholder="FCC, SRU" /></Field>
        <Field label="Planned start" required><input type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
        <Field label="Scope freeze date" hint="Blank = the standard lead before start"><input type="date" value={f.freezeDate} onChange={(e) => set('freezeDate', e.target.value)} /></Field>
        <Field label="Duration (days)" required><input type="number" min={1} value={f.durationDays} onChange={(e) => set('durationDays', e.target.value)} /></Field>
        <Field label="Contingency (%)"><input type="number" min={0} max={60} value={f.contingencyPct} onChange={(e) => set('contingencyPct', e.target.value)} /></Field>
        <Field label="Budget (OMR)" required><input type="number" min={0} step={10000} value={f.budgetOMR} onChange={(e) => set('budgetOMR', e.target.value)} /></Field>
        <Field label="Man-hours" required><input type="number" min={0} step={1000} value={f.manhours} onChange={(e) => set('manhours', e.target.value)} /></Field>
      </div>

      {!r ? (
        <div className="callout" style={{ marginTop: 14 }} role="status">
          <div className="row-wrap" style={{ justifyContent: 'space-between' }}><strong>Plan check</strong><SimBadge kind="model" /></div>
          <div className="small" style={{ marginTop: 4 }}>Fill in the name, units, start date, duration, budget and man-hours. TURNPOINT compares them with STO-2024, STO-2026 and industry practice while you type, and warns when something looks wrong.</div>
        </div>
      ) : (
        <div className={`callout callout-${tone}`} style={{ marginTop: 14, borderLeft: `4px solid var(--${tone})` }} role="status" aria-live="polite" data-testid="plan-guard">
          <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
            <strong>
              {r.gate === 'ready'
                ? 'This plan agrees with history and industry practice'
                : `${r.blocks} blocker${r.blocks === 1 ? '' : 's'} and ${r.warns} warning${r.warns === 1 ? '' : 's'}${gap > 0 ? `. You planned ${draft!.durationDays} days, history supports about ${likely} (P80 ${Math.max(o!.p80Days, likely)})` : ''}`}
            </strong>
            <span className="row" style={{ gap: 6 }}>
              {issues.some((x) => x.fix && x.fix.bulk !== false) && <button type="button" className="btn btn-sm" onClick={fixAll}>Apply suggested fixes</button>}
              <SimBadge kind="model" />
            </span>
          </div>
          <div className="stack" style={{ marginTop: 8, color: 'var(--ink)' }}>
            {issues.map((x) => (
              <div key={x.id} className="small" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Chip tone={TONE[x.severity]}>{x.severity === 'block' ? 'Blocker' : 'Review'}</Chip>
                <div style={{ flex: 1 }}>
                  <strong>{x.rule}:</strong> {x.yours}. <span className="muted">{x.history}.</span>
                </div>
                {x.fix && <button type="button" className="btn btn-sm" onClick={() => fixOne(x.fix!.patch)}>{x.fix.label}</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {blocked && (
        <div style={{ marginTop: 12 }}>
          <Field label="Why proceed despite the blockers? (required, logged)">
            <textarea rows={2} value={override} onChange={(e) => setOverride(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <ActionButton variant={blocked ? 'danger' : 'primary'} small={false} busy={busy} disabled={!r || needReason} onClick={create}>
          {blocked ? 'Create anyway' : r && r.warns > 0 ? 'Create with warnings noted' : 'Create plan'}
        </ActionButton>
      </div>
    </Modal>
  );
}
