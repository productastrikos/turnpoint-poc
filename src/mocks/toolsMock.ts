// Broken / missing tools: the tool-crib catalogue and the seeded fault reports (PBC 03 #7, "Showcase tools faulty list in the dashboard").
// SIMULATED. Reports come from operators in the mobile app, are confirmed by the tool crib and followed to replacement.
import { scheduleActivities } from './scheduleMock';

export type ToolIssue = 'Broken' | 'Missing' | 'Needs calibration' | 'Damaged';
export type ToolSeverity = 'Low' | 'Medium' | 'High';
export type ToolStatus = 'Reported' | 'Crib confirmed' | 'Replacement ordered' | 'Replaced' | 'Written off';
export type ToolSource = 'Mobile app' | 'Tool crib' | 'Office';

export const TOOL_ISSUES: ToolIssue[] = ['Broken', 'Missing', 'Needs calibration', 'Damaged'];
export const TOOL_SEVERITIES: ToolSeverity[] = ['Low', 'Medium', 'High'];
export const TOOL_STATUS_FLOW: ToolStatus[] = ['Reported', 'Crib confirmed', 'Replacement ordered', 'Replaced'];
export const TOOL_CATEGORIES = ['Torque & tensioning', 'Power tools', 'Inspection & NDT', 'Test & measurement', 'Lifting & rigging', 'Welding', 'Safety & detection', 'Cleaning'] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export interface CribTool {
  tag: string;
  name: string;
  category: ToolCategory;
  crib: string;
}

/** The tool-crib catalogue an operator picks from in the mobile app (or finds by scanning the tag). */
export const CRIB_TOOLS: CribTool[] = [
  { tag: 'TL-9101', name: 'Hydraulic torque wrench 3000 Nm', category: 'Torque & tensioning', crib: 'Crib A' },
  { tag: 'TL-9102', name: 'Bolt tensioner set M48', category: 'Torque & tensioning', crib: 'Crib A' },
  { tag: 'TL-9103', name: 'Torque multiplier 1:25', category: 'Torque & tensioning', crib: 'Crib A' },
  { tag: 'TL-9104', name: 'Hydrotest pump 1000 bar', category: 'Test & measurement', crib: 'Workshop' },
  { tag: 'TL-9105', name: 'Laser alignment kit', category: 'Test & measurement', crib: 'Crib B' },
  { tag: 'TL-9106', name: 'Portable hardness tester', category: 'Inspection & NDT', crib: 'Crib B' },
  { tag: 'TL-9107', name: 'ECT tube probe set', category: 'Inspection & NDT', crib: 'Crib B' },
  { tag: 'TL-9108', name: 'Thickness gauge (UT)', category: 'Inspection & NDT', crib: 'Crib B' },
  { tag: 'TL-9109', name: 'Pneumatic grinder', category: 'Power tools', crib: 'Crib A' },
  { tag: 'TL-9110', name: 'Magnetic drill', category: 'Power tools', crib: 'Crib A' },
  { tag: 'TL-9111', name: 'Pipe bevelling machine', category: 'Power tools', crib: 'Workshop' },
  { tag: 'TL-9112', name: 'Welding machine 400 A', category: 'Welding', crib: 'Workshop' },
  { tag: 'TL-9113', name: 'Gas detector 4-gas', category: 'Safety & detection', crib: 'Crib B' },
  { tag: 'TL-9114', name: 'Pull-lift 3 t', category: 'Lifting & rigging', crib: 'Crib A' },
  { tag: 'TL-9115', name: 'Chain block 5 t', category: 'Lifting & rigging', crib: 'Crib A' },
  { tag: 'TL-9116', name: 'Hydro-jet lance set', category: 'Cleaning', crib: 'Workshop' },
  { tag: 'TL-9119', name: 'Loop calibrator', category: 'Test & measurement', crib: 'Crib B' },
  { tag: 'TL-9120', name: 'Insulation tester 5 kV', category: 'Test & measurement', crib: 'Crib B' },
];
export const CRIB_BY_TAG: Record<string, CribTool> = Object.fromEntries(CRIB_TOOLS.map((t) => [t.tag, t]));

/** Activities that are on the critical path or near-critical (float of 5 days or less): a tool problem here moves the end date. */
const NEAR_CRITICAL = new Set(['ACT-231', 'ACT-244', 'ACT-318', 'ACT-352', 'ACT-367', 'ACT-204', 'ACT-206']);
export function isCriticalActivity(activityId: string): boolean {
  const a = scheduleActivities.find((x) => x.id === activityId);
  return NEAR_CRITICAL.has(activityId) || Boolean(a?.cp);
}

