// The detailed activity schedule (the "P6 view"): supporting activities plus the critical-path activities.
// Days are TA days (Day 1 = 3 Aug 2026, Day 14 = status date 16 Aug, Day 32 = 3 Sep). Days 33+ are start-up / post-TA.
import type { ScheduleActivity } from '../types/execution';
import { criticalPathActivities } from './criticalPathMock';
import { JOB_BY_ID } from './jobsMock';
import { dateToDay } from './_gen';
import { sapWoForJob } from './sapKeys';
import type { Discipline } from '../types';

type Cal = ScheduleActivity['calendar'];
// [id, p6Id, name, discipline, area, jobId, startDay, endDay, pct, bluHours, calendar]
type Row = [string, string, string, Discipline, string, string, number, number, number, number, Cal];

const rows: Row[] = [
  // ---- Unit 100 · HCU ----
  ['ACT-101', 'HCU-1005', 'R-101 shutdown, depressurise & purge', 'Process', 'Unit 100', 'J-2209', 1, 4, 100, 640, '7-day'],
  ['ACT-102', 'HCU-1006', 'R-101 scaffold — internal & external', 'Civil', 'Unit 100', 'J-2205', 3, 9, 100, 1900, '12h Day'],
  ['ACT-103', 'HCU-1008', 'R-101 manway opening & ventilation', 'Process', 'Unit 100', 'J-2209', 9, 11, 100, 420, '12h Day'],
  ['ACT-104', 'HCU-1009', 'R-101 steam-out & pre-inspection cleaning', 'Process', 'Unit 100', 'J-2209', 10, 13, 100, 760, '12h Night'],
  ['ACT-105', 'HCU-2010', 'F-101 tube inspection & decoking', 'Inspection', 'Unit 100', 'J-2212', 6, 13, 100, 1900, '12h Day'],
  ['ACT-244', 'HCU-2020', 'F-101 Burner Block Refractory Cure', 'Civil', 'Unit 100', 'J-2212', 11, 17, 60, 900, '7-day'],
  ['ACT-107', 'HCU-3010', 'Control valve overhaul — batch 1 (16 CVs)', 'Instrumentation', 'Unit 100', 'J-2220', 8, 13, 100, 520, '12h Day'],
  ['ACT-108', 'HCU-3020', 'Control valve overhaul — batch 2 (16 CVs)', 'Instrumentation', 'Unit 100', 'J-2220', 14, 17, 20, 530, '12h Day'],
  ['ACT-109', 'HCU-3030', 'DCS I/O card replacement — Unit 100', 'Instrumentation', 'Unit 100', 'J-2225', 13, 17, 15, 640, '12h Day'],
  // ---- Unit 200 · CDU ----
  ['ACT-201', 'CDU-1010', 'T-201 trays removal — Section A', 'Inspection', 'Unit 200', 'J-2213', 4, 9, 100, 1100, '12h Day'],
  ['ACT-231', 'CDU-1020', 'T-201 Tray Repair — Section B', 'Inspection', 'Unit 200', 'J-2213', 10, 17, 40, 1400, '12h Day'],
  ['ACT-203', 'CDU-1030', 'T-201 trays re-installation & box-up', 'Inspection', 'Unit 200', 'J-2213', 18, 21, 0, 600, '12h Day'],
  ['ACT-204', 'CDU-2005', 'E-204 shell-side cleaning (hydro-jet)', 'Rotating Equipment', 'Unit 200', 'J-2202', 12, 15, 70, 380, '12h Night'],
  ['ACT-205', 'CDU-3010', 'P-205 pump strip & inspection', 'Rotating Equipment', 'Unit 200', 'J-2214', 8, 12, 100, 420, '12h Day'],
  ['ACT-206', 'CDU-3020', 'P-205 reassembly & alignment', 'Rotating Equipment', 'Unit 200', 'J-2214', 13, 16, 50, 400, '12h Day'],
  ['ACT-207', 'CDU-4010', 'Insulation removal — Unit 200', 'Civil', 'Unit 200', 'J-2224', 10, 15, 80, 1900, '12h Day'],
  ['ACT-208', 'CDU-4020', 'Insulation renewal — Unit 200', 'Civil', 'Unit 200', 'J-2224', 16, 23, 0, 1900, '12h Day'],
  // ---- Unit 220 · SRU / Unit 250 · VDU ----
  ['ACT-301', 'SRU-1010', 'T-221 catalyst unloading', 'Process', 'Unit 220', 'J-2217', 7, 10, 100, 700, '12h Day'],
  ['ACT-302', 'SRU-1020', 'T-221 catalyst loading', 'Process', 'Unit 220', 'J-2217', 14, 16, 30, 1100, '12h Day'],
  ['ACT-401', 'VDU-1010', 'T-251 packing removal & inspection', 'Inspection', 'Unit 250', 'J-2218', 9, 14, 85, 1000, '12h Day'],
  ['ACT-402', 'VDU-1020', 'T-251 packing installation', 'Inspection', 'Unit 250', 'J-2218', 15, 18, 0, 700, '12h Day'],
  // ---- Unit 300 · FCC ----
  ['ACT-501', 'FCC-1010', 'R-301 refractory demolition', 'Civil', 'Unit 300', 'J-2216', 5, 10, 100, 1600, '12h Day'],
  ['ACT-502', 'FCC-1020', 'R-301 refractory lining — cyclone zone', 'Civil', 'Unit 300', 'J-2216', 11, 19, 45, 2200, '7-day'],
  ['ACT-503', 'FCC-1030', 'R-301 refractory dry-out', 'Civil', 'Unit 300', 'J-2216', 20, 23, 0, 800, '7-day'],
  ['ACT-318', 'FCC-2010', 'K-301 Blower Casing Alignment', 'Rotating Equipment', 'Unit 300', 'J-2215', 12, 17, 30, 600, '12h Day'],
  ['ACT-504', 'FCC-3050', 'P-305 pump overhaul', 'Rotating Equipment', 'Unit 300', 'J-2211', 9, 14, 100, 560, '12h Day'],
  ['ACT-505', 'FCC-4010', 'MCC-3 motor protection relay upgrade', 'Electrical', 'Unit 300', 'J-2222', 10, 15, 75, 720, '12h Day'],
  // ---- Flare / Pipe rack 4 ----
  ['ACT-601', 'FLR-1010', 'PSV recertification — batches 1 & 2', 'Instrumentation', 'Flare System', 'J-2219', 6, 13, 100, 760, '12h Day'],
  ['ACT-367', 'FLR-1020', 'PSV Recertification — Batch 3', 'Instrumentation', 'Flare System', 'J-2219', 14, 19, 20, 500, '12h Day'],
  ['ACT-602', 'FLR-2005', 'FL-401 header tie-in spool fit-up', 'Process', 'Flare System', 'J-2221', 14, 16, 35, 700, '12h Day'],
  ['ACT-352', 'FLR-2010', 'FL-401 Flare Header Hydrotest', 'Process', 'Flare System', 'J-2221', 17, 20, 0, 650, '12h Day'],
  ['ACT-701', 'PR4-1010', 'Pipe support replacement — 40 supports', 'Civil', 'Pipe Rack 4', 'J-2223', 6, 17, 70, 1900, '12h Day'],
  // ---- start-up & post-TA (look-ahead beyond the TA window) ----
  ['ACT-801', 'SUP-1010', 'Utilities & nitrogen purge — Unit 100', 'Process', 'Unit 100', 'J-2208', 30, 32, 0, 320, '7-day'],
  ['ACT-802', 'SUP-1020', 'Heater F-101 light-up', 'Process', 'Unit 100', 'J-2208', 33, 34, 0, 240, '7-day'],
  ['ACT-803', 'SUP-1030', 'Reactor R-101 heat-up & catalyst sulfiding', 'Process', 'Unit 100', 'J-2209', 34, 38, 0, 480, '7-day'],
  ['ACT-804', 'SUP-1040', 'Hydrocracker feed-in', 'Process', 'Unit 100', 'J-2208', 38, 40, 0, 360, '7-day'],
  ['ACT-805', 'SUP-1050', 'CDU/VDU hot oil circulation', 'Process', 'Unit 200', 'J-2208', 35, 37, 0, 300, '7-day'],
  ['ACT-806', 'SUP-1060', 'FCC main air blower run-in & start', 'Rotating Equipment', 'Unit 300', 'J-2215', 36, 38, 0, 260, '7-day'],
  ['ACT-807', 'SUP-1070', 'Post-TA punch list close-out — Area 1', 'Inspection', 'Unit 100', 'J-2201', 33, 42, 0, 520, '5-day'],
];

