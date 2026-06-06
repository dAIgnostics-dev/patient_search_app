import type { PractitionerSession } from '../auth/types';
import type { EncounterSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { formatFhirStatus } from '../utils/formatFhirCode';
import { formatDate } from '../utils/localeFormat';

interface EncounterTimelineProps {
  encounters: EncounterSummary[];
  viewerSession?: PractitionerSession;
  selectedId?: string | null;
  onSelect: (id: string) => void;
}

function isOwnEncounter(encounter: EncounterSummary, session?: PractitionerSession): boolean {
  if (!session) return false;
  if (encounter.practitionerFhirId === session.practitionerId) return true;
  if (encounter.practitionerHzjzId === session.hzjzId) return true;
  return false;
}

export function EncounterTimeline({
  encounters,
  viewerSession,
  selectedId,
  onSelect,
}: EncounterTimelineProps) {
  const { locale, t } = useLocale();

  const sorted = [...encounters].sort((a, b) => {
    const ta = a.start ? Date.parse(a.start) : 0;
    const tb = b.start ? Date.parse(b.start) : 0;
    return tb - ta;
  });

  if (sorted.length === 0) {
    return <p className="empty-section">{t('karton.emptyEncounters')}</p>;
  }

  return (
    <ol className="timeline">
      {sorted.map((enc) => {
        const own = isOwnEncounter(enc, viewerSession);
        const statusLabel = formatFhirStatus(enc.status, locale) ?? enc.status;

        return (
          <li key={enc.id}>
            <button
              type="button"
              className={`timeline-item ${own ? 'timeline-own' : ''} ${selectedId === enc.id ? 'timeline-selected' : ''}`}
              onClick={() => onSelect(enc.id)}
            >
              <span className="timeline-date">
                {formatDate(enc.start, locale) ?? t('common.emDash')}
              </span>
              <span className="timeline-title">
                {enc.classDisplay ?? enc.classCode ?? t('karton.encounter')}
                {own && <span className="timeline-badge">{t('karton.yourVisit')}</span>}
              </span>
              <span className="timeline-meta">
                {statusLabel}
                {enc.organizationName && ` · ${enc.organizationName}`}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
