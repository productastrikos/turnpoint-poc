import { exchangers, itps, STAGES, type Cell, type CellState, type Exchanger, type Itp, type Remark, type StageId } from '../mocks/qaqcMock';
import { delay } from './_util';
import { createCollection } from './_collection';
import { pushSapStatus } from './integrationService';

const exStore = createCollection<Exchanger>(exchangers);
const itpStore = createCollection<Itp>(itps);

export const listExchangers = () => exStore.list();
export const listItps = () => itpStore.list();

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

// ---------------- ITP ----------------
export async function recordPoint(id: string, canApproveHold: boolean): Promise<ActResult> {
  const itp = (await itpStore.get(id))!;
  const idx = itp.points.findIndex((p) => !p.done);
  if (idx === -1) return { ok: false, error: 'All points complete' };
  if (itp.points[idx].type === 'H' && !canApproveHold) return delay({ ok: false, error: 'Hold point: needs an OQ inspector to attend and sign.' }, 80);
  await itpStore.update(id, { points: itp.points.map((p, i) => (i === idx ? { ...p, done: true } : p)) });
  return delay({ ok: true }, 120);
}
