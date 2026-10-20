// Tools the TURNPOINT assistant can call. Each one reads the same live services the screens use, so an answer is
// grounded in what the user can see (and changes when the data changes). Role-based access is enforced HERE, in code:
// for the contractor role, cost fields are removed before anything reaches the model (SOW 4.17), not left to a prompt.
import type Anthropic from '@anthropic-ai/sdk';
import { getCriticalPathActivities, getCpDailyChanges, getNearCritical } from '../../services/criticalPathService';
import { getRiskForecast } from '../../services/predictionService';
import { getJobs } from '../../services/jobsService';
import { checkCandidate, getScopeFindings } from '../../services/duplicateService';
import { getBudgetLines } from '../../services/budgetService';
import { listVariations, summarise } from '../../services/scopeService';
import { getSCFs } from '../../services/scfService';
import { getChangeRequests } from '../../services/changeService';
import { getDiscoveryJobs } from '../../services/discoveryService';
import { getTracked } from '../../services/procurementService';
import { getMaterials } from '../../services/materialsService';
import { listIssues, listNcrs } from '../../services/qualityService';
import { getReadiness } from '../../services/readinessService';
import { listShifts } from '../../services/executionService';
import { getHubState, getPresence } from '../../services/integrationService';
import { getSafetyStats } from '../../services/dashboardService';
import { dayToDate, shortDate, STATUS_DAY, TA_DAYS } from '../../mocks/_gen';
import { OMR_PER_USD } from '../../mocks/master';
import type { ViewRole } from '../../app/roleTypes';

export interface ToolContext {
  role: ViewRole;
}

export interface ToolResult {
  data: unknown;
  /** Page that shows the same data, offered to the user as a link. */
  page: { to: string; label: string };
}

const day = (d: number) => shortDate(dayToDate(Math.round(d)));
const omrK = (v: number) => `OMR ${Math.round(v / 1000).toLocaleString()}K`;
const RESTRICTED = 'restricted for the contractor role';

// Strict schemas: additionalProperties false + every property required, so inputs are always schema-valid.
const obj = (properties: Record<string, unknown>): Anthropic.Beta.BetaTool['input_schema'] => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

export const TOOL_DEFS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'get_schedule',
    description: 'Critical path activities (CP1 R-101 reactor, CP2 E-204 exchanger, CP3 C-301 compressor) with status, planned and forecast finish, total float and change count; how many times the critical path changed this TA and today; near-critical activities; baseline and forecast TA end. Use for questions about the schedule, delays, the critical path, what is blocking a path, or the finish date.',
    input_schema: obj({ path: { type: 'string', enum: ['all', 'CP1', 'CP2', 'CP3'], description: 'Which path to return activities for' } }),
    strict: true,
  },
  {
    name: 'get_risk_forecast',
    description: 'Output of the AI risk model: chance of finishing by the schedule forecast, P10/P50/P90 finish dates from 2,000 simulations, slip risk per critical path, the riskiest activities with the signals that drive them, and the recommended actions with their modelled effect. Use for risk, prediction, probability, forecast confidence, and what to do about delays.',
    input_schema: obj({}),
    strict: true,
  },
  {
    name: 'get_scope',
    description: 'Turnaround scope items (worklist): counts by status and gate, live estimate and man-hours roll-up, and matching items. Use for scope, worklist, approvals pending at each gate, and finding scope on an equipment tag.',
    input_schema: obj({
      status: { type: 'string', enum: ['all', 'pending', 'approved', 'rejected'], description: 'Filter by status' },
      search: { type: 'string', description: 'Text or equipment tag to match, or empty for no text filter' },
    }),
    strict: true,
  },
  {
    name: 'find_duplicate_scope',
    description: 'Run the AI duplicate scope detector. With an empty description it scans the live worklist and returns duplicate pairs (same work raised twice) and bundling opportunities (same equipment and window, different work) with probabilities, reasons and savings. With a description it checks that proposed work against the worklist.',
    input_schema: obj({ description: { type: 'string', description: 'Proposed work to check, e.g. "Weld build-up on R-101 outlet nozzle", or empty to scan the worklist' } }),
    strict: true,
  },
  {
    name: 'get_budget',
    description: 'Budget control: approved budget, committed, actual and forecast at completion, the Sub-WBS lines with the largest forecast overrun, and scope growth from variations before and after the freeze.',
    input_schema: obj({}),
    strict: true,
  },
  {
    name: 'get_change_control',
    description: 'Change control: scope change requests (SCFs) with their approval route under the USD 75K rule and status, MOCs by state, and discovery jobs found on site.',
    input_schema: obj({}),
    strict: true,
  },
  {
    name: 'get_materials',
    description: 'Materials and procurement: purchase orders arriving after their need date, lines without a PO, and long-lead items.',
    input_schema: obj({}),
    strict: true,
  },
  {
    name: 'get_quality_safety',
    description: 'Safety and quality: LTI-free days, near misses, open safety issues, and open NCRs by severity.',
    input_schema: obj({}),
    strict: true,
  },
  {
    name: 'get_readiness',
    description: 'Overall STO readiness: composite score, component scores and the open gaps that would raise it most.',
    input_schema: obj({}),
    strict: true,
  },
  {
    name: 'get_shift_handover',
    description: 'The latest day / night shift handover: completed work, work in progress, issues, safety notes and carry-over items.',
    input_schema: obj({}),
    strict: true,
  },
  {
    name: 'get_integrations',
    description: 'SAP S/4HANA and Primavera P6 integration status: whether the stand-in consoles are connected, recent messages in both directions, and the error queue.',
    input_schema: obj({}),
    strict: true,
  },
];

