import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync } from 'node:fs';
import type { ServerOptions as HttpsServerOptions } from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createAuditMiddleware } from './server/auditMiddleware';
import { createAuthMiddleware } from './server/authMiddleware';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const accountsDir = path.join(rootDir, 'auth/accounts');
const auditDir = path.join(rootDir, 'audit');
const cardCaDir = path.join(rootDir, 'auth/ca');

/**
 * Mode "card" (npm run dev:card / preview:card): serve over HTTPS and ask the
 * browser for a smart card client certificate, trusting only the CAs in auth/ca/.
 * rejectUnauthorized=false keeps the TLS connection open without a card so the
 * password login still works; /api/auth/card-login checks the result itself.
 */
function cardTlsOptions(): HttpsServerOptions {
  const ca = readdirSync(cardCaDir)
    .filter((f) => f.endsWith('.pem'))
    .map((f) => readFileSync(path.join(cardCaDir, f), 'utf8'));
  return { ca, requestCert: true, rejectUnauthorized: false };
}

export default defineConfig(({ mode }) => {
  const cardMode = mode === 'card';
  const https = cardMode ? cardTlsOptions() : undefined;

  return {
    plugins: [
      react(),
      ...(cardMode ? [basicSsl()] : []),
      {
        name: 'auth-middleware',
        configureServer(server) {
          server.middlewares.use(createAuditMiddleware(auditDir));
          server.middlewares.use(createAuthMiddleware(accountsDir));
        },
        configurePreviewServer(server) {
          server.middlewares.use(createAuditMiddleware(auditDir));
          server.middlewares.use(createAuthMiddleware(accountsDir));
        },
      },
    ],
    server: { https },
    preview: { https },
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src'),
      },
    },
  };
});
