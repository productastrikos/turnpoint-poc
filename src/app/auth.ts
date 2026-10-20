// Demo sign-in. A gate for the demo, NOT security: the accounts and the shared password are in the client bundle and
// pre-filled on the login screen so a meeting never stalls on a forgotten password. Real auth (SSO / the client's IdP)
// is out of PoC scope. Each account opens the app as one persona from access.ts.
import { PERSONAS } from './access';

export const DEMO_PASSWORD = 'Turnpoint2026!';

export interface DemoAccount {
  email: string;
  personaId: string;
  label: string;
  org: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = PERSONAS.map((p) => ({
  email: `${p.id}@turnpoint.demo`,
  personaId: p.id,
  label: p.label,
  org: p.org,
}));

/** Pre-filled on the login screen: the TA Event Manager, who has full rights everywhere. */
export const DEFAULT_ACCOUNT = DEMO_ACCOUNTS[0];

const KEY = 'turnpoint-session';

/** Checks the credentials; returns the account's persona id, or null when they do not match. */
export function authenticate(email: string, password: string): string | null {
  const acct = DEMO_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase());
  return acct && password === DEMO_PASSWORD ? acct.personaId : null;
}

/** The persona id of the signed-in user for this browser tab session, if any. */
export function readSession(): string | null {
  try {
    const id = sessionStorage.getItem(KEY);
    return id && DEMO_ACCOUNTS.some((a) => a.personaId === id) ? id : null;
  } catch {
    return null;
  }
}

export function writeSession(personaId: string | null): void {
  try {
    if (personaId) sessionStorage.setItem(KEY, personaId);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the session just does not survive a reload */
  }
}
