import { useEffect, useMemo, useRef, useState } from 'react';
import type { PractitionerSession } from '../auth/types';
import {
  logPatientKartonOpen,
  logPatientResourceView,
  type PatientAccessSource,
} from '../data/auditAccess';
import { healthlakeApiClient } from '../data/healthlakeApiClient';
import { addRecentPatient } from '../data/recentPatients';
import type {
  KartonSelection,
  PatientDetail as PatientDetailModel,
  PatientSectionKey,
  PatientSummary,
} from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import type { TranslationKey } from '../i18n/translations';
import { formatFhirStatus, formatFhirStatusPair } from '../utils/formatFhirCode';
import { formatDate } from '../utils/localeFormat';
import { practitionerDisplayName } from '../utils/practitionerDisplayName';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';
import { EncounterTimeline } from './EncounterTimeline';
import { KartonSection, type KartonSectionHandle } from './KartonSection';
import { KartonSectionNav } from './KartonSectionNav';
import { KartonSelectionPanel } from './KartonSelectionPanel';
import { KartonSkeleton } from './KartonSkeleton';
import { KartonSummary } from './KartonSummary';
import { PatientBanner } from './PatientBanner';

interface PatientKartonProps {
  patient: PatientSummary;
  viewerSession?: PractitionerSession;
  onBack: () => void;
  breadcrumbs?: BreadcrumbItem[];
  accessSource?: PatientAccessSource;
}

const SECTION_EMPTY_KEYS: Record<PatientSectionKey, TranslationKey> = {
  medications: 'karton.emptyMedications',
  allergies: 'karton.emptyAllergies',
  procedures: 'karton.emptyProcedures',
  documents: 'karton.emptyDocuments',
  referrals: 'karton.emptyReferrals',
};

const SECTION_TITLE_KEYS: Record<PatientSectionKey, TranslationKey> = {
  medications: 'karton.medications',
  allergies: 'karton.allergies',
  procedures: 'karton.procedures',
  documents: 'karton.documents',
  referrals: 'karton.referrals',
};

const SECTION_ID_KEYS: Record<PatientSectionKey, string> = {
  medications: 'section-medications',
  allergies: 'section-allergies',
  procedures: 'section-procedures',
  documents: 'section-documents',
  referrals: 'section-referrals',
};

const FALLBACK_LABEL_KEYS: Record<PatientSectionKey, TranslationKey> = {
  medications: 'karton.medication',
  allergies: 'karton.allergy',
  procedures: 'karton.procedure',
  documents: 'karton.document',
  referrals: 'karton.referral',
};

function isSelected(selection: KartonSelection | null, kind: KartonSelection['kind'], id: string) {
  return selection?.kind === kind && selection.id === id;
}