const P6_FOR_CP: Record<string, string> = {
  'CPA-001': 'HCU-1010', 'CPA-002': 'HCU-1020', 'CPA-003': 'HCU-1030', 'CPA-011': 'HCU-1040', 'CPA-009': 'HCU-1050', 'CPA-012': 'HCU-1060', 'CPA-013': 'HCU-1070',
  'CPA-004': 'CDU-2010', 'CPA-005': 'CDU-2020', 'CPA-014': 'CDU-2030', 'CPA-008': 'CDU-2040', 'CPA-010': 'CDU-2050',
  'CPA-006': 'FCC-3010', 'CPA-007': 'FCC-3020', 'CPA-015': 'FCC-3030', 'CPA-016': 'FCC-3040',
};

const CP_META: Record<string, { jobId: string; area: string; discipline: Discipline }> = {
  'CPA-001': { jobId: 'J-2201', area: 'Unit 100', discipline: 'Inspection' },
  'CPA-002': { jobId: 'J-2209', area: 'Unit 100', discipline: 'Process' },
  'CPA-003': { jobId: 'J-2201', area: 'Unit 100', discipline: 'Inspection' },
  'CPA-011': { jobId: 'J-2201', area: 'Unit 100', discipline: 'Inspection' },
  'CPA-009': { jobId: 'J-2201', area: 'Unit 100', discipline: 'Inspection' },
  'CPA-012': { jobId: 'J-2209', area: 'Unit 100', discipline: 'Process' },
  'CPA-013': { jobId: 'J-2209', area: 'Unit 100', discipline: 'Process' },
  'CPA-004': { jobId: 'J-2202', area: 'Unit 200', discipline: 'Rotating Equipment' },
  'CPA-005': { jobId: 'J-2202', area: 'Unit 200', discipline: 'Rotating Equipment' },
  'CPA-014': { jobId: 'J-2202', area: 'Unit 200', discipline: 'Rotating Equipment' },
  'CPA-008': { jobId: 'J-2210', area: 'Unit 200', discipline: 'Process' },
  'CPA-010': { jobId: 'J-2208', area: 'Unit 200', discipline: 'Process' },
  'CPA-006': { jobId: 'J-2203', area: 'Unit 300', discipline: 'Rotating Equipment' },
  'CPA-007': { jobId: 'J-2203', area: 'Unit 300', discipline: 'Rotating Equipment' },
  'CPA-015': { jobId: 'J-2203', area: 'Unit 300', discipline: 'Rotating Equipment' },
  'CPA-016': { jobId: 'J-2203', area: 'Unit 300', discipline: 'Rotating Equipment' },
};

