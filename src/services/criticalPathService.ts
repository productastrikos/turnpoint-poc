import { criticalPathActivities, cpDailyChanges, nearCritical } from '../mocks/criticalPathMock';
import type { CPStatus, CriticalPathActivity } from '../types';
import { delay } from './_util';

let store: CriticalPathActivity[] = [...criticalPathActivities];
let daily = cpDailyChanges.map((d) => ({ ...d }));
let near: NearCritical[] = nearCritical.map((n) => ({ ...n }));
let ticker = 0;

export async function getCriticalPathActivities(): Promise<CriticalPathActivity[]> {
  return delay([...store]);
}

export async function setActivityStatus(id: string, status: CPStatus): Promise<CriticalPathActivity> {
  store = store.map((a) => (a.id === id ? { ...a, status, changeCount: a.changeCount + 1 } : a));
  const updated = store.find((a) => a.id === id)!;
  // an activity status change on the critical path is a change to the critical path: it lands in today's log
  daily = daily.map((d, i) => (i === daily.length - 1 ? { ...d, changes: d.changes + 1, note: d.note || `${id} set to ${status}` } : d));
  return delay(updated);
}

export interface CpDay {
  day: number;
  changes: number;
  note: string;
}

export async function getCpDailyChanges(): Promise<CpDay[]> {
  return delay(daily.map((d) => ({ ...d })));
}

/** Record a change to the critical path itself (e.g. a P6 recalculation made new activities critical). */
export async function recordCpChange(note: string): Promise<void> {
  daily = daily.map((d, i) => (i === daily.length - 1 ? { ...d, changes: d.changes + 1, note: d.note ? `${d.note}; ${note}` : note } : d));
  return delay(undefined, 60);
}

/**
 * Dates and float written back from the P6 schedule (integration). A finish that moved later turns the activity
 * at-risk, or delayed if it now has negative float. `cpNote` is logged as one critical-path change when the
 * reschedule moved critical work or changed which path drives the end date.
 */
export async function applyP6Schedule(updates: { id: string; forecastFinish: string; floatDays: number }[], cpNote: string | null): Promise<void> {
  store = store.map((a) => {
    const u = updates.find((x) => x.id === a.id);
    if (!u) return a;
    const later = u.forecastFinish > a.forecastFinish;
    const status = later ? (u.floatDays < 0 ? 'delayed' : 'at-risk') : u.forecastFinish < a.forecastFinish && u.floatDays >= 0 ? 'on-track' : a.status;
    return { ...a, forecastFinish: u.forecastFinish, floatDays: u.floatDays, status, changeCount: a.changeCount + 1 };
  });
  near = near.map((n) => {
    const u = updates.find((x) => x.id === n.id);
    return u ? { ...n, floatDays: u.floatDays, becameCritical: n.becameCritical || u.floatDays <= 0 } : n;
  });
  if (cpNote) await recordCpChange(cpNote);
}

export interface NearCritical {
  id: string;
  name: string;
  floatDays: number;
  driver: string;
  path: string;
  becameCritical?: boolean;
}

export async function getNearCritical(): Promise<NearCritical[]> {
  return delay(near.map((n) => ({ ...n })), 120);
}

/**
 * Simulated live monitor (X21): each tick one near-critical activity loses float as execution delay accrues.
 * When float hits zero it is automatically flagged as newly critical and counted as a critical-path change.
 */
export async function tickMonitor(): Promise<{ list: NearCritical[]; event?: string }> {
  const candidates = near.filter((n) => n.floatDays > 0);
  let event: string | undefined;
  if (candidates.length > 0) {
    const pick = candidates[ticker % candidates.length];
    ticker += 1;
    near = near.map((n) => (n.id === pick.id ? { ...n, floatDays: n.floatDays - 1 } : n));
    const after = near.find((n) => n.id === pick.id)!;
    if (after.floatDays <= 0) {
      near = near.map((n) => (n.id === pick.id ? { ...n, becameCritical: true } : n));
      await recordCpChange(`${pick.id} became critical (${pick.driver})`);
      event = `${pick.id} ${pick.name} is now CRITICAL (float 0 d). Cause: ${pick.driver}.`;
    } else {
      event = `${pick.id} ${pick.name} lost 1 day of float, ${after.floatDays} d left.`;
    }
  }
  return delay({ list: near.map((n) => ({ ...n })), event }, 80);
}
