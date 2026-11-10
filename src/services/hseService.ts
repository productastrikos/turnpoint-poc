// Contractor daily HSE records and the HSE compliance score derived from them (PBC 03 #9).
// Entries are typed by each contractor's supervisor in the mobile app and applied here when the phone syncs. In-memory, SIMULATED.
import { createCollection } from './_collection';
import { HSE_ELAPSED_DAYS, HK_ITEMS, TBT_TOPICS, hseProfile, hseSeed, type HseDay, type HseSource, type HkEntry, type ObsEntry, type PermitEntry, type PpeEntry, type TbtEntry } from '../mocks/hseMock';
import { CONTRACTOR_NAMES } from '../mocks/master';
import { scenarioNow } from '../mocks/toolsMock';

export const HSE_DAY = HSE_ELAPSED_DAYS;
const store = createCollection<HseDay>(hseSeed, 120);

/** Weights inside the HSE compliance score. */
export const HSE_WEIGHTS = { tbt: 0.3, housekeeping: 0.25, permit: 0.2, ppe: 0.15, obs: 0.1 } as const;

export type CalendarCell = { state: 'done' | 'missed' | 'pending'; attendancePct?: number; topic?: string; attendees?: number; expected?: number };

export interface HseScore {
  contractor: string;
  tbtDone: number;
  tbtRequired: number;
  tbtPct: number;
  attendancePct: number;
  hkAvg: number; // average score on the days inspected
  hkDays: number;
  permitChecked: number;
  permitNon: number;
  permitPct: number;
  ppeSampled: number;
  ppeNon: number;
  ppePct: number;
  obsRaised: number;
  obsClosed: number;
  obsOpen: number;
  obsClosurePct: number;
  sub: { tbt: number; housekeeping: number; permit: number; ppe: number; obs: number };
  composite: number;
  calendar: CalendarCell[];
  hkTrend: (number | null)[];
  todayPending: boolean;
  last?: { by: string; at: string; source: HseSource };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

export function scoreContractor(contractor: string, all: HseDay[]): HseScore {
  const days = all.filter((d) => d.contractor === contractor).sort((a, b) => a.day - b.day);
  const tbtDays = days.filter((d) => d.tbt);
  const hkDays = days.filter((d) => d.hk);
  const sum = (f: (d: HseDay) => number) => days.reduce((s, d) => s + f(d), 0);
  const permitChecked = sum((d) => d.permit?.checked ?? 0);
  const permitNon = sum((d) => d.permit?.nonCompliant ?? 0);
  const ppeSampled = sum((d) => d.ppe?.sampled ?? 0);
  const ppeNon = sum((d) => d.ppe?.nonCompliant ?? 0);
  const obsRaised = sum((d) => d.obs?.raised ?? 0);
  const obsClosed = Math.min(obsRaised, sum((d) => d.obs?.closed ?? 0));
  const tbtPct = pct(tbtDays.length, HSE_DAY);
  const attendancePct = tbtDays.length ? tbtDays.reduce((s, d) => s + pct(d.tbt!.attendees, d.tbt!.expected), 0) / tbtDays.length : 0;
  const hkAvg = hkDays.length ? hkDays.reduce((s, d) => s + d.hk!.score, 0) / hkDays.length : 0;
  const permitPct = permitChecked ? 100 - pct(permitNon, permitChecked) : 0;
  const ppePct = ppeSampled ? 100 - pct(ppeNon, ppeSampled) : 0;
  const obsClosurePct = obsRaised ? pct(obsClosed, obsRaised) : 100;
  const sub = {
    tbt: 0.7 * tbtPct + 0.3 * attendancePct,
    housekeeping: (hkAvg * hkDays.length) / HSE_DAY, // a missed inspection counts as a zero
    permit: permitPct,
    ppe: ppePct,
    obs: obsClosurePct,
  };
  const composite = sub.tbt * HSE_WEIGHTS.tbt + sub.housekeeping * HSE_WEIGHTS.housekeeping + sub.permit * HSE_WEIGHTS.permit + sub.ppe * HSE_WEIGHTS.ppe + sub.obs * HSE_WEIGHTS.obs;
  const byDay = new Map(days.map((d) => [d.day, d]));
  const calendar: CalendarCell[] = Array.from({ length: HSE_DAY }, (_, i) => {
    const d = byDay.get(i + 1);
    if (d?.tbt) return { state: 'done', attendancePct: Math.round(pct(d.tbt.attendees, d.tbt.expected)), topic: d.tbt.topic, attendees: d.tbt.attendees, expected: d.tbt.expected };
    // today is still open until the talk is entered, an earlier day without a talk is a miss
    return { state: i + 1 === HSE_DAY ? 'pending' : 'missed' };
  });
  const lastRec = [...days].filter((d) => d.lastAt).sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))[0];
  return {
    contractor,
    tbtDone: tbtDays.length,
    tbtRequired: HSE_DAY,
    tbtPct,
    attendancePct,
    hkAvg,
    hkDays: hkDays.length,
    permitChecked,
    permitNon,
    permitPct,
    ppeSampled,
    ppeNon,
    ppePct,
    obsRaised,
    obsClosed,
    obsOpen: obsRaised - obsClosed,
    obsClosurePct,
    sub,
    composite: r1(composite),
    calendar,
    hkTrend: Array.from({ length: HSE_DAY }, (_, i) => byDay.get(i + 1)?.hk?.score ?? null),
    todayPending: calendar[HSE_DAY - 1].state === 'pending',
    last: lastRec ? { by: lastRec.lastBy ?? '', at: lastRec.lastAt!, source: lastRec.lastSource ?? 'seed' } : undefined,
  };
}

