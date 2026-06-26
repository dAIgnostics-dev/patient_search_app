import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assertTruthy(value, label) {
  if (!value) throw new Error(`Expected truthy value for ${label}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const root = process.cwd();
const practitioner = readJson(join(root, 'mock-data/practitioners/1466.json'));
const accounts = readJson(join(root, 'amplify/functions/auth-proxy/accounts.json'));

assertTruthy(practitioner.id, 'mock practitioner id');
assertTruthy(practitioner.name?.[0]?.family, 'mock practitioner family');
assertTruthy(practitioner.identifier?.[0]?.value, 'mock practitioner identifier');

const account = accounts.find((item) => item.practitionerId === practitioner.id);
assertTruthy(account, 'account entry for mock practitioner');
assertTruthy(account.username, 'account username');
assertTruthy(account.hzjzId, 'account hzjz id');

console.log('Mapper/input validation passed.');
