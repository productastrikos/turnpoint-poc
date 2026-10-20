import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_PERSONA, personaById, type AccessGroup, type AccessLevel, type Persona } from './access';
import type { ViewRole } from './roleTypes';

export type { ViewRole } from './roleTypes';

interface RoleCtx {
  /** Coarse role used by the original pages: cost visibility + approval rights. */
  role: ViewRole;
  persona: Persona;
  setPersona: (id: string) => void;
  levelFor: (group: AccessGroup) => AccessLevel;
}

const Ctx = createContext<RoleCtx | null>(null);

export function RoleProvider({ children, initialPersonaId }: { children: ReactNode; initialPersonaId?: string }) {
  const [personaId, setPersonaId] = useState<string>(initialPersonaId ?? DEFAULT_PERSONA.id);
  const value = useMemo<RoleCtx>(() => {
    const persona = personaById(personaId);
    return {
      role: persona.kind,
      persona,
      setPersona: setPersonaId,
      levelFor: (group) => persona.access[group],
    };
  }, [personaId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRole() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}
