import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getTaEvents } from '../services/portfolioService';
import { ACTIVE_TA_ID } from '../mocks/master';
import type { TaEvent } from '../types/platform';

interface TaCtx {
  activeTaId: string;
  activeTa: TaEvent | undefined;
  tas: TaEvent[];
  setActiveTaId: (id: string) => void;
  refreshTas: () => void;
}

const Ctx = createContext<TaCtx | null>(null);

export function TaProvider({ children }: { children: ReactNode }) {
  const [tas, setTas] = useState<TaEvent[]>([]);
  const [activeTaId, setActiveTaId] = useState<string>(ACTIVE_TA_ID);

  const refreshTas = useCallback(() => {
    getTaEvents().then(setTas);
  }, []);

  useEffect(() => {
    refreshTas();
  }, [refreshTas]);

  const activeTa = tas.find((t) => t.id === activeTaId);
  return <Ctx.Provider value={{ activeTaId, activeTa, tas, setActiveTaId, refreshTas }}>{children}</Ctx.Provider>;
}

export function useActiveTa() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useActiveTa must be used within TaProvider');
  return ctx;
}
