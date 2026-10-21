// Duration reality check. When a planner enters "this work takes 5 hours", this model estimates how long the same
// work actually takes, from three things the planner does not weigh by hand:
//   1. what comparable past jobs really took against what was planned (work type x equipment class),
//   2. the current condition of the asset (vibration, wall loss, fouling, open findings) read from monitoring data,
//   3. how the same tag behaved the last time it was worked on.
//
// The model is a ridge regression on log(actual hours). It outputs a median (P50) and an 80th-percentile (P80)
// duration, the chance the job finishes inside the planner's number, and which factors added how many hours, so
// every flag can be explained in the planner's own terms.
//
// Training data: OQ's historical turnaround confirmations are not digitised yet (the SOW asks for that), so the
// model is trained on a generated history of completed jobs with planner optimism and condition effects built in.
// Replace `generateHistory()` with the SAP PM confirmation export and nothing else changes.
import { analyze } from './text';
import { rng } from './rng';
import { signalsFor, TAG_HISTORY, type AssetSignals, type TagHistory } from '../mocks/assetSignalsMock';

export type WorkType = 'inspect' | 'replace' | 'repair' | 'clean' | 'overhaul' | 'test' | 'calibrate' | 'recertify' | 'install' | 'remove' | 'paint' | 'general';
export type EquipClass = 'Reactor' | 'Exchanger' | 'Pump' | 'Compressor' | 'Heater' | 'Column' | 'Vessel' | 'Valve' | 'Instrument' | 'Electrical' | 'Piping' | 'General';

export const WORK_TYPES: WorkType[] = ['inspect', 'replace', 'repair', 'clean', 'overhaul', 'test', 'calibrate', 'recertify', 'install', 'remove', 'paint', 'general'];
export const EQUIP_CLASSES: EquipClass[] = ['Reactor', 'Exchanger', 'Pump', 'Compressor', 'Heater', 'Column', 'Vessel', 'Valve', 'Instrument', 'Electrical', 'Piping', 'General'];

const BASE_HOURS: Record<WorkType, number> = { inspect: 6, replace: 8, repair: 10, clean: 8, overhaul: 12, test: 4, calibrate: 3, recertify: 4, install: 10, remove: 8, paint: 8, general: 6 };
const CLASS_MULT: Record<EquipClass, number> = { Reactor: 1.7, Exchanger: 1.5, Pump: 0.7, Compressor: 1.8, Heater: 1.6, Column: 1.9, Vessel: 1.4, Valve: 0.5, Instrument: 1.0, Electrical: 0.7, Piping: 1.0, General: 1.0 };
const CLASS_ACCESS: Record<EquipClass, number> = { Reactor: 0.8, Column: 0.75, Vessel: 0.6, Heater: 0.6, Exchanger: 0.45, Compressor: 0.35, Pump: 0.2, Piping: 0.3, Valve: 0.15, Instrument: 0.1, Electrical: 0.15, General: 0.25 };
const COMPATIBLE: Record<WorkType, EquipClass[]> = {
  inspect: ['Reactor', 'Exchanger', 'Column', 'Vessel', 'Heater', 'Piping', 'Pump'],
  replace: ['Valve', 'Exchanger', 'Piping', 'Instrument', 'Electrical', 'Heater', 'Column', 'Pump'],
  repair: ['Reactor', 'Column', 'Vessel', 'Piping', 'Exchanger', 'Heater'],
  clean: ['Exchanger', 'Heater', 'Vessel', 'Column'],
  overhaul: ['Pump', 'Compressor', 'Valve', 'Exchanger'],
  test: ['Piping', 'Vessel', 'Exchanger'],
  calibrate: ['Instrument', 'Valve'],
  recertify: ['Valve'],
  install: ['Piping', 'Instrument', 'Electrical', 'Vessel'],
  remove: ['Exchanger', 'Column', 'Reactor', 'Heater', 'Pump'],
  paint: ['Piping', 'Vessel', 'Column'],
  general: ['General'],
};

