// Work packs (P4): one per approved job, with a 5-point readiness checklist. Derived from the shared jobs, materials and schedule.
import { jobs } from './jobsMock';
import { materialItems } from './materialsMock';
import { scheduleActivities } from './scheduleMock';
import { STATUS_DAY, rng } from './_gen';
import { p6IdForJob, sapWoForJob } from './sapKeys';

export type PackStage = 'Preparing' | 'Ready for release' | 'Released' | 'In progress' | 'Complete';
export const PACK_STAGES: PackStage[] = ['Preparing', 'Ready for release', 'Released', 'In progress', 'Complete'];

export const READINESS_ITEMS = [
  { key: 'scope', label: 'Scope approved and frozen' },
  { key: 'drawings', label: 'Drawings, procedures and ITP issued' },
  { key: 'materials', label: 'Materials available' },
  { key: 'permits', label: 'Permits and isolations planned' },
  { key: 'resources', label: 'Crew, tools and equipment booked' },
] as const;
export type ReadinessKey = (typeof READINESS_ITEMS)[number]['key'];

export interface WorkPack {
  id: string;
  jobId: string;
  title: string;
  discipline: string;
  area: string;
  contractor: string;
  p6Id: string;
  sapWo?: string;
  startDay: number;
  endDay: number;
  manhours: number;
  stage: PackStage;
  ready: Record<ReadinessKey, boolean>;
  materials: { id: string; description: string; status: string }[];
  activities: number;
}

const r = rng(2026);

export const workPacks: WorkPack[] = jobs
  .filter((j) => j.status !== 'rejected')
  .map((j) => {
    const mats = materialItems.filter((m) => m.jobId === j.id);
    const matsOk = mats.every((m) => m.prStatus === 'delivered');
    const started = j.startDay <= STATUS_DAY;
    const finished = j.startDay + j.durationDays - 1 < STATUS_DAY;
    const ready: Record<ReadinessKey, boolean> = {
      scope: j.status === 'approved',
      drawings: started || r() > 0.2,
      materials: started ? true : matsOk,
      permits: started || r() > 0.35,
      resources: started || r() > 0.3,
    };
    const allReady = Object.values(ready).every(Boolean);
    const stage: PackStage = finished ? 'Complete' : started ? 'In progress' : allReady ? (j.startDay - STATUS_DAY <= 3 ? 'Released' : 'Ready for release') : 'Preparing';
    return {
      id: `WP-${j.id.slice(2)}`,
      jobId: j.id,
      title: j.desc,
      discipline: j.discipline,
      area: j.area,
      contractor: j.contractor,
      p6Id: p6IdForJob(j),
      sapWo: sapWoForJob(j),
      startDay: j.startDay,
      endDay: j.startDay + j.durationDays - 1,
      manhours: j.manhours,
      stage,
      ready,
      materials: mats.map((m) => ({ id: m.id, description: m.description, status: m.prStatus })),
      activities: scheduleActivities.filter((a) => a.jobId === j.id).length,
    };
  });
