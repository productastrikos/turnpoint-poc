// Broken / missing tools service. In-memory, REST-shaped. Reports arrive from the mobile app (see mobileService.sync),
// from the tool crib, or from the office, and are followed to replacement.
import { createCollection } from './_collection';
import {
  CRIB_BY_TAG,
  SIMULATED_REPORTS,
  hoursBetween,
  isCriticalActivity,
  scenarioNow,
  toolReportSeed,
  type ToolIssue,
  type ToolReport,
  type ToolSeverity,
  type ToolSource,
  type ToolStatus,
} from '../mocks/toolsMock';
import { scheduleActivities } from '../mocks/scheduleMock';

const store = createCollection<ToolReport>(toolReportSeed, 120);

// ---- change notification: pages reload on 'change', the tools page also toasts on 'received' ----
export type ToolsEvent = { type: 'change' } | { type: 'received'; report: ToolReport };
const listeners = new Set<(e: ToolsEvent) => void>();
const emit = (e: ToolsEvent) => listeners.forEach((l) => l(e));
export const subscribeTools = (fn: (e: ToolsEvent) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** Report ids that arrived from the phone during this session, so the live feed can mark them NEW. */
const freshIds = new Set<string>();
export const isFreshReport = (id: string) => freshIds.has(id);

export const listToolReports = () => store.list();

export interface ToolReportInput {
  toolTag: string;
  issue: ToolIssue;
  activityId: string;
  severity: ToolSeverity;
  reportedBy: string;
  reportedAt?: string;
  note: string;
  replacementRequested: boolean;
  photo?: string;
  source: ToolSource;
}

export async function addToolReport(input: ToolReportInput): Promise<ToolReport> {
  const tool = CRIB_BY_TAG[input.toolTag];
  const act = scheduleActivities.find((a) => a.id === input.activityId);
  if (!tool || !act) throw new Error('Unknown tool or activity');
  const now = scenarioNow();
  const id = store.nextId('TR-', 4);
  const report: ToolReport = {
    id,
    toolTag: tool.tag,
    toolName: tool.name,
    category: tool.category,
    contractor: act.contractor,
    reportedBy: input.reportedBy,
    reportedAt: input.reportedAt ?? now,
    receivedAt: now,
    issue: input.issue,
    activityId: act.id,
    p6Id: act.p6Id,
    activityName: act.name,
    critical: isCriticalActivity(act.id),
    severity: input.severity,
    status: 'Reported',
    replacementRequested: input.replacementRequested,
    note: input.note,
    photo: input.photo,
    source: input.source,
    history: [{ status: 'Raised', at: input.reportedAt ?? now, by: input.reportedBy }],
  };
  await store.add(report);
  if (input.source === 'Mobile app') freshIds.add(id);
  emit({ type: 'change' });
  if (input.source === 'Mobile app') emit({ type: 'received', report });
  return report;
}

const NEXT: Partial<Record<ToolStatus, ToolStatus>> = {
  Reported: 'Crib confirmed',
  'Crib confirmed': 'Replacement ordered',
  'Replacement ordered': 'Replaced',
};
const NEXT_LABEL: Record<string, string> = {
  Reported: 'Confirm at crib',
  'Crib confirmed': 'Order replacement',
  'Replacement ordered': 'Mark replaced',
};
export const nextToolAction = (r: ToolReport): string | null => (r.status === 'Replaced' || r.status === 'Written off' ? null : NEXT_LABEL[r.status] ?? null);

export async function advanceToolReport(id: string, by = 'Tool crib'): Promise<ToolReport> {
  const cur = (await store.list()).find((r) => r.id === id);
  const next = cur && NEXT[cur.status];
  if (!cur || !next) throw new Error('Nothing to advance');
  const at = scenarioNow();
  const patch: Partial<ToolReport> = {
    status: next,
    history: [...cur.history, { status: next, at, by: next === 'Replacement ordered' ? 'Procurement' : by }],
  };
  if (next === 'Replacement ordered') patch.eta = at.slice(0, 10) === '2026-08-16' ? '2026-08-18' : at.slice(0, 10);
  if (next === 'Replaced') patch.replacedAt = at;
  const out = await store.update(id, patch);
  emit({ type: 'change' });
  return out;
}

export async function writeOffTool(id: string): Promise<ToolReport> {
  const cur = (await store.list()).find((r) => r.id === id);
  if (!cur) throw new Error('Not found');
  const out = await store.update(id, { status: 'Written off', history: [...cur.history, { status: 'Written off', at: scenarioNow(), by: 'Tool crib' }] });
  emit({ type: 'change' });
  return out;
}

export function resetTools() {
  store.reset();
  freshIds.clear();
  emit({ type: 'change' });
}

// ---- simulated operator report ("as if sent from the phone") ----
let simSeq = 0;
export function nextSimulatedReport(): ToolReportInput & { label: string } {
  const s = SIMULATED_REPORTS[simSeq++ % SIMULATED_REPORTS.length];
  const tool = CRIB_BY_TAG[s.tag];
  return { toolTag: s.tag, issue: s.issue, activityId: s.activityId, severity: s.severity, reportedBy: s.by, note: s.note, replacementRequested: true, photo: `IMG_${2100 + simSeq}.jpg`, source: 'Mobile app', label: `${tool.name} ${s.issue.toLowerCase()}` };
}
export const resetSimulation = () => {
  simSeq = 0;
};

// ---- summary used by the page, the widget and anywhere else that shows the faulty list ----
export const isOpen = (r: ToolReport) => r.status !== 'Replaced' && r.status !== 'Written off';
const SEV_RANK: Record<ToolSeverity, number> = { High: 0, Medium: 1, Low: 2 };

export interface ToolsSummary {
  faulty: number; // broken, damaged or due calibration, still open
  missing: number;
  awaiting: number; // replacement requested and not yet replaced
  replaced: number;
  avgReplacementHrs: number | null;
  blockingCritical: number;
  lostCrewHrs: number;
  top: ToolReport[];
}

export function summarizeTools(rows: ToolReport[]): ToolsSummary {
  const open = rows.filter(isOpen);
  const done = rows.filter((r) => r.status === 'Replaced' && r.replacedAt);
  const now = scenarioNow();
  const crew = { High: 6, Medium: 3, Low: 1 } as const;
  return {
    faulty: open.filter((r) => r.issue !== 'Missing').length,
    missing: open.filter((r) => r.issue === 'Missing').length,
    awaiting: open.filter((r) => r.replacementRequested).length,
    replaced: done.length,
    avgReplacementHrs: done.length ? done.reduce((s, r) => s + hoursBetween(r.reportedAt, r.replacedAt!), 0) / done.length : null,
    blockingCritical: open.filter((r) => r.critical).length,
    lostCrewHrs: Math.round(open.filter((r) => r.severity !== 'Low').reduce((s, r) => s + hoursBetween(r.reportedAt, now) * crew[r.severity], 0)),
    top: [...open].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || Number(b.critical) - Number(a.critical) || a.reportedAt.localeCompare(b.reportedAt)).slice(0, 3),
  };
}

/** Human "how long ago" against the scenario clock. */
export function ago(iso: string): string {
  const h = hoursBetween(iso, scenarioNow());
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min ago`;
  if (h < 36) return `${Math.round(h)} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
