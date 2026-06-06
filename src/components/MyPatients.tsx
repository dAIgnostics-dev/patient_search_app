import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import type { PatientSummary } from '../domain/models';
import {
  filterPractitionerPatients,
  getPatientsForPractitioner,
  type PractitionerPatientSummary,
} from '../data/practitionerPatients';
import { formatDate, formatPatientCount } from '../utils/localeFormat';
import { logPatientListSelect } from '../data/auditAccess';
import { PatientKarton } from './PatientKarton';
import { PatientListSkeleton } from './PatientListSkeleton';

type SortOption = 'lastVisit' | 'name';

export function MyPatients() {
  const { session } = useAuth();
  const { locale, t } = useLocale();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('lastVisit');
  const [last12MonthsOnly, setLast12MonthsOnly] = useState(false);
  const [allPatients, setAllPatients] = useState<PractitionerPatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PatientSummary | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = await getPatientsForPractitioner(session!);
        if (!cancelled) setAllPatients(list);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : t('myPatients.loadFailed');
          if (message.toLowerCase().includes('fetch') || message.includes('FHIR')) {
            setError(t('myPatients.apiError'));
          } else {
            setError(message);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const patients = useMemo(
    () =>
      filterPractitionerPatients(allPatients, {
        search,
        sort,
        last12MonthsOnly,
      }),
    [allPatients, search, sort, last12MonthsOnly],
  );

  const emptyBecauseFilter =
    !loading && !error && allPatients.length > 0 && patients.length === 0;
  const emptyBecauseNoEncounters = !loading && !error && allPatients.length === 0;

  if (selected) {
    return (
      <PatientKarton
        patient={selected}
        viewerSession={session ?? undefined}
        accessSource="my-patients"
        breadcrumbs={[
          { label: t('tabs.myPatients'), onClick: () => setSelected(null) },
          { label: `${selected.firstName} ${selected.lastName}` },
        ]}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <section className="panel">
      <h2>{t('myPatients.title')}</h2>
      <p className="search-hint">{t('myPatients.hint')}</p>

      <div className="list-controls">
        <label className="search-bar-label">
          {t('myPatients.search')}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('myPatients.searchPlaceholder')}
          />
        </label>

        <label className="control-label">
          {t('myPatients.sortBy')}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
            <option value="lastVisit">{t('myPatients.sortLastVisit')}</option>
            <option value="name">{t('myPatients.sortName')}</option>
          </select>
        </label>

        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={last12MonthsOnly}
            onChange={(e) => setLast12MonthsOnly(e.target.checked)}
          />
          {t('myPatients.last12Months')}
        </label>
      </div>

      {loading && <PatientListSkeleton />}
      {error && <p className="error">{error}</p>}

      {emptyBecauseNoEncounters && (
        <p className="empty">{t('myPatients.emptyNoEncounters')}</p>
      )}

      {emptyBecauseFilter && <p className="empty">{t('myPatients.emptyFilter')}</p>}

      {!loading && patients.length > 0 && (
        <>
          <p className="result-count">{formatPatientCount(patients.length, locale)}</p>
          <ul className="result-list">
            {patients.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    if (session) logPatientListSelect(session, p, 'my-patients', locale);
                    setSelected(p);
                  }}
                >
                  {p.firstName} {p.lastName}
                </button>
                <span className="meta">
                  {t('mbo.label')} {p.mbo ?? t('common.emDash')}
                  {p.lastEncounterDate &&
                    ` · ${t('myPatients.lastEncounter')} ${formatDate(p.lastEncounterDate, locale) ?? t('common.emDash')}`}
                  {p.lastOrganizationName && ` · ${p.lastOrganizationName}`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
