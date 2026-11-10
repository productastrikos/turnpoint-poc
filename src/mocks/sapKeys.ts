// Cross-system keys so the same job shows the same SAP number and P6 Activity ID on every page.
import type { Job } from '../types';
import { unitOf } from './master';

const jobNum = (id: string) => Number(id.replace(/\D/g, '')) || 0;

/**
 * SAP maintenance order (work order) number.
 * - A SAP work order keeps its own number.
 * - An item that came from a SAP notification gets its order when it is approved.
 * - An item created in OQ (manual entry, bulk upload, Excel import) gets its order in SAP the moment it is created.
 */
export function sapWoForJob(job: Pick<Job, 'id' | 'source' | 'sapRef' | 'inBaseline' | 'status'>): string | undefined {
  if (job.source === 'SAP work order' && job.sapRef) return job.sapRef;
  if (job.source === 'SAP notification') return job.inBaseline || job.status === 'approved' ? `400003${String(1000 + jobNum(job.id))}` : undefined;
  return `400003${String(1000 + jobNum(job.id))}`;
}

/** SAP maintenance notification number if the job originated from one. */
export function sapNotificationForJob(job: Pick<Job, 'source' | 'sapRef'>): string | undefined {
  return job.source === 'SAP notification' ? job.sapRef : undefined;
}

/** Work-package level P6 Activity ID, e.g. HCU-4010. */
export function p6IdForJob(job: Pick<Job, 'id' | 'area'>): string {
  return `${unitOf(job.area)}-${4000 + (jobNum(job.id) - 2200) * 10}`;
}
