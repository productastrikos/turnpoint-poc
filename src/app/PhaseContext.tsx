import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { Phase } from '../types';

interface PhaseCtx {
  activePhase: Phase;
  setActivePhase: Dispatch<SetStateAction<Phase>>;
}

const Ctx = createContext<PhaseCtx | null>(null);

export function PhaseProvider({ children }: { children: ReactNode }) {
  const [activePhase, setActivePhase] = useState<Phase>('execution');
  return <Ctx.Provider value={{ activePhase, setActivePhase }}>{children}</Ctx.Provider>;
}

export function usePhase() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePhase must be used within PhaseProvider');
  return ctx;
}