// How strongly each condition signal bites for each kind of work (0..1), so a vibration reading matters for a pump
// overhaul and not for a paint job.
const W_CORR: Partial<Record<WorkType, number>> = { repair: 1, replace: 0.5, inspect: 0.4, remove: 0.3 };
const W_VIB: Partial<Record<WorkType, number>> = { overhaul: 1, replace: 0.5, inspect: 0.4, remove: 0.3 };
const W_FOUL: Partial<Record<WorkType, number>> = { clean: 1, remove: 0.8, overhaul: 0.6, inspect: 0.3 };
const ROTATING: EquipClass[] = ['Pump', 'Compressor'];
const STATIC: EquipClass[] = ['Reactor', 'Column', 'Vessel', 'Piping', 'Exchanger', 'Heater'];
const FOULING: EquipClass[] = ['Exchanger', 'Heater'];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const vibSeverity = (mmS?: number) => clamp01(((mmS ?? 0) - 2.8) / (7.1 - 2.8));
const corrSeverity = (lossPct?: number) => clamp01((lossPct ?? 0) / 25);
const foulSeverity = (dpPct?: number) => clamp01((dpPct ?? 0) / 60);

// ---------------------------------------------------------------- parsing the work order

export function equipClassOf(tagField: string, desc: string): { cls: EquipClass; canonical: string; label: string } {
  const a = analyze(desc, tagField);
  const canonical = a.tags[0] ?? '';
  const label = a.tagLabels[0] ?? '';
  const isLine = /^\s*\d{1,2}["”]?-/.test(tagField);
  if (isLine) return { cls: 'Piping', canonical, label };
  const pre = (canonical.match(/^[A-Z]+/) ?? [''])[0];
  const byPrefix: Record<string, EquipClass> = {
    R: 'Reactor', E: 'Exchanger', P: 'Pump', C: 'Compressor', K: 'Compressor', F: 'Heater', T: 'Column', V: 'Vessel', ST: 'Vessel',
    PV: 'Valve', FV: 'Valve', XV: 'Valve', RV: 'Valve', LV: 'Valve', TV: 'Valve', PSV: 'Valve', CV: 'Valve',
    QC: 'Instrument', FT: 'Instrument', PT: 'Instrument', TT: 'Instrument', LT: 'Instrument', AT: 'Instrument', DCS: 'Instrument', PLC: 'Instrument',
    MCC: 'Electrical', MCP: 'Electrical', SWG: 'Electrical', TX: 'Electrical',
    FL: 'Piping', TL: 'Piping', PR: 'Piping',
  };
  return { cls: byPrefix[pre] ?? 'General', canonical, label };
}

const ACTION_PRIORITY: WorkType[] = ['overhaul', 'repair', 'replace', 'clean', 'remove', 'install', 'test', 'recertify', 'calibrate', 'inspect', 'paint'];

export function workTypeOf(desc: string, tagField = ''): WorkType {
  const actions = analyze(desc, tagField).actions;
  return ACTION_PRIORITY.find((w) => actions.includes(w)) ?? 'general';
}

function accessDifficulty(cls: EquipClass, desc: string): { value: number; keyword: boolean } {
  const keyword = /scaffold|confined|vessel entry|manway|internals?|at height|platform|tower|stack/i.test(desc);
  return { value: clamp01(CLASS_ACCESS[cls] + (keyword ? 0.15 : 0)), keyword };
}

// ---------------------------------------------------------------- features

const COND_FEATURES = ['wall loss x repair-type work', 'vibration x rotating overhaul', 'fouling x cleaning work', 'access difficulty', 'open inspection findings', 'tag overran last time'] as const;
const FEATURES = ['ln(planned hours)', ...WORK_TYPES.slice(0, -1).map((w) => `work:${w}`), ...EQUIP_CLASSES.slice(0, -1).map((c) => `class:${c}`), ...COND_FEATURES];
const N_COND = COND_FEATURES.length;

interface Case {
  workType: WorkType;
  cls: EquipClass;
  plannedHours: number;
  corr: number; // severity 0..1
  vib: number;
  foul: number;
  access: number;
  findings: number;
  prior: number; // mean ln(actual/planned) from this tag's earlier jobs, 0 if none
}

function features(c: Case): number[] {
  const f = [Math.log(c.plannedHours)];
  for (const w of WORK_TYPES.slice(0, -1)) f.push(c.workType === w ? 1 : 0);
  for (const k of EQUIP_CLASSES.slice(0, -1)) f.push(c.cls === k ? 1 : 0);
  f.push(
    STATIC.includes(c.cls) ? c.corr * (W_CORR[c.workType] ?? 0) : 0,
    ROTATING.includes(c.cls) ? c.vib * (W_VIB[c.workType] ?? 0) : 0,
    FOULING.includes(c.cls) ? c.foul * (W_FOUL[c.workType] ?? 0) : 0,
    c.access,
    c.findings,
    c.prior
  );
  return f;
}

// ---------------------------------------------------------------- generated history

export interface HistoryRow extends Case {
  actualHours: number;
}

function generateHistory(n = 640): HistoryRow[] {
  const r = rng(20260816);
  const out: HistoryRow[] = [];
  const types = WORK_TYPES.filter((w) => w !== 'general');
  for (let i = 0; i < n; i++) {
    const workType = r.pick(types);
    const cls = r.pick(COMPATIBLE[workType]);
    const corr = STATIC.includes(cls) ? corrSeverity(r.triangular(0, 6, 32)) : 0;
    const vib = ROTATING.includes(cls) ? vibSeverity(r.triangular(1.2, 2.6, 8.5)) : 0;
    const foul = FOULING.includes(cls) ? foulSeverity(r.triangular(0, 18, 70)) : 0;
    const access = clamp01(CLASS_ACCESS[cls] + r.normal(0, 0.1) + (r.chance(0.25) ? 0.15 : 0));
    const findings = Math.min(4, Math.max(0, Math.round(r.triangular(0, 0.6, 4))));
    const prior = r.chance(0.3) ? Math.max(0, r.normal(0.25, 0.2)) : 0;

    const size = Math.exp(r.normal(0, 0.3));
    const nominal = BASE_HOURS[workType] * CLASS_MULT[cls] * size;
    const cond =
      (1 + 0.7 * (STATIC.includes(cls) ? corr * (W_CORR[workType] ?? 0) : 0)) *
      (1 + 0.6 * (ROTATING.includes(cls) ? vib * (W_VIB[workType] ?? 0) : 0)) *
      (1 + 0.6 * (FOULING.includes(cls) ? foul * (W_FOUL[workType] ?? 0) : 0)) *
      (1 + 0.15 * access) *
      (1 + 0.03 * findings) *
      Math.exp(0.3 * prior);
    const actualHours = Math.max(1, Math.round(nominal * cond * Math.exp(r.normal(0, 0.12)) * 2) / 2);
    // Planners size the job from the scope, not from the asset's current condition, and plan a little tight (about 5% on average).
    const plannedHours = Math.max(1, Math.round(nominal * Math.exp(r.normal(Math.log(0.95), 0.18)) * 2) / 2);
    out.push({ workType, cls, plannedHours, corr, vib, foul, access, findings, prior, actualHours });
  }
  return out;
}

// ---------------------------------------------------------------- ridge regression

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]];
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

