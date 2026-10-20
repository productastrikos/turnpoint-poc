// Live AI risk prediction (G12), schedule forecast (X16) and predictive critical path (X17).
// Assembles the nine model inputs for every critical and near-critical activity from the live services (critical-path
// status and change counts, discovery jobs, NCRs, attendance, contractor KPIs, risk register, SCFs), runs the slip
// classifier and the Monte Carlo in src/ai/riskModel.ts, and costs each mitigation by re-running the simulation with it.
import {
  buildRiskModel,
  explainActivity,
  simulate,
  slipProbability,
  type NearActivity,
  type NetActivity,
  type RiskFeature,
  type RiskModel,
  type RiskModelCard,
  type RiskVector,
  type SimResult,
} from '../ai/riskModel';
import { ACTIVITY_CONTEXT, DELAY_COST_PER_DAY_OMR, MITIGATIONS, type Mitigation } from '../mocks/riskContext';
import { contractorKpis } from '../mocks/executionMock';
import { plannedPct, scheduleActivities } from '../mocks/scheduleMock';
import { dateToDay, STATUS_DAY, TA_DAYS } from '../mocks/_gen';
import { getCriticalPathActivities, getNearCritical, type NearCritical } from './criticalPathService';
import { getDiscoveryJobs } from './discoveryService';
import { listNcrs } from './qualityService';
import { getAttendance } from './workforceService';
import { getRisks, updateRiskStatus } from './riskService';
import { getSCFs } from './scfService';
import type { CriticalPathActivity } from '../types';

export { DELAY_COST_PER_DAY_OMR };

export interface ActivityRisk {
  id: string;
  name: string;
  path: 'CP1' | 'CP2' | 'CP3' | 'Near';
  p6Id?: string;
  crew: string;
  contractor: string;
  status?: CriticalPathActivity['status'];
  x: RiskVector;
  /** Probability of slipping at least one more day beyond today's forecast. */
  p: number;
  drivers: { feature: RiskFeature; label: string; value: number; contrib: number }[];
  /** Linked records the inputs were read from, in words. */
  evidence: string[];
  /** Share of simulation runs in which this activity set the TA end (critical-path activities). */
  criticality?: number;
  /** Chance a near-critical activity uses up its float. */
  becomesCritical?: number;
  float: number;
}

export interface MitigationResult extends Mitigation {
  accepted: boolean;
  deltaCp1Risk: number;
  deltaP50: number;
  deltaMeet: number;
  deltaExposureOMR: number;
  /** Delay cost avoided (finish date plus protected near-critical float) minus the action's cost. */
  netOMR: number;
}

/** Ranking: expected delay cost avoided, before the action's own cost (shown separately). */
const benefit = (m: MitigationResult) => m.netOMR + m.costOMR;

export interface RiskForecast {
  activities: ActivityRisk[];
  sim: SimResult;
  baselineEnd: number;
  exposureOMR: number;
  mitigations: MitigationResult[];
  modelCard: RiskModelCard;
  computedMs: number;
}

let model: RiskModel | null = null;
const getModel = () => (model ??= buildRiskModel());
const accepted = new Set<string>();

type Effect = Mitigation['effects'][string];

interface Inputs {
  cp: CriticalPathActivity[];
  near: NearCritical[];
  base: Record<string, { x: RiskVector; ownDelay: number; behindDays: number; evidence: string[] }>;
}

const SPI = Object.fromEntries(contractorKpis.map((k) => [k.contractor, k.spi]));
const SCHEDULE = Object.fromEntries(scheduleActivities.map((a) => [a.id, a]));
const OPEN_DJ = new Set(['identified', 'evaluating']);
const OPEN_RISK = new Set(['open', 'mitigating']);