/** Activities a tool issue can be tied to: running now (Day 14) or starting within the next week. */
export const TOOL_ACTIVITIES = scheduleActivities.filter((a) => a.startDay <= 21 && a.endDay >= 14 && a.pct < 100 && !a.id.startsWith('CPA'));

export interface ToolHistoryEntry {
  status: ToolStatus | 'Raised';
  at: string; // scenario ISO timestamp
  by: string;
  note?: string;
}

export interface ToolReport {
  id: string;
  toolTag: string;
  toolName: string;
  category: ToolCategory;
  contractor: string;
  reportedBy: string;
  reportedAt: string; // when the operator recorded it (may be earlier than receivedAt if the phone was offline)
  receivedAt: string; // when it reached the platform
  issue: ToolIssue;
  activityId: string;
  p6Id: string;
  activityName: string;
  critical: boolean;
  severity: ToolSeverity;
  status: ToolStatus;
  replacementRequested: boolean;
  eta?: string; // ISO date
  replacedAt?: string;
  note: string;
  photo?: string;
  source: ToolSource;
  history: ToolHistoryEntry[];
}

// ---- the scenario clock: the demo is frozen on Day 14 (16 Aug 2026) and advances in real time from 09:40 ----
const T0 = Date.UTC(2026, 7, 16, 9, 40, 0);
const LOADED = Date.now();
export function scenarioNow(): string {
  return new Date(T0 + (Date.now() - LOADED)).toISOString().slice(0, 19);
}
export function hoursBetween(fromIso: string, toIso: string): number {
  return (Date.parse(`${toIso}Z`) - Date.parse(`${fromIso}Z`)) / 3_600_000;
}

type Seed = [
  id: string,
  tag: string,
  issue: ToolIssue,
  activityId: string,
  severity: ToolSeverity,
  status: ToolStatus,
  reportedBy: string,
  reportedAt: string,
  source: ToolSource,
  note: string,
  eta?: string,
  replacedAt?: string,
];

const SEEDS: Seed[] = [
  ['TR-1001', 'TL-9101', 'Broken', 'ACT-231', 'High', 'Replacement ordered', 'Khalid Al-Rashdi', '2026-08-15T14:20:00', 'Mobile app', 'Hydraulic pump leaking at the coupling, no pressure above 400 bar. Tray bolting on Section B stopped.', '2026-08-17'],
  ['TR-1002', 'TL-9105', 'Missing', 'ACT-318', 'High', 'Crib confirmed', 'Tariq Said', '2026-08-16T06:55:00', 'Mobile app', 'Signed out on the 13 Aug night shift, not returned. Not in Crib B or at the K-301 laydown. Casing alignment is waiting on it.', '2026-08-18'],
  ['TR-1003', 'TL-9113', 'Needs calibration', 'ACT-207', 'Medium', 'Reported', 'Imran Shah', '2026-08-16T08:55:00', 'Mobile app', 'Bump test failed on the H2S channel. Confined space entry cannot be signed with it.'],
  ['TR-1004', 'TL-9109', 'Broken', 'ACT-701', 'Low', 'Replaced', 'Suresh Pillai', '2026-08-13T10:05:00', 'Mobile app', 'Air motor seized.', undefined, '2026-08-14T08:30:00'],
  ['TR-1005', 'TL-9104', 'Damaged', 'ACT-352', 'High', 'Replacement ordered', 'Mohammed Al-Farsi', '2026-08-15T16:40:00', 'Tool crib', 'Gauge cracked and relief set point drifting. Needed for the FL-401 hydrotest on Day 17.', '2026-08-18'],
  ['TR-1006', 'TL-9112', 'Broken', 'ACT-231', 'Medium', 'Crib confirmed', 'Joseph D’Costa', '2026-08-16T05:30:00', 'Mobile app', 'Inverter trips on start. Second welding machine on this crew is already booked.', '2026-08-17'],
  ['TR-1007', 'TL-9108', 'Needs calibration', 'ACT-401', 'Medium', 'Replaced', 'Ali Al-Hinai', '2026-08-12T09:15:00', 'Mobile app', 'Calibration certificate expired on 12 Aug.', undefined, '2026-08-13T07:45:00'],
  ['TR-1008', 'TL-9103', 'Broken', 'ACT-206', 'Medium', 'Reported', 'Vijay Kumar', '2026-08-16T07:30:00', 'Mobile app', 'Reaction arm cracked on the ratchet side.'],
  ['TR-1009', 'TL-9114', 'Damaged', 'ACT-701', 'Medium', 'Written off', 'Suresh Pillai', '2026-08-11T13:10:00', 'Tool crib', 'Failed the load test, chain stretched. Written off and removed from the crib.'],
  ['TR-1010', 'TL-9116', 'Missing', 'ACT-204', 'High', 'Replacement ordered', 'Rahul Menon', '2026-08-15T21:10:00', 'Mobile app', 'Lance set left at the E-204 bundle pad, not found at shift handover. Hydro-jetting is stopped.', '2026-08-17'],
  ['TR-1011', 'TL-9119', 'Needs calibration', 'ACT-109', 'Low', 'Replaced', 'Hamad Al-Busaidi', '2026-08-10T11:00:00', 'Mobile app', 'Due for calibration before DCS loop checks.', undefined, '2026-08-12T15:20:00'],
  ['TR-1012', 'TL-9102', 'Broken', 'ACT-602', 'Medium', 'Crib confirmed', 'Mohammed Al-Farsi', '2026-08-16T04:50:00', 'Mobile app', 'Two stud tensioners will not hold pressure. Flange bolting at the FL-401 tie-in is slowed.', '2026-08-18'],
  ['TR-1013', 'TL-9120', 'Missing', 'ACT-505', 'Low', 'Reported', 'Hamad Al-Busaidi', '2026-08-16T08:10:00', 'Mobile app', 'Not at the MCC-3 work area after lunch.'],
  ['TR-1014', 'TL-9110', 'Broken', 'ACT-701', 'Medium', 'Replaced', 'Suresh Pillai', '2026-08-14T07:20:00', 'Mobile app', 'Motor burnt out, smell of smoke.', undefined, '2026-08-15T09:50:00'],
  ['TR-1015', 'TL-9111', 'Broken', 'ACT-602', 'Medium', 'Replacement ordered', 'Mohammed Al-Farsi', '2026-08-15T10:35:00', 'Tool crib', 'Cutter head chipped, bevel angle out of tolerance.', '2026-08-17'],
];

