import { useSyncExternalStore } from 'react';
import { subscribeWorkforce, workforceVersion } from '../../services/workforceService';

/** Re-renders the page whenever the shared attendance / mobilization store changes (sync, simulate, reset). */
export function useWorkforce(): number {
  return useSyncExternalStore(subscribeWorkforce, workforceVersion);
}
