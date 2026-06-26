import { useEffect, useState } from 'react';
import type { KartonSelection } from '../domain/models';
import {
  getAllergyDetail,
  getConditionDetail,
  getDocumentDetail,
  getEncounterDetail,
  getMedicationDetail,
  getOrganizationDetail,
  getPractitionerDetail,
  getProcedureDetail,
  getReferralDetail,
} from '../data/kartonApi';
import { useLocale } from '../i18n/LocaleContext';
import { formatFhirStatus } from '../utils/formatFhirCode';
import { formatDate, formatDateTime } from '../utils/localeFormat';
import { practitionerDisplayName } from '../utils/practitionerDisplayName';
import { formatPriorityLabel } from '../data/encounter-management/encounterMessageShared';
import { DetailGrid } from './DetailGrid';
import type {
  AllergyDetail,
  ConditionDetail,
  DocumentDetail,
  EncounterDetail,
  EncounterSummary,
  MedicationDetail,
  OrganizationDetail,
  PractitionerDetail,
  ProcedureDetail,
  ReferralDetail,
} from '../domain/models';

interface KartonSelectionPanelProps {
  selection: KartonSelection;
  encounterSummary?: EncounterSummary | null;
  canUpdateEncounter?: boolean;
  canCloseEncounter?: boolean;
  canCancelEncounter?: boolean;
  canReopenEncounter?: boolean;
  canUpdateCase?: boolean;
  canDeleteCase?: boolean;
  canRelapseCase?: boolean;
  canRemissionCase?: boolean;
  canResolveCase?: boolean;
  onUpdateEncounter?: () => void;
  onCloseEncounter?: () => void;
  onCancelEncounter?: () => void;
  onReopenEncounter?: () => void;
  onUpdateCase?: () => void;
  onDeleteCase?: () => void;
  onRelapseCase?: () => void;
  onRemissionCase?: () => void;
  onResolveCase?: () => void;
  onSelectPractitioner: (id: string) => void;
  onSelectOrganization: (id: string) => void;
  onClear: () => void;
}