export async function listHseDays(): Promise<HseDay[]> {
  return store.list();
}
export const scoreAll = (all: HseDay[]): HseScore[] => CONTRACTOR_NAMES.map((c) => scoreContractor(c, all));

// ---- change events ----
export interface HseEvent {
  message: string;
  contractor?: string;
  before?: number;
  after?: number;
}
const listeners = new Set<(e: HseEvent | null) => void>();
const emit = (e: HseEvent | null) => listeners.forEach((l) => l(e));
export const subscribeHse = (fn: (e: HseEvent | null) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

// ---- entries from the phone ----
export type HseEntryPayload =
  | { section: 'tbt'; contractor: string; data: TbtEntry; by: string; at: string }
  | { section: 'hk'; contractor: string; data: HkEntry; by: string; at: string }
  | { section: 'checks'; contractor: string; permit: PermitEntry; ppe: PpeEntry; by: string; at: string }
  | { section: 'obs'; contractor: string; data: ObsEntry; by: string; at: string };

const SECTION_NAME = { tbt: 'toolbox talk', hk: 'housekeeping inspection', checks: 'permit and PPE checks', obs: 'HSE observations' } as const;

/** Apply one synced entry to the contractor's Day 14 record. Returns the message the phone shows. */
export async function applyHseEntry(p: HseEntryPayload, source: HseSource = 'mobile', quiet = false): Promise<{ message: string; before: number; after: number }> {
  const before = scoreContractor(p.contractor, await store.list()).composite;
  const id = `${p.contractor}|${HSE_DAY}`;
  const cur = (await store.list()).find((d) => d.id === id) ?? { id, contractor: p.contractor, day: HSE_DAY };
  const patch: Partial<HseDay> = { lastBy: p.by, lastAt: scenarioNow(), lastSource: source };
  if (p.section === 'tbt') patch.tbt = p.data;
  if (p.section === 'hk') patch.hk = p.data;
  if (p.section === 'checks') {
    patch.permit = p.permit;
    patch.ppe = p.ppe;
  }
  if (p.section === 'obs') {
    const o = cur.obs;
    patch.obs = { raised: (o?.raised ?? 0) + p.data.raised, closed: (o?.closed ?? 0) + p.data.closed };
  }
  const exists = (await store.list()).some((d) => d.id === id);
  if (exists) await store.update(id, patch);
  else await store.add({ ...cur, ...patch } as HseDay);
  const after = scoreContractor(p.contractor, await store.list()).composite;
  const diff = r1(after - before);
  const message = `${p.contractor} ${SECTION_NAME[p.section]} recorded for Day ${HSE_DAY}. HSE compliance ${before.toFixed(1)} to ${after.toFixed(1)} (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}).`;
  emit({ message: quiet ? '' : message, contractor: p.contractor, before, after });
  return { message, before, after };
}

export function resetHse() {
  store.reset();
  simSeq = 0;
  emit(null);
}

// ---- simulated supervisor entry (the whole Day 14 sheet for one contractor, as if typed on the phone) ----
let simSeq = 0;
export function demoSheet(contractor: string): HseEntryPayload[] {
  const p = hseProfile(contractor);
  const t = TBT_TOPICS[(HSE_DAY + CONTRACTOR_NAMES.indexOf(contractor) * 3 + simSeq) % TBT_TOPICS.length];
  const base = { contractor, by: p.supervisor, at: scenarioNow() };
  return [
    { ...base, section: 'tbt', data: { topic: t.topic, hazards: t.hazards.slice(0, 2), controls: t.controls.slice(0, 2), attendees: Math.round(p.expected * 0.94), expected: p.expected, time: '06:15', signSheetPhoto: true, signedBy: p.supervisor } },
    { ...base, section: 'hk', data: { checks: HK_ITEMS.map((_, i) => i !== 3), score: 83, inspector: p.supervisor } },
    { ...base, section: 'checks', permit: { checked: p.permitsPerDay, nonCompliant: 1 }, ppe: { sampled: 48, nonCompliant: 2 } },
    { ...base, section: 'obs', data: { raised: 2, closed: 3 } },
  ];
}

/** The next contractor with no Day 14 toolbox talk; falls back to the lowest scoring one. */
export async function nextPendingContractor(): Promise<{ contractor: string; pending: boolean }> {
  const scores = scoreAll(await store.list());
  const pending = scores.find((s) => s.todayPending);
  if (pending) return { contractor: pending.contractor, pending: true };
  return { contractor: [...scores].sort((a, b) => a.composite - b.composite)[0].contractor, pending: false };
}
export const bumpSimulation = () => {
  simSeq += 1;
};
