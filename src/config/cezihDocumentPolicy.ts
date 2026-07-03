function readEnv(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const value = (import.meta.env as Record<string, string | undefined>)[key];
    if (value?.trim()) return value.trim();
  }
  if (typeof process !== 'undefined' && process.env[key]?.trim()) {
    return process.env[key]!.trim();
  }
  return undefined;
}

/** Max ms after document.date for edit/cancel; null = unlimited (default). */
export function resolveDocumentEditWindowMs(): number | null {
  const raw = readEnv('VITE_DOCUMENT_EDIT_WINDOW_MS');
  if (!raw || raw.toLowerCase() === 'unlimited') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** LOM notification endpoint; null = mock middleware. */
export function resolveLomNotificationUrl(): string | null {
  const raw = readEnv('VITE_LOM_NOTIFICATION_URL');
  return raw ? raw.replace(/\/+$/, '') : null;
}
