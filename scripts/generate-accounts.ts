/**
 * Generate practitioner login accounts from mock-data/practitioners/.
 *
 * Usage: npm run auth:generate
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const practitionersDir = join(scriptDir, '../mock-data/practitioners');
const accountsDir = join(scriptDir, '../auth/accounts');
const lambdaAccountsPath = join(scriptDir, '../amplify/functions/auth-proxy/accounts.json');
const DEFAULT_PASSWORD = 'cezih-demo';

interface FhirPractitioner {
  id: string;
  identifier?: Array<{ system?: string; value?: string }>;
  name?: Array<{ family?: string; given?: string[] }>;
}

const HZJZ_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/HZJZ-broj-zdravstvenog-djelatnika';

function slugify(given: string, family: string): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '');
  return `${normalize(given)}.${normalize(family)}`;
}

mkdirSync(accountsDir, { recursive: true });

const files = readdirSync(practitionersDir).filter((f) => f.endsWith('.json'));
const generated: string[] = [];
const lambdaAccounts: Array<{
  username: string;
  password: string;
  practitionerId: string;
  hzjzId: string;
  firstName: string;
  lastName: string;
}> = [];

for (const file of files) {
  const resource = JSON.parse(
    readFileSync(join(practitionersDir, file), 'utf8'),
  ) as FhirPractitioner;

  const name = resource.name?.[0];
  const firstName = name?.given?.[0] ?? 'Unknown';
  const lastName = name?.family ?? 'Practitioner';
  const hzjzId =
    resource.identifier?.find((i) => i.system === HZJZ_SYSTEM)?.value ?? resource.id;
  const username = slugify(firstName, lastName);

  const content = [
    `username=${username}`,
    `password=${DEFAULT_PASSWORD}`,
    `practitionerId=${resource.id}`,
    `hzjzId=${hzjzId}`,
    `firstName=${firstName}`,
    `lastName=${lastName}`,
    '',
  ].join('\n');

  const outPath = join(accountsDir, `${resource.id}.txt`);
  writeFileSync(outPath, content, 'utf8');
  lambdaAccounts.push({
    username,
    password: DEFAULT_PASSWORD,
    practitionerId: resource.id,
    hzjzId,
    firstName,
    lastName,
  });
  generated.push(`${username} / ${DEFAULT_PASSWORD} (${firstName} ${lastName}, id ${resource.id})`);
}

writeFileSync(lambdaAccountsPath, `${JSON.stringify(lambdaAccounts, null, 2)}\n`, 'utf8');

console.log(`Wrote ${generated.length} account file(s) to auth/accounts/:\n`);
console.log(`Wrote auth-proxy bundle accounts to amplify/functions/auth-proxy/accounts.json\n`);
for (const line of generated) console.log(`  ${line}`);
