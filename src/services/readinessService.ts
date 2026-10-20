import { STAGE_ITEMS, readyComponents, readyGaps, readySystems, type ReadyComponent, type ReadyGap, type ReadyStage, type ReadySystem } from '../mocks/readinessMock';
import { delay } from './_util';
import { pushSapStatus } from './integrationService';

let systems: ReadySystem[] = readySystems.map((s) => ({ ...s, items: { walkdown: [...s.items.walkdown], pssr: [...s.items.pssr], startup: [...s.items.startup] } }));
let gaps: ReadyGap[] = readyGaps.map((g) => ({ ...g }));

export { STAGE_ITEMS };

export function systemPct(s: ReadySystem, stage: ReadyStage): number {
  const items = s.items[stage];
  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

export async function getSystems(): Promise<ReadySystem[]> {
  return delay(systems.map((s) => ({ ...s, items: { walkdown: [...s.items.walkdown], pssr: [...s.items.pssr], startup: [...s.items.startup] } })), 150);
}

export async function toggleItem(systemId: string, stage: ReadyStage, index: number): Promise<ReadySystem> {
  systems = systems.map((s) => {
    if (s.id !== systemId) return s;
    const arr = [...s.items[stage]];
    arr[index] = !arr[index];
    return { ...s, items: { ...s.items, [stage]: arr } };
  });
  const sys = systems.find((s) => s.id === systemId)!;
  if (systemPct(sys, stage) === 100) pushSapStatus('System / user status', sys.id, `${sys.name}: ready for ${stage === 'walkdown' ? 'walkdown' : stage === 'pssr' ? 'PSSR sign-off' : 'start-up'}`);
  return delay(sys, 100);
}

export interface ReadinessSnapshot {
  components: (ReadyComponent & { effective: number })[];
  composite: number;
  gaps: ReadyGap[];
}

/** Composite = weighted average of component scores. Closing a gap lifts its component. Start-up readiness is the average of the three stage boards. */
export async function getReadiness(): Promise<ReadinessSnapshot> {
  const stageAvg = (st: ReadyStage) => systems.reduce((s, x) => s + systemPct(x, st), 0) / systems.length;
  const startupBoard = Math.round((stageAvg('walkdown') + stageAvg('pssr') + stageAvg('startup')) / 3);
  const components = readyComponents.map((c) => {
    const lift = gaps.filter((g) => g.component === c.id && g.closed).reduce((s, g) => s + g.lift, 0);
    const base = c.id === 'startup' ? startupBoard : c.score;
    return { ...c, effective: Math.min(100, base + lift) };
  });
  const totalW = components.reduce((s, c) => s + c.weight, 0);
  const composite = Math.round(components.reduce((s, c) => s + c.effective * c.weight, 0) / totalW);
  return delay({ components, composite, gaps: gaps.map((g) => ({ ...g })) }, 150);
}

export async function closeGap(id: string): Promise<void> {
  gaps = gaps.map((g) => (g.id === id ? { ...g, closed: !g.closed } : g));
  return delay(undefined, 120);
}
