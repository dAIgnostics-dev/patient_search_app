import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { resolveAuthLoginUrl } from '../config/runtime';
import { logAuthLogin, logAuthLogout } from '../data/auditAccess';
import { createAuditSessionId, ensureAuditSessionId } from '../data/auditSession';
import { SESSION_STORAGE_KEY, type PractitionerSession } from './types';

interface AuthContextValue {
  session: PractitionerSession | null;
  login: (username: string, password: string, locale?: string) => Promise<void>;
  logout: (locale?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): PractitionerSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PractitionerSession;
    const ensured = ensureAuditSessionId(parsed);
    if (!parsed.auditSessionId) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(ensured));
    }
    return ensured;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PractitionerSession | null>(() => loadSession());

  const login = useCallback(async (username: string, password: string, locale?: string) => {
    const response = await fetch(resolveAuthLoginUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const payload = (await response.json()) as PractitionerSession & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? 'Login failed');
    }

    const next: PractitionerSession = {
      practitionerId: payload.practitionerId,
      hzjzId: payload.hzjzId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      username: payload.username,
      auditSessionId: createAuditSessionId(),
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    logAuthLogin(next, locale);
  }, []);

  const logout = useCallback((locale?: string) => {
    const current = loadSession();
    if (current) logAuthLogout(current, locale);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, login, logout }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
