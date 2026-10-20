import {
  BOXUP_STAGES,
  HANDOVER_STAGES,
  MC_STAGES,
  MILESTONES,
  assetMilestones,
  blinds,
  boxups,
  checklistSubmissions,
  checklistTemplates,
  contractorKpis,
  handovers,
  mcCerts,
  productivityRows,
  shiftEntries,
  type AssetMilestones,
  type Blind,
  type BoxUp,
  type ChecklistSubmission,
  type ContractorKpi,
  type Handover,
  type McCert,
  type MilestoneId,
  type MsState,
  type ProductivityRow,
  type ShiftEntry,
} from '../mocks/executionMock';
import { createCollection } from './_collection';
import { delay } from './_util';
import { addAlert } from './alertsService';
import { pushSapStatus } from './integrationService';
import { createIssue } from './qualityService';
import { STATUS_DATE } from '../mocks/_gen';

// ---------------------------------------------------------------- field checklists
const subStore = createCollection<ChecklistSubmission>(checklistSubmissions);
let fcSeq = 411;
export const getTemplates = () => delay(checklistTemplates, 60);
export const listSubmissions = () => subStore.list();

export async function submitChecklist(input: { templateId: string; tag: string; area: string; by: string; results: ('pass' | 'fail' | 'na')[]; photos: number; notes: string }): Promise<ChecklistSubmission> {
  const t = checklistTemplates.find((x) => x.id === input.templateId)!;
  const failed = input.results.filter((r) => r === 'fail').length;
  const sub: ChecklistSubmission = {
    id: `FC-${fcSeq++}`,
    templateId: t.id,
    template: t.name,
    tag: input.tag,
    area: input.area,
    by: input.by,
    at: `${STATUS_DATE}T09:${String(10 + (fcSeq % 40)).padStart(2, '0')}:00`,
    passed: input.results.filter((r) => r === 'pass').length,
    failed,
    na: input.results.filter((r) => r === 'na').length,
    photos: input.photos,
    notes: input.notes,
  };
  const saved = await subStore.add(sub);
  if (failed > 0) {
    // a failed check item automatically raises an issue in the Issues & Safety log
    await createIssue({ type: 'Unsafe condition', title: `${t.name} failed on ${input.tag}: ${failed} item(s). ${input.notes}`.trim(), severity: failed > 1 ? 'High' : 'Medium', area: input.area, owner: input.by });
  }
  return saved;
}

// ---------------------------------------------------------------- productivity
const prodStore = createCollection<ProductivityRow>(productivityRows);
export const listProductivity = () => prodStore.list();
export const productivityIndex = (r: ProductivityRow) => Math.round((r.actual / r.planned) * 100) / 100;
/** Hours-weighted overall index (earned / actual hours): the one number the KPI scorecard and the Productivity page both show. */
export function overallProductivityOf(rows: readonly ProductivityRow[]): number {
  const hrs = rows.reduce((s, r) => s + r.hours, 0) || 1;
  return rows.reduce((s, r) => s + r.hours * (r.actual / r.planned), 0) / hrs;
}
export async function overallProductivity(): Promise<number> {
  return overallProductivityOf(await prodStore.list());
}

export async function flagProductivity(id: string): Promise<ProductivityRow> {
  const row = (await prodStore.get(id))!;
  await createIssue({ type: 'Issue', title: `Productivity review: ${row.activity} (${row.contractor}) at index ${productivityIndex(row).toFixed(2)}`, severity: 'Medium', area: 'Unit 200', owner: row.contractor });
  return prodStore.update(id, { flagged: true });
}

// ---------------------------------------------------------------- box-up
const boxStore = createCollection<BoxUp>(boxups);
export const listBoxups = () => boxStore.list();
export const BOXUP_ACTIONS = ['Record inspection', 'Operations witness', 'Issue certificate', null];

