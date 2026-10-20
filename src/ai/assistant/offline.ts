// On-device answer engine, used when the language model is not reachable (no API key in .env.local, no network).
// It picks an intent from the question and composes the answer from the same live tool data the model would read,
// so the numbers always match the screens. It cannot reason beyond its intents; the UI labels it as on-device.
import { TOOL_IMPL, TOOL_LABEL, type ToolContext } from './tools';
import type { AgentStep } from './agent';

export interface OfflineAnswer {
  text: string;
  pages: { to: string; label: string }[];
  steps: AgentStep[];
}

type Impl = typeof TOOL_IMPL;
type Use = <K extends keyof Impl>(k: K, input?: Record<string, string>) => ReturnType<Impl[K]>;
type Run = (q: string, ctx: ToolContext, read: Use) => Promise<string>;

const pathIn = (q: string) => (/\bcp\s*1\b/i.test(q) ? 'CP1' : /\bcp\s*2\b/i.test(q) ? 'CP2' : /\bcp\s*3\b/i.test(q) ? 'CP3' : 'all');
const drivers = (d: string[]) => d.map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join(', ');
const bullets = (xs: string[]) => xs.filter(Boolean).map((x) => `- ${x}`).join('\n');

const INTENTS: { id: string; words: string[]; run: Run }[] = [
  {
    id: 'briefing',
    words: ['meeting', 'tomorrow', 'brief', 'briefing', 'look at', 'focus', 'priorit', 'summary', 'summarise', 'summarize', 'status'],
    run: async (_q, _c, read) => {
      const [r, s, c] = await Promise.all([read('get_risk_forecast'), read('get_scope', { status: 'pending', search: '' }), read('get_change_control')]);
      const top = r.data.riskiestActivities[0];
      const act = r.data.recommendedActions.find((m) => !m.accepted);
      const scfs = c.data.scfs.filter((x) => x.status === 'evaluating');
      return `**Four things for tomorrow's planning meeting** (from live data):\n${bullets([
        `Finish: the schedule says ${r.data.scheduleForecast}; the risk model gives it ${r.data.chanceOfMeetingScheduleForecast} (P50 ${r.data.aiFinish.p50}). Biggest risk: ${top.id} ${top.name} at ${top.slipProbability}.`,
        act ? `Decision: ${act.action} (${act.effect}).` : '',
        `${s.data.totals.pending} scope items waiting at the gates (G1 ${s.data.pendingByGate.gate1}, G2 ${s.data.pendingByGate.gate2}, G3 ${s.data.pendingByGate.gate3}).`,
        scfs.length ? `${scfs.length} SCF${scfs.length > 1 ? 's' : ''} still being evaluated: ${scfs.map((x) => `${x.id} (${x.routesTo})`).join(', ')}.` : '',
      ])}`;
    },
  },
  {
    id: 'cp-changes',
    words: ['how many times', 'times', 'changed', 'change count', 'cp change'],
    run: async (_q, _c, read) => {
      const s = await read('get_schedule', { path: 'all' });
      const ch = s.data.criticalPathChanges;
      return `The critical path has changed **${ch.thisTA} times** this turnaround, **${ch.today} today** (data date ${s.data.dataDate}).\n${bullets(ch.recent)}\nThe same log feeds the end-of-TA CP change report.`;
    },
  },
  {
    id: 'blocking',
    words: ['block', 'blocking', 'holding', 'late', 'delay', 'delayed', 'behind', 'critical path', 'cp1', 'cp2', 'cp3'],
    run: async (q, _c, read) => {
      const path = pathIn(q);
      const [s, r] = await Promise.all([read('get_schedule', { path }), read('get_risk_forecast')]);
      const hot = s.data.activities.filter((a) => a.status !== 'on-track');
      const risky = r.data.riskiestActivities.filter((a) => path === 'all' || a.path === path).slice(0, 2);
      return `${path === 'all' ? 'Across CP1-CP3' : path}: ${hot.length ? `${hot.length} activit${hot.length > 1 ? 'ies are' : 'y is'} off track` : 'nothing is off track'}; the schedule forecast ends ${s.data.scheduleForecastEnd} (baseline ${s.data.baselineEnd}).\n${bullets([
        ...hot.slice(0, 3).map((a) => `${a.id} ${a.name}: ${a.status}, forecast ${a.forecastFinish} vs ${a.plannedFinish}, float ${a.totalFloatDays} d, changed ${a.timesChanged}x.`),
        ...risky.map((a) => `Model: ${a.id} has a ${a.slipProbability} chance of slipping again (${drivers(a.drivers)}).`),
      ])}`;
    },
  },
  {
    id: 'risk',
    words: ['risk', 'predict', 'prediction', 'probability', 'chance', 'finish', 'when will', 'forecast', 'p50', 'p90', 'on time'],
    run: async (_q, _c, read) => {
      const r = await read('get_risk_forecast');
      const d = r.data;
      return `The schedule forecast is **${d.scheduleForecast}**; the risk model gives it **${d.chanceOfMeetingScheduleForecast}**, with P50 ${d.aiFinish.p50} and P90 ${d.aiFinish.p90}.\n${bullets([
        `Slip risk by path: CP1 ${d.slipRiskByPath.CP1}, CP2 ${d.slipRiskByPath.CP2}, CP3 ${d.slipRiskByPath.CP3}.`,
        ...d.riskiestActivities.slice(0, 2).map((a) => `${a.id} ${a.name}: ${a.slipProbability} (${drivers(a.drivers)}).`),
        d.recommendedActions[0] ? `Best action: ${d.recommendedActions[0].action} (${d.recommendedActions[0].effect}).` : '',
      ])}`;
    },
  },
  {
    id: 'duplicates',
    words: ['duplicate scope', 'duplicate', 'duplicates', 'same work', 'twice', 'overlap', 'bundle'],
    run: async (_q, _c, read) => {
      const f = await read('find_duplicate_scope', { description: '' });
      const findings = f.data.findings ?? [];
      const dups = findings.filter((x) => x.kind === 'duplicate');
      const bundles = findings.filter((x) => x.kind === 'bundle');
      return `The duplicate detector finds **${dups.length} duplicate${dups.length === 1 ? '' : 's'}** and ${bundles.length} bundling opportunit${bundles.length === 1 ? 'y' : 'ies'} in the live worklist.\n${bullets([
        ...dups.slice(0, 3).map((x) => `${x.probability}: ${x.other} repeats ${x.keep} (${x.reasons.slice(0, 2).join('; ').toLowerCase()}); saving ${x.saving}.`),
        bundles[0] ? `Bundle: ${bundles[0].keep} with ${bundles[0].other} (one scaffold and permit).` : '',
      ])}`;
    },
  },
  {
    id: 'budget',
    words: ['budget', 'cost', 'over budget', 'overspend', 'spend', 'money', 'forecast at completion', 'growth', 'variation'],
    run: async (_q, _c, read) => {
      const d = (await read('get_budget')).data;
      if (d.restricted || !d.largestOverruns || !d.scopeGrowth) return d.restricted ?? 'Budget data is not available.';
      return `Forecast at completion is **${d.forecastAtCompletion}** against an approved **${d.approvedBudget}** (${d.forecastVsBudget}); ${d.committed} is committed and ${d.actualSpent} spent.\n${bullets([
        `Largest overruns: ${d.largestOverruns.slice(0, 3).map((l) => `${l.subWbs} ${l.overrun} (${l.pct})`).join(', ')}.`,
        `Scope growth: ${d.scopeGrowth.approvedVariations} approved variations since the base estimate (${d.scopeGrowth.beforeFreeze} before the freeze, ${d.scopeGrowth.afterFreeze} after), ${d.scopeGrowth.pending} pending.`,
      ])}`;
    },
  },
  {
    id: 'readiness',
    words: ['readiness', 'ready', 'sto readiness', 'gaps'],
    run: async (_q, _c, read) => {
      const r = await read('get_readiness');
      return `Composite STO readiness is **${r.data.composite}**.\n${bullets([
        `Weakest: ${[...r.data.components].sort((a, b) => parseInt(a.score) - parseInt(b.score)).slice(0, 2).map((c) => `${c.name} ${c.score}`).join(', ')}.`,
        ...r.data.topGaps.slice(0, 3).map((g) => `${g.id} ${g.gap} (${g.owner}, ${g.lift}).`),
      ])}`;
    },
  },
  {
    id: 'materials',
    words: ['material', 'materials', 'expedite', 'expediting', 'procurement', 'po ', 'purchase', 'long lead', 'vendor'],
    run: async (_q, _c, read) => {
      const m = await read('get_materials');
      return `${m.data.lateAgainstNeedDate.length} order${m.data.lateAgainstNeedDate.length === 1 ? '' : 's'} will arrive after the need date and ${m.data.withoutPO.length} line${m.data.withoutPO.length === 1 ? ' has' : 's have'} no PO yet.\n${bullets([
        ...m.data.lateAgainstNeedDate.slice(0, 3).map((x) => `${x.id} ${x.item}: ${x.daysLate ?? '?'} days late (${x.vendor}).`),
        ...m.data.withoutPO.slice(0, 2).map((x) => `${x.id} ${x.item}: ${x.leadWeeks}-week lead, ${x.status.replace('-', ' ')}.`),
      ])}`;
    },
  },
  {
    id: 'safety',
    words: ['safety', 'lti', 'incident', 'near miss', 'hse', 'ncr', 'quality', 'non-conformance'],
    run: async (_q, _c, read) => {
      const s = await read('get_quality_safety');
      const d = s.data;
      return `**${d.ltiFreeDays} days LTI-free**; ${d.nearMissesThisTA} near misses this TA (${d.highPotential} high-potential). ${d.ncrs.open} of ${d.ncrs.total} NCRs are open.\n${bullets([
        ...d.openSafetyIssues.slice(0, 2).map((i) => `${i.type}: ${i.title} (${i.area}, ${i.severity}).`),
        ...d.ncrs.criticalOrMajorOpen.slice(0, 2).map((n) => `${n.id} ${n.title} (${n.severity}, ${n.status.toLowerCase()}).`),
      ])}`;
    },
  },
  {
    id: 'shift',
    words: ['shift', 'handover', 'night shift', 'day shift', 'handing over'],
    run: async (_q, _c, read) => {
      const d = (await read('get_shift_handover')).data;
      if (!d.shift) return 'No shift handover has been logged yet.';
      const done = d.completed ?? [];
      const wip = d.inProgress ?? [];
      const issues = d.issues ?? [];
      return `**${d.shift}** handed over by ${d.outgoing} to ${d.incoming}, ${d.carryOverItems} carry-over items.\n${bullets([`Completed: ${done.slice(0, 3).join('; ')}.`, wip.length ? `In progress: ${wip.slice(0, 2).join('; ')}.` : '', issues.length ? `Issues: ${issues.slice(0, 2).join('; ')}.` : ''])}`;
    },
  },
  {
    id: 'integrations',
    words: ['sap', 'p6', 'primavera', 'integration', 'sync', 'interface'],
    run: async (_q, _c, read) => {
      const i = await read('get_integrations');
      return `SAP stand-in: ${i.data.sap}; P6 stand-in: ${i.data.p6}. ${i.data.errorQueue} message${i.data.errorQueue === 1 ? '' : 's'} in the error queue. ${i.data.note}\n${bullets(i.data.recentMessages.slice(0, 3).map((m) => `${m.system} ${m.direction.toLowerCase()}: ${m.object} ${m.key} (${m.status}).`))}`;
    },
  },
  {
    id: 'scope',
    words: ['scope', 'worklist', 'gate', 'approval', 'approve', 'pending', 'items'],
    run: async (_q, _c, read) => {
      const s = await read('get_scope', { status: 'pending', search: '' });
      const t = s.data.totals;
      return `The worklist has **${t.items} scope items**: ${t.approved} approved, ${t.pending} pending, ${t.rejectedOrDiverted} rejected or diverted; live estimate ${t.liveEstimate}, ${t.liveManhours.toLocaleString()} man-hours.\n${bullets([
        `Waiting: gate 1 ${s.data.pendingByGate.gate1}, gate 2 ${s.data.pendingByGate.gate2}, gate 3 ${s.data.pendingByGate.gate3}.`,
        ...s.data.items.slice(0, 3).map((j) => `${j.id} ${j.description} (${j.status}, ${j.estimate}).`),
      ])}`;
    },
  },
];

