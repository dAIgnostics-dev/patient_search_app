import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CEZIH_SIMULATION_USERS, type CezihUserAuthStatus, type CezihUserPrincipal } from '../src/config/cezihUserAuth';

const COOKIE = 'cezih_user_session';
const RETENTION_MS = 30 * 60 * 1000;
type Session = {
  id: string; state: CezihUserAuthStatus['state']; source: 'simulation' | 'cezih' | null;
  user: CezihUserPrincipal | null; upstream: string | null; expiresAt: number | null;
  challenge: string | null; retainUntil: number; check: CezihUserAuthStatus['check'];
  retiredIds: Set<string>;
};

export function createCezihUserSessions(live: boolean, now = Date.now) {
  const sessions = new Map<string, Session>();
  const random = () => randomBytes(32).toString('hex');
  function cookieId(header: string | undefined) {
    const values = (header ?? '').split(';').map((item) => item.trim()).filter((item) => item.startsWith(`${COOKIE}=`));
    if (values.length !== 1) return null;
    const id = values[0].slice(COOKIE.length + 1);
    return /^[a-f0-9]{64}$/.test(id) ? id : null;
  }
  function get(header: string | undefined) {
    for (const [id, value] of sessions) if (value.retainUntil <= now()) sessions.delete(id);
    const id = cookieId(header);
    const session = id ? sessions.get(id) : undefined;
    if (session && session.expiresAt !== null && session.expiresAt <= now()) {
      session.state = 'expired'; session.upstream = null; session.user = null; session.challenge = null; session.check = null;
    }
    return session;
  }
  function setCookie(req: IncomingMessage, res: ServerResponse, id: string, clear = false) {
    const secure = (req.socket as { encrypted?: boolean }).encrypted ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${COOKIE}=${id}; Path=/api/cezih; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : RETENTION_MS / 1000}${secure}`);
  }
  function open(header: string | undefined, req: IncomingMessage, res: ServerResponse) {
    const existing = get(header);
    if (existing) return existing;
    if (sessions.size >= 1000) throw new Error('CEZIH_USER_SESSION_CAPACITY');
    const session: Session = {
      id: random(), state: live ? 'not-configured' : 'signed-out', source: null, user: null,
      upstream: null, expiresAt: null, challenge: null, retainUntil: now() + RETENTION_MS, check: null, retiredIds: new Set(),
    };
    sessions.set(session.id, session);
    setCookie(req, res, session.id);
    return session;
  }
  function rotate(session: Session, req: IncomingMessage, res: ServerResponse) {
    if (sessions.get(session.id) !== session || session.retiredIds.size >= 64) throw new Error('CEZIH_USER_SESSION_RESTART_REQUIRED');
    // Retired IDs can revoke a rotated session, but can never authorize a request.
    session.retiredIds.add(session.id);
    sessions.delete(session.id); session.id = random(); session.retainUntil = now() + RETENTION_MS;
    sessions.set(session.id, session); setCookie(req, res, session.id);
  }
  function status(session?: Session): CezihUserAuthStatus {
    return {
      mode: live ? 'live' : 'simulation', state: session?.state ?? (live ? 'not-configured' : 'signed-out'),
      user: session?.user ? { ...session.user, roles: [...session.user.roles] } : null,
      expiresAt: session?.expiresAt ? new Date(session.expiresAt).toISOString() : null,
      challenge: !live ? session?.challenge ?? null : null, check: session?.check ?? null,
    };
  }
  return {
    get, open, status,
    start(session: Session, req: IncomingMessage, res: ServerResponse) {
      if (live) return false;
      rotate(session, req, res);
      Object.assign(session, { state: 'pending', source: null, user: null, upstream: null,
        challenge: random(), expiresAt: now() + 60000, check: null });
      return true;
    },
    completeSimulation(session: Session, challenge: string, result: string, actor: 'ana' | 'luka', req: IncomingMessage, res: ServerResponse) {
      if (live || session.state !== 'pending' || !session.challenge || !/^[a-f0-9]{64}$/.test(challenge) ||
        !timingSafeEqual(Buffer.from(session.challenge), Buffer.from(challenge)) || session.expiresAt! <= now()) return false;
      session.challenge = null;
      rotate(session, req, res);
      session.state = result === 'success' ? 'authenticated' : result as Session['state'];
      session.source = 'simulation'; session.expiresAt = result === 'success' ? now() + 300000 : null;
      session.user = result === 'success' ? structuredClone(CEZIH_SIMULATION_USERS[actor]) : null;
      session.check = null;
      return true;
    },
    // Server-only seam for the future verified SSO handoff; no HTTP route accepts these values.
    completeVerified(session: Session, user: CezihUserPrincipal, upstream: string, expiresAt: number, req: IncomingMessage, res: ServerResponse) {
      if (!live || !user.subject || !user.displayName || !user.roles.length || user.roles.some((role) => typeof role !== 'string' || !role) ||
        !upstream || upstream.length > 16384 || /[^\x21-\x7e]/.test(upstream) || !Number.isFinite(expiresAt) ||
        expiresAt <= now() || !Number.isFinite(new Date(expiresAt).getTime())) throw new Error('CEZIH_USER_INVALID_VERIFIED_SESSION');
      rotate(session, req, res);
      Object.assign(session, { state: 'authenticated', source: 'cezih', user: structuredClone(user),
        upstream, expiresAt: Math.min(expiresAt, now() + RETENTION_MS), challenge: null, check: null });
    },
    upstream(session?: Session) {
      if (!live || !session || sessions.get(session.id) !== session || session.state !== 'authenticated' ||
        session.source !== 'cezih' || session.expiresAt! <= now()) return null;
      return session.upstream;
    },
    expire(session: Session) {
      session.state = 'expired'; session.user = null; session.upstream = null; session.challenge = null; session.expiresAt = now(); session.check = null;
    },
    invalidate(session: Session, usedValue: string) {
      if (session.upstream === usedValue) this.expire(session);
    },
    test(session: Session, denied: boolean) {
      session.check = session.state !== 'authenticated' || session.expiresAt! <= now() ? 'requires-login' : denied ? 'denied' : 'allowed';
      return session.check;
    },
    logout(header: string | undefined, req: IncomingMessage, res: ServerResponse) {
      const id = cookieId(header);
      const session = id ? sessions.get(id) ?? [...sessions.values()].find((value) => value.retiredIds.has(id)) : undefined;
      if (session) {
        session.state = live ? 'not-configured' : 'signed-out'; session.upstream = null; session.user = null; session.challenge = null;
        sessions.delete(session.id);
      }
      setCookie(req, res, '', true);
    },
  };
}
