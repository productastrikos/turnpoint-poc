import { useEffect, useState, useSyncExternalStore } from 'react';
import { getFreezeReadiness, getScopeState, subscribeScope, type FreezeReadiness, type ScopeState } from '../../services/scopeService';
import type { Job } from '../../types';

/** Live scope lifecycle (stage, baseline, certificates, variations). Re-renders on every change. */
export function useScope(): ScopeState {
  return useSyncExternalStore(subscribeScope, getScopeState, getScopeState);
}

/** Readiness-to-freeze checks, recomputed whenever the worklist or the variations change. */
export function useReadiness(jobs: Job[]): FreezeReadiness | null {
  const scope = useScope();
  const [r, setR] = useState<FreezeReadiness | null>(null);
  useEffect(() => {
    let live = true;
    getFreezeReadiness().then((x) => live && setR(x));
    return () => {
      live = false;
    };
  }, [jobs, scope.version]);
  return r;
}

export type ScopePhase = 'Pre-freeze' | 'Baseline' | 'Post-freeze';

/** Which side of the freeze an item sits on. Before the freeze everything is pre-freeze. */
export function phaseOf(job: Job, scope: ScopeState): ScopePhase {
  if (scope.stage === 'pre-freeze') return 'Pre-freeze';
  return job.inBaseline ? 'Baseline' : 'Post-freeze';
}
