import {
  exchangers,
  STAGES,
  PO_STAGES,
  NCR_STAGE,
  DEMO_TODAY,
  DEMO_PO_POOL,
  poSeed,
  buildPoints,
  type Cell,
  type CellState,
  type Exchanger,
  type Itp,
  type PoNcr,
  type PoPoint,
  type PoRec,
  type PoStageId,
  type PointType,
  type Remark,
  type StageId,
} from '../mocks/qaqcMock';
import { materialItems } from '../mocks/materialsMock';
import { addDays, daysBetween } from '../mocks/_gen';
import type { Persona } from '../app/access';
import { delay } from './_util';
import { createCollection } from './_collection';
import { pushSapStatus } from './integrationService';

const exStore = createCollection<Exchanger>(exchangers);

export const listExchangers = () => exStore.list();

export type Action = 'request' | 'record' | 'clear' | 'rework';

const ALLOWED: Record<Action, CellState[]> = {
  request: ['Not requested', 'Rework'],
  record: ['Requested'],
  clear: ['Done'],
  rework: ['Requested', 'Done', 'Cleared'],
};
const TARGET: Record<Action, CellState> = { request: 'Requested', record: 'Done', clear: 'Cleared', rework: 'Rework' };

export function availableActions(ex: Exchanger, comp: string, stage: StageId): Action[] {
  const c = ex.components.find((x) => x.name === comp)!;
  const idx = STAGES.findIndex((s) => s.id === stage);
  const prevOk = idx === 0 || c.stages[STAGES[idx - 1].id].state === 'Cleared';
  const cell = c.stages[stage];
  return (Object.keys(ALLOWED) as Action[]).filter((a) => ALLOWED[a].includes(cell.state) && (a === 'rework' || a === 'record' || a === 'clear' || prevOk));
}

export interface ActResult {
  ok: boolean;
  error?: string;
}

/** One workflow step on one component and stage. Enforces stage control (previous stage cleared) and role-based clearance. */
export async function act(tag: string, comp: string, stage: StageId, action: Action, by: string, opts: { remarks?: string; canClear: boolean; reason?: string }): Promise<ActResult> {
  const ex = (await exStore.get(tag))!;
  const allowed = availableActions(ex, comp, stage);
  if (!allowed.includes(action)) return delay({ ok: false, error: 'Stage control: the previous stage must be cleared before this step.' }, 80);
  if (action === 'clear' && !opts.canClear) return delay({ ok: false, error: 'Role-based approval: only an OQ inspector can give clearance.' }, 80);
  if ((action === 'record' || action === 'clear' || action === 'rework') && !opts.remarks?.trim()) return delay({ ok: false, error: 'Remarks are required to record, clear or raise rework.' }, 80);

  const at = '2026-08-16T09:' + String(10 + Math.floor(Math.random() * 40)).padStart(2, '0') + ':00';
  const components = ex.components.map((c) => {
    if (c.name !== comp) return c;
    const cell = c.stages[stage];
    const next: Cell = {
      ...cell,
      state: TARGET[action],
      reworkCount: action === 'rework' ? cell.reworkCount + 1 : cell.reworkCount,
      reason: action === 'request' ? opts.reason ?? 'Awaiting inspector' : undefined,
      remarks: opts.remarks?.trim() ? [...cell.remarks, { at, by, text: opts.remarks.trim(), state: TARGET[action] } as Remark] : cell.remarks,
      signedBy: action === 'clear' ? by : action === 'rework' ? undefined : cell.signedBy,
      signedAt: action === 'clear' ? at : action === 'rework' ? undefined : cell.signedAt,
    };
    return { ...c, stages: { ...c.stages, [stage]: next } };
  });
  await exStore.update(tag, { components });
  if (action === 'clear' && stage === 'final') pushSapStatus('Maintenance Order status', tag, `${tag} ${comp}: final inspection cleared`);
  return delay({ ok: true }, 120);
}

export interface ExSummary {
  pct: number;
  cleared: number;
  total: number;
  currentStage: string;
  requestedNotDone: number;
  doneNotCleared: number;
  rework: number; // cells currently in rework
  reworkEver: number;
  status: 'Not started' | 'In progress' | 'Rework' | 'Cleared';
}

export function summarise(ex: Exchanger): ExSummary {
  const cells = ex.components.flatMap((c) => STAGES.map((s) => c.stages[s.id]));
  const cleared = cells.filter((c) => c.state === 'Cleared').length;
  const stageDone = STAGES.map((s) => ex.components.every((c) => c.stages[s.id].state === 'Cleared'));
  const idx = stageDone.findIndex((d) => !d);
  const rework = cells.filter((c) => c.state === 'Rework').length;
  return {
    pct: Math.round((cleared / cells.length) * 100),
    cleared,
    total: cells.length,
    currentStage: idx === -1 ? 'Complete' : STAGES[idx].name,
    requestedNotDone: cells.filter((c) => c.state === 'Requested').length,
    doneNotCleared: cells.filter((c) => c.state === 'Done').length,
    rework,
    reworkEver: cells.reduce((s, c) => s + c.reworkCount, 0),
    status: cleared === cells.length ? 'Cleared' : rework > 0 ? 'Rework' : cleared === 0 && !cells.some((c) => c.state !== 'Not requested') ? 'Not started' : 'In progress',
  };
}

