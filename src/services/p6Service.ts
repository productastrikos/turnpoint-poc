// SIMULATED Primavera P6 round trip: import a sample XER, apply field updates, recalculate ALU/RLU/forecast, export a generated XER.
import { P6_CALENDARS, P6_PROJECT, P6_RESOURCES, P6_WBS } from '../mocks/integrationMock';
import { fieldUpdates, plannedPct, scheduleActivities } from '../mocks/scheduleMock';
import { criticalPathActivities, nearCritical } from '../mocks/criticalPathMock';
import { STATUS_DAY, dayToDate } from '../mocks/_gen';
import { actualPctAt, plannedPctAt } from '../mocks/progress';
import { delay } from './_util';
import { logMessage, markP6Import, pushP6Progress, sendToSystems } from './integrationService';
import { recordCpChange } from './criticalPathService';
import type { ScheduleActivity } from '../types/execution';

export async function getImportSummary() {
  markP6Import(P6_PROJECT.activities);
  logMessage({ system: 'P6', direction: 'Inbound', object: 'XER import', key: P6_PROJECT.file, status: 'Delivered', latencyMs: 2410, channel: 'XER file', note: `${P6_PROJECT.activities.toLocaleString()} activities, ${P6_PROJECT.relationships.toLocaleString()} relationships, ${P6_PROJECT.resources} resources imported` });
  return delay({ ...P6_PROJECT, calendarList: P6_CALENDARS, wbs: P6_WBS }, 1400);
}

export interface PreviewRow {
  p6Id: string;
  name: string;
  wbs: string;
  calendar: ScheduleActivity['calendar'];
  start: string;
  finish: string;
  duration: number;
  pct: number;
  blu: number;
  resources: string;
  constraint: string;
  cp?: string;
}

const WBS_FOR_AREA: Record<string, string> = { 'Unit 100': '2', 'Unit 200': '3', 'Unit 220': '4', 'Unit 250': '5', 'Unit 300': '6', 'Pipe Rack 4': '7', 'Flare System': '7' };
const RES_FOR_DISC: Record<string, string> = {
  Inspection: 'L-INSP, L-NDT',
  'Rotating Equipment': 'L-MW, L-RIG, N-CR80',
  Process: 'L-PF, L-WLD, L-FOR',
  Instrumentation: 'L-IT, L-FOR',
  Civil: 'L-SCF, L-REF, N-MAN',
  Electrical: 'L-EL, N-GEN',
};

export async function getPreviewRows(): Promise<PreviewRow[]> {
  const rows = scheduleActivities.map<PreviewRow>((a) => ({
    p6Id: a.p6Id,
    name: a.name,
    wbs: `${WBS_FOR_AREA[a.area] ?? '1'}.${a.p6Id.slice(-2)}`,
    calendar: a.calendar,
    start: dayToDate(a.startDay),
    finish: dayToDate(a.endDay),
    duration: a.endDay - a.startDay + 1,
    pct: a.pct,
    blu: a.bluHours,
    resources: RES_FOR_DISC[a.discipline] ?? 'L-FOR',
    constraint: a.cp ? 'Finish No Later Than' : a.startDay <= 1 ? 'Start On' : '-',
    cp: a.cp,
  }));
  return delay(rows, 200);
}

export function getResources() {
  return P6_RESOURCES;
}

export interface FieldUpdateRow {
  activity: ScheduleActivity;
  pct: number;
  by: string;
  at: string;
  via: string;
}

// field updates received since the last sync; the mobile app appends to this list when its queue syncs
let updates = fieldUpdates.map((u) => ({ ...u }));

export function addFieldUpdate(activityId: string, pct: number, by: string, via: string) {
  const at = `2026-08-16T08:${String(10 + updates.length).padStart(2, '0')}:00`;
  updates = [...updates.filter((u) => u.activityId !== activityId), { activityId, pct, by, at, via }];
  sendToSystems({ type: 'tp.progress', tpId: activityId, pct, by, via });
}

export async function getFieldUpdates(): Promise<FieldUpdateRow[]> {
  return delay(
    updates.map((u) => ({ activity: scheduleActivities.find((a) => a.id === u.activityId)!, pct: u.pct, by: u.by, at: u.at, via: u.via })),
    250
  );
}

export interface RecalcRow {
  id: string;
  p6Id: string;
  name: string;
  plannedPct: number;
  actualPct: number;
  blu: number;
  alu: number;
  rlu: number;
  atCompletion: number;
  remainingDur: number;
  plannedEnd: string;
  estEnd: string;
  delayGain: number; // + = delay, - = gain (days)
  successors: { p6Id: string; name: string; shift: number }[];
}