interface Model {
  w: number[]; // intercept first
  sigma: number;
}

function fit(X: number[][], y: number[], lambda = 0.05): Model {
  const d = X[0].length + 1;
  const A = Array.from({ length: d }, () => new Array(d).fill(0));
  const b = new Array(d).fill(0);
  X.forEach((row, i) => {
    const z = [1, ...row];
    for (let p = 0; p < d; p++) {
      b[p] += z[p] * y[i];
      for (let q = 0; q < d; q++) A[p][q] += z[p] * z[q];
    }
  });
  for (let p = 1; p < d; p++) A[p][p] += lambda; // the intercept is not shrunk
  const w = solve(A, b);
  const res = X.map((row, i) => y[i] - (w[0] + row.reduce((s, v, j) => s + v * w[j + 1], 0)));
  const sigma = Math.sqrt(res.reduce((s, e) => s + e * e, 0) / Math.max(1, res.length - d));
  return { w, sigma };
}

const mu = (m: Model, x: number[]) => m.w[0] + x.reduce((s, v, j) => s + v * m.w[j + 1], 0);

// standard normal CDF (Abramowitz and Stegun 7.1.26)
function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

export interface ModelCard {
  trainedOn: number;
  heldOut: number;
  modelMapePct: number;
  plannerMapePct: number;
  overranPct: number; // share of historical jobs that took more than 15% longer than planned
  avgOverrunPct: number;
  conditionEffects: { label: string; effect: string }[];
}

interface Trained {
  model: Model;
  history: HistoryRow[];
  card: ModelCard;
}

let trained: Trained | null = null;

