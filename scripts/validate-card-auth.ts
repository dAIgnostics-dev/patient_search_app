import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cardIdentityNamesMatch,
  findAccountByCardIdentity,
  findAccountByUsername,
  loadAccounts,
  MOCK_CARD_LOGIN_USERNAME,
  normalizePersonName,
  toSessionPayload,
} from '../server/cardAuthShared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const accountsDir = join(root, 'auth/accounts');

function assertMatch(
  identity: { givenName?: string; familyName?: string; oib?: string },
  expectedPractitionerId: string,
): void {
  const accounts = loadAccounts(accountsDir);
  const match = findAccountByCardIdentity(accounts, identity);
  assert(match, `Expected account match for ${identity.givenName} ${identity.familyName}`);
  assert.equal(match.practitionerId, expectedPractitionerId);
  const payload = toSessionPayload(match);
  assert.equal(payload.practitionerId, expectedPractitionerId);
}

assert.equal(normalizePersonName('Marković'), 'markovic');
assert.equal(normalizePersonName('MARKOVIĆ'), 'markovic');

assertMatch({ givenName: 'Ana', familyName: 'Marković' }, '1466');
assertMatch({ givenName: 'ANA', familyName: 'markovic' }, '1466');

const accounts = loadAccounts(accountsDir);
const unknown = findAccountByCardIdentity(accounts, {
  givenName: 'Nepoznata',
  familyName: 'Osoba',
});
assert.equal(unknown, null, 'Unknown card identity must not match');

assert.equal(
  cardIdentityNamesMatch({ givenName: 'Ana' }, { givenName: 'ANA', familyName: 'markovic' }),
  true,
  'Entered and card given names should match with normalization',
);

assert.equal(
  cardIdentityNamesMatch({ givenName: 'Ivan' }, { givenName: 'Ana', familyName: 'Marković' }),
  false,
  'Different given names should not match',
);

const mockAccount = findAccountByUsername(accounts, MOCK_CARD_LOGIN_USERNAME);
assert(mockAccount, 'Mock login account ana.markovic must exist');
assert.equal(mockAccount.username, 'ana.markovic');
assert.equal(mockAccount.practitionerId, '1466');

console.log('Card auth validation passed.');
