import { useEffect, useMemo, useState } from 'react';
import { SimBadge } from '../../components/ui/SimBadge';
import { Chip } from '../../components/ui/Chip';
import { checkDuration, getDurationModelCard, DURATION_EXAMPLES, type DurationExample } from '../../services/durationService';
import { rejudge, type DurationAssessment, type ModelCard } from '../../ai/durationModel';

const CALLOUT: Record<DurationAssessment['verdict'], string> = { ok: 'callout-good', warn: 'callout-warn', crit: 'callout-crit' };
const TONE: Record<DurationAssessment['verdict'], 'good' | 'warn' | 'crit'> = { ok: 'good', warn: 'warn', crit: 'crit' };
const fmt = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} h`;

/** One-click cases that fill the whole new-scope form: three under-estimates the AI should catch and one honest estimate. */
export function DurationExamples({ onPick }: { onPick: (ex: DurationExample) => void }) {
  return (
    <div className="row-wrap" style={{ gap: 8, marginBottom: 12, alignItems: 'center' }}>
      <span className="eyebrow">Try an example</span>
      {DURATION_EXAMPLES.map((ex) => (
        <button key={ex.label} type="button" className="fchip" onClick={() => onPick(ex)} title={`Planned ${ex.plannedHours} h`}>
          {ex.label}
          <span className="fchip-count">{ex.hint}</span>
        </button>
      ))}
    </div>
  );
}

function RangeBar({ a }: { a: DurationAssessment }) {
  const max = Math.max(a.p80Hours, a.plannedHours) * 1.12;
  const pos = (h: number) => `${Math.min(100, (h / max) * 100)}%`;
  const tick = (h: number, label: string, color: string, up: boolean) => (
    <div style={{ position: 'absolute', left: pos(h), top: 0, bottom: 0, width: 2, background: color }}>
      <span className="mono small" style={{ position: 'absolute', [up ? 'bottom' : 'top']: 'calc(100% + 3px)', left: 0, transform: 'translateX(-50%)', whiteSpace: 'nowrap', color }}>{label}</span>
    </div>
  );
  return (
    <div style={{ position: 'relative', height: 14, margin: '22px 6px 24px', background: 'var(--surface-2)', borderRadius: 7 }} aria-hidden="true">
      <div style={{ position: 'absolute', left: pos(a.expectedHours), width: `calc(${pos(a.p80Hours)} - ${pos(a.expectedHours)})`, top: 0, bottom: 0, background: 'currentColor', opacity: 0.22, borderRadius: 7 }} />
      {tick(a.plannedHours, `Planned ${fmt(a.plannedHours)}`, 'var(--ink)', true)}
      {tick(a.expectedHours, `AI ${fmt(a.expectedHours)}`, 'currentColor', false)}
    </div>
  );
}

export function DurationGuard({
  desc,
  tag,
  area,
  discipline,
  plannedHours,
  onUseHours,
  onResult,
}: {
  desc: string;
  tag: string;
  area: string;
  discipline: string;
  plannedHours: string;
  onUseHours: (h: number) => void;
  onResult: (a: DurationAssessment | null) => void;
}) {
  const [fresh, setFresh] = useState<DurationAssessment | null>(null);
  // once the planner adopts an AI figure, that expectation stays put and later plans are judged against it
  const [pin, setPin] = useState<DurationAssessment | null>(null);
  const [card, setCard] = useState<ModelCard | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hours = Number(plannedHours);
    const t = setTimeout(() => {
      checkDuration({ desc, tag, area, discipline, plannedHours: hours }).then((r) => {
        setFresh(r);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [desc, tag, area, discipline, plannedHours]);

  useEffect(() => setPin(null), [desc, tag, area, discipline]);

  const hours = Number(plannedHours);
  const a = useMemo(() => (pin && hours > 0 ? rejudge(pin, hours) : fresh), [pin, fresh, hours]);
  useEffect(() => onResult(a), [a, onResult]);

  useEffect(() => {
    if (open && !card) getDurationModelCard().then(setCard);
  }, [open, card]);

  if (!a) {
    return (
      <div className="callout" style={{ marginTop: 14 }} role="status">
        <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
          <strong>Duration check</strong>
          <SimBadge kind="model" />
        </div>
        <div className="small" style={{ marginTop: 4 }}>Enter a description, the equipment tag and the planned hours. TURNPOINT AI compares them with past jobs and the live condition of the asset, and warns when the time looks too short.</div>
      </div>
    );
  }

  const gap = a.expectedHours - a.plannedHours;
  const headline =
    a.verdict === 'ok'
      ? a.generous
        ? `Your ${fmt(a.plannedHours)} looks generous: the AI expects about ${fmt(a.expectedHours)}`
        : `Your ${fmt(a.plannedHours)} looks realistic: the AI expects about ${fmt(a.expectedHours)}`
      : `You planned ${fmt(a.plannedHours)}, the AI expects about ${fmt(a.expectedHours)} (+${fmt(gap)}, ${a.overrunPct}% longer)`;
  const s = a.signals;
  const readings = [
    s.vibrationMmS !== undefined && `Vibration ${s.vibrationMmS} mm/s RMS`,
    s.wallLossPct !== undefined && `Wall loss ${s.wallLossPct}%${s.corrosionRateMmY ? ` at ${s.corrosionRateMmY} mm/y` : ''}`,
    s.foulingDpPct !== undefined && `Fouling dP +${s.foulingDpPct}%`,
    `${s.openFindings} open finding${s.openFindings === 1 ? '' : 's'}`,
  ].filter(Boolean) as string[];

  return (
    <div className={`callout ${CALLOUT[a.verdict]}`} style={{ marginTop: 14, borderLeft: `4px solid var(--${TONE[a.verdict]})` }} role="status" aria-live="polite">
      <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
        <strong>{headline}</strong>
        <span className="row" style={{ gap: 6 }}>
          <Chip tone={TONE[a.verdict]}>{a.verdict === 'ok' ? 'Estimate OK' : a.verdict === 'warn' ? 'Likely under-estimated' : 'Very likely under-estimated'}</Chip>
          <SimBadge kind="model" />
        </span>
      </div>

      <RangeBar a={a} />

      <div className="small" style={{ color: 'var(--ink)' }}>
        P50 <strong className="mono">{fmt(a.expectedHours)}</strong> · safe buffer (P80) <strong className="mono">{fmt(a.p80Hours)}</strong> · chance of finishing within your estimate <strong className="mono">{a.withinPct}%</strong> · confidence {a.confidence}
      </div>

      <div style={{ marginTop: 10, color: 'var(--ink)' }}>
        <div className="eyebrow">Why</div>
        <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18, display: 'grid', gap: 3 }}>
          <li>
            <strong>Past jobs:</strong> {a.comparables.n} comparable {a.comparables.scope} jobs were planned at {fmt(a.comparables.avgPlanned)} on average and took {fmt(a.comparables.avgActual)} ({a.comparables.overrunPct >= 0 ? '+' : ''}{a.comparables.overrunPct}%).
          </li>
          <li>
            <strong>Asset condition{a.tagLabel ? ` (${a.tagLabel})` : ''}:</strong> {readings.join(' · ')}. <span className="muted">{s.sourceNote}.</span>
          </li>
          {a.drivers.map((d) => (
            <li key={d.label}>
              <strong>{d.label} +{fmt(d.hours)}:</strong> {d.detail}
            </li>
          ))}
          {a.tagHistory.slice(0, 2).map((h) => (
            <li key={`${h.event}-${h.work}`}>
              <strong>Same tag, {h.event}:</strong> {h.work.toLowerCase()} planned {fmt(h.plannedHours)}, took {fmt(h.actualHours)}.{h.note ? ` ${h.note}.` : ''}
            </li>
          ))}
          {a.notes.map((n) => (
            <li key={n} className="muted">{n}</li>
          ))}
        </ul>
      </div>

      <div className="row-wrap" style={{ marginTop: 12, gap: 8 }}>
        {a.verdict !== 'ok' && (
          <>
            <button type="button" className="btn btn-primary" onClick={() => { setPin(a); onUseHours(a.expectedHours); }}>Use AI estimate ({fmt(a.expectedHours)})</button>
            <button type="button" className="btn" onClick={() => { setPin(a); onUseHours(a.p80Hours); }}>Plan with buffer (P80, {fmt(a.p80Hours)})</button>
          </>
        )}
        <button type="button" className="btn" style={{ marginLeft: 'auto' }} onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? 'Hide model details' : 'Model details'}</button>
      </div>

      {open && card && (
        <div className="small" style={{ marginTop: 10, color: 'var(--ink)' }}>
          <div>
            Trained on {card.trainedOn} generated past jobs ({card.heldOut} held out). Error on held-out jobs: <strong>{card.modelMapePct}%</strong> for the model against <strong>{card.plannerMapePct}%</strong> for the planner's own estimate. In this history {card.overranPct}% of jobs ran more than 15% over plan (average +{card.avgOverrunPct}%).
          </div>
          <div style={{ marginTop: 4 }}>Learned effects: {card.conditionEffects.map((e) => `${e.label} ${e.effect}`).join(' · ')}.</div>
          <div className="muted" style={{ marginTop: 4 }}>The job history and the asset readings are simulated until OQ RPI's SAP PM confirmations, vibration system and inspection database are connected. The model itself runs in this browser.</div>
        </div>
      )}
    </div>
  );
}
