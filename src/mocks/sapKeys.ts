// Cross-system keys so the same job shows the same SAP number and P6 Activity ID on every page.
import type { Job } from '../types';
import { unitOf } from './master';

const jobNum = (id: string) => Number(id.replace(/\D/g, '')) || 0;

/** SAP maintenance order (work order) number. Approved/frozen jobs always have one; others only if they came from SAP as a work order. */
export function sapWoForJob(job: Pick<Job, 'id' | 'source' | 'sapRef' | 'inBaseline' | 'status'>): string | undefined {
  if (job.source === 'SAP work order' && job.sapRef) return job.sapRef;
  if (job.inBaseline || job.status === 'approved') return `400003${String(1000 + jobNum(job.id))}`;
  return undefined;
}

/** SAP maintenance notification number if the job originated from one. */
export function sapNotificationForJob(job: Pick<Job, 'source' | 'sapRef'>): string | undefined {
  return job.source === 'SAP notification' ? job.sapRef : undefined;
}

/** Work-package level P6 Activity ID, e.g. HCU-4010. */
export function p6IdForJob(job: Pick<Job, 'id' | 'area'>): string {
  return `${unitOf(job.area)}-${4000 + (jobNum(job.id) - 2200) * 10}`;
}
