import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const checks = scripts['validate:architecture'].split(' && ').map((command) => {
  const name = command.match(/^npm run (validate:[a-z-]+)$/)?.[1];
  assert(name, 'Unexpected architecture check command.');
  const file = scripts[name]?.match(/^(?:node|tsx) (scripts\/validate-[a-z-]+\.(?:mjs|ts))$/)?.[1];
  assert(file, `Unexpected validation entry point: ${name}`);
  return file;
});
checks.push('scripts/validate-cezih-cert-offline.ts', 'scripts/validate-cezih-live.ts', 'scripts/validate-cezih-oauth.ts', 'scripts/validate-cezih-user-session.ts', 'scripts/validate-cezih-signing.ts');
for (const file of checks) {
  const result = spawnSync(process.execPath, ['--import', './scripts/offline-only.mjs', '--import', 'tsx', file], {
    stdio: 'inherit',
    env: { ...process.env, VITE_CEZIH_MODE: 'mock', ...(file.endsWith('validate-cezih-signing.ts') ? { TSX_TSCONFIG_PATH: 'tsconfig.app.json' } : {}) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`All ${checks.length} offline validations passed.`);
