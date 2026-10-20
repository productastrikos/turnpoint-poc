import { scfItems } from '../mocks/scfMock';
import type { SCF } from '../types';
import { delay } from './_util';
import { deriveApprover } from './scfRules';
import { sendToSystems } from './integrationService';
import { OMR_PER_USD } from '../mocks/master';

export { deriveApprover };

let store: SCF[] = [...scfItems];
let seq = store.length + 1;

export async function getSCFs(): Promise<SCF[]> {
  return delay([...store]);
}

export interface CreateSCFInput {
  kind?: SCF['kind'];
  title: string;
  requestedBy: string;
  department: SCF['department'];
  costUSD: number;
  durationDays: number;
  exceedsWindow: boolean;
  justification: string;
}

export async function createSCF(input: CreateSCFInput): Promise<SCF> {
  const scf: SCF = {
    id: `SCF-${200 + seq++}`,
    ...input,
    approver: deriveApprover(input.costUSD, input.exceedsWindow),
    status: 'evaluating',
    raisedAt: new Date().toISOString().slice(0, 10),
  };
  store = [scf, ...store];
  return delay(scf);
}

export async function updateSCFStatus(id: string, status: SCF['status']): Promise<SCF> {
  store = store.map((s) => (s.id === id ? { ...s, status } : s));
  const scf = store.find((s) => s.id === id)!;
  if (status === 'approved') {
    sendToSystems({
      type: 'tp.order.upsert',
      order: { MaintenanceOrder: `40000${34000 + Number(id.replace(/\D/g, ''))}`, MaintenanceOrderDesc: `${scf.id} ${scf.title}`, MaintenanceOrderType: 'PM01', SystemStatusText: 'REL', UserStatusText: 'SCFA', PlannedCostOMR: Math.round(scf.costUSD * OMR_PER_USD), ZZ_TurnpointRef: scf.id },
      note: `${scf.id} approved by the ${scf.approver} in TURNPOINT: additional work order created`,
    });
  }
  return delay(scf);
}
