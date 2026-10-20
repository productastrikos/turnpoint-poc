// Critical Path Method scheduler for the P6 stand-in: forward and backward pass over finish-to-start logic with lags
// (negative lag = lead), "start on or after" and "finish on or before" constraints, progress at the data date.
// Times are TA days, end-of-day (an activity "finishing on Day 21" ends at 21.0). Total float = late - early finish;
// it goes negative when a constraint is missed, as it does in P6.

export interface CpmActivity {
  id: string;
  remaining: number; // remaining duration, days
  preds: { id: string; lag: number }[];
  /** Started before the data date: it continues from the data date with its remaining duration. */
  started?: boolean;
  complete?: boolean;
  actualFinish?: number;
  startOnOrAfter?: number;
  finishOnOrBefore?: number;
}

export interface CpmResult {
  es: Record<string, number>;
  ef: Record<string, number>;
  lf: Record<string, number>;
  tf: Record<string, number>;
  /** Project finish (latest early finish) and the chain of activities that drives it, last first. */
  finish: number;
  driving: string[];
}

function order(acts: CpmActivity[]): CpmActivity[] {
  const byId = new Map(acts.map((a) => [a.id, a]));
  const out: CpmActivity[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (a: CpmActivity) => {
    if (state.get(a.id) === 2) return;
    if (state.get(a.id) === 1) throw new Error(`Logic loop at ${a.id}`);
    state.set(a.id, 1);
    a.preds.forEach((p) => { const pa = byId.get(p.id); if (pa) visit(pa); });
    state.set(a.id, 2);
    out.push(a);
  };
  acts.forEach(visit);
  return out;
}

export function schedule(acts: CpmActivity[], dataDate: number): CpmResult {
  const seq = order(acts);
  const es: Record<string, number> = {};
  const ef: Record<string, number> = {};
  for (const a of seq) {
    if (a.complete) {
      ef[a.id] = a.actualFinish ?? dataDate;
      es[a.id] = ef[a.id];
      continue;
    }
    const logic = a.preds.filter((p) => ef[p.id] !== undefined).map((p) => ef[p.id] + p.lag);
    const start = a.started ? dataDate : Math.max(dataDate, a.startOnOrAfter ?? -Infinity, ...logic);
    es[a.id] = start;
    ef[a.id] = start + a.remaining;
  }
  const finish = Math.max(...seq.map((a) => ef[a.id]));
  const succ = new Map<string, { id: string; lag: number }[]>();
  acts.forEach((a) => a.preds.forEach((p) => succ.set(p.id, [...(succ.get(p.id) ?? []), { id: a.id, lag: p.lag }])));
  const lf: Record<string, number> = {};
  const ls: Record<string, number> = {};
  for (const a of [...seq].reverse()) {
    const fromSucc = (succ.get(a.id) ?? []).map((s) => ls[s.id] - s.lag);
    let late = fromSucc.length ? Math.min(...fromSucc) : finish;
    if (a.finishOnOrBefore !== undefined) late = Math.min(late, a.finishOnOrBefore);
    lf[a.id] = late;
    ls[a.id] = late - (a.complete ? 0 : a.remaining);
  }
  const tf = Object.fromEntries(seq.map((a) => [a.id, lf[a.id] - ef[a.id]]));
  // driving chain: from the activity that sets the finish, back through the predecessor whose logic set each start
  const byId = new Map(acts.map((a) => [a.id, a]));
  const driving: string[] = [];
  let cur = seq.reduce((b, a) => (ef[a.id] > ef[b.id] ? a : b), seq[0]);
  while (cur) {
    driving.push(cur.id);
    const c: CpmActivity = cur;
    const next = c.preds.find((p) => ef[p.id] !== undefined && Math.abs(ef[p.id] + p.lag - es[c.id]) < 1e-6);
    cur = next ? byId.get(next.id)! : (undefined as unknown as CpmActivity);
  }
  return { es, ef, lf, tf, finish, driving };
}
