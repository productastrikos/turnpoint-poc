// Pure scope maths shared by the Scope pages: risk score, risk band, priority ranking.
import type { Job } from '../types';
import { scheduleActivities } from '../mocks/scheduleMock';

export const riskScore = (j: Pick<Job, 'likelihood' | 'consequence'>) => j.likelihood * j.consequence;

export type RiskBand = 'Low' | 'Medium' | 'High' | 'Extreme';
export function riskBand(score: number): RiskBand {
  if (score >= 17) return 'Extreme';
  if (score >= 10) return 'High';
  if (score >= 5) return 'Medium';
  return 'Low';
}
export const BAND_TONE: Record<RiskBand, 'good' | 'accent' | 'warn' | 'crit'> = { Low: 'good', Medium: 'accent', High: 'warn', Extreme: 'crit' };

/** Jobs that carry a critical-path activity in the schedule. */
const CP_JOBS = new Set(scheduleActivities.filter((a) => a.cp).map((a) => a.jobId));
export const onCriticalPath = (j: Pick<Job, 'id'>) => CP_JOBS.has(j.id);

export interface PriorityWeights {
  risk: number;
  criticality: number;
  costEfficiency: number;
  scheduleFit: number;
}
export const DEFAULT_WEIGHTS: PriorityWeights = { risk: 50, criticality: 20, costEfficiency: 20, scheduleFit: 10 };

export interface Ranked {
  job: Job;
  score: number;
  rank: number;
  band: 'P1' | 'P2' | 'P3';
  parts: { risk: number; criticality: number; costEfficiency: number; scheduleFit: number };
}

/** Priority 0-100 = weighted blend of risk, critical-path involvement, cost efficiency (risk per OMR) and schedule fit (earlier start first). */
export function rankJobs(jobs: Job[], w: PriorityWeights = DEFAULT_WEIGHTS): Ranked[] {
  const total = w.risk + w.criticality + w.costEfficiency + w.scheduleFit || 1;
  const maxCost = Math.max(...jobs.map((j) => j.costOMR), 1);
  const rows = jobs.map((job) => {
    const parts = {
      risk: (riskScore(job) / 25) * 100,
      criticality: onCriticalPath(job) ? 100 : job.durationDays >= 10 ? 50 : 20,
      costEfficiency: (1 - Math.min(1, job.costOMR / maxCost)) * 100,
      scheduleFit: Math.max(0, 100 - (job.startDay - 1) * 3.2),
    };
    const score = Math.round((parts.risk * w.risk + parts.criticality * w.criticality + parts.costEfficiency * w.costEfficiency + parts.scheduleFit * w.scheduleFit) / total);
    return { job, score, parts };
  });
  rows.sort((a, b) => b.score - a.score);
  return rows.map((r, i) => ({ ...r, rank: i + 1, band: r.score >= 62 ? 'P1' : r.score >= 45 ? 'P2' : 'P3' }));
}

export const MANDATORY: { key: keyof Job | 'justification'; label: string }[] = [
  { key: 'desc', label: 'Description' },
  { key: 'discipline', label: 'Discipline' },
  { key: 'area', label: 'Area / unit' },
  { key: 'tag', label: 'Equipment tag' },
  { key: 'costOMR', label: 'Budgetary estimate' },
  { key: 'manhours', label: 'Man-hours' },
  { key: 'likelihood', label: 'Risk likelihood' },
  { key: 'consequence', label: 'Risk consequence' },
  { key: 'requestedBy', label: 'Originator' },
];

/** Completeness of a job against the mandatory fields (checklist S2). */
export function completeness(j: Job): number {
  const filled = MANDATORY.filter((m) => {
    const v = (j as unknown as Record<string, unknown>)[m.key as string];
    return v !== undefined && v !== '' && v !== 0;
  }).length;
  return Math.round((filled / MANDATORY.length) * 100);
}