export async function advanceBoxup(id: string): Promise<BoxUp> {
  const cur = (await boxStore.get(id))!;
  if (cur.stage >= BOXUP_STAGES.length - 1) return cur;
  const next = cur.stage + 1;
  const updated = await boxStore.update(id, { stage: next, itemsDone: next >= 1 ? cur.items : cur.itemsDone, hold: undefined });
  if (next === BOXUP_STAGES.length - 1) {
    pushSapStatus('Maintenance Order status', `${cur.tag} ${cur.item}`, `Box-up certificate issued for ${cur.tag} ${cur.item}`);
    await addAlert({ type: 'boxup-certificate', message: `Box-up certificate issued: ${cur.tag} ${cur.item}`, severity: 'info', link: '/box-up' });
  }
  return updated;
}

// ---------------------------------------------------------------- blinding
const blindStore = createCollection<Blind>(blinds);
export const listBlinds = () => blindStore.list();

export async function advanceBlind(id: string): Promise<Blind> {
  const cur = (await blindStore.get(id))!;
  const next = cur.status === 'Planned' ? 'Installed' : cur.status === 'Installed' ? 'Removed' : 'Removed';
  return blindStore.update(id, { status: next, verified: cur.status === 'Installed' ? true : cur.verified });
}

// ---------------------------------------------------------------- MC certificates
const mcStore = createCollection<McCert>(mcCerts);
export const listMc = () => mcStore.list();
export const MC_ACTIONS = ['Contractor signs completion', 'Verify inspection', 'Operations accepts', 'Issue certificate'];

export async function advanceMc(id: string): Promise<McCert> {
  const cur = (await mcStore.get(id))!;
  if (cur.stage >= MC_STAGES.length - 1) return cur;
  const next = cur.stage + 1;
  const updated = await mcStore.update(id, { stage: next, punchA: next >= 2 ? 0 : cur.punchA });
  if (next === MC_STAGES.length - 1) {
    pushSapStatus('Maintenance Order status', cur.id, `Mechanical completion certificate ${cur.id} issued for ${cur.system}: order TECO-ready`);
    await addAlert({ type: 'pssr-approval', message: `MC certificate ${cur.id} issued: ${cur.system}`, severity: 'info', link: '/mc-certificates' });
  }
  return updated;
}

// ---------------------------------------------------------------- handover
const hoStore = createCollection<Handover>(handovers);
export const listHandovers = () => hoStore.list();
export const HANDOVER_ACTIONS = ['Declare completion', 'Start walkdown and punch', 'Clear punch A', 'Sign handover', 'Operations accepts'];

export async function advanceHandover(id: string): Promise<Handover> {
  const cur = (await hoStore.get(id))!;
  if (cur.stage >= HANDOVER_STAGES.length - 1) return cur;
  const next = cur.stage + 1;
  return hoStore.update(id, { stage: next, punchOpen: next >= 3 ? 0 : cur.punchOpen });
}

let ms: AssetMilestones[] = assetMilestones.map((a) => ({ ...a, stateByMilestone: { ...a.stateByMilestone } }));
export const getMilestones = () => delay(ms.map((a) => ({ ...a, stateByMilestone: { ...a.stateByMilestone } })), 100);
export async function advanceMilestone(assetId: string, m: MilestoneId): Promise<void> {
  ms = ms.map((a) => {
    if (a.id !== assetId) return a;
    const cur = a.stateByMilestone[m];
    const next: MsState = cur === 'Not started' ? 'In progress' : cur === 'In progress' ? 'Done' : 'Done';
    return { ...a, stateByMilestone: { ...a.stateByMilestone, [m]: next } };
  });
  return delay(undefined, 80);
}
export { MILESTONES };

// ---------------------------------------------------------------- shift log
const shiftStore = createCollection<ShiftEntry>(shiftEntries);
export const listShifts = () => shiftStore.list();
export async function signShift(id: string): Promise<ShiftEntry> {
  const cur = (await shiftStore.get(id))!;
  return shiftStore.update(id, cur.signedOut ? { takenOver: true } : { signedOut: true });
}
export async function logShift(input: Omit<ShiftEntry, 'id' | 'signedOut' | 'takenOver'>): Promise<ShiftEntry> {
  return shiftStore.add({ ...input, id: shiftStore.nextId('SH-', 1), signedOut: false, takenOver: false });
}

// ---------------------------------------------------------------- contractor KPI
export const listContractorKpis = (): Promise<ContractorKpi[]> => delay(contractorKpis.map((c) => ({ ...c })), 100);