async function readInputs(): Promise<Inputs> {
  const [cp, near, djs, ncrs, att, risks, scfs] = await Promise.all([getCriticalPathActivities(), getNearCritical(), getDiscoveryJobs(), listNcrs(), getAttendance(), getRisks(), getSCFs()]);
  const shortfallOf = Object.fromEntries(att.rows.map((r) => [r.contractor, Math.round((1 - (r.actDay + r.actNight) / (r.planDay + r.planNight)) * 1000) / 10]));
  const cpById = Object.fromEntries(cp.map((a) => [a.id, a]));
  const slip = (a: CriticalPathActivity) => dateToDay(a.forecastFinish) - dateToDay(a.plannedFinish);

  const base: Inputs['base'] = {};
  const linked = (id: string) => {
    const c = ACTIVITY_CONTEXT[id];
    const evidence: string[] = [];
    let findings = 0;
    for (const d of c.dj ?? []) {
      const dj = djs.find((x) => x.id === d);
      if (dj && OPEN_DJ.has(dj.state)) { findings++; evidence.push(`${dj.id} ${dj.desc} (${dj.state})`); }
    }
    for (const n of c.ncr ?? []) {
      const ncr = ncrs.find((x) => x.tag === n.tag && x.title.toLowerCase().includes(n.title) && x.status !== 'Closed');
      if (ncr) { findings++; evidence.push(`${ncr.id} ${ncr.title} (${ncr.status.toLowerCase()})`); }
    }
    let constraints = 0;
    for (const rid of c.risks ?? []) {
      const r = risks.find((x) => x.id === rid);
      if (r && OPEN_RISK.has(r.status)) { constraints++; evidence.push(`${r.id} ${r.description} (${r.status})`); }
    }
    for (const sid of c.scf ?? []) {
      const s = scfs.find((x) => x.id === sid);
      if (s && s.status === 'evaluating') { constraints++; evidence.push(`${s.id} ${s.title} still being evaluated`); }
    }
    for (const k of c.constraints ?? []) { constraints++; evidence.push(k); }
    const shortfall = c.shortfall ?? shortfallOf[c.contractor] ?? 0;
    if (c.shortfall) evidence.push(`Crew shortfall ${c.shortfall}% reported by the field`);
    return { c, findings, constraints, shortfall, evidence };
  };

  for (const a of cp) {
    const { c, findings, constraints, shortfall, evidence } = linked(a.id);
    const preds = a.predecessors.map((p) => cpById[p]).filter(Boolean);
    const ownDelay = Math.max(0, slip(a) - Math.max(0, ...preds.map(slip)));
    base[a.id] = {
      ownDelay,
      behindDays: 0,
      evidence,
      x: {
        float: a.floatDays,
        behind: 0, // not started at the data date
        volatility: a.changeCount,
        findings,
        shortfall,
        reliability: SPI[c.contractor] ?? 0.95,
        predLate: preds.some((p) => p.status !== 'on-track') ? 1 : 0,
        remaining: a.durationDays + ownDelay,
        constraints,
      },
    };
  }
  for (const n of near) {
    const s = SCHEDULE[n.id];
    const { c, findings, constraints, shortfall, evidence } = linked(n.id);
    const behind = s ? Math.max(0, plannedPct(s, STATUS_DAY) - s.pct) : 0;
    const dur = s ? s.endDay - s.startDay + 1 : 3;
    base[n.id] = {
      ownDelay: 0,
      behindDays: (behind / 100) * dur,
      evidence: behind ? [`${s!.pct}% complete vs ${plannedPct(s!, STATUS_DAY)}% planned`, ...evidence] : evidence,
      x: {
        float: n.floatDays,
        behind,
        volatility: c.volatility ?? 0,
        findings,
        shortfall,
        reliability: SPI[c.contractor] ?? 0.95,
        predLate: 0,
        remaining: s ? Math.max(1, s.endDay - STATUS_DAY) : 2,
        constraints,
      },
    };
  }
  return { cp, near, base };
}

function applyEffects(inp: Inputs, ids: Iterable<string>) {
  const out = Object.fromEntries(Object.entries(inp.base).map(([k, v]) => [k, { ...v, x: { ...v.x } }]));
  for (const id of ids) {
    const m = MITIGATIONS.find((x) => x.id === id);
    if (!m) continue;
    for (const [act, e] of Object.entries(m.effects) as [string, Effect][]) {
      const t = out[act];
      if (!t) continue;
      if (e.ownDelay) t.ownDelay = Math.max(0, t.ownDelay + e.ownDelay);
      if (e.remaining) t.x.remaining = Math.max(1, t.x.remaining + e.remaining);
      if (e.findings) t.x.findings = Math.max(0, t.x.findings + e.findings);
      if (e.constraints) t.x.constraints = Math.max(0, t.x.constraints + e.constraints);
      if (e.shortfall !== undefined) t.x.shortfall = e.shortfall;
      if (e.reliability !== undefined) t.x.reliability = e.reliability;
      if (e.behindFactor !== undefined) {
        t.behindDays *= e.behindFactor;
        t.x.behind = Math.round(t.x.behind * e.behindFactor);
      }
    }
  }
  return out;
}

