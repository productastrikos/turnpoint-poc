// Demo sign-in. A gate for the demo, NOT security: the usernames and the shared password are in the client bundle and
// pre-filled on the login screen so a meeting never stalls on a forgotten password. Real auth (SSO / the client IdP)
// is out of PoC scope. Each username opens the app as one persona from access.ts.
import { PERSONAS } from './access';

export const DEMO_PASSWORD = 'Turnpoint2026!';

/** username -> persona id. `admin` is the TA Event Manager (full rights); the rest are the persona ids, for trying a role. */
const USERS: Record<string, string> = { admin: 'ta-manager', ...Object.fromEntries(PERSONAS.map((p) => [p.id, p.id])) };

/** Pre-filled on the login screen. */
export const DEFAULT_USERNAME = 'admin';

const KEY = 'turnpoint-session';

/** Checks the credentials; returns the account's persona id, or null when they do not match. */
export function authenticate(username: string, password: string): string | null {
  const id = USERS[username.trim().toLowerCase()];
  return id && password === DEMO_PASSWORD ? id : null;
}

/** The persona id of the signed-in user for this browser tab session, if any. */
export function readSession(): string | null {
  try {
    const id = sessionStorage.getItem(KEY);
    return id && PERSONAS.some((p) => p.id === id) ? id : null;
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
