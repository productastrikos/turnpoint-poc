import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { authenticate, readSession, writeSession } from './auth';

interface AuthCtx {
  /** Persona id of the signed-in user, or null on the login screen. */
  personaId: string | null;
  /** Returns true on success. */
  signIn: (username: string, password: string) => boolean;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [personaId, setPersonaId] = useState<string | null>(readSession);

  const signIn = useCallback((username: string, password: string) => {
    const id = authenticate(username, password);
    if (!id) return false;
    writeSession(id);
    setPersonaId(id);
    return true;
  }, []);

  const signOut = useCallback(() => {
    writeSession(null);
    setPersonaId(null);
  }, []);

  const value = useMemo(() => ({ personaId, signIn, signOut }), [personaId, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