export interface IncompleteRow {
  tag: string;
  component: string;
  stage: string;
  state: CellState;
  why: string;
}

/** Extraction of every inspection that is not complete, and why (SOW dry run #19). */
export function incomplete(list: Exchanger[]): IncompleteRow[] {
  const out: IncompleteRow[] = [];
  for (const ex of list)
    for (const c of ex.components)
      for (const s of STAGES) {
        const cell = c.stages[s.id];
        if (cell.state === 'Requested') out.push({ tag: ex.id, component: c.name, stage: s.name, state: cell.state, why: cell.reason ?? 'Awaiting inspector' });
        else if (cell.state === 'Done') out.push({ tag: ex.id, component: c.name, stage: s.name, state: cell.state, why: 'Inspection done, clearance not given yet' });
        else if (cell.state === 'Rework') out.push({ tag: ex.id, component: c.name, stage: s.name, state: cell.state, why: cell.remarks[cell.remarks.length - 1]?.text ?? 'Rework required' });
      }
  return out;
}

export interface RemarkRow extends Remark {
  tag: string;
  component: string;
  stage: string;
}

export function allRemarks(list: Exchanger[]): RemarkRow[] {
  const out: RemarkRow[] = [];
  for (const ex of list) for (const c of ex.components) for (const s of STAGES) c.stages[s.id].remarks.forEach((r) => out.push({ ...r, tag: ex.id, component: c.name, stage: s.name }));
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

// ======================================================================================================
// PO -> ITP -> acceptance pipeline (PBC 5 "digitalize QA/QC / acceptance workflows", PBC 6 "ITP tracking after PO issuance")
// One record per PO. Every step is a small pure function (Step) so the same rules run for a button click and for the
// demo helpers (fast-forward, simulate failure). Roles come from the persona (useRole); nothing here is real SAP / vendor-portal traffic.
// ======================================================================================================

const poStore = createCollection<PoRec>(poSeed);
const clockStore = createCollection<{ id: string; today: string }>([{ id: 'clock', today: DEMO_TODAY }]);

export interface PoState {
  pos: PoRec[];
  today: string;
}

export async function getPoState(): Promise<PoState> {
  const [pos, c] = await Promise.all([poStore.list(), clockStore.get('clock')]);
  return { pos, today: c!.today };
}

/** Back to the seeded pipeline and the seeded demo date. */
export async function resetPoDemo(): Promise<void> {
  poStore.reset();
  clockStore.reset();
  exStore.reset();
}

/** Demo clock: lets the presenter show an ITP review breaching its SLA without waiting. */
export async function advanceClock(days: number): Promise<string> {
  const c = (await clockStore.get('clock'))!;
  const today = addDays(c.today, days);
  await clockStore.update('clock', { today });
  return today;
}

export interface Actor {
  person: string;
  /** OQ QA/QC: approves ITPs, releases hold/witness points, raises and closes NCRs, issues certificates */
  qa: boolean;
  /** site stores / site QC: receipt and site acceptance inspection */
  site: boolean;
  /** vendor portal step (simulated): submit ITP, submit rework */
  vendor: boolean;
  label: string;
}

export function actorOf(persona: Persona): Actor {
  const qa = ['ta-manager', 'inspection'].includes(persona.id);
  return { person: persona.person, qa, site: qa || persona.id === 'planner', vendor: persona.id !== 'steerco', label: persona.label };
}

const DEMO_ACTOR: Actor = { person: 'Demo fast-forward', qa: true, site: true, vendor: true, label: 'Demo' };

export interface PoResult {
  ok: boolean;
  error?: string;
  message?: string;
  tone?: 'good' | 'warn' | 'crit' | 'accent';
  po?: PoRec;
}

interface Step {
  error?: string;
  next?: PoRec;
  message?: string;
  tone?: PoResult['tone'];
}

const NO_QA = 'Role-based approval: only OQ QA/QC (TA Event Manager or Inspection Engineer) can do this step.';
const NO_SITE = 'Role-based approval: only site stores / site QC can record receipt and site acceptance.';
const NO_VENDOR = 'This step belongs to the vendor (vendor portal).';

const openNcrs = (p: PoRec) => p.ncrs.filter((n) => n.status !== 'Closed');
const pendingPoints = (p: PoRec) => p.points.filter((x) => !x.done);
const stampOf = (today: string) => {
  const d = new Date();
  return `${today}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function evolve(p: PoRec, today: string, by: string, text: string, patch: Partial<PoRec>): PoRec {
  return { ...p, ...patch, events: [{ at: stampOf(today), by, text }, ...p.events] };
}
function moveTo(p: PoRec, today: string, by: string, text: string, stage: PoStageId, patch: Partial<PoRec> = {}): PoRec {
  return evolve(p, today, by, text, { ...patch, stage, stageSince: today });
}
const fail = (error: string): Step => ({ error });
const nextRev = (rev: string) => String.fromCharCode(rev.charCodeAt(0) + 1);

// ---- stage 1 -> 2
function sRequestItp(p: PoRec, a: Actor, t: string): Step {
  if (!a.qa) return fail(NO_QA);
  if (p.stage !== 'po') return fail('The ITP request has already been sent to the vendor.');
  return { next: moveTo(p, t, a.person, `ITP requested from ${p.vendor} (SLA 5 days)`, 'itp-submit'), message: `ITP request sent to ${p.vendor}. Vendor has 5 days to submit; PO ${p.id} moves to "Vendor submits ITP".`, tone: 'accent' };
}

// ---- stage 2 -> 3
function sSubmitItp(p: PoRec, a: Actor, t: string): Step {
  if (!a.vendor) return fail(NO_VENDOR);
  if (p.stage !== 'itp-submit') return fail(p.stage === 'po' ? 'OQ must send the ITP request first (stage 1).' : 'The ITP is already submitted or approved.');
  const rev = p.itpStatus === 'Rejected' ? nextRev(p.itpRev) : p.itpRev;
  const c = { at: stampOf(t), by: `${p.vendor} (vendor)`, text: `ITP Rev ${rev} submitted via vendor portal.${p.itpStatus === 'Rejected' ? ' Comments addressed.' : ''}`, kind: 'submitted' as const };
  return {
    next: moveTo(p, t, `${p.vendor} (vendor)`, `ITP Rev ${rev} submitted`, 'itp-review', { itpStatus: 'Submitted', itpRev: rev, itpSubmittedAt: t, itpComments: [...p.itpComments, c] }),
    message: `ITP Rev ${rev} submitted by ${p.vendor}. It is now in the OQ QA/QC review queue (3-day SLA).`,
    tone: 'accent',
  };
}

function sStartReview(p: PoRec, a: Actor, t: string): Step {
  if (!a.qa) return fail(NO_QA);
  if (p.itpStatus !== 'Submitted') return fail('Review can only start on a submitted ITP.');
  return { next: evolve(p, t, a.person, 'ITP review started', { itpStatus: 'Under review' }), message: `Review of ITP Rev ${p.itpRev} started by ${a.person}.`, tone: 'accent' };
}

// ---- stage 3 -> 4 (approve) or back to 2 (reject)
function sApprove(p: PoRec, a: Actor, t: string, comment?: string): Step {
  if (!a.qa) return fail(NO_QA);
  if (p.stage !== 'itp-review') return fail('There is no submitted ITP to approve at this PO.');
  const days = p.itpSubmittedAt ? daysBetween(p.itpSubmittedAt.slice(0, 10), t) : 0;
  const c = { at: stampOf(t), by: a.person, text: comment?.trim() || 'Approved without comments.', kind: 'approved' as const };
  return {
    next: moveTo(p, t, a.person, `ITP Rev ${p.itpRev} approved after ${days} day${days === 1 ? '' : 's'}`, 'schedule', { itpStatus: 'Approved', itpApprovedAt: t, itpComments: [...p.itpComments, c] }),
    message: `ITP Rev ${p.itpRev} approved after ${days} day${days === 1 ? '' : 's'} (SLA 3). ${p.points.filter((x) => x.type === 'H').length} hold points now need scheduling.`,
    tone: days > 3 ? 'warn' : 'good',
  };
}
function sReject(p: PoRec, a: Actor, t: string, comment?: string): Step {
  if (!a.qa) return fail(NO_QA);
  if (p.stage !== 'itp-review') return fail('There is no submitted ITP to reject at this PO.');
  if (!comment?.trim()) return fail('Comments are required to reject an ITP so the vendor knows what to fix.');
  const c = { at: stampOf(t), by: a.person, text: comment.trim(), kind: 'rejected' as const };
  return {
    next: moveTo(p, t, a.person, `ITP Rev ${p.itpRev} rejected with comments`, 'itp-submit', { itpStatus: 'Rejected', itpComments: [...p.itpComments, c] }),
    message: `ITP Rev ${p.itpRev} rejected. ${p.vendor} has been asked to resubmit as Rev ${nextRev(p.itpRev)}.`,
    tone: 'warn',
  };
}

// ---- stage 4 -> 5
function sSchedule(p: PoRec, a: Actor, t: string): Step {
  if (!a.qa) return fail(NO_QA);
  if (p.itpStatus !== 'Approved') return fail('Stage control: the ITP must be approved before inspection points can be scheduled.');
  if (p.stage !== 'schedule') return fail('Inspection points are already scheduled.');
  let k = 0;
  const points = p.points.map((x) => (x.done ? x : { ...x, planned: addDays(t, 3 + 3 * k++) }));
  const first = points.find((x) => !x.done);
  return {
    next: moveTo(p, t, a.person, `Inspection points scheduled (${points.length} points, first on ${first?.planned})`, 'fat', { points }),
    message: `${points.length} inspection points scheduled (${points.filter((x) => x.type === 'H').length} H, ${points.filter((x) => x.type === 'W').length} W). First: ${first?.name} on ${first?.planned}. Vendor and inspector notified.`,
    tone: 'good',
  };
}

// ---- stage 5 -> 6
function sRelease(p: PoRec, a: Actor, t: string, pointId?: string): Step {
  const next = p.points.find((x) => !x.done);
  if (p.stage !== 'fat') return fail(p.stage === 'po' || p.stage === 'itp-submit' || p.stage === 'itp-review' || p.stage === 'schedule' ? 'Stage control: inspection points are not open yet (ITP approval and scheduling come first).' : 'All inspection points are already released.');
  const pt = pointId ? p.points.find((x) => x.id === pointId) : next;
  if (!pt || !next) return fail('Point not found.');
  if (pt.type === 'H' || pt.type === 'W' ? !a.qa : !(a.qa || a.site)) return fail(`Role-based approval: a ${pt.type === 'H' ? 'hold' : pt.type === 'W' ? 'witness' : 'review/surveillance'} point must be signed by an OQ ${pt.type === 'H' || pt.type === 'W' ? 'inspector who attends' : 'QA/QC or site engineer'}. A contractor or vendor cannot close it.`);
  const open = openNcrs(p);
  if (open.length) return fail(`Stage control: ${open[0].id} is open. Close the NCR (vendor rework, then OQ verification) before the next inspection point can be released.`);
  if (pt.id !== next.id) return fail(`Stage control: "${next.name}" must be released first (points are signed in ITP order).`);
  const points = p.points.map((x) => (x.id === pt.id ? { ...x, done: true, doneAt: t, by: a.person } : x));
  const rest = points.filter((x) => !x.done);
  if (rest.length === 0) {
    const irnNo = `IRN-2026-${p.id.slice(-4)}`;
    return {
      next: moveTo(p, t, a.person, `Final inspection passed, inspection release note ${irnNo} issued. Vendor may ship.`, 'receipt', { points, irnNo }),
      message: `Last hold point released and signed. Inspection release note ${irnNo} issued: ${p.vendor} may ship, PO moves to receipt & site acceptance.`,
      tone: 'good',
    };
  }
  const label = pt.type === 'H' ? 'Hold' : pt.type === 'W' ? 'Witness' : pt.type === 'R' ? 'Review' : 'Surveillance';
  return { next: evolve(p, t, a.person, `${label} point released: ${pt.name}`, { points }), message: `${label} point "${pt.name}" released and signed by ${a.person}. ${rest.length} left (${rest.filter((x) => x.type === 'H').length} hold). Next: ${rest[0].name}.`, tone: 'good' };
}

// ---- NCR loop
function sRaiseNcr(p: PoRec, a: Actor, t: string, text?: string, pointName?: string): Step {
  if (!a.qa) return fail(NO_QA);
  if (p.stage !== 'fat' && p.stage !== 'receipt') return fail('An NCR is raised at the vendor inspection (stage 5) or the site acceptance inspection (stage 6).');
  if (!text?.trim()) return fail('Describe the non-conformance (the box above the buttons) before raising an NCR.');
  const id = `NCR-${p.id.slice(-4)}-${p.ncrs.length + 1}`;
  const ncr: PoNcr = { id, pointName: pointName ?? pendingPoints(p)[0]?.name ?? 'Site acceptance inspection', text: text.trim(), raisedAt: stampOf(t), raisedBy: a.person, origin: p.stage, status: 'Open' };
  pushSapStatus('Quality Notification', id, `${p.id} ${p.vendor}: ${ncr.pointName} - ${ncr.text.slice(0, 60)}`);
  return {
    next: evolve(p, t, a.person, `${id} raised: ${ncr.pointName}`, { ncrs: [...p.ncrs, ncr] }),
    message: `${id} raised. PO ${p.id} drops into the NCR / rework loop: further inspection points and the acceptance certificate are blocked until it is closed.`,
    tone: 'crit',
  };
}
function sSubmitRework(p: PoRec, a: Actor, t: string, ncrId: string): Step {
  if (!a.vendor) return fail(NO_VENDOR);
  const n = p.ncrs.find((x) => x.id === ncrId);
  if (!n || n.status !== 'Open') return fail('This NCR is not waiting for vendor rework.');
  return { next: evolve(p, t, `${p.vendor} (vendor)`, `${ncrId}: rework completed, re-inspection requested`, { ncrs: p.ncrs.map((x) => (x.id === ncrId ? { ...x, status: 'Rework submitted' as const } : x)) }), message: `${p.vendor} reports rework done on ${ncrId}. OQ QA/QC must verify and close it.`, tone: 'accent' };
}
function sCloseNcr(p: PoRec, a: Actor, t: string, ncrId: string): Step {
  if (!a.qa) return fail(NO_QA);
  const n = p.ncrs.find((x) => x.id === ncrId);
  if (!n || n.status === 'Closed') return fail('This NCR is already closed.');
  if (n.status === 'Open') return fail('Stage control: the vendor must submit the rework first, then OQ verifies it.');
  const ncrs = p.ncrs.map((x) => (x.id === ncrId ? { ...x, status: 'Closed' as const, closedAt: stampOf(t), closedBy: a.person } : x));
  const left = ncrs.filter((x) => x.status !== 'Closed').length;
  return { next: evolve(p, t, a.person, `${ncrId} verified and closed`, { ncrs }), message: `${ncrId} closed by ${a.person}.${left ? ` ${left} NCR still open.` : ` PO ${p.id} leaves the loop and returns to ${p.stage === 'receipt' ? 'site acceptance' : 'vendor inspection'}.`}`, tone: 'good' };
}

// ---- stage 6 -> 7
function sReceive(p: PoRec, a: Actor, t: string): Step {
  if (!a.site) return fail(NO_SITE);
  if (p.stage !== 'receipt') return fail(p.stage === 'fat' ? 'Stage control: the vendor inspection release note (IRN) has not been issued yet.' : 'Material is not at the receipt stage.');
  if (p.receivedOn) return fail('Material is already received.');
  return { next: evolve(p, t, a.person, 'Material received at site stores', { receivedOn: t }), message: `Material for PO ${p.id} received at site stores (IRN ${p.irnNo}). Site acceptance inspection can start.`, tone: 'accent' };
}
function sSiteAccept(p: PoRec, a: Actor, t: string): Step {
  if (!a.site) return fail(NO_SITE);
  if (p.stage !== 'receipt') return fail('Material is not at the receipt stage.');
  if (!p.receivedOn) return fail('Stage control: record the material receipt before the site acceptance inspection.');
  const open = openNcrs(p);
  if (open.length) return fail(`Stage control: ${open[0].id} is open. Close it before the site acceptance inspection can pass.`);
  return { next: moveTo(p, t, a.person, 'Site acceptance inspection passed', 'cert', { siteAcceptedOn: t }), message: `Site acceptance inspection passed for PO ${p.id}. Ready for the acceptance certificate.`, tone: 'good' };
}

// ---- stage 7 -> 8: the acceptance gate
export function certificateBlockers(p: PoRec): string[] {
  const out: string[] = [];
  if (p.itpStatus !== 'Approved') out.push(`the ITP is ${p.itpStatus.toLowerCase()}`);
  const pend = pendingPoints(p);
  const h = pend.filter((x) => x.type === 'H').length;
  const w = pend.filter((x) => x.type === 'W').length;
  if (h || w) out.push(`${h} hold and ${w} witness point${h + w === 1 ? '' : 's'} still open`);
  const nc = openNcrs(p);
  if (nc.length) out.push(`${nc.length} NCR${nc.length === 1 ? '' : 's'} open (${nc.map((n) => n.id).join(', ')})`);
  if (!p.irnNo && !pend.length) out.push('the inspection release note is missing');
  if (!p.receivedOn) out.push('material has not been received');
  else if (!p.siteAcceptedOn) out.push('the site acceptance inspection is not recorded');
  return out;
}
function sCertificate(p: PoRec, a: Actor, t: string, seq: number): Step {
  if (!a.qa) return fail(NO_QA);
  if (p.cert) return fail(`Certificate ${p.cert.no} was already issued.`);
  const blockers = certificateBlockers(p);
  if (blockers.length) return fail(`Stage control: acceptance certificate cannot be issued. ${blockers.map((b, i) => (i === 0 ? b.charAt(0).toUpperCase() + b.slice(1) : b)).join('; ')}.`);
  const no = `AC-2026-${String(seq).padStart(4, '0')}`;
  const workPack = `WP-${p.jobId.slice(2)}`;
  pushSapStatus('Goods Receipt', p.id, `${p.materialId}: quality inspection usage decision "accepted", stock released (certificate ${no})`);
  return {
    next: moveTo(p, t, a.person, `Acceptance certificate ${no} issued, released to work pack ${workPack}`, 'release', { cert: { no, issuedAt: stampOf(t), by: a.person, workPack } }),
    message: `Acceptance certificate ${no} issued. ${p.materialId} is released to work pack ${workPack} (job ${p.jobId}); the Work Packs readiness flag turns green.`,
    tone: 'good',
  };
}

// ---- fast-forward one stage (demo helper): composes the same steps with an all-roles actor
function sFastForward(p: PoRec, t: string, seq: number): Step {
  const a = DEMO_ACTOR;
  switch (p.stage) {
    case 'po':
      return sRequestItp(p, a, t);
    case 'itp-submit':
      return sSubmitItp(p, a, t);
    case 'itp-review':
      return sApprove(p, a, t, 'Reviewed against PO technical requirements. Approved.');
    case 'schedule':
      return sSchedule(p, a, t);
    case 'fat': {
      const open = openNcrs(p);
      if (open.length) {
        let cur = p;
        for (const n of open) {
          const r1 = n.status === 'Open' ? sSubmitRework(cur, a, t, n.id) : { next: cur };
          cur = r1.next ?? cur;
          const r2 = sCloseNcr(cur, a, t, n.id);
          if (r2.error || !r2.next) return r2;
          cur = r2.next;
        }
        return { next: cur, message: `Vendor rework done and verified: ${open.map((n) => n.id).join(', ')} closed. PO ${p.id} is back on the vendor inspection path.`, tone: 'good' };
      }
      let cur = p;
      let last: Step = fail('No points left.');
      while (cur.points.some((x) => !x.done)) {
        last = sRelease(cur, a, t);
        if (last.error || !last.next) return last;
        cur = last.next;
      }
      return { ...last, message: `All remaining inspection points released and signed. Inspection release note ${cur.irnNo} issued, PO ${p.id} moves to receipt & site acceptance.` };
    }
    case 'receipt': {
      const open = openNcrs(p);
      if (open.length) {
        let cur = p;
        for (const n of open) {
          const r1 = n.status === 'Open' ? sSubmitRework(cur, a, t, n.id) : { next: cur };
          cur = r1.next ?? cur;
          const r2 = sCloseNcr(cur, a, t, n.id);
          if (r2.error || !r2.next) return r2;
          cur = r2.next;
        }
        return { next: cur, message: `Replacement / rework verified: ${open.map((n) => n.id).join(', ')} closed. Site acceptance can continue.`, tone: 'good' };
      }
      let cur = p;
      if (!cur.receivedOn) {
        const r = sReceive(cur, a, t);
        if (r.error || !r.next) return r;
        cur = r.next;
      }
      const r = sSiteAccept(cur, a, t);
      return r.next ? { ...r, message: `Material received and site acceptance inspection passed. PO ${p.id} is ready for the acceptance certificate.` } : r;
    }
    case 'cert':
      return sCertificate(p, a, t, seq);
    default:
      return { error: `PO ${p.id} is already released to the work pack: nothing left to fast-forward.` };
  }
}

// ---- simulated inspection failure (demo helper)
const FAIL_TEXT: Record<string, string> = {
  'NDT witness (RT/UT)': 'RT film shows lack of fusion on welds. Weld repair and re-shoot required.',
  'Pressure / functional test': 'Pressure drop during the test: leak at nozzle flange. Rework and re-test required.',
  'Final inspection and release note': 'Final inspection found damaged nameplate and missing material certificate in the dossier. Vendor to correct and re-present.',
};
function sFailure(p: PoRec, t: string): Step {
  const a: Actor = { ...DEMO_ACTOR, person: 'A. Hinai (simulated)' };
  if (p.stage !== 'fat' && p.stage !== 'receipt') return fail('Inspection failures happen at the vendor inspection (stage 5) or the site acceptance inspection (stage 6). Fast-forward this PO to one of them first.');
  if (openNcrs(p).length) return fail(`${openNcrs(p)[0].id} is already open on this PO. Close it (vendor rework, OQ verification) first.`);
  if (p.stage === 'receipt') {
    if (!p.receivedOn) return fail('Material has not arrived yet. Fast-forward once more to receive it, then simulate a site acceptance failure.');
    return sRaiseNcr(p, a, t, 'Site acceptance inspection: transit damage on 2 of the delivered items and a missing material certificate. Vendor to replace and re-present.', 'Site acceptance inspection');
  }
  const next = pendingPoints(p)[0];
  if (!next) return fail('All inspection points are already released.');
  return sRaiseNcr(p, a, t, FAIL_TEXT[next.name] ?? `Non-conformance found during "${next.name}": dimensions outside drawing tolerance. Vendor to rework and re-present.`, next.name);
}

// ---------------- public async API ----------------
async function run(id: string, fn: (p: PoRec, today: string) => Step): Promise<PoResult> {
  const [p, c] = await Promise.all([poStore.get(id), clockStore.get('clock')]);
  if (!p) return { ok: false, error: `PO ${id} not found.` };
  const r = fn(p, c!.today);
  if (r.error || !r.next) return delay({ ok: false, error: r.error ?? 'Not allowed' }, 80);
  await poStore.update(id, r.next);
  return { ok: true, message: r.message, tone: r.tone, po: r.next };
}
async function nextCertSeq(): Promise<number> {
  const all = await poStore.list();
  return Math.max(1, ...all.map((x) => (x.cert ? Number(x.cert.no.slice(-4)) : 0))) + 1;
}

export const requestItp = (id: string, a: Actor) => run(id, (p, t) => sRequestItp(p, a, t));
export const submitItp = (id: string, a: Actor) => run(id, (p, t) => sSubmitItp(p, a, t));
export const startReview = (id: string, a: Actor) => run(id, (p, t) => sStartReview(p, a, t));
export const approveItp = (id: string, a: Actor, comment?: string) => run(id, (p, t) => sApprove(p, a, t, comment));
export const rejectItp = (id: string, a: Actor, comment?: string) => run(id, (p, t) => sReject(p, a, t, comment));
export const scheduleInspection = (id: string, a: Actor) => run(id, (p, t) => sSchedule(p, a, t));
export const releasePoint = (id: string, pointId: string, a: Actor) => run(id, (p, t) => sRelease(p, a, t, pointId));
export const raiseNcr = (id: string, a: Actor, text?: string) => run(id, (p, t) => sRaiseNcr(p, a, t, text));
export const submitRework = (id: string, ncrId: string, a: Actor) => run(id, (p, t) => sSubmitRework(p, a, t, ncrId));
export const closeNcr = (id: string, ncrId: string, a: Actor) => run(id, (p, t) => sCloseNcr(p, a, t, ncrId));
export const receiveMaterial = (id: string, a: Actor) => run(id, (p, t) => sReceive(p, a, t));
export const siteAccept = (id: string, a: Actor) => run(id, (p, t) => sSiteAccept(p, a, t));
export async function issueCertificate(id: string, a: Actor): Promise<PoResult> {
  const seq = await nextCertSeq();
  return run(id, (p, t) => sCertificate(p, a, t, seq));
}
export async function fastForward(id: string): Promise<PoResult> {
  const seq = await nextCertSeq();
  return run(id, (p, t) => sFastForward(p, t, seq));
}
export const simulateFailure = (id: string) => run(id, (p, t) => sFailure(p, t));

let demoSeq = 0;
/** Demo helper: a PR-raised material line becomes a PO and enters the pipeline at stage 1. */
export async function issueDemoPo(): Promise<PoResult> {
  const [all, c] = await Promise.all([poStore.list(), clockStore.get('clock')]);
  const today = c!.today;
  const used = new Set(all.map((x) => x.materialId));
  const pick = DEMO_PO_POOL.find((x) => !used.has(x.mto)) ?? DEMO_PO_POOL[demoSeq % DEMO_PO_POOL.length];
  const mat = materialItems.find((m) => m.id === pick.mto);
  demoSeq += 1;
  const no = `45000813${String(all.filter((x) => x.demo).length + 1).padStart(2, '0')}`;
  const itpNo = `ITP-${314 + all.filter((x) => x.demo).length}`;
  const rec: PoRec = {
    id: no,
    itpNo,
    materialId: pick.mto,
    vendor: pick.vendor,
    item: pick.item,
    jobId: mat?.jobId ?? 'J-2201',
    area: mat?.area ?? 'Unit 100',
    poDate: today,
    valueOMR: mat?.estCostOMR ?? 40_000,
    requiredBy: mat?.requiredBy ?? '2026-09-02',
    stage: 'po',
    stageSince: today,
    itpStatus: 'Not submitted',
    itpRev: 'A',
    itpComments: [],
    points: buildPoints(no, 0),
    ncrs: [],
    events: [{ at: stampOf(today), by: 'OQ Procurement', text: `PO ${no} issued to ${pick.vendor} (SAP MM)` }],
    demo: true,
  };
  pushSapStatus('Purchase Order', no, `${pick.mto}: purchase order issued to ${pick.vendor}, ITP requested`);
  const po = await poStore.add(rec);
  return { ok: true, po, tone: 'accent', message: `PO ${no} issued to ${pick.vendor} for ${pick.mto}. It enters the pipeline at stage 1 and the ITP request is due.` };
}

// ---------------- derived views ----------------
export const displayStage = (p: PoRec): PoStageId | 'ncr' => (openNcrs(p).length ? 'ncr' : p.stage);

/** Days the PO has been in its current stage, or null where no clock runs (released, or goods still in transit). */
export function daysInStage(p: PoRec, today: string): number | null {
  const ds = displayStage(p);
  if (ds === 'release') return null;
  if (ds === 'ncr') return daysBetween(openNcrs(p)[0].raisedAt.slice(0, 10), today);
  if (ds === 'receipt') return p.receivedOn ? daysBetween(p.receivedOn.slice(0, 10), today) : null;
  return daysBetween(p.stageSince.slice(0, 10), today);
}
export function slaOf(stage: PoStageId | 'ncr'): number {
  return stage === 'ncr' ? NCR_STAGE.sla : PO_STAGES.find((s) => s.id === stage)!.sla;
}
export function breaching(p: PoRec, today: string): boolean {
  const d = daysInStage(p, today);
  const sla = slaOf(displayStage(p));
  return d !== null && sla > 0 && d > sla;
}

export function progressPct(p: PoRec): number {
  if (p.cert) return 100;
  const done = p.points.filter((x) => x.done).length;
  return Math.round((p.itpStatus === 'Approved' ? 20 : 0) + (50 * done) / p.points.length + (p.receivedOn ? 10 : 0) + (p.siteAcceptedOn ? 10 : 0));
}

export type AcceptanceStatus = 'Certified' | 'Blocked by NCR' | 'Ready for certificate' | 'Site inspection pending' | 'Awaiting receipt' | 'In vendor inspection' | 'Not started';
export function acceptanceStatus(p: PoRec): AcceptanceStatus {
  if (p.cert) return 'Certified';
  if (openNcrs(p).length) return 'Blocked by NCR';
  if (p.stage === 'cert') return 'Ready for certificate';
  if (p.stage === 'receipt') return p.receivedOn ? 'Site inspection pending' : 'Awaiting receipt';
  if (p.stage === 'fat') return 'In vendor inspection';
  return 'Not started';
}

export function nextPoint(p: PoRec): PoPoint | undefined {
  return pendingPoints(p)[0];
}
export function pointCounts(p: PoRec) {
  const c = (type: PointType) => ({ done: p.points.filter((x) => x.type === type && x.done).length, total: p.points.filter((x) => x.type === type).length });
  return { all: { done: p.points.filter((x) => x.done).length, total: p.points.length }, H: c('H'), W: c('W'), R: c('R'), S: c('S') };
}
export function nextInspectionDate(p: PoRec): string | undefined {
  return nextPoint(p)?.planned;
}
export const openNcrCount = (p: PoRec) => openNcrs(p).length;

export interface PoMetrics {
  awaitingItp: number;
  holdOverdue: number;
  ncrOpen: number;
  certs: number;
  cycleDays: number | null;
  slaBreaches: { po: PoRec; days: number }[];
  stage: Record<PoStageId | 'ncr', { count: number; breach: number; pos: PoRec[] }>;
}

export function poMetrics(list: PoRec[], today: string): PoMetrics {
  const stage = Object.fromEntries([...PO_STAGES, NCR_STAGE].map((s) => [s.id, { count: 0, breach: 0, pos: [] as PoRec[] }])) as PoMetrics['stage'];
  for (const p of list) {
    const ds = displayStage(p);
    stage[ds].count += 1;
    stage[ds].pos.push(p);
    if (breaching(p, today)) stage[ds].breach += 1;
  }
  const awaiting = list.filter((p) => p.itpStatus === 'Submitted' || p.itpStatus === 'Under review');
  const cycles = list.filter((p) => p.itpApprovedAt && p.itpSubmittedAt).map((p) => daysBetween(p.itpSubmittedAt!.slice(0, 10), p.itpApprovedAt!.slice(0, 10)));
  return {
    awaitingItp: awaiting.length,
    holdOverdue: list.reduce((n, p) => n + (p.stage === 'fat' ? p.points.filter((x) => !x.done && x.type === 'H' && x.planned && x.planned < today).length : 0), 0),
    ncrOpen: list.reduce((n, p) => n + openNcrs(p).length, 0),
    certs: list.filter((p) => p.cert).length,
    cycleDays: cycles.length ? Math.round((cycles.reduce((s, x) => s + x, 0) / cycles.length) * 10) / 10 : null,
    slaBreaches: awaiting.map((p) => ({ po: p, days: daysBetween((p.itpSubmittedAt ?? p.stageSince).slice(0, 10), today) })).filter((x) => x.days > 3).sort((a, b) => b.days - a.days),
    stage,
  };
}

// ---------------- legacy "ITP tracking" tab: a read-only projection of the PO records (kept so that tab keeps working) ----------------
export async function listItps(): Promise<Itp[]> {
  const { pos } = await getPoState();
  return pos
    .filter((p) => p.itpStatus === 'Approved')
    .map((p) => ({
      id: p.itpNo,
      materialId: p.materialId,
      po: p.id,
      vendor: p.vendor,
      item: p.item,
      points: p.points.map((x) => ({ name: x.name, type: x.type, done: x.done })),
      note: openNcrs(p).length ? `${openNcrs(p)[0].id} open: ${openNcrs(p)[0].pointName}` : p.stage === 'fat' && nextPoint(p)?.type === 'H' && (nextPoint(p)?.planned ?? '9') < DEMO_TODAY ? `Hold point (${nextPoint(p)!.name}) is overdue and needs OQ inspector attendance at the vendor` : undefined,
    }));
}

/** Record the next inspection point of an ITP (legacy tab button). Same stage control as the PO drawer. */
export async function recordPoint(itpNo: string, canApproveHold: boolean): Promise<ActResult> {
  const { pos } = await getPoState();
  const p = pos.find((x) => x.itpNo === itpNo);
  if (!p) return { ok: false, error: 'ITP not found' };
  const r = await releasePoint(p.id, nextPoint(p)?.id ?? '', { ...DEMO_ACTOR, person: 'Inspector', qa: canApproveHold, site: canApproveHold, label: 'Inspector' });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