function build(s: Seed): ToolReport {
  const tool = CRIB_BY_TAG[s[1]];
  const act = scheduleActivities.find((a) => a.id === s[3])!;
  const history: ToolHistoryEntry[] = [{ status: 'Raised', at: s[7], by: s[6] }];
  const order: ToolStatus[] = ['Reported', 'Crib confirmed', 'Replacement ordered', 'Replaced'];
  const reachedIdx = s[5] === 'Written off' ? 1 : order.indexOf(s[5]);
  const t0 = Date.parse(`${s[7]}Z`);
  for (let i = 1; i <= reachedIdx; i++) {
    const at = s[11] && i === 3 ? s[11] : new Date(t0 + i * 3_600_000 * (i === 3 ? 20 : 2)).toISOString().slice(0, 19);
    history.push({ status: order[i], at, by: i === 1 ? 'Tool crib' : i === 2 ? 'Procurement' : 'Tool crib' });
  }
  if (s[5] === 'Written off') history.push({ status: 'Written off', at: new Date(t0 + 5 * 3_600_000).toISOString().slice(0, 19), by: 'Tool crib' });
  return {
    id: s[0],
    toolTag: s[1],
    toolName: tool.name,
    category: tool.category,
    contractor: act.contractor,
    reportedBy: s[6],
    reportedAt: s[7],
    receivedAt: new Date(t0 + 60_000).toISOString().slice(0, 19),
    issue: s[2],
    activityId: act.id,
    p6Id: act.p6Id,
    activityName: act.name,
    critical: isCriticalActivity(act.id),
    severity: s[4],
    status: s[5],
    replacementRequested: s[5] !== 'Written off',
    eta: s[10],
    replacedAt: s[11],
    note: s[9],
    source: s[8],
    history,
  };
}

export const toolReportSeed: ToolReport[] = SEEDS.map(build).sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));

/** Prepared operator reports for the "Simulate operator report" demo button, used in turn. */
export const SIMULATED_REPORTS = [
  { tag: 'TL-9101', issue: 'Broken' as ToolIssue, activityId: 'ACT-231', severity: 'High' as ToolSeverity, by: 'Khalid Al-Rashdi', note: 'Hydraulic hose burst at the torque wrench head. Tray bolting on Section B cannot continue.' },
  { tag: 'TL-9105', issue: 'Damaged' as ToolIssue, activityId: 'ACT-318', severity: 'High' as ToolSeverity, by: 'Tariq Said', note: 'Laser emitter housing cracked, drifting readings on the K-301 casing.' },
  { tag: 'TL-9115', issue: 'Missing' as ToolIssue, activityId: 'ACT-206', severity: 'Medium' as ToolSeverity, by: 'Vijay Kumar', note: 'Chain block not returned after lifting the P-205 casing.' },
  { tag: 'TL-9106', issue: 'Needs calibration' as ToolIssue, activityId: 'ACT-401', severity: 'Low' as ToolSeverity, by: 'Ali Al-Hinai', note: 'Hardness tester calibration block reading out of range.' },
];
