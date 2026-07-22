import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PractitionerAccount {
  username: string;
  password: string;
  practitionerId: string;
  hzjzId: string;
  firstName: string;
  lastName: string;
  role: string;
  oib?: string;
}

/**
 * POC default: aplikacija je namijenjena privatnicima. Ako account datoteka ne
 * navodi `role=`, liječnik dobiva ulogu `private_care_specialist`.
 */
export const DEFAULT_PRACTITIONER_ROLE = 'private_care_specialist';

export interface CardIdentityInput {
  cardId?: string;
  givenName?: string;
  familyName?: string;
  oib?: string;
  certificateSubject?: string;
}

export const MOCK_CARD_LOGIN_USERNAME = 'ana.markovic';

function parseAccountFile(content: string): PractitionerAccount | null {
  const fields: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    fields[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }

  const { username, password, practitionerId, hzjzId, firstName, lastName, role, oib } = fields;
  if (!username || !password || !practitionerId || !hzjzId || !firstName || !lastName) {
    return null;
  }

  return {
    username,
    password,
    practitionerId,
    hzjzId,
    firstName,
    lastName,
    role: role?.trim() || DEFAULT_PRACTITIONER_ROLE,
    oib,
  };
}

export function loadAccounts(accountsDir: string): PractitionerAccount[] {
  const files = readdirSync(accountsDir).filter((f) => f.endsWith('.txt'));
  const accounts: PractitionerAccount[] = [];

  for (const file of files) {
    const content = readFileSync(join(accountsDir, file), 'utf8');
    const account = parseAccountFile(content);
    if (account) accounts.push(account);
  }

  return accounts;
}

export function normalizePersonName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function findAccountByUsername(
  accounts: PractitionerAccount[],
  username: string,
): PractitionerAccount | null {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return null;
  return accounts.find((account) => account.username.trim().toLowerCase() === normalized) ?? null;
}

export function cardIdentityNamesMatch(
  entered: { givenName: string },
  card: CardIdentityInput,
): boolean {
  const cardGiven = card.givenName?.trim();
  if (!cardGiven) return false;

  return normalizePersonName(entered.givenName) === normalizePersonName(cardGiven);
}

export function findAccountByCardIdentity(
  accounts: PractitionerAccount[],
  identity: CardIdentityInput,
): PractitionerAccount | null {
  const oib = identity.oib?.trim();
  if (oib) {
    const byOib = accounts.find((account) => account.oib?.trim() === oib);
    if (byOib) return byOib;
  }

  const givenName = identity.givenName?.trim();
  const familyName = identity.familyName?.trim();
  if (!givenName || !familyName) return null;

  const normalizedGiven = normalizePersonName(givenName);
  const normalizedFamily = normalizePersonName(familyName);

  return (
    accounts.find(
      (account) =>
        normalizePersonName(account.firstName) === normalizedGiven &&
        normalizePersonName(account.lastName) === normalizedFamily,
    ) ?? null
  );
}

export function toSessionPayload(account: PractitionerAccount) {
  return {
    practitionerId: account.practitionerId,
    hzjzId: account.hzjzId,
    firstName: account.firstName,
    lastName: account.lastName,
    username: account.username,
    role: account.role || DEFAULT_PRACTITIONER_ROLE,
  };
}