type Exec = (input: Record<string, string>, ctx: ToolContext) => Promise<ToolResult>;

/** Tool implementations, typed (the on-device engine reads their data directly). */
export const TOOL_IMPL = {
  async get_schedule({ path }) {
    const [acts, daily, near, f] = await Promise.all([getCriticalPathActivities(), getCpDailyChanges(), getNearCritical(), getRiskForecast()]);
    const list = acts.filter((a) => path === 'all' || a.path === path);
    return {
      page: { to: '/critical-path', label: 'Open Critical Path' },
      data: {
        dataDate: `${day(STATUS_DAY)} (TA day ${STATUS_DAY} of ${TA_DAYS})`,
        baselineEnd: day(TA_DAYS),
        scheduleForecastEnd: day(f.sim.forecastEnd),
        criticalPathChanges: { thisTA: daily.reduce((s, d) => s + d.changes, 0), today: daily[daily.length - 1]?.changes ?? 0, recent: daily.filter((d) => d.note).slice(-4).map((d) => `Day ${d.day}: ${d.note}`) },
        activities: list.map((a) => ({ id: a.id, name: a.name, path: a.path, status: a.status, plannedFinish: shortDate(a.plannedFinish), forecastFinish: shortDate(a.forecastFinish), totalFloatDays: a.floatDays, timesChanged: a.changeCount, predecessors: a.predecessors, owner: a.owner, crew: a.resource })),
        nearCritical: near.map((n) => ({ id: n.id, name: n.name, floatDays: n.floatDays, driver: n.driver })),
      },
    };
  },

  async get_risk_forecast(_i, ctx) {
    const f = await getRiskForecast();
    const s = f.sim;
    const cost = ctx.role !== 'contractor';
    return {
      page: { to: '/ai-panel?tab=risk', label: 'Open AI risk prediction' },
      data: {
        method: 'Logistic slip model per activity (9 live signals) + 2,000-run Monte Carlo over the CP1/CP2/CP3 network',
        scheduleForecast: day(s.forecastEnd),
        chanceOfMeetingScheduleForecast: `${Math.round(s.pMeetForecast * 100)}%`,
        aiFinish: { p10: day(s.p10), p50: day(s.p50), p80: day(s.p80), p90: day(s.p90) },
        slipRiskByPath: Object.fromEntries((['CP1', 'CP2', 'CP3'] as const).map((p) => [p, `${Math.round(s.path[p].slipRisk * 100)}%`])),
        expectedCostOfDelay: cost ? omrK(f.exposureOMR) : RESTRICTED,
        riskiestActivities: [...f.activities].sort((a, b) => b.p - a.p).slice(0, 5).map((a) => ({
          id: a.id,
          name: a.name,
          path: a.path,
          slipProbability: `${Math.round(a.p * 100)}%`,
          becomesCritical: a.becomesCritical !== undefined ? `${Math.round(a.becomesCritical * 100)}%` : undefined,
          drivers: a.drivers.filter((d) => d.contrib > 0.1).slice(0, 3).map((d) => d.label),
          linkedRecords: a.evidence.slice(0, 3),
        })),
        recommendedActions: f.mitigations.slice(0, 4).map((m) => ({
          id: m.id,
          action: m.title,
          owner: m.owner,
          accepted: m.accepted,
          effect: `chance of forecast ${m.deltaMeet >= 0 ? '+' : ''}${Math.round(m.deltaMeet * 100)} pts, P50 ${m.deltaP50 <= 0 ? '' : '+'}${m.deltaP50.toFixed(1)} d`,
          cost: cost ? (m.costOMR ? omrK(m.costOMR) : 'no direct cost') : RESTRICTED,
          expectedDelayCostAvoided: cost ? omrK(Math.max(0, -m.deltaExposureOMR)) : RESTRICTED,
        })),
      },
    };
  },

  async get_scope({ status, search }, ctx) {
    const jobs = await getJobs();
    const cost = ctx.role !== 'contractor';
    const q = (search ?? '').toLowerCase().trim();
    const match = jobs.filter((j) => (status === 'all' || j.status === status) && (!q || `${j.id} ${j.desc} ${j.tag} ${j.area} ${j.sapRef ?? ''}`.toLowerCase().includes(q)));
    const active = jobs.filter((j) => j.status !== 'rejected');
    const pending = jobs.filter((j) => j.status === 'pending');
    return {
      page: { to: q ? '/scope' : status === 'pending' ? '/scope?tab=approvals' : '/scope', label: status === 'pending' ? 'Open 3-gate approvals' : 'Open Scope & Worklist' },
      data: {
        totals: { items: jobs.length, approved: jobs.filter((j) => j.status === 'approved').length, pending: pending.length, rejectedOrDiverted: jobs.filter((j) => j.status === 'rejected').length, liveEstimate: cost ? omrK(active.reduce((s, j) => s + j.costOMR, 0)) : RESTRICTED, liveManhours: active.reduce((s, j) => s + j.manhours, 0) },
        pendingByGate: { gate1: pending.filter((j) => j.gate === 1).length, gate2: pending.filter((j) => j.gate === 2).length, gate3: pending.filter((j) => j.gate === 3).length },
        items: match.slice(0, 12).map((j) => ({ id: j.id, description: j.desc, tag: j.tag, area: j.area, discipline: j.discipline, status: j.status === 'pending' ? `pending at gate ${j.gate}` : j.status, source: j.source, estimate: cost ? omrK(j.costOMR) : RESTRICTED, manhours: j.manhours })),
        matched: match.length,
      },
    };
  },

  async find_duplicate_scope({ description }, ctx) {
    const cost = ctx.role !== 'contractor';
    if (description && description.trim().length >= 8) {
      const m = await checkCandidate({ desc: description, tag: '', area: '', discipline: '' });
      return {
        page: { to: '/scope', label: 'Open Scope & Worklist' },
        data: { checked: description, matches: m.map((p) => ({ kind: p.kind, probability: `${Math.round(p.probability * 100)}%`, existingItem: p.b.id, existingDescription: p.b.desc, reasons: p.reasons })), note: m.length ? undefined : 'No duplicate or shared work front found in the live worklist.' },
      };
    }
    const scan = await getScopeFindings();
    return {
      page: { to: '/scope', label: 'Open duplicate detection' },
      data: {
        method: 'Pairwise classifier on text similarity and equipment / component / work type / mechanism agreement, trained on labelled pairs',
        scanned: `${scan.scannedItems} active items, ${scan.scannedPairs} pairs in ${scan.ms} ms`,
        findings: scan.findings.map((f) => ({
          kind: f.kind,
          probability: f.kind === 'duplicate' ? `${Math.round(f.probability * 100)}%` : undefined,
          keep: `${f.keep.id} ${f.keep.desc}`,
          other: `${f.drop.id} ${f.drop.desc}`,
          reasons: f.reasons.slice(0, 5),
          evidence: f.evidence,
          saving: cost ? `${omrK(f.saving.omr)}, ${f.saving.manhours} man-hours` : `${f.saving.manhours} man-hours`,
        })),
      },
    };
  },

  async get_budget(_i, ctx) {
    if (ctx.role === 'contractor') return { page: { to: '/budget', label: 'Open Budget' }, data: { restricted: 'Budget and cost figures are restricted to OQ staff (SOW 4.17 role-based access).' } };
    const [lines, vars] = await Promise.all([getBudgetLines(), listVariations()]);
    const sum = (k: 'plannedOMR' | 'committedOMR' | 'actualOMR' | 'forecastOMR') => lines.reduce((s, l) => s + l[k], 0);
    const v = summarise(vars);
    return {
      page: { to: '/budget', label: 'Open Budget Control' },
      data: {
        approvedBudget: omrK(sum('plannedOMR')),
        committed: omrK(sum('committedOMR')),
        actualSpent: omrK(sum('actualOMR')),
        forecastAtCompletion: omrK(sum('forecastOMR')),
        forecastVsBudget: `${(((sum('forecastOMR') - sum('plannedOMR')) / sum('plannedOMR')) * 100).toFixed(1)}%`,
        largestOverruns: [...lines].sort((a, b) => b.forecastOMR - b.plannedOMR - (a.forecastOMR - a.plannedOMR)).slice(0, 4).map((l) => ({ subWbs: l.subWbs, overrun: omrK(l.forecastOMR - l.plannedOMR), pct: `${(((l.forecastOMR - l.plannedOMR) / l.plannedOMR) * 100).toFixed(1)}%` })),
        scopeGrowth: { baseEstimate: omrK(v.base), approvedVariations: `${v.approvedCount} (${omrK(v.approvedNet)})`, beforeFreeze: omrK(v.approvedPre), afterFreeze: omrK(v.approvedPost), pending: `${v.pendingCount} (${omrK(v.pendingValue)})` },
      },
    };
  },

  async get_change_control(_i, ctx) {
    const [scfs, mocs, djs] = await Promise.all([getSCFs(), getChangeRequests(), getDiscoveryJobs()]);
    const cost = ctx.role !== 'contractor';
    return {
      page: { to: '/scf', label: 'Open SCF & Additional Work' },
      data: {
        rule: 'SCF under USD 75K and within the mechanical window: TA Event Manager approves; above USD 75K or longer than the window: Head of Turnaround Services',
        scfs: scfs.map((s) => ({ id: s.id, title: s.title, status: s.status, routesTo: s.approver, cost: cost ? `USD ${Math.round(s.costUSD / 1000)}K (OMR ${Math.round((s.costUSD * OMR_PER_USD) / 1000)}K)` : RESTRICTED, durationDays: s.durationDays, exceedsWindow: s.exceedsWindow })),
        mocsByState: mocs.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.state]: (acc[m.state] ?? 0) + 1 }), {}),
        discoveryJobs: djs.map((d) => ({ id: d.id, description: d.desc, state: d.state, area: d.area })),
      },
    };
  },

  async get_materials() {
    const [tracked, items] = await Promise.all([getTracked(), getMaterials()]);
    return {
      page: { to: '/material-tracking', label: 'Open Material Tracking' },
      data: {
        lateAgainstNeedDate: tracked.filter((t) => t.late).map((t) => ({ id: t.item.id, item: t.item.description, daysLate: t.marginDays === null ? null : -t.marginDays, vendor: t.line.vendor })),
        withoutPO: items.filter((m) => m.prStatus === 'not-raised' || m.prStatus === 'raised').map((m) => ({ id: m.id, item: m.description, leadWeeks: m.leadWeeks, status: m.prStatus })).slice(0, 8),
        longLeadOpen: items.filter((m) => m.leadTime === 'long' && m.prStatus !== 'delivered').length,
      },
    };
  },

  async get_quality_safety() {
    const [issues, ncrs, safety] = await Promise.all([listIssues(), listNcrs(), getSafetyStats()]);
    const openNcr = ncrs.filter((n) => n.status !== 'Closed');
    return {
      page: { to: '/issues', label: 'Open Issues & Safety' },
      data: {
        ltiFreeDays: safety.ltiDays,
        nearMissesThisTA: safety.nearMisses,
        highPotential: safety.highPotential,
        openSafetyIssues: issues.filter((i) => i.status !== 'Closed' && i.status !== 'Resolved').slice(0, 6).map((i) => ({ title: i.title, type: i.type, severity: i.severity, area: i.area })),
        ncrs: { total: ncrs.length, open: openNcr.length, criticalOrMajorOpen: openNcr.filter((n) => n.severity !== 'Minor').map((n) => ({ id: n.id, title: n.title, tag: n.tag, severity: n.severity, status: n.status })) },
      },
    };
  },

  async get_readiness() {
    const r = await getReadiness();
    return {
      page: { to: '/readiness', label: 'Open STO Readiness' },
      data: {
        composite: `${r.composite}%`,
        components: r.components.map((c) => ({ name: c.name, score: `${Math.round(c.effective)}%`, weight: c.weight })),
        topGaps: r.gaps.filter((g) => !g.closed).slice(0, 6).map((g) => ({ id: g.id, gap: g.title, owner: g.owner, due: shortDate(g.due), lift: `+${g.lift} pts on ${g.component}` })),
      },
    };
  },

  async get_shift_handover() {
    const shifts = await listShifts();
    const last = [...shifts].sort((a, b) => b.day - a.day || (a.shift === 'Night' ? -1 : 1))[0];
    return {
      page: { to: '/shift-log', label: 'Open Shift Log' },
      data: last ? { shift: `Day ${last.day} ${last.shift}`, outgoing: last.outgoing, incoming: last.incoming, completed: last.completed, inProgress: last.inProgress, issues: last.issues, safety: last.safety, carryOverItems: last.carryOver, signedOut: last.signedOut, takenOver: last.takenOver } : { note: 'No handover logged' },
    };
  },

  async get_integrations() {
    const hub = getHubState();
    const presence = getPresence();
    const seen = (t?: number) => (t && Date.now() - t < 5 * 60_000 ? 'connected (console open)' : 'console not open');
    return {
      page: { to: '/integrations?tab=live', label: 'Open Integration Hub' },
      data: {
        note: 'SAP and P6 here are demo stand-in consoles exchanging messages with TURNPOINT; there is no connection to the client systems.',
        sap: seen(presence.SAP),
        p6: seen(presence.P6),
        recentMessages: hub.messages.slice(0, 8).map((m) => ({ system: m.system, direction: m.direction, object: m.object, key: m.key, status: m.status, note: m.note })),
        errorQueue: hub.messages.filter((m) => m.status === 'Failed' || m.status === 'Retrying').length,
      },
    };
  },
} satisfies Record<string, Exec>;

export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolResult> {
  const exec = (TOOL_IMPL as Record<string, Exec>)[name];
  if (!exec) throw new Error(`Unknown tool ${name}`);
  return exec((input ?? {}) as Record<string, string>, ctx);
}

/** Human-readable label for the tool steps shown in the chat. */
export const TOOL_LABEL: Record<string, string> = {
  get_schedule: 'Read the critical path',
  get_risk_forecast: 'Ran the risk model',
  get_scope: 'Read the scope worklist',
  find_duplicate_scope: 'Ran duplicate detection',
  get_budget: 'Read budget control',
  get_change_control: 'Read SCFs, MOCs and discovery jobs',
  get_materials: 'Read material tracking',
  get_quality_safety: 'Read safety and quality',
  get_readiness: 'Read STO readiness',
  get_shift_handover: 'Read the shift log',
  get_integrations: 'Read SAP / P6 integration',
};
