import type { Connect } from 'vite';
import { CEZIH_USER_AUTH_ACTIONS, CEZIH_USER_AUTH_BASE } from '../src/config/cezihUserAuth';
import { createCezihMiddleware } from './cezihMiddleware';
import { createCezihUserSessions } from './cezihUserSession';

function readBody(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const deadline = setTimeout(() => reject(new Error('Invalid request.')), 10000);
    const fail = () => { clearTimeout(deadline); reject(new Error('Invalid request.')); };
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 4096) { fail(); return; }
      chunks.push(Buffer.from(chunk));
    });
    req.on('aborted', fail); req.on('error', fail);
    req.on('end', () => {
      clearTimeout(deadline);
      try {
        if (size && req.headers['content-type']?.split(';')[0] !== 'application/json') throw new Error();
        const body: unknown = size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
        resolve(body as Record<string, unknown>);
      } catch { fail(); }
    });
  });
}

export function createCezihUserAuth(live: boolean, now = Date.now) {
  const sessions = createCezihUserSessions(live, now);
  const gate = createCezihMiddleware(true);
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const path = (req.url ?? '').split('?')[0];
    if (!path.startsWith(CEZIH_USER_AUTH_BASE)) return next();
    const cookie = req.headers.cookie;
    const actionHeader = req.headers['x-cezih-user-action'];
    gate(req, res, () => {
      const action = CEZIH_USER_AUTH_ACTIONS.find((value) => path === CEZIH_USER_AUTH_BASE + value)!;
      res.setHeader('Content-Type', 'application/json');
      async function handle() {
        if (action !== 'status' && actionHeader !== '1') {
          res.statusCode = 403; res.end(JSON.stringify({ error: 'CEZIH_USER_ACTION_REQUIRED' })); return;
        }
        const body = action === 'status' ? {} : await readBody(req);
        const allowed = action === 'complete' ? ['challenge', 'result', 'actor'] : action === 'test' ? ['denied'] : [];
        if (Object.keys(body).some((key) => !allowed.includes(key))) throw new Error('Invalid request.');
        if (action === 'logout') {
          sessions.logout(cookie, req, res); res.end(JSON.stringify(sessions.status())); return;
        }
        const session = sessions.open(cookie, req, res);
        if (action !== 'status' && live) {
          res.statusCode = 501; res.end(JSON.stringify(sessions.status(session))); return;
        }
        if (action === 'start') sessions.start(session, req, res);
        if (action === 'complete') {
          if (typeof body.challenge !== 'string' || !['success', 'cancelled', 'card-unavailable', 'denied'].includes(String(body.result)) ||
            (body.actor !== 'ana' && body.actor !== 'luka')) throw new Error('Invalid request.');
          if (!sessions.completeSimulation(session, body.challenge, String(body.result), body.actor, req, res)) res.statusCode = 409;
        }
        if (action === 'expire') sessions.expire(session);
        if (action === 'test') {
          if (body.denied !== undefined && typeof body.denied !== 'boolean') throw new Error('Invalid request.');
          const result = sessions.test(session, body.denied === true);
          res.statusCode = result === 'allowed' ? 200 : result === 'denied' ? 403 : 401;
        }
        res.end(JSON.stringify(sessions.status(session)));
      }
      void handle().catch(() => {
        if (res.writableEnded || res.destroyed) return;
        res.statusCode = 400; res.end(JSON.stringify({ error: 'CEZIH_USER_INVALID_REQUEST' }));
      });
    });
  };
  return { sessions, middleware };
}