function getTrained(): Trained {
  if (trained) return trained;
  const history = generateHistory();
  const split = Math.floor(history.length * 0.8);
  const tr = history.slice(0, split);
  const te = history.slice(split);
  const evalModel = fit(tr.map(features), tr.map((h) => Math.log(h.actualHours)));
  const mape = (pred: (h: HistoryRow) => number) => (te.reduce((s, h) => s + Math.abs(pred(h) - h.actualHours) / h.actualHours, 0) / te.length) * 100;
  const modelMape = mape((h) => Math.exp(mu(evalModel, features(h))));
  const plannerMape = mape((h) => h.plannedHours);
  // the served model is refit on everything
  const model = fit(history.map(features), history.map((h) => Math.log(h.actualHours)));
  const condW = model.w.slice(1 + FEATURES.length - N_COND);
  const effect = (j: number, unit: number) => `+${Math.round((Math.exp(condW[j] * unit) - 1) * 100)}%`;
  const card: ModelCard = {
    trainedOn: history.length,
    heldOut: te.length,
    modelMapePct: Math.round(modelMape),
    plannerMapePct: Math.round(plannerMape),
    overranPct: Math.round((history.filter((h) => h.actualHours > h.plannedHours * 1.15).length / history.length) * 100),
    avgOverrunPct: Math.round((history.reduce((s, h) => s + h.actualHours / h.plannedHours, 0) / history.length - 1) * 100),
    conditionEffects: [
      { label: 'Wall loss at 25% on repair-type work', effect: effect(0, 1) },
      { label: 'Vibration in the unacceptable zone on a rotating overhaul', effect: effect(1, 1) },
      { label: 'Heavy fouling (60% dP rise) on cleaning work', effect: effect(2, 1) },
      { label: 'Hard access (scaffold, confined space)', effect: effect(3, 1) },
      { label: 'Each open inspection finding', effect: effect(4, 1) },
    ],
  };
  trained = { model, history, card };
  return trained;
}

export const durationModelCard = (): ModelCard => getTrained().card;

// ---------------------------------------------------------------- the check

export interface DurationInput {
  desc: string;
  tag: string;
  area?: string;
  discipline?: string;
  plannedHours: number;
}

export type Verdict = 'ok' | 'warn' | 'crit';

export interface Driver {
  label: string;
  detail: string;
  hours: number;
}

export interface DurationAssessment {
  verdict: Verdict;
  plannedHours: number;
  expectedHours: number; // P50
  p80Hours: number;
  withinPct: number; // chance (0-100) the job finishes inside the planned hours
  logMu: number; // ln of the P50 duration and the spread of the log-normal, kept so a changed plan can be re-judged
  logSigma: number;
  overrunPct: number; // expected vs planned
  workType: WorkType;
  equipClass: EquipClass;
  tagLabel: string;
  confidence: 'high' | 'medium' | 'low';
  comparables: { n: number; scope: string; avgPlanned: number; avgActual: number; overrunPct: number };
  signals: AssetSignals;
  drivers: Driver[];
  tagHistory: TagHistory[];
  generous: boolean;
  notes: string[];
}

const verdictOf = (ratio: number, within: number): Verdict => (ratio >= 1.5 || within < 0.15 ? 'crit' : ratio >= 1.2 || within < 0.35 ? 'warn' : 'ok');

/**
 * Re-judge a different planned duration against an expectation that is already fixed. The model reads the planned hours
 * as a size signal, so re-running it after the planner adopts the AI figure would push the expectation up again; this keeps it still.
 */
export function rejudge(a: DurationAssessment, plannedHours: number): DurationAssessment {
  const within = phi((Math.log(plannedHours) - a.logMu) / a.logSigma);
  const ratio = Math.exp(a.logMu) / plannedHours;
  return { ...a, plannedHours, withinPct: Math.round(within * 100), overrunPct: Math.round((ratio - 1) * 100), verdict: verdictOf(ratio, within), generous: ratio < 0.7 };
}

const round05 = (h: number) => Math.max(0.5, Math.round(h * 2) / 2);