const base: ScheduleActivity[] = rows.map((r) => {
  const job = JOB_BY_ID[r[5]];
  return {
    id: r[0],
    p6Id: r[1],
    name: r[2],
    discipline: r[3],
    area: r[4],
    jobId: r[5],
    contractor: job?.contractor ?? 'Galfar',
    startDay: r[6],
    endDay: r[7],
    pct: r[8],
    bluHours: r[9],
    calendar: r[10],
    sapWo: job ? sapWoForJob(job) : undefined,
  };
});

const cpActs: ScheduleActivity[] = criticalPathActivities.map((a) => {
  const meta = CP_META[a.id];
  const job = JOB_BY_ID[meta.jobId];
  const endDay = dateToDay(a.plannedFinish);
  return {
    id: a.id,
    p6Id: P6_FOR_CP[a.id],
    name: a.name,
    discipline: meta.discipline,
    area: meta.area,
    jobId: meta.jobId,
    contractor: job.contractor,
    startDay: endDay - a.durationDays + 1,
    endDay,
    pct: 0,
    bluHours: Math.round(a.costOMR / 22),
    calendar: '7-day' as const,
    cp: a.path,
    sapWo: sapWoForJob(job),
  };
});

export const scheduleActivities: ScheduleActivity[] = [...base, ...cpActs].sort((a, b) => a.startDay - b.startDay || a.id.localeCompare(b.id));

/** Planned % complete at the data date from the planned dates (linear), used for delay/gain. */
export function plannedPct(a: ScheduleActivity, day = 14): number {
  if (day < a.startDay) return 0;
  if (day >= a.endDay) return 100;
  return Math.round(((day - a.startDay + 1) / (a.endDay - a.startDay + 1)) * 100);
}

/** Field progress updates received from the mobile app since the last P6 sync (drives the P6 round trip). */
export const fieldUpdates: { activityId: string; pct: number; by: string; at: string; via: string }[] = [
  { activityId: 'ACT-231', pct: 40, by: 'A. Hinai', at: '2026-08-16T06:41:00', via: 'Mobile (synced after offline)' },
  { activityId: 'ACT-244', pct: 60, by: 'M. Al-Balushi', at: '2026-08-16T07:05:00', via: 'Mobile' },
  { activityId: 'ACT-502', pct: 45, by: 'M. Al-Balushi', at: '2026-08-16T06:20:00', via: 'Mobile' },
  { activityId: 'ACT-318', pct: 30, by: 'T. Said', at: '2026-08-16T07:12:00', via: 'Mobile (synced after offline)' },
  { activityId: 'ACT-701', pct: 70, by: 'M. Al-Balushi', at: '2026-08-16T06:58:00', via: 'Mobile' },
  { activityId: 'ACT-206', pct: 75, by: 'R. Fernandes', at: '2026-08-16T07:30:00', via: 'Mobile' },
  { activityId: 'ACT-401', pct: 85, by: 'A. Hinai', at: '2026-08-16T06:02:00', via: 'Mobile' },
  { activityId: 'ACT-204', pct: 70, by: 'R. Fernandes', at: '2026-08-16T05:45:00', via: 'Mobile (synced after offline)' },
];
