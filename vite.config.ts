import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { createAuditMiddleware } from './server/auditMiddleware';
import { createAuthMiddleware } from './server/authMiddleware';
import { createCardReaderMiddleware } from './server/cardReaderMiddleware';
import { createLomNotificationMiddleware, defaultLomQueuePath } from './server/lomNotificationMiddleware';
import { createMockCezihMiddleware } from './server/mockCezihMiddleware';
import { createCezihIntegration } from './server/cezihProxy';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const accountsDir = path.join(rootDir, 'auth/accounts');
const auditDir = path.join(rootDir, 'audit');
const mockCezihStorageFile = path.join(rootDir, 'mock-data/cezih-fhir-store.json');
const lomQueueFile = defaultLomQueuePath(rootDir);

export default defineConfig(({ mode, command, isPreview }) => {
  const env = loadEnv(mode, rootDir, '');
  if (env.VITE_CEZIH_MODE && !['mock', 'cert-offline', 'cert-live'].includes(env.VITE_CEZIH_MODE)) {
    throw new Error('VITE_CEZIH_MODE must be mock, cert-offline or cert-live.');
  }
  const live = env.VITE_CEZIH_MODE === 'cert-live';
  if (mode === 'cert-live' && !live) {
    throw new Error('cert-live mode was overridden; unset VITE_CEZIH_MODE in your shell and use .env.cert-live.');
  }
  if (live && (mode !== 'cert-live' || command !== 'serve' || isPreview)) {
    throw new Error('cert-live is available only through npm run dev:cert-live (local development).');
  }
  const cezih = createCezihIntegration(env, rootDir);
  return {
    plugins: [
      react(),
      {
        name: 'auth-middleware',
        configureServer(server) {
          server.middlewares.use(cezih.middleware);
          server.middlewares.use(createAuditMiddleware(auditDir));
          server.middlewares.use(createCardReaderMiddleware());
          server.middlewares.use(createAuthMiddleware(accountsDir));
          server.middlewares.use(createLomNotificationMiddleware(lomQueueFile));
          server.middlewares.use(createMockCezihMiddleware(mockCezihStorageFile));
        },
        configurePreviewServer(server) {
          server.middlewares.use(cezih.middleware);
          server.middlewares.use(createAuditMiddleware(auditDir));
          server.middlewares.use(createCardReaderMiddleware());
          server.middlewares.use(createAuthMiddleware(accountsDir));
          server.middlewares.use(createLomNotificationMiddleware(lomQueueFile));
          server.middlewares.use(createMockCezihMiddleware(mockCezihStorageFile));
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src'),
      },
    },
    server: {
      ...(live ? { host: '127.0.0.1', strictPort: true, proxy: cezih.proxy } : {}),
      fs: {
        deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx}', '**/.git/**', '**/.cezih-cert.local.json',
          ...['CEZIH_CA_FILE', 'CEZIH_CERT_FILE', 'CEZIH_KEY_FILE'].flatMap((name) =>
            env[name] ? [`**/${path.basename(env[name])}`] : [])],
      },
      watch: {
        ignored: ['**/mock-data/cezih-fhir-store.json'],
      },
    },
  };
});
