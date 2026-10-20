// AI risk prediction (checklist G12), schedule forecasting (X16) and predictive critical path (X17).
//
// Two parts, both running in the browser:
// 1. A slip classifier: for each critical / near-critical activity, the probability that it slips at least one more day
//    beyond today's forecast, from nine signals read off the live data (float, progress behind plan, re-planning count,
//    open findings, crew shortfall, contractor SPI, late predecessors, remaining duration, open constraints).
//    Trained on a generated history of 2,400 activities standing in for six previous turnarounds (OQ's history is not
//    digitised yet); the generating process is documented below so the model card can say exactly what it learned from.
// 2. A Monte Carlo schedule simulation: 2,000 runs over the CP1 / CP2 / CP3 activity network (finish-to-start logic
//    with the plan's own lags), each activity's extra delay drawn from its predicted slip probability. Gives P10 / P50 /
//    P90 finish dates, the chance of meeting today's forecast, the expected cost of delay, and a criticality index.
import { evaluate, explain, predict, rawWeights, split, train, type LogRegModel, type Metrics } from './logreg';
import { rng, type Rng } from './rng';

export const RISK_FEATURES = ['float', 'behind', 'volatility', 'findings', 'shortfall', 'reliability', 'predLate', 'remaining', 'constraints'] as const;
export type RiskFeature = (typeof RISK_FEATURES)[number];

export const RISK_FEATURE_LABEL: Record<RiskFeature, string> = {
  float: 'Remaining float (days)',
  behind: 'Progress behind plan (points)',
  volatility: 'Times re-planned this TA',
  findings: 'Open findings on the equipment',
  shortfall: 'Crew shortfall vs plan (%)',
  reliability: 'Contractor schedule performance (SPI)',
  predLate: 'Predecessor late or at risk',
  remaining: 'Remaining duration (days)',
  constraints: 'Open constraints (permits, cranes, tools)',
};

export type RiskVector = Record<RiskFeature, number>;
const toX = (v: RiskVector) => RISK_FEATURES.map((f) => v[f]);

// ------------------------------------------------------------------------------------------------ history

/** The process the synthetic history is drawn from (log-odds per unit). The trained model has to recover it from data. */
export const HISTORY_PROCESS = {
  intercept: -4.0,
  float: -0.32,
  behind: 0.035,
  volatility: 0.2,
  findings: 0.34,
  shortfall: 0.055,
  reliability: -9, // per 1.0 SPI, centred at 0.95
  predLate: 0.75,
  remaining: 0.05,
  constraints: 0.42,
  noiseSd: 0.45,
};

const clip = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const poisson = (r: Rng, mean: number, cap: number) => {
  let k = 0;
  let p = Math.exp(-mean);
  let s = p;
  const u = r.next();
  while (u > s && k < cap) {
    k++;
    p *= mean / k;
    s += p;
  }
  return k;
};

export function syntheticActivities(seed = 1408, n = 2400): { x: RiskVector; y: number; ta: string }[] {
  const r = rng(seed);
  const h = HISTORY_PROCESS;
  const tas = ['STO-2012', 'TA-2014', 'STO-2016', 'TA-2018', 'STO-2020', 'TA-2024'];
  const out: { x: RiskVector; y: number; ta: string }[] = [];
  for (let i = 0; i < n; i++) {
    const x: RiskVector = {
      float: Math.round(clip(r.chance(0.35) ? r.normal(0.3, 1.2) : r.normal(3.2, 2.2), -3, 10) * 2) / 2,
      behind: r.chance(0.5) ? 0 : Math.round(clip(-12 * Math.log(1 - r.next()), 0, 50)),
      volatility: poisson(r, 1.3, 8),
      findings: poisson(r, 0.7, 5),
      shortfall: Math.round(clip(r.normal(5.5, 5), 0, 35)),
      reliability: Math.round(clip(r.normal(0.95, 0.04), 0.8, 1.05) * 100) / 100,
      predLate: r.chance(0.28) ? 1 : 0,
      remaining: r.int(1, 12),
      constraints: poisson(r, 0.6, 4),
    };
    const z =
      h.intercept +
      h.float * x.float +
      h.behind * x.behind +
      h.volatility * x.volatility +
      h.findings * x.findings +
      h.shortfall * x.shortfall +
      h.reliability * (x.reliability - 0.95) +
      h.predLate * x.predLate +
      h.remaining * x.remaining +
      h.constraints * x.constraints +
      r.normal(0, h.noiseSd);
    out.push({ x, y: r.chance(1 / (1 + Math.exp(-z))) ? 1 : 0, ta: tas[i % tas.length] });
  }
  return out;
}