const SUCCESSORS: Record<string, string[]> = {
  'ACT-231': ['ACT-203'],
  'ACT-318': ['ACT-806'],
  'ACT-401': ['ACT-402'],
  'ACT-502': ['ACT-503'],
};

function efficiency(id: string): number {
  const n = id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return 1 + ((n % 7) - 2) / 50; // 0.96 .. 1.08
}

export function recalcRow(a: ScheduleActivity, pct: number): RecalcRow {
  const dur = a.endDay - a.startDay + 1;
  const p = pct / 100;
  const blu = a.bluHours;
  const alu = Math.round(blu * p * efficiency(a.id));
  const rlu = Math.round(blu * (1 - p));
  const remainingDur = Math.ceil((1 - p) * dur); // SOW dry-run #12
  const estEndDay = STATUS_DAY + remainingDur; // est. end = data date + remaining duration
  const delayGain = estEndDay - a.endDay;
  const successors = (SUCCESSORS[a.id] ?? [])
    .map((sid) => scheduleActivities.find((s) => s.id === sid))
    .filter((s): s is ScheduleActivity => Boolean(s))
    .map((s) => ({ p6Id: s.p6Id, name: s.name, shift: delayGain }));
  return {
    id: a.id,
    p6Id: a.p6Id,
    name: a.name,
    plannedPct: plannedPct(a),
    actualPct: pct,
    blu,
    alu,
    rlu,
    atCompletion: alu + rlu,
    remainingDur,
    plannedEnd: dayToDate(a.endDay),
    estEnd: dayToDate(estEndDay),
    delayGain,
    successors,
  };
}

export interface RecalcResult {
  rows: RecalcRow[];
  newlyCritical: { id: string; name: string; floatBefore: number; floatAfter: number }[];
  cpChangeCount: number;
  assetEnds: { asset: string; endTask: string; shift: number }[];
  totals: { blu: number; alu: number; rlu: number };
  scurve: { day: number; planned: number; before: number; after: number | null }[];
}

export async function recalculate(): Promise<RecalcResult> {
  const rows = updates.map((u) => recalcRow(scheduleActivities.find((a) => a.id === u.activityId)!, u.pct));
  const newlyCritical = nearCritical
    .map((n) => {
      const r = rows.find((x) => x.id === n.id);
      const shift = r ? r.delayGain : 0;
      return { id: n.id, name: n.name, floatBefore: n.floatDays, floatAfter: n.floatDays - shift };
    })
    .filter((n) => n.floatBefore > 0 && n.floatAfter <= 0);
  const totals = rows.reduce((s, r) => ({ blu: s.blu + r.blu, alu: s.alu + r.alu, rlu: s.rlu + r.rlu }), { blu: 0, alu: 0, rlu: 0 });
  const assetEnds = [
    { asset: 'T-201 Atmospheric Column', endTask: 'CDU-1030 trays re-installation & box-up', shift: rows.find((r) => r.id === 'ACT-231')?.delayGain ?? 0 },
    { asset: 'K-301 Main Air Blower', endTask: 'SUP-1060 blower run-in & start', shift: rows.find((r) => r.id === 'ACT-318')?.delayGain ?? 0 },
    { asset: 'T-251 Vacuum Column', endTask: 'VDU-1020 packing installation', shift: rows.find((r) => r.id === 'ACT-401')?.delayGain ?? 0 },
    { asset: 'R-301 FCC Regenerator', endTask: 'FCC-1030 refractory dry-out', shift: rows.find((r) => r.id === 'ACT-502')?.delayGain ?? 0 },
  ];
  const scurve = Array.from({ length: 33 }, (_, day) => {
    const planned = plannedPctAt(day);
    const before = actualPctAt(day);
    // after recalculation the status-day actual moves because ALU is now computed from entered progress
    const after = day <= 14 ? (day === 14 ? Math.max(0, before - 1) : before) : null;
    return { day, planned, before, after };
  });
  return delay({ rows, newlyCritical, cpChangeCount: newlyCritical.length > 0 ? 1 : 0, assetEnds, totals, scurve }, 1100);
}

