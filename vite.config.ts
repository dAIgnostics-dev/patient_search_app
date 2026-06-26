import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createAuditMiddleware } from './server/auditMiddleware';
import { createAuthMiddleware } from './server/authMiddleware';
import { createMockCezihMiddleware } from './server/mockCezihMiddleware';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const accountsDir = path.join(rootDir, 'auth/accounts');
const auditDir = path.join(rootDir, 'audit');
const mockCezihStorageFile = path.join(rootDir, 'mock-data/cezih-fhir-store.json');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'auth-middleware',
      configureServer(server) {
        server.middlewares.use(createAuditMiddleware(auditDir));
        server.middlewares.use(createAuthMiddleware(accountsDir));
        server.middlewares.use(createMockCezihMiddleware(mockCezihStorageFile));
      },
      configurePreviewServer(server) {
        server.middlewares.use(createAuditMiddleware(auditDir));
        server.middlewares.use(createAuthMiddleware(accountsDir));
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
    watch: {
      ignored: ['**/mock-data/cezih-fhir-store.json'],
    },
  },
});
