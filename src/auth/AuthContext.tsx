import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { resolveCardReaderLoginUrl } from '../config/runtime';
import { DEFAULT_PRACTITIONER_ROLE } from './roles';
import { logAuthLogin, logAuthLogout } from '../data/auditAccess';
import { createAuditSessionId, ensureAuditSessionId } from '../data/auditSession';
import { SESSION_STORAGE_KEY, type PractitionerSession } from './types';

export interface CardLoginInput {
  givenName: string;
}

interface AuthContextValue {
  session: PractitionerSession | null;
  loginWithCard: (input: CardLoginInput, locale?: string) => Promise<void>;
  logout: (locale?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): PractitionerSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PractitionerSession;
    const ensured = ensureAuditSessionId(parsed);
    const withRole: PractitionerSession = {
      ...ensured,
      role: ensured.role || DEFAULT_PRACTITIONER_ROLE,
    };
    if (!parsed.auditSessionId || !parsed.role) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(withRole));
    }
    return withRole;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PractitionerSession | null>(() => loadSession());

  const loginWithCard = useCallback(async (input: CardLoginInput, locale?: string) => {
    const response = await fetch(resolveCardReaderLoginUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        givenName: input.givenName.trim(),
      }),
    });

    const payload = (await response.json()) as PractitionerSession & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? 'card_login_failed');
    }

    const next: PractitionerSession = {
      practitionerId: payload.practitionerId,
      hzjzId: payload.hzjzId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      username: payload.username,
      role: payload.role || DEFAULT_PRACTITIONER_ROLE,
      auditSessionId: createAuditSessionId(),
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    logAuthLogin(next, locale, 'card');
  }, []);

  const logout = useCallback((locale?: string) => {
    const current = loadSession();
    if (current) logAuthLogout(current, locale);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, loginWithCard, logout }),
    [session, loginWithCard, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