export interface RiskModelCard {
  rows: number;
  slipRate: number;
  holdout: Metrics;
  weights: { feature: RiskFeature; label: string; weight: number; truth: number }[];
  trainMs: number;
}

export interface RiskModel {
  model: LogRegModel;
  card: RiskModelCard;
}

export function buildRiskModel(): RiskModel {
  const t0 = performance.now();
  const data = syntheticActivities();
  const { trainRows, testRows } = split(data);
  const model = train([...RISK_FEATURES], trainRows.map((d) => toX(d.x)), trainRows.map((d) => d.y), { l2: 0.005, epochs: 600 });
  // slips are the minority class (about 1 in 12), so precision / recall are read at a 0.15 alert threshold
  const holdout = evaluate(model, testRows.map((d) => toX(d.x)), testRows.map((d) => d.y), 0.15);
  const truth = HISTORY_PROCESS as unknown as Record<string, number>;
  return {
    model,
    card: {
      rows: data.length,
      slipRate: data.filter((d) => d.y).length / data.length,
      holdout,
      weights: rawWeights(model).map((w) => ({ feature: w.feature as RiskFeature, label: RISK_FEATURE_LABEL[w.feature as RiskFeature], weight: w.weight, truth: truth[w.feature] })),
      trainMs: Math.round(performance.now() - t0),
    },
  };
}

export const slipProbability = (m: RiskModel, v: RiskVector) => predict(m.model, toX(v));

export function explainActivity(m: RiskModel, v: RiskVector) {
  return explain(m.model, toX(v)).map((c) => ({ ...c, feature: c.feature as RiskFeature, label: RISK_FEATURE_LABEL[c.feature as RiskFeature] }));
}

// ------------------------------------------------------------------------------------------------ Monte Carlo

export interface NetActivity {
  id: string;
  path: 'CP1' | 'CP2' | 'CP3';
  predecessors: string[];
  /** Planned start and finish, in TA days (end of day). */
  plannedStart: number;
  plannedFinish: number;
  /** Delay already known and in today's forecast that is this activity's own (not inherited). */
  ownDelay: number;
  /** Probability of slipping at least one more day (from the classifier). */
  p: number;
}

export interface NearActivity {
  id: string;
  float: number;
  /** Days behind plan today (progress gap x duration). */
  behindDays: number;
  p: number;
}

export interface SimSettings {
  runs?: number;
  seed?: number;
  /** Days from the last activity of each path to the end of the TA window (start-up prep, float). */
  tail: Record<'CP1' | 'CP2' | 'CP3', number>;
  baselineEnd: number;
  /** Fixed reference to measure slips against (today's schedule forecast); defaults to this network's own deterministic pass. */
  reference?: { end: number; path: Record<'CP1' | 'CP2' | 'CP3', number> };
}

export interface SimResult {
  runs: number;
  forecastEnd: number; // deterministic, today's schedule
  endDays: number[]; // sorted simulated TA end days
  p10: number;
  p50: number;
  p80: number;
  p90: number;
  pMeetForecast: number;
  pMeetBaseline: number;
  meanExtra: number; // days beyond today's forecast, averaged (0 if early)
  path: Record<'CP1' | 'CP2' | 'CP3', { forecastEnd: number; slipRisk: number; p50: number; p80: number }>;
  criticality: Record<string, number>; // share of runs in which the activity drove the TA end
  nearCritical: Record<string, number>; // chance a near-critical activity uses up its float
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];

/** Extra delay beyond today's forecast: a slip of 0.2-1.6 days (mostly about half a day) if it slips, otherwise a little either way. */
function extraDelay(r: Rng, p: number): number {
  return r.chance(p) ? r.triangular(0.2, 0.55, 1.6) : r.triangular(-0.35, 0, 0.3);
}

