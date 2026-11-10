// The scenario clock for scope events. Before the freeze, everything is stamped on the freeze date; after it, on the
// status date the rest of the app uses (day 14 of the turnaround). The time of day is the real wall clock, so a live
// demo shows signatures and approvals in the order they happen.
import { STATUS_DATE } from '../mocks/_gen';
import { FREEZE_DATE } from '../mocks/scopeMock';

let post = false;

export function setClockPostFreeze(v: boolean) {
  post = v;
}

export const demoDate = () => (post ? STATUS_DATE : FREEZE_DATE);

const p2 = (n: number) => String(n).padStart(2, '0');

/** ISO local timestamp on the scenario date, e.g. 2026-06-12T10:20:31. `plusSec` staggers events inside one action. */
export function demoStamp(plusSec = 0): string {
  const t = new Date(Date.now() + plusSec * 1000);
  return `${demoDate()}T${p2(t.getHours())}:${p2(t.getMinutes())}:${p2(t.getSeconds())}`;
}