/** Returns null until there is enough on the form to judge (a description, and a planned duration above zero). */
export function assessDuration(input: DurationInput): DurationAssessment | null {
  if (!(input.plannedHours > 0) || input.desc.trim().length < 6) return null;
  const { model, history } = getTrained();
  const workType = workTypeOf(input.desc, input.tag);
  const { cls, canonical, label } = equipClassOf(input.tag, input.desc);
  const signals = signalsFor(canonical, label, cls);
  const access = accessDifficulty(cls, input.desc);
  const tagHistory = TAG_HISTORY.filter((h) => h.tag === canonical);
  const prior = tagHistory.length ? Math.max(0, tagHistory.reduce((s, h) => s + Math.log(h.actualHours / h.plannedHours), 0) / tagHistory.length) : 0;

  const c: Case = {
    workType,
    cls,
    plannedHours: input.plannedHours,
    corr: corrSeverity(signals.wallLossPct),
    vib: vibSeverity(signals.vibrationMmS),
    foul: foulSeverity(signals.foulingDpPct),
    access: access.value,
    findings: signals.openFindings,
    prior,
  };
  const x = features(c);
  const m = mu(model, x);
  const sigma = model.sigma * (signals.source === 'class-average' ? 1.15 : 1);
  const expected = Math.exp(m);
  const p80 = Math.exp(m + 0.84 * sigma);
  const within = phi((Math.log(input.plannedHours) - m) / sigma);
  const ratio = expected / input.plannedHours;

  // hours each condition factor adds: the prediction with and without that feature
  const base = 1 + FEATURES.length - N_COND;
  const hoursOf = (j: number) => expected - Math.exp(m - model.w[base + j] * x[base - 1 + j]);
  const drivers: Driver[] = [];
  const add = (j: number, label: string, detail: string) => {
    const hours = hoursOf(j);
    if (hours >= 0.5) drivers.push({ label, detail, hours: Math.round(hours * 2) / 2 });
  };
  if (c.corr * (W_CORR[workType] ?? 0) > 0 && STATIC.includes(cls)) add(0, 'Wall loss', `${signals.wallLossPct}% of wall lost${signals.corrosionRateMmY ? `, corroding ${signals.corrosionRateMmY} mm/y` : ''}. Repair work on thin metal needs extra mapping, preheat and weld passes.`);
  if (c.vib * (W_VIB[workType] ?? 0) > 0 && ROTATING.includes(cls)) add(1, 'Vibration', `${signals.vibrationMmS} mm/s RMS (ISO 10816 ${signals.vibrationMmS! >= 7.1 ? 'zone D, not acceptable' : signals.vibrationMmS! >= 4.5 ? 'zone C, restricted' : 'zone B'}). High vibration usually means worn bearings or seats found only on strip-down.`);
  if (c.foul * (W_FOUL[workType] ?? 0) > 0 && FOULING.includes(cls)) add(2, 'Fouling', `Pressure drop ${signals.foulingDpPct}% above the clean case. Hard deposit means repeated cleaning passes.`);
  add(3, 'Access', access.keyword ? 'Scaffold, confined space or work at height named in the description.' : `${cls} work normally needs scaffold or confined-space entry.`);
  if (signals.openFindings > 0) add(4, 'Open findings', `${signals.openFindings} open inspection finding${signals.openFindings === 1 ? '' : 's'} on this tag can widen the scope once it is opened up.`);
  if (prior > 0) add(5, 'Overran last time', `The previous job on this tag took ${Math.round((Math.exp(prior) - 1) * 100)}% longer than planned.`);
  drivers.sort((a, b) => b.hours - a.hours);

  // comparable past jobs
  let pool = history.filter((h) => h.workType === workType && h.cls === cls);
  let scope = `${cls.toLowerCase()} ${workType}`;
  if (pool.length < 8) {
    pool = history.filter((h) => h.workType === workType);
    scope = `${workType}`;
  }
  if (pool.length < 8) {
    pool = history;
    scope = 'all';
  }
  const avgPlanned = pool.reduce((s, h) => s + h.plannedHours, 0) / pool.length;
  const avgActual = pool.reduce((s, h) => s + h.actualHours, 0) / pool.length;

  const confidence: DurationAssessment['confidence'] = workType === 'general' || cls === 'General' ? 'low' : signals.source === 'tag-data' && pool.length >= 20 ? 'high' : 'medium';
  const notes: string[] = [];
  if (workType === 'general') notes.push('The description does not name a clear kind of work (inspect, replace, repair, clean, overhaul...), so the check is rough.');
  if (cls === 'General') notes.push('No recognisable equipment tag, so the asset-class effects are not applied.');
  if (signals.source === 'class-average' && cls !== 'General') notes.push('No condition data is loaded for this tag, so the asset-class average is used.');

  return {
    verdict: verdictOf(ratio, within),
    logMu: m,
    logSigma: sigma,
    plannedHours: input.plannedHours,
    expectedHours: round05(expected),
    p80Hours: round05(p80),
    withinPct: Math.round(within * 100),
    overrunPct: Math.round((ratio - 1) * 100),
    workType,
    equipClass: cls,
    tagLabel: label,
    confidence,
    comparables: { n: pool.length, scope, avgPlanned: Math.round(avgPlanned * 10) / 10, avgActual: Math.round(avgActual * 10) / 10, overrunPct: Math.round((avgActual / avgPlanned - 1) * 100) },
    signals,
    drivers,
    tagHistory,
    generous: ratio < 0.7,
    notes,
  };
}
