import { useEffect, useState, useSyncExternalStore } from 'react';
import { getHubState, subscribeHub, type HubState } from '../../services/integrationService';

export function useHub(): HubState {
  return useSyncExternalStore(subscribeHub, getHubState, getHubState);
}

/** Forces a re-render every `ms` so relative timestamps ("2 min ago") keep ticking. */
export function useTick(ms = 15_000): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}
