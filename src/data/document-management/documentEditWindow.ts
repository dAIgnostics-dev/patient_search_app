import { resolveDocumentEditWindowMs } from '../../config/cezihDocumentPolicy';

export function isWithinDocumentEditWindow(documentDate: string | null | undefined): boolean {
  const windowMs = resolveDocumentEditWindowMs();
  if (windowMs == null) return true;
  if (!documentDate) return true;

  const documentTime = Date.parse(documentDate);
  if (Number.isNaN(documentTime)) return true;

  return Date.now() - documentTime <= windowMs;
}