const HELP = 'On-device mode answers questions about the critical path and what is blocking it, finish-date risk, duplicates in the scope, budget and scope growth, readiness, materials, safety and quality, the last shift handover and the SAP / P6 integration. Try one of the suggestions. (Connect the language model in .env.local for open questions.)';

export async function answerOffline(question: string, ctx: ToolContext): Promise<OfflineAnswer> {
  const q = question.toLowerCase();
  let best: (typeof INTENTS)[number] | undefined;
  let score = 0;
  for (const it of INTENTS) {
    const s = it.words.reduce((n, w) => n + (q.includes(w) ? w.length : 0), 0);
    if (s > score) {
      score = s;
      best = it;
    }
  }
  if (!best) return { text: HELP, pages: [], steps: [] };
  const pages = new Map<string, { to: string; label: string }>();
  const steps: AgentStep[] = [];
  const read = (async (k: keyof Impl, input: Record<string, string> = {}) => {
    const r = await (TOOL_IMPL[k] as (i: Record<string, string>, c: ToolContext) => Promise<{ page: { to: string; label: string } }>)(input, ctx);
    pages.set(r.page.to, r.page);
    if (!steps.some((s) => s.tool === k)) steps.push({ tool: k, label: TOOL_LABEL[k] ?? k, ok: true });
    return r;
  }) as Use;
  const text = await best.run(question, ctx, read);
  return { text, pages: [...pages.values()], steps };
}