export function PatientKarton({
  patient,
  viewerSession,
  onBack,
  breadcrumbs,
  accessSource,
}: PatientKartonProps) {
  const { locale, t } = useLocale();
  const [detail, setDetail] = useState<PatientDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<KartonSelection | null>(null);
  const loggedRef = useRef<string | null>(null);
  const sectionRefs = useRef<Record<string, KartonSectionHandle | null>>({});

  function navigateToSection(id: string) {
    const section = sectionRefs.current[id];
    section?.expand();
    section?.scrollIntoView();
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSelection(null);
      loggedRef.current = null;
      try {
        const data = await healthlakeApiClient.getPatientDetailById(patient.id);
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('karton.loadPatientFailed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [patient.id, t]);

  useEffect(() => {
    if (loading || !viewerSession || !accessSource) return;
    if (loggedRef.current === patient.id) return;
    loggedRef.current = patient.id;

    if (error) {
      logPatientKartonOpen(viewerSession, patient, accessSource, 'error', locale);
      return;
    }
    if (!detail) {
      logPatientKartonOpen(viewerSession, patient, accessSource, 'not_found', locale);
      return;
    }

    addRecentPatient(viewerSession.practitionerId, patient);
    logPatientKartonOpen(viewerSession, patient, accessSource, 'success', locale);
  }, [loading, detail, error, viewerSession, accessSource, patient, locale]);

  useEffect(() => {
    if (!selection || !viewerSession) return;
    logPatientResourceView(viewerSession, patient, selection, accessSource, locale);
  }, [selection, viewerSession, patient, accessSource, locale]);

  const sectionNav = useMemo(
    () => [
      { id: 'section-timeline', label: t('karton.encounterTimeline') },
      { id: 'section-practitioners', label: t('karton.practitioners') },
      { id: 'section-conditions', label: t('karton.conditions') },
      { id: 'section-medications', label: t('karton.medications') },
      { id: 'section-allergies', label: t('karton.allergies') },
      { id: 'section-procedures', label: t('karton.procedures') },
      { id: 'section-documents', label: t('karton.documents') },
      { id: 'section-referrals', label: t('karton.referrals') },
    ],
    [t],
  );

  const navHeader = (
    <div className="karton-nav-header">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs items={breadcrumbs} />
      ) : (
        <button type="button" className="back-button" onClick={onBack}>
          {t('karton.back')}
        </button>
      )}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <button type="button" className="back-button back-button-compact" onClick={onBack} aria-label={t('karton.back')}>
          {t('karton.back')}
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <section className="panel detail">
        {navHeader}
        <KartonSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel detail">
        {navHeader}
        <p className="error">
          {t('karton.loadFailed')} {error}
        </p>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="panel detail">
        {navHeader}
        <p className="error">{t('karton.notFound')}</p>
      </section>
    );
  }

  const hasSectionWarnings = detail.sectionErrors && Object.keys(detail.sectionErrors).length > 0;

  return (
    <section className="panel detail">
      {navHeader}

      <PatientBanner detail={detail} />
      <KartonSummary detail={detail} />
      <KartonSectionNav sections={sectionNav} onNavigate={navigateToSection} />

      {hasSectionWarnings && <p className="warning-banner">{t('karton.sectionWarning')}</p>}

      <div className="karton-layout">
        <div className="karton-main">
          <KartonSection
            ref={(handle) => {
              sectionRefs.current['section-timeline'] = handle;
            }}
            id="section-timeline"
            title={t('karton.encounterTimeline')}
            count={detail.encounters.length}
            defaultOpen
          >
            <EncounterTimeline
              encounters={detail.encounters}
              viewerSession={viewerSession}
              selectedId={selection?.kind === 'encounter' ? selection.id : null}
              onSelect={(id) => setSelection({ kind: 'encounter', id })}
            />
          </KartonSection>

          <KartonSection
            ref={(handle) => {
              sectionRefs.current['section-practitioners'] = handle;
            }}
            id="section-practitioners"
            title={t('karton.practitioners')}
            count={detail.practitioners.length}
            defaultOpen
          >
            {detail.practitioners.length === 0 ? (
              <p className="empty-section">{t('karton.emptyPractitioners')}</p>
            ) : (
              <ul className="card-list interactive-list">
                {detail.practitioners.map((pr) => (
                  <li key={pr.id}>
                    <button
                      type="button"
                      className={`card card-button ${isSelected(selection, 'practitioner', pr.id) ? 'card-selected' : ''}`}
                      onClick={() => setSelection({ kind: 'practitioner', id: pr.id })}
                    >
                      <strong>{practitionerDisplayName(pr)}</strong>
                      <span className="meta">
                        FHIR {pr.fhirId} · HZJZ {pr.hzjzId ?? t('common.emDash')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </KartonSection>

          <KartonSection
            ref={(handle) => {
              sectionRefs.current['section-conditions'] = handle;
            }}
            id="section-conditions"
            title={t('karton.conditions')}
            count={detail.conditions.length}
            defaultOpen
          >
            {detail.conditions.length === 0 ? (
              <p className="empty-section">{t('karton.emptyConditions')}</p>
            ) : (
              <ul className="card-list interactive-list">
                {detail.conditions.map((cond) => (
                  <li key={cond.id}>
                    <button
                      type="button"
                      className={`card card-button ${isSelected(selection, 'condition', cond.id) ? 'card-selected' : ''}`}
                      onClick={() => setSelection({ kind: 'condition', id: cond.id })}
                    >
                      <strong>
                        {cond.icd10Code} — {cond.display}
                      </strong>
                      <span>
                        {formatFhirStatusPair(cond.clinicalStatus, cond.verificationStatus, locale)}
                      </span>
                      {cond.note && <span className="note">{cond.note}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </KartonSection>

          {(['medications', 'allergies', 'procedures', 'documents', 'referrals'] as const).map(
            (section) => {
              const items =
                section === 'medications'
                  ? detail.medications
                  : section === 'allergies'
                    ? detail.allergies
                    : section === 'procedures'
                      ? detail.procedures
                      : section === 'documents'
                        ? detail.documents
                        : detail.referrals;

              const sectionError = detail.sectionErrors?.[section]
                ? t('karton.sectionLoadFailed')
                : undefined;

              return (
                <KartonSection
                  key={section}
                  ref={(handle) => {
                    sectionRefs.current[SECTION_ID_KEYS[section]] = handle;
                  }}
                  id={SECTION_ID_KEYS[section]}
                  title={t(SECTION_TITLE_KEYS[section])}
                  count={items.length}
                  defaultOpen={items.length > 0}
                  error={sectionError}
                >
                  {items.length === 0 && !sectionError ? (
                    <p className="empty-section">{t(SECTION_EMPTY_KEYS[section])}</p>
                  ) : (
                    <ul className="card-list interactive-list">
                      {items.map((item) => {
                        const label =
                          'display' in item && item.display
                            ? item.display
                            : 'description' in item && item.description
                              ? item.description
                              : 'typeDisplay' in item && item.typeDisplay
                                ? item.typeDisplay
                                : 'code' in item && item.code
                                  ? item.code
                                  : t(FALLBACK_LABEL_KEYS[section]);

                        const dateValue =
                          'authoredOn' in item
                            ? item.authoredOn
                            : 'performedDate' in item
                              ? item.performedDate
                              : 'date' in item
                                ? item.date
                                : null;

                        const statusLine =
                          'criticality' in item && item.criticality
                            ? `${item.criticality} · ${formatFhirStatus(item.clinicalStatus, locale) ?? item.clinicalStatus ?? ''}`
                            : 'status' in item
                              ? formatFhirStatus(item.status, locale) ?? String(item.status ?? '')
                              : '';

                        const selectionKind =
                          section === 'medications'
                            ? 'medication'
                            : section === 'allergies'
                              ? 'allergy'
                              : section === 'procedures'
                                ? 'procedure'
                                : section === 'documents'
                                  ? 'document'
                                  : 'referral';

                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              className={`card card-button ${isSelected(selection, selectionKind, item.id) ? 'card-selected' : ''}`}
                              onClick={() => setSelection({ kind: selectionKind, id: item.id })}
                            >
                              <strong>{label}</strong>
                              <span>
                                {statusLine}
                                {dateValue &&
                                  ` · ${formatDate(dateValue, locale) ?? t('common.emDash')}`}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </KartonSection>
              );
            },
          )}
        </div>

        {selection && (
          <KartonSelectionPanel
            selection={selection}
            onSelectPractitioner={(id) => setSelection({ kind: 'practitioner', id })}
            onSelectOrganization={(id) => setSelection({ kind: 'organization', id })}
            onClear={() => setSelection(null)}
          />
        )}
      </div>
    </section>
  );
}