let committed = false;
/** Writes the recalculation result into the app: logs the CP change once and queues the P6 messages. */
export async function commitRecalc(result: RecalcResult): Promise<{ cpChanged: boolean }> {
  if (committed) return { cpChanged: false };
  committed = true;
  if (result.newlyCritical.length > 0) {
    await recordCpChange(`P6 recalculation: ${result.newlyCritical.map((n) => n.id).join(', ')} became critical`);
  }
  return { cpChanged: result.newlyCritical.length > 0 };
}

// ---------------------------------------------------------------- generated XER

function tab(...cols: (string | number)[]): string {
  return cols.join('\t');
}

/** Build a small but structurally plausible XER text file. Clearly named SIMULATED. */
export function buildXer(): string {
  const dd = `${P6_PROJECT.dataDate} 08:00`;
  const lines: string[] = [];
  lines.push(tab('ERMHDR', '24.12', P6_PROJECT.dataDate, 'Project', 'turnpoint_sim', 'TURNPOINT STO Platform (SIMULATED EXPORT)', 'dbxDatabaseNoName', 'Project Management', 'USD'));
  lines.push('%T\tPROJECT');
  lines.push(tab('%F', 'proj_id', 'proj_short_name', 'last_recalc_date', 'plan_start_date', 'scd_end_date'));
  lines.push(tab('%R', 1001, P6_PROJECT.project, dd, '2026-08-03 06:00', '2026-09-03 18:00'));
  lines.push('%T\tCALENDAR');
  lines.push(tab('%F', 'clndr_id', 'clndr_name', 'day_hr_cnt', 'week_hr_cnt'));
  P6_CALENDARS.forEach((c, i) => lines.push(tab('%R', 2001 + i, c.name, c.name.startsWith('12h') ? 12 : c.name === '7-day' ? 24 : 9, c.name === '5-day' ? 45 : 84)));
  lines.push('%T\tTASK');
  lines.push(tab('%F', 'task_id', 'task_code', 'task_name', 'status_code', 'phys_complete_pct', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt', 'act_start_date', 'act_end_date', 'target_start_date', 'target_end_date', 'target_work_qty', 'act_work_qty', 'remain_work_qty', 'wo_ref'));
  const updated = new Map(updates.map((u) => [u.activityId, u.pct]));
  scheduleActivities.slice(0, 40).forEach((a, i) => {
    const pct = updated.get(a.id) ?? a.pct;
    const r = recalcRow(a, pct);
    const status = pct >= 100 ? 'TK_Complete' : pct > 0 ? 'TK_Active' : 'TK_NotStart';
    const dur = (a.endDay - a.startDay + 1) * 12;
    const actStart = pct > 0 ? `${dayToDate(a.startDay)} 06:00` : '';
    const actEnd = pct >= 100 ? `${dayToDate(a.endDay)} 18:00` : '';
    lines.push(tab('%R', 5001 + i, a.p6Id, a.name, status, pct, dur, Math.ceil((1 - pct / 100) * dur), actStart, actEnd, `${dayToDate(a.startDay)} 06:00`, `${dayToDate(a.endDay)} 18:00`, a.bluHours, r.alu, r.rlu, a.sapWo ?? ''));
  });
  lines.push('%T\tTASKPRED');
  lines.push(tab('%F', 'task_pred_id', 'task_id', 'pred_task_id', 'pred_type', 'lag_hr_cnt'));
  criticalPathActivities.forEach((a, i) => a.predecessors.forEach((p, j) => lines.push(tab('%R', 9001 + i * 3 + j, a.id, p, 'PR_FS', 0))));
  lines.push('%T\tRSRC');
  lines.push(tab('%F', 'rsrc_id', 'rsrc_short_name', 'rsrc_name', 'rsrc_type'));
  P6_RESOURCES.slice(0, 12).forEach((r, i) => lines.push(tab('%R', 7001 + i, r.id, r.name, r.type === 'Labour' ? 'RT_Labor' : 'RT_Equip')));
  lines.push('%E');
  return lines.join('\n') + '\n';
}

export const EXPORT_FILENAME = 'OQ_Sohar_TA2026_Updated_SIMULATED.xer';

export async function logExport(rowCount: number) {
  pushP6Progress(P6_PROJECT.project, `Updated XER exported: ${rowCount} activities with actual timestamps, progress, remaining duration, ALU and RLU`);
  logMessage({ system: 'P6', direction: 'Outbound', object: 'XER export', key: EXPORT_FILENAME, status: 'Delivered', latencyMs: 1810, channel: 'XER file', note: 'Generated sample file, not a real P6 export' });
  return delay(true, 300);
}