export function KartonSelectionPanel({
  selection,
  encounterSummary = null,
  canUpdateEncounter = false,
  canCloseEncounter = false,
  canCancelEncounter = false,
  canReopenEncounter = false,
  canUpdateCase = false,
  canDeleteCase = false,
  canRelapseCase = false,
  canRemissionCase = false,
  canResolveCase = false,
  onUpdateEncounter,
  onCloseEncounter,
  onCancelEncounter,
  onReopenEncounter,
  onUpdateCase,
  onDeleteCase,
  onRelapseCase,
  onRemissionCase,
  onResolveCase,
  onSelectPractitioner,
  onSelectOrganization,
  onClear,
}: KartonSelectionPanelProps) {
  const { locale, t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [encounter, setEncounter] = useState<EncounterDetail | null>(null);
  const [condition, setCondition] = useState<ConditionDetail | null>(null);
  const [practitioner, setPractitioner] = useState<PractitionerDetail | null>(null);
  const [organization, setOrganization] = useState<OrganizationDetail | null>(null);
  const [medication, setMedication] = useState<MedicationDetail | null>(null);
  const [allergy, setAllergy] = useState<AllergyDetail | null>(null);
  const [procedure, setProcedure] = useState<ProcedureDetail | null>(null);
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [referral, setReferral] = useState<ReferralDetail | null>(null);

  const fmtDateTime = (value: string | null | undefined) =>
    formatDateTime(value, locale);
  const fmtDate = (value: string | null | undefined) => formatDate(value, locale);
  const fmtStatus = (value: string | null | undefined) =>
    formatFhirStatus(value, locale) ?? value;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setEncounter(null);
      setCondition(null);
      setPractitioner(null);
      setOrganization(null);
      setMedication(null);
      setAllergy(null);
      setProcedure(null);
      setDocument(null);
      setReferral(null);

      try {
        if (selection.kind === 'encounter') {
          const data = await getEncounterDetail(selection.id);
          if (!cancelled) setEncounter(data);
        } else if (selection.kind === 'condition') {
          const data = await getConditionDetail(selection.id);
          if (!cancelled) setCondition(data);
        } else if (selection.kind === 'practitioner') {
          const data = await getPractitionerDetail(selection.id);
          if (!cancelled) setPractitioner(data);
        } else if (selection.kind === 'organization') {
          const data = await getOrganizationDetail(selection.id);
          if (!cancelled) setOrganization(data);
        } else if (selection.kind === 'medication') {
          const data = await getMedicationDetail(selection.id);
          if (!cancelled) setMedication(data);
        } else if (selection.kind === 'allergy') {
          const data = await getAllergyDetail(selection.id);
          if (!cancelled) setAllergy(data);
        } else if (selection.kind === 'procedure') {
          const data = await getProcedureDetail(selection.id);
          if (!cancelled) setProcedure(data);
        } else if (selection.kind === 'document') {
          const data = await getDocumentDetail(selection.id);
          if (!cancelled) setDocument(data);
        } else {
          const data = await getReferralDetail(selection.id);
          if (!cancelled) setReferral(data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [selection]);

  if (loading) {
    return (
      <aside className="selection-panel">
        <p className="loading">{t('panel.loading')}</p>
      </aside>
    );
  }

  if (selection.kind === 'encounter') {
    if (!encounter && encounterSummary?.id !== selection.id) {
      return <p className="empty">{t('panel.notFoundEncounter')}</p>;
    }

    const summary = encounterSummary?.id === selection.id ? encounterSummary : null;
    const priorityCode = encounter?.priorityCode ?? summary?.priorityCode ?? null;

    return (
      <aside className="selection-panel">
        <div className="selection-panel-header">
          <h4>{t('panel.encounterTitle')}</h4>
          <button type="button" className="text-button" onClick={onClear}>
            {t('panel.close')}
          </button>
        </div>
        {(canUpdateEncounter || canCloseEncounter || canCancelEncounter || canReopenEncounter) && (
          <div className="selection-panel-actions">
            {canUpdateEncounter && onUpdateEncounter && (
              <button type="button" className="secondary-button" onClick={onUpdateEncounter}>
                {t('karton.updateEncounter')}
              </button>
            )}
            {canCloseEncounter && onCloseEncounter && (
              <button type="button" className="secondary-button" onClick={onCloseEncounter}>
                {t('karton.closeEncounter')}
              </button>
            )}
            {canCancelEncounter && onCancelEncounter && (
              <button type="button" className="secondary-button" onClick={onCancelEncounter}>
                {t('karton.cancelEncounter')}
              </button>
            )}
            {canReopenEncounter && onReopenEncounter && (
              <button type="button" className="secondary-button" onClick={onReopenEncounter}>
                {t('karton.reopenEncounter')}
              </button>
            )}
          </div>
        )}
        <DetailGrid
          rows={[
            { label: t('panel.fhirId'), value: encounter?.fhirId ?? summary?.fhirId },
            { label: t('panel.visitId'), value: encounter?.visitId ?? summary?.visitId },
            {
              label: t('panel.status'),
              value: fmtStatus(encounter?.status ?? summary?.status ?? null),
            },
            { label: t('panel.classCode'), value: encounter?.classCode ?? summary?.classCode },
            { label: t('panel.class'), value: encounter?.classDisplay ?? summary?.classDisplay },
            {
              label: t('panel.priority'),
              value: formatPriorityLabel(priorityCode, locale) ?? t('encounterUpdate.priorityNone'),
            },
            { label: t('panel.start'), value: fmtDateTime(encounter?.start ?? summary?.start) },
            { label: t('panel.end'), value: fmtDateTime(encounter?.end ?? summary?.end) },
            {
              label: t('panel.practitioner'),
              value: encounter?.practitioner
                ? practitionerDisplayName(encounter.practitioner)
                : summary?.practitionerName,
            },
            {
              label: t('panel.hzjzId'),
              value: encounter?.practitioner?.hzjzId ?? summary?.practitionerHzjzId,
            },
            {
              label: t('panel.organization'),
              value: encounter?.organization?.name ?? summary?.organizationName,
            },
            {
              label: t('panel.hzzoCode'),
              value: encounter?.organization?.hzzoCode ?? summary?.organizationFhirId,
            },
          ]}
        />
        <div className="selection-links">
          {encounter?.practitioner && (
            <button
              type="button"
              className="link-button"
              onClick={() => onSelectPractitioner(encounter.practitioner!.id)}
            >
              {t('panel.viewPractitioner')}
            </button>
          )}
          {encounter?.organization && (
            <button
              type="button"
              className="link-button"
              onClick={() => onSelectOrganization(encounter.organization!.id)}
            >
              {t('panel.viewOrganization')}
            </button>
          )}
        </div>
      </aside>
    );
  }

  if (selection.kind === 'condition') {
    if (!condition) return <p className="empty">{t('panel.notFoundCondition')}</p>;

    return (
      <aside className="selection-panel">
        <div className="selection-panel-header">
          <h4>{t('panel.conditionTitle')}</h4>
          <button type="button" className="text-button" onClick={onClear}>
            {t('panel.close')}
          </button>
        </div>
        {((canUpdateCase && onUpdateCase) ||
          (canRemissionCase && onRemissionCase) ||
          (canResolveCase && onResolveCase) ||
          (canRelapseCase && onRelapseCase) ||
          (canDeleteCase && onDeleteCase)) && (
          <div className="selection-panel-actions">
            {canUpdateCase && onUpdateCase && (
              <button type="button" className="secondary-button" onClick={onUpdateCase}>
                {t('karton.updateCase')}
              </button>
            )}
            {canRemissionCase && onRemissionCase && (
              <button type="button" className="secondary-button" onClick={onRemissionCase}>
                {t('karton.remissionCase')}
              </button>
            )}
            {canResolveCase && onResolveCase && (
              <button type="button" className="secondary-button" onClick={onResolveCase}>
                {t('karton.resolveCase')}
              </button>
            )}
            {canRelapseCase && onRelapseCase && (
              <button type="button" className="secondary-button" onClick={onRelapseCase}>
                {t('karton.relapseCase')}
              </button>
            )}
            {canDeleteCase && onDeleteCase && (
              <button type="button" className="secondary-button" onClick={onDeleteCase}>
                {t('karton.deleteCase')}
              </button>
            )}
          </div>
        )}
        <DetailGrid
          rows={[
            { label: t('panel.fhirId'), value: condition.fhirId },
            { label: t('panel.caseId'), value: condition.caseId },
            { label: t('panel.icd10'), value: condition.icd10Code },
            { label: t('panel.display'), value: condition.display },
            { label: t('panel.clinicalStatus'), value: fmtStatus(condition.clinicalStatus) },
            { label: t('panel.verification'), value: fmtStatus(condition.verificationStatus) },
            { label: t('panel.onsetDate'), value: fmtDate(condition.onsetDate) },
            { label: t('panel.abatementDate'), value: fmtDate(condition.abatementDate) },
            { label: t('panel.recordedDate'), value: fmtDate(condition.recordedDate) },
            { label: t('panel.encounterVisitId'), value: condition.encounterVisitId },
            { label: t('panel.asserterHzjzId'), value: condition.asserterHzjzId },
            { label: t('panel.recorderHzjzId'), value: condition.recorderHzjzId },
            { label: t('panel.note'), value: condition.note },
          ]}
        />
      </aside>
    );
  }

  if (selection.kind === 'practitioner') {
    if (!practitioner) return <p className="empty">{t('panel.notFoundPractitioner')}</p>;

    return (
      <aside className="selection-panel">
        <div className="selection-panel-header">
          <h4>{t('panel.practitionerTitle')}</h4>
          <button type="button" className="text-button" onClick={onClear}>
            {t('panel.close')}
          </button>
        </div>
        <DetailGrid
          rows={[
            { label: t('panel.name'), value: practitionerDisplayName(practitioner) },
            { label: t('panel.fhirId'), value: practitioner.fhirId },
            { label: t('panel.firstName'), value: practitioner.firstName },
            { label: t('panel.lastName'), value: practitioner.lastName },
            { label: t('panel.hzjzId'), value: practitioner.hzjzId },
          ]}
        />
      </aside>
    );
  }

  if (selection.kind === 'medication') {
    if (!medication) return <p className="empty">{t('panel.notFoundMedication')}</p>;

    return (
      <aside className="selection-panel">
        <div className="selection-panel-header">
          <h4>{t('panel.medicationTitle')}</h4>
          <button type="button" className="text-button" onClick={onClear}>
            {t('panel.close')}
          </button>
        </div>
        <DetailGrid
          rows={[
            { label: t('panel.fhirId'), value: medication.fhirId },
            { label: t('panel.medication'), value: medication.display },
            { label: t('panel.code'), value: medication.code },
            { label: t('panel.status'), value: fmtStatus(medication.status) },
            { label: t('panel.intent'), value: medication.intent },
            { label: t('panel.authored'), value: fmtDateTime(medication.authoredOn) },
            { label: t('panel.dosage'), value: medication.dosage },
            { label: t('panel.note'), value: medication.note },
          ]}
        />
      </aside>
    );
  }

  if (selection.kind === 'allergy') {
    if (!allergy) return <p className="empty">{t('panel.notFoundAllergy')}</p>;

    return (
      <aside className="selection-panel">
        <div className="selection-panel-header">
          <h4>{t('panel.allergyTitle')}</h4>
          <button type="button" className="text-button" onClick={onClear}>
            {t('panel.close')}
          </button>
        </div>
        <DetailGrid
          rows={[
            { label: t('panel.fhirId'), value: allergy.fhirId },
            { label: t('panel.substance'), value: allergy.display },
            { label: t('panel.code'), value: allergy.code },
            { label: t('panel.clinicalStatus'), value: fmtStatus(allergy.clinicalStatus) },
            { label: t('panel.verification'), value: fmtStatus(allergy.verificationStatus) },
            { label: t('panel.type'), value: allergy.type },
            { label: t('panel.category'), value: allergy.category },
            { label: t('panel.criticality'), value: allergy.criticality },
            { label: t('panel.onset'), value: fmtDate(allergy.onsetDate) },
            { label: t('panel.note'), value: allergy.note },
          ]}
        />
      </aside>
    );
  }

  if (selection.kind === 'procedure') {
    if (!procedure) return <p className="empty">{t('panel.notFoundProcedure')}</p>;

    return (
      <aside className="selection-panel">
        <div className="selection-panel-header">
          <h4>{t('panel.procedureTitle')}</h4>
          <button type="button" className="text-button" onClick={onClear}>
            {t('panel.close')}
          </button>
        </div>
        <DetailGrid
          rows={[
            { label: t('panel.fhirId'), value: procedure.fhirId },
            { label: t('panel.procedure'), value: procedure.display },
            { label: t('panel.code'), value: procedure.code },
            { label: t('panel.status'), value: fmtStatus(procedure.status) },
            { label: t('panel.performed'), value: fmtDateTime(procedure.performedDate) },
            { label: t('panel.note'), value: procedure.note },
          ]}
        />
      </aside>
    );
  }

  if (selection.kind === 'document') {
    if (!document) return <p className="empty">{t('panel.notFoundDocument')}</p>;

    return (
      <aside className="selection-panel">
        <div className="selection-panel-header">
          <h4>{t('panel.documentTitle')}</h4>
          <button type="button" className="text-button" onClick={onClear}>
            {t('panel.close')}
          </button>
        </div>
        <DetailGrid
          rows={[
            { label: t('panel.fhirId'), value: document.fhirId },
            { label: t('panel.title'), value: document.description },
            { label: t('panel.type'), value: document.typeDisplay },
            { label: t('panel.typeCode'), value: document.typeCode },
            { label: t('panel.category'), value: document.category },
            { label: t('panel.status'), value: fmtStatus(document.status) },
            { label: t('panel.date'), value: fmtDateTime(document.date) },
            { label: t('panel.contentType'), value: document.contentType },
          ]}
        />
      </aside>
    );
  }

  if (selection.kind === 'referral') {
    if (!referral) return <p className="empty">{t('panel.notFoundReferral')}</p>;

    return (
      <aside className="selection-panel">
        <div className="selection-panel-header">
          <h4>{t('panel.referralTitle')}</h4>
          <button type="button" className="text-button" onClick={onClear}>
            {t('panel.close')}
          </button>
        </div>
        <DetailGrid
          rows={[
            { label: t('panel.fhirId'), value: referral.fhirId },
            { label: t('panel.service'), value: referral.display },
            { label: t('panel.code'), value: referral.code },
            { label: t('panel.status'), value: fmtStatus(referral.status) },
            { label: t('panel.intent'), value: referral.intent },
            { label: t('panel.priority'), value: referral.priority },
            { label: t('panel.authored'), value: fmtDateTime(referral.authoredOn) },
            { label: t('panel.note'), value: referral.note },
          ]}
        />
      </aside>
    );
  }

  if (!organization) return <p className="empty">{t('panel.notFoundOrganization')}</p>;

  return (
    <aside className="selection-panel">
      <div className="selection-panel-header">
        <h4>{t('panel.organizationTitle')}</h4>
        <button type="button" className="text-button" onClick={onClear}>
          {t('panel.close')}
        </button>
      </div>
      <DetailGrid
        rows={[
          { label: t('panel.name'), value: organization.name },
          { label: t('panel.fhirId'), value: organization.fhirId },
          { label: t('panel.hzzoCode'), value: organization.hzzoCode },
        ]}
      />
    </aside>
  );
}
