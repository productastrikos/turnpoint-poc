// SIMULATED SAP S/4HANA (PM / MM / PS) access. "Pull from SAP" really creates scope items through jobsService.
import { SAP_PENDING } from '../mocks/integrationMock';
import type { SapItem } from '../types/execution';
import type { Job } from '../types';
import { delay } from './_util';
import { createJobsFromSap } from './jobsService';
import { logMessage, sendToSystems } from './integrationService';

let items: SapItem[] = SAP_PENDING.map((i) => ({ ...i }));

export async function getSapPending(): Promise<SapItem[]> {
  return delay(items.map((i) => ({ ...i })), 700); // pretend OData round trip
}

export async function importFromSap(numbers: string[]): Promise<Job[]> {
  const chosen = items.filter((i) => numbers.includes(i.number) && !i.imported);
  const jobs = await createJobsFromSap(chosen);
  items = items.map((i) => (numbers.includes(i.number) ? { ...i, imported: true } : i));
  chosen.forEach((c, idx) => {
    logMessage({
      system: 'SAP',
      direction: 'Inbound',
      object: c.kind === 'Work Order' ? 'Maintenance Order' : 'Maintenance Notification',
      key: c.number,
      status: 'Delivered',
      latencyMs: 280 + idx * 17,
      channel: 'OData V2 / OAuth 2.0 + mTLS',
      note: `Imported as scope item ${jobs[idx].id} at Gate 1`,
    });
    sendToSystems(
      c.kind === 'Work Order'
        ? { type: 'tp.order.upsert', order: { MaintenanceOrder: c.number, UserStatusText: 'TPSC', ZZ_TurnpointRef: jobs[idx].id }, note: `Taken into the TA scope as ${jobs[idx].id} (Gate 1)` }
        : { type: 'tp.notification.update', MaintenanceNotification: c.number, phase: 'In process', ref: jobs[idx].id, note: `Taken into the TA scope as ${jobs[idx].id} (Gate 1)` }
    );
  });
  return jobs;
}