function run(inp: Inputs, mitigations: Iterable<string>, reference?: { end: number; path: Record<'CP1' | 'CP2' | 'CP3', number> }) {
  const m = getModel();
  const eff = applyEffects(inp, mitigations);
  const p = Object.fromEntries(Object.entries(eff).map(([k, v]) => [k, slipProbability(m, v.x)]));
  const net: NetActivity[] = inp.cp.map((a) => ({
    id: a.id,
    path: a.path,
    predecessors: a.predecessors,
    plannedStart: dateToDay(a.plannedFinish) - a.durationDays,
    plannedFinish: dateToDay(a.plannedFinish),
    ownDelay: eff[a.id].ownDelay,
    p: p[a.id],
  }));
  const tail = Object.fromEntries((['CP1', 'CP2', 'CP3'] as const).map((path) => [path, TA_DAYS - Math.max(...net.filter((a) => a.path === path).map((a) => a.plannedFinish))])) as Record<'CP1' | 'CP2' | 'CP3', number>;
  const near: NearActivity[] = inp.near.map((n) => ({ id: n.id, float: n.floatDays, behindDays: eff[n.id].behindDays, p: p[n.id] }));
  const sim = simulate(net, near, { tail, baselineEnd: TA_DAYS, reference });
  // cost of delay is measured against the contractual end (baseline), so options that move the forecast compare fairly
  const lateDays = sim.endDays.reduce((s, v) => s + Math.max(0, v - TA_DAYS), 0) / sim.runs;
  return { eff, p, sim, exposure: lateDays * DELAY_COST_PER_DAY_OMR };
}


/** Everything the AI risk screens show, computed from the live data. */
export async function getRiskForecast(): Promise<RiskForecast> {
  const t0 = performance.now();
  const inp = await readInputs();
  const m = getModel();
  // today's schedule forecast (no actions applied) is the fixed yardstick; accepted actions change the odds, not the yardstick
  const ref = run(inp, []).sim;
  const reference = { end: ref.forecastEnd, path: { CP1: ref.path.CP1.forecastEnd, CP2: ref.path.CP2.forecastEnd, CP3: ref.path.CP3.forecastEnd } };
  const now = run(inp, accepted, reference);
  const activities: ActivityRisk[] = [
    ...inp.cp.map<ActivityRisk>((a) => ({
      id: a.id,
      name: a.name,
      path: a.path,
      p6Id: SCHEDULE[a.id]?.p6Id,
      crew: ACTIVITY_CONTEXT[a.id].crew,
      contractor: ACTIVITY_CONTEXT[a.id].contractor,
      status: a.status,
      x: now.eff[a.id].x,
      p: now.p[a.id],
      drivers: explainActivity(m, now.eff[a.id].x),
      evidence: now.eff[a.id].evidence,
      criticality: now.sim.criticality[a.id] ?? 0,
      float: a.floatDays,
    })),
    ...inp.near.map<ActivityRisk>((n) => ({
      id: n.id,
      name: n.name,
      path: 'Near',
      p6Id: SCHEDULE[n.id]?.p6Id,
      crew: ACTIVITY_CONTEXT[n.id].crew,
      contractor: ACTIVITY_CONTEXT[n.id].contractor,
      x: now.eff[n.id].x,
      p: now.p[n.id],
      drivers: explainActivity(m, now.eff[n.id].x),
      evidence: now.eff[n.id].evidence,
      becomesCritical: now.sim.nearCritical[n.id] ?? 0,
      float: n.floatDays,
    })),
  ];
  const mitigations = MITIGATIONS.map<MitigationResult>((mit) => {
    if (accepted.has(mit.id)) return { ...mit, accepted: true, deltaCp1Risk: 0, deltaP50: 0, deltaMeet: 0, deltaExposureOMR: 0, netOMR: 0 };
    const w = run(inp, [...accepted, mit.id], reference);
    const deltaExposureOMR = w.exposure - now.exposure;
    // near-critical actions do not move the TA end today; credit them with the delay they prevent on their own path
    const nearGain = Object.keys(mit.effects).filter((k) => k.startsWith('ACT-')).reduce((s, k) => s + ((now.sim.nearCritical[k] ?? 0) - (w.sim.nearCritical[k] ?? 0)) * DELAY_COST_PER_DAY_OMR, 0);
    return {
      ...mit,
      accepted: false,
      deltaCp1Risk: w.sim.path.CP1.slipRisk - now.sim.path.CP1.slipRisk,
      deltaP50: w.sim.p50 - now.sim.p50,
      deltaMeet: w.sim.pMeetForecast - now.sim.pMeetForecast,
      deltaExposureOMR,
      netOMR: -deltaExposureOMR + nearGain - mit.costOMR,
    };
  }).sort((a, b) => Number(a.accepted) - Number(b.accepted) || benefit(b) - benefit(a));
  return { activities, sim: now.sim, baselineEnd: TA_DAYS, exposureOMR: now.exposure, mitigations, modelCard: m.card, computedMs: Math.round(performance.now() - t0) };
}

// Mitigations that also settle a risk-register entry
const SETTLES: Record<string, string> = { 'MIT-3': 'RSK-01', 'MIT-4': 'RSK-03' };

export async function acceptMitigation(id: string): Promise<void> {
  accepted.add(id);
  if (SETTLES[id]) await updateRiskStatus(SETTLES[id], 'mitigating');
}

export const acceptedMitigations = () => [...accepted];

export function getRiskModelCard(): RiskModelCard {
  return getModel().card;
}
