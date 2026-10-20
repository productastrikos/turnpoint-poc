import { createContext, useContext } from 'react';
import type { AccessLevel } from './access';

/** Access level of the current user for the page being shown. Provided by AppShell. */
export const AccessCtx = createContext<AccessLevel>('full');

export function useCanEdit(): boolean {
  return useContext(AccessCtx) === 'full';
}