export function simulate(acts: NetActivity[], near: NearActivity[], s: SimSettings): SimResult {
  const runs = s.runs ?? 2000;
  const r = rng(s.seed ?? 4242);
  const byId = Object.fromEntries(acts.map((a) => [a.id, a]));
  // topological order (the network is small and acyclic)
  const order: NetActivity[] = [];
  const seen = new Set<string>();
  const visit = (a: NetActivity) => {
    if (seen.has(a.id)) return;
    a.predecessors.forEach((p) => byId[p] && visit(byId[p]));
    seen.add(a.id);
    order.push(a);
  };
  acts.forEach(visit);
  // lag = planned start minus latest planned predecessor finish (negative = planned overlap), so a zero-delay pass reproduces the plan
  const lag = Object.fromEntries(acts.map((a) => [a.id, a.predecessors.length ? a.plannedStart - Math.max(...a.predecessors.map((p) => byId[p].plannedFinish)) : 0]));
  const terminal = (path: NetActivity['path']) => acts.filter((a) => a.path === path && !acts.some((b) => b.path === path && b.predecessors.includes(a.id)));

  const pass = (extra: (a: NetActivity) => number) => {
    const finish: Record<string, number> = {};
    const driver: Record<string, string> = {};
    for (const a of order) {
      const predMax = a.predecessors.length ? Math.max(...a.predecessors.map((p) => finish[p])) : -Infinity;
      const start = Math.max(a.plannedStart, predMax + lag[a.id]);
      finish[a.id] = start + (a.plannedFinish - a.plannedStart) + a.ownDelay + extra(a);
      driver[a.id] = a.predecessors.reduce((best, p) => (finish[p] > (finish[best] ?? -Infinity) ? p : best), a.predecessors[0] ?? '');
    }
    const pathEnd = (['CP1', 'CP2', 'CP3'] as const).map((p) => {
      const ends = terminal(p).map((t) => ({ id: t.id, end: finish[t.id] }));
      const last = ends.reduce((b, e) => (e.end > b.end ? e : b), ends[0]);
      return { path: p, end: last.end + s.tail[p], last: last.id };
    });
    const top = pathEnd.reduce((b, e) => (e.end > b.end ? e : b), pathEnd[0]);
    // walk back along the driving predecessors to mark the activities that set the TA end this run
    const driving: string[] = [];
    for (let id: string | undefined = top.last; id; id = driver[id] || undefined) driving.push(id);
    return { pathEnd, end: top.end, driving };
  };

  const det = pass(() => 0);
  const forecastEnd = s.reference?.end ?? det.end;
  const refPath = (p: 'CP1' | 'CP2' | 'CP3') => s.reference?.path[p] ?? det.pathEnd.find((x) => x.path === p)!.end;
  const ends: number[] = [];
  const pathEnds: Record<string, number[]> = { CP1: [], CP2: [], CP3: [] };
  const crit: Record<string, number> = {};
  for (let i = 0; i < runs; i++) {
    const draws = new Map(acts.map((a) => [a.id, extraDelay(r, a.p)]));
    const res = pass((a) => draws.get(a.id)!);
    ends.push(res.end);
    res.pathEnd.forEach((pe) => pathEnds[pe.path].push(pe.end));
    res.driving.forEach((id) => (crit[id] = (crit[id] ?? 0) + 1));
  }
  // near-critical: today's lag behind plan, partly recovered, plus the same extra-delay draw, against remaining float
  const nearCritical = Object.fromEntries(
    near.map((n) => {
      let hits = 0;
      for (let i = 0; i < runs; i++) if (n.behindDays * (0.45 + 0.55 * r.next()) + extraDelay(r, n.p) >= n.float) hits++;
      return [n.id, hits / runs];
    })
  );
  ends.sort((a, b) => a - b);
  const path = Object.fromEntries(
    (['CP1', 'CP2', 'CP3'] as const).map((p) => {
      const xs = pathEnds[p].sort((a, b) => a - b);
      const fe = refPath(p);
      return [p, { forecastEnd: fe, slipRisk: xs.filter((v) => v >= fe + 0.5).length / runs, p50: quantile(xs, 0.5), p80: quantile(xs, 0.8) }];
    })
  ) as SimResult['path'];
  return {
    runs,
    forecastEnd,
    endDays: ends,
    p10: quantile(ends, 0.1),
    p50: quantile(ends, 0.5),
    p80: quantile(ends, 0.8),
    p90: quantile(ends, 0.9),
    pMeetForecast: ends.filter((v) => v < forecastEnd + 0.5).length / runs,
    pMeetBaseline: ends.filter((v) => v < s.baselineEnd + 0.5).length / runs,
    meanExtra: ends.reduce((sum, v) => sum + Math.max(0, v - forecastEnd), 0) / runs,
    path,
    criticality: Object.fromEntries(Object.entries(crit).map(([k, v]) => [k, v / runs])),
    nearCritical,
  };
}
