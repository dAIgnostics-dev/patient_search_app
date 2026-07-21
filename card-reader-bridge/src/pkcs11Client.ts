import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CardIdentity, CardReaderStatus } from './types.js';

const execFileAsync = promisify(execFile);

export function resolvePkcs11Module(): string | null {
  const modulePath = process.env.PKCS11_MODULE?.trim();
  return modulePath || null;
}

export function parseSubjectDn(subject: string): Partial<CardIdentity> {
  const parts = subject.split(/[,/]/).map((part) => part.trim());
  const out: Partial<CardIdentity> = { certificateSubject: subject };

  for (const part of parts) {
    const [rawKey, ...rest] = part.split('=');
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join('=').trim();
    if (!key || !value) continue;

    if (key === 'gn' || key === 'givenname') out.givenName = value;
    if (key === 'sn' || key === 'surname') out.familyName = value;
    if (key === 'oib' || key === 'serialnumber') {
      const oibMatch = value.match(/\d{11}/);
      if (oibMatch) out.oib = oibMatch[0];
    }
    if (key === 'cn' && !out.givenName && !out.familyName) {
      const tokens = value.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        out.givenName = tokens[0];
        out.familyName = tokens.slice(1).join(' ');
      }
    }
  }

  return out;
}

async function runPkcs11Tool(args: string[]): Promise<string> {
  const modulePath = resolvePkcs11Module();
  if (!modulePath) {
    throw new Error('PKCS11_MODULE is not configured');
  }

  const { stdout } = await execFileAsync('pkcs11-tool', ['--module', modulePath, ...args], {
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

function parseSlotListing(stdout: string): Pick<CardReaderStatus, 'readerConnected' | 'cardPresent' | 'readerName'> {
  const normalized = stdout.trim();
  if (!normalized || /no slots/i.test(normalized)) {
    return { readerConnected: false, cardPresent: false };
  }

  const slotLine = normalized
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^Slot \d+/i.test(line));

  const readerName = slotLine?.replace(/^Slot \d+[^:]*:\s*/i, '').trim() || undefined;
  const readerConnected = Boolean(slotLine);
  const cardPresent = /token label/i.test(normalized);

  return {
    readerConnected,
    cardPresent,
    readerName: readerName || undefined,
  };
}

export async function probePkcs11Status(): Promise<CardReaderStatus> {
  const pkcs11Configured = Boolean(resolvePkcs11Module());
  if (!pkcs11Configured) {
    return {
      readerConnected: false,
      cardPresent: false,
      bridgeAvailable: true,
      mode: 'pkcs11',
      pkcs11Configured: false,
    };
  }

  try {
    const stdout = await runPkcs11Tool(['-L']);
    const parsed = parseSlotListing(stdout);
    return {
      ...parsed,
      bridgeAvailable: true,
      mode: 'pkcs11',
      pkcs11Configured: true,
    };
  } catch (error) {
    console.error(
      '[card-reader-bridge] PKCS#11 status probe failed:',
      error instanceof Error ? error.message : error,
    );
    return {
      readerConnected: false,
      cardPresent: false,
      bridgeAvailable: true,
      mode: 'pkcs11',
      pkcs11Configured: true,
    };
  }
}

export async function readPkcs11Identity(): Promise<CardIdentity | null> {
  try {
    const stdout = await runPkcs11Tool(['-O', '--type', 'cert']);
    const subjectMatch = stdout.match(/subject:\s*(.+)/i);
    if (!subjectMatch) return null;

    const parsed = parseSubjectDn(subjectMatch[1].trim());
    if (!parsed.givenName && !parsed.familyName && !parsed.oib) return null;

    return {
      cardId: parsed.oib ?? parsed.certificateSubject,
      givenName: parsed.givenName,
      familyName: parsed.familyName,
      oib: parsed.oib,
      certificateSubject: parsed.certificateSubject,
    };
  } catch (error) {
    console.error(
      '[card-reader-bridge] PKCS#11 identity read failed:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
