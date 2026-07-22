import { useEffect, useMemo, useRef, useState } from 'react';
import {
  canManageCases,
  canManageEncounters,
  canRegisterDocument,
  canRetrieveDocuments,
  canSearchDocuments,
} from '../auth/roles';
import type { PractitionerSession } from '../auth/types';
import {
  logPatientKartonOpen,
  logPatientResourceView,
  type PatientAccessSource,
} from '../data/auditAccess';
import { getPatientChart } from '../data/kartonApi';
import { searchDocuments } from '../data/documentApi';
import { addRecentPatient } from '../data/recentPatients';
import type {
  ConditionSummary,
  DocumentSummary,
  EncounterSummary,
  KartonSelection,
  MedicationSummary,
  AllergySummary,
  ProcedureSummary,
  ReferralSummary,
  PatientDetail as PatientDetailModel,
  PatientSectionKey,
  PatientSummary,
} from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import type { TranslationKey } from '../i18n/translations';
import { formatFhirStatus, formatFhirStatusPair } from '../utils/formatFhirCode';
import { formatDate } from '../utils/localeFormat';
import { CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA } from '../fhir/types';
import { isWithinDocumentEditWindow } from '../data/document-management/documentEditWindow';
import { practitionerDisplayName } from '../utils/practitionerDisplayName';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';
import { CancelEncounterForm } from './CancelEncounterForm';
import { CloseEncounterForm } from './CloseEncounterForm';
import { CreateCaseForm } from './CreateCaseForm';
import { CreateClinicalDocumentForm } from './CreateClinicalDocumentForm';
import { UpdateClinicalDocumentForm } from './UpdateClinicalDocumentForm';
import { CancelClinicalDocumentForm } from './CancelClinicalDocumentForm';
import { CreateEncounterForm } from './CreateEncounterForm';
import { DeleteCaseForm } from './DeleteCaseForm';
import { ReopenEncounterForm } from './ReopenEncounterForm';
import { RemissionCaseForm } from './RemissionCaseForm';
import { RelapseCaseForm } from './RelapseCaseForm';
import { ResolveCaseForm } from './ResolveCaseForm';
import { UpdateCaseForm } from './UpdateCaseForm';
import { UpdateEncounterForm } from './UpdateEncounterForm';
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

function isEncounterEditable(encounter: EncounterSummary | null | undefined): boolean {
  if (!encounter?.visitId) return false;
  return (encounter.status ?? '').toLowerCase() === 'in-progress';
}

function isEncounterCancellable(encounter: EncounterSummary | null | undefined): boolean {
  if (!encounter?.visitId) return false;
  const status = (encounter.status ?? '').toLowerCase();
  return status === 'in-progress' || status === 'finished';
}

function isEncounterReopenable(encounter: EncounterSummary | null | undefined): boolean {
  if (!encounter?.visitId) return false;
  const status = (encounter.status ?? '').toLowerCase();
  return status === 'finished' || status === 'entered-in-error';
}

function isCaseDeletable(condition: ConditionSummary | null | undefined): boolean {
  if (!condition?.caseId) return false;
  return (condition.clinicalStatus ?? '').toLowerCase() !== 'deleted';
}

function isCaseRelapsable(condition: ConditionSummary | null | undefined): boolean {
  if (!condition?.caseId) return false;
  return (condition.clinicalStatus ?? '').toLowerCase() === 'remission';
}

function isCaseRemissionable(condition: ConditionSummary | null | undefined): boolean {
  if (!condition?.caseId) return false;
  const status = (condition.clinicalStatus ?? '').toLowerCase();
  return status === 'active' || status === 'relapse';
}

function isCaseResolvable(condition: ConditionSummary | null | undefined): boolean {
  if (!condition?.caseId) return false;
  const status = (condition.clinicalStatus ?? '').toLowerCase();
  return status === 'active' || status === 'relapse' || status === 'remission';
}

function isCaseEditable(condition: ConditionSummary | null | undefined): boolean {
  if (!condition?.caseId || !condition.clinicalStatus) return false;
  return condition.clinicalStatus.toLowerCase() !== 'deleted';
}

function isDocumentEditable(document: DocumentSummary | null | undefined): boolean {
  if (!document) return false;
  const status = (document.compositionStatus ?? '').toLowerCase();
  if (status !== 'final') return false;
  return isWithinDocumentEditWindow(document.date);
}

function formatSectionItemLabel(
  section: Exclude<PatientSectionKey, 'documents'>,
  item: MedicationSummary | AllergySummary | ProcedureSummary | ReferralSummary,
  t: (key: TranslationKey) => string,
): string {
  if (section === 'medications' || section === 'allergies' || section === 'referrals') {
    return item.display ?? item.code ?? t(FALLBACK_LABEL_KEYS[section]);
  }
  return item.display ?? item.code ?? t(FALLBACK_LABEL_KEYS[section]);
}

function formatSectionItemDate(
  item: MedicationSummary | AllergySummary | ProcedureSummary | ReferralSummary,
): string | null | undefined {
  if ('authoredOn' in item) return item.authoredOn;
  if ('performedDate' in item) return item.performedDate;
  return null;
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
  const [showCreateEncounter, setShowCreateEncounter] = useState(false);
  const [showUpdateEncounter, setShowUpdateEncounter] = useState(false);
  const [showCloseEncounter, setShowCloseEncounter] = useState(false);
  const [showCancelEncounter, setShowCancelEncounter] = useState(false);
  const [showReopenEncounter, setShowReopenEncounter] = useState(false);
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [showCreateCaseRecurrence, setShowCreateCaseRecurrence] = useState(false);
  const [showUpdateCase, setShowUpdateCase] = useState(false);
  const [showDeleteCase, setShowDeleteCase] = useState(false);
  const [showRelapseCase, setShowRelapseCase] = useState(false);
  const [showRemissionCase, setShowRemissionCase] = useState(false);
  const [showResolveCase, setShowResolveCase] = useState(false);
  const [showCreateDocument, setShowCreateDocument] = useState(false);
  const [showUpdateDocument, setShowUpdateDocument] = useState(false);
  const [showCancelDocument, setShowCancelDocument] = useState(false);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentFilters, setDocumentFilters] = useState({
    dateFrom: '',
    dateTo: '',
    typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
    compositionStatus: '',
  });
  const [createSuccessMessage, setCreateSuccessMessage] = useState<string | null>(null);
  const loggedRef = useRef<string | null>(null);
  const sectionRefs = useRef<Record<string, KartonSectionHandle | null>>({});

  function mergeEncounter(encounter: EncounterSummary) {
    setDetail((current) => {
      if (!current) return current;
      const exists = current.encounters.some((item) => item.id === encounter.id);
      const encounters = exists
        ? current.encounters.map((item) =>
            item.id === encounter.id ? { ...item, ...encounter } : item,
          )
        : [...current.encounters, encounter];
      encounters.sort((a, b) => {
        const ta = a.start ? Date.parse(a.start) : 0;
        const tb = b.start ? Date.parse(b.start) : 0;
        return tb - ta;
      });
      return { ...current, encounters };
    });
  }

  function mergeDocument(document: DocumentSummary) {
    setDocuments((current) => {
      const exists = current.some((item) => item.id === document.id);
      const next = exists
        ? current.map((item) => (item.id === document.id ? { ...item, ...document } : item))
        : [document, ...current];
      next.sort((a, b) => {
        const ta = a.date ? Date.parse(a.date) : 0;
        const tb = b.date ? Date.parse(b.date) : 0;
        return tb - ta;
      });
      return next;
    });
  }

  function mergeCondition(condition: ConditionSummary) {
    setDetail((current) => {
      if (!current) return current;
      const exists = current.conditions.some((item) => item.id === condition.id);
      const conditions = exists
        ? current.conditions.map((item) =>
            item.id === condition.id ? { ...item, ...condition } : item,
          )
        : [...current.conditions, condition];
      conditions.sort((a, b) => {
        const ta = a.onsetDate ? Date.parse(a.onsetDate) : 0;
        const tb = b.onsetDate ? Date.parse(b.onsetDate) : 0;
        return tb - ta;
      });
      return { ...current, conditions };
    });
  }

  function handleEncounterCreated(encounter: EncounterSummary, visitId: string) {
    mergeEncounter(encounter);
    setSelection({ kind: 'encounter', id: encounter.id });
    setCreateSuccessMessage(t('karton.encounterCreated', { visitId }));
    setShowCreateEncounter(false);
    setShowCreateCase(false);
    setShowCreateCaseRecurrence(false);
    setShowUpdateCase(false);
    setShowDeleteCase(false);
    setShowRelapseCase(false);
    setShowRemissionCase(false);
    setShowResolveCase(false);
  }

  function handleEncounterUpdated(encounter: EncounterSummary, visitId: string) {
    mergeEncounter(encounter);
    setCreateSuccessMessage(t('karton.encounterUpdated', { visitId }));
    setShowUpdateEncounter(false);
  }

  function handleEncounterClosed(encounter: EncounterSummary, visitId: string) {
    mergeEncounter(encounter);
    setCreateSuccessMessage(t('karton.encounterClosed', { visitId }));
    setShowCloseEncounter(false);
  }

  function handleEncounterCancelled(encounter: EncounterSummary, visitId: string) {
    mergeEncounter(encounter);
    setCreateSuccessMessage(t('karton.encounterCancelled', { visitId }));
    setShowCancelEncounter(false);
  }

  function handleEncounterReopened(encounter: EncounterSummary, visitId: string) {
    mergeEncounter(encounter);
    setCreateSuccessMessage(t('karton.encounterReopened', { visitId }));
    setShowReopenEncounter(false);
  }

  function handleCaseCreated(condition: ConditionSummary, caseId: string) {
    mergeCondition(condition);
    setSelection({ kind: 'condition', id: condition.id });
    setCreateSuccessMessage(t('karton.caseCreated', { caseId }));
    setShowCreateCase(false);
  }

  function handleCaseRecurrenceCreated(condition: ConditionSummary, caseId: string) {
    mergeCondition(condition);
    setSelection({ kind: 'condition', id: condition.id });
    setCreateSuccessMessage(t('karton.caseRecurrenceCreated', { caseId }));
    setShowCreateCaseRecurrence(false);
  }

  function handleCaseUpdated(condition: ConditionSummary, caseId: string) {
    mergeCondition(condition);
    setSelection({ kind: 'condition', id: condition.id });
    setCreateSuccessMessage(t('karton.caseUpdated', { caseId }));
    setShowUpdateCase(false);
  }

  function handleCaseDeleted(condition: ConditionSummary, caseId: string) {
    mergeCondition(condition);
    setSelection({ kind: 'condition', id: condition.id });
    setCreateSuccessMessage(t('karton.caseDeleted', { caseId }));
    setShowDeleteCase(false);
  }

  function handleCaseRelapsed(condition: ConditionSummary, caseId: string) {
    mergeCondition(condition);
    setSelection({ kind: 'condition', id: condition.id });
    setCreateSuccessMessage(t('karton.caseRelapsed', { caseId }));
    setShowRelapseCase(false);
  }

  function handleCaseRemissioned(condition: ConditionSummary, caseId: string) {
    mergeCondition(condition);
    setSelection({ kind: 'condition', id: condition.id });
    setCreateSuccessMessage(t('karton.caseChangedToRemission', { caseId }));
    setShowRemissionCase(false);
  }

  function handleCaseResolved(condition: ConditionSummary, caseId: string) {
    mergeCondition(condition);
    setSelection({ kind: 'condition', id: condition.id });
    setCreateSuccessMessage(t('karton.caseResolved', { caseId }));
    setShowResolveCase(false);
  }

  function handleDocumentSubmitted(summary: DocumentSummary, documentReferenceId: string) {
    mergeDocument(summary);
    setSelection({ kind: 'document', id: documentReferenceId });
    setCreateSuccessMessage(t('karton.documentCreated', { documentId: documentReferenceId }));
    setShowCreateDocument(false);
  }

  function handleDocumentUpdated(summary: DocumentSummary, documentReferenceId: string) {
    mergeDocument(summary);
    setSelection({ kind: 'document', id: documentReferenceId });
    setCreateSuccessMessage(t('karton.documentUpdated', { documentId: documentReferenceId }));
    setShowUpdateDocument(false);
  }

  function handleDocumentCancelled(summary: DocumentSummary, documentReferenceId: string) {
    mergeDocument(summary);
    setSelection({ kind: 'document', id: documentReferenceId });
    setCreateSuccessMessage(t('karton.documentCancelled', { documentId: documentReferenceId }));
    setShowCancelDocument(false);
  }

  const selectedEncounter = useMemo(() => {
    if (!detail || selection?.kind !== 'encounter') return null;
    return detail.encounters.find((item) => item.id === selection.id) ?? null;
  }, [detail, selection]);

  const selectedCondition = useMemo(() => {
    if (!detail || selection?.kind !== 'condition') return null;
    return detail.conditions.find((item) => item.id === selection.id) ?? null;
  }, [detail, selection]);

  const selectedDocument = useMemo(() => {
    if (selection?.kind !== 'document') return null;
    return documents.find((item) => item.id === selection.id) ?? null;
  }, [selection, documents]);

  const canManageEncountersRole = canManageEncounters(viewerSession?.role);
  const canUpdateSelectedEncounter =
    canManageEncountersRole && isEncounterEditable(selectedEncounter);
  const canCloseSelectedEncounter =
    canManageEncountersRole && isEncounterEditable(selectedEncounter);
  const canCancelSelectedEncounter =
    canManageEncountersRole && isEncounterCancellable(selectedEncounter);
  const canReopenSelectedEncounter =
    canManageEncountersRole && isEncounterReopenable(selectedEncounter);
  const canManageCasesRole = canManageCases(viewerSession?.role);
  const canUpdateSelectedCase = canManageCasesRole && isCaseEditable(selectedCondition);
  const canDeleteSelectedCase = canManageCasesRole && isCaseDeletable(selectedCondition);
  const canRelapseSelectedCase = canManageCasesRole && isCaseRelapsable(selectedCondition);
  const canRemissionSelectedCase = canManageCasesRole && isCaseRemissionable(selectedCondition);
  const canResolveSelectedCase = canManageCasesRole && isCaseResolvable(selectedCondition);
  const canRegisterDocumentsRole = canRegisterDocument(
    viewerSession?.role,
    CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
  );
  const canSearchDocumentsRole = canSearchDocuments(viewerSession?.role);
  const canRetrieveDocumentsRole = canRetrieveDocuments(viewerSession?.role);
  const canNewVersionSelectedDocument =
    canRegisterDocumentsRole && isDocumentEditable(selectedDocument);
  const canCancelSelectedDocument =
    canRegisterDocumentsRole && isDocumentEditable(selectedDocument);

  const openCaseEncounters = useMemo(() => {
    if (!detail || !viewerSession) return [];
    return detail.encounters.filter(
      (encounter) =>
        encounter.visitId &&
        (encounter.status ?? '').toLowerCase() === 'in-progress' &&
        encounter.practitionerHzjzId === viewerSession.hzjzId,
    );
  }, [detail, viewerSession]);

  const createCaseDisabled = !canManageCasesRole || openCaseEncounters.length === 0;
  const createCaseTitle = !canManageCasesRole
    ? t('karton.caseRoleNotAllowed')
    : openCaseEncounters.length === 0
      ? t('karton.createCaseRequiresOpenEncounter')
      : undefined;

  const createDocumentDisabled = !canRegisterDocumentsRole || openCaseEncounters.length === 0;
  const createDocumentTitle = !canRegisterDocumentsRole
    ? t('karton.documentRegisterRoleNotAllowed')
    : openCaseEncounters.length === 0
      ? t('documentCreate.requiresOpenEncounter')
      : undefined;

  const resolvedCases = useMemo(() => {
    if (!detail) return [];
    return detail.conditions.filter(
      (condition) => condition.caseId && (condition.clinicalStatus ?? '').toLowerCase() === 'resolved',
    );
  }, [detail]);

  const patientCases = useMemo(() => {
    if (!detail) return [];
    return detail.conditions.filter((condition) => condition.caseId);
  }, [detail]);

  async function reloadDocuments() {
    if (!patient.mbo || !viewerSession) return;
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      const results = await searchDocuments(viewerSession, {
        patientMbo: patient.mbo,
        typeCode: documentFilters.typeCode || undefined,
        dateFrom: documentFilters.dateFrom || undefined,
        dateTo: documentFilters.dateTo || undefined,
        compositionStatus: documentFilters.compositionStatus || undefined,
      });
      setDocuments(results);
    } catch (err) {
      setDocumentsError(err instanceof Error ? err.message : t('documentSearch.loadFailed'));
    } finally {
      setDocumentsLoading(false);
    }
  }

  function openResolveCase() {
    setCreateSuccessMessage(null);
    setShowCreateEncounter(false);
    setShowCreateCase(false);
    setShowCreateCaseRecurrence(false);
    setShowUpdateCase(false);
    setShowDeleteCase(false);
    setShowRelapseCase(false);
    setShowRemissionCase(false);
    setShowUpdateEncounter(false);
    setShowCloseEncounter(false);
    setShowCancelEncounter(false);
    setShowReopenEncounter(false);
    setShowCreateDocument(false);
    setShowUpdateDocument(false);
    setShowCancelDocument(false);
    setShowResolveCase(true);
  }

  function openNewDocumentVersion() {
    setCreateSuccessMessage(null);
    setShowCreateEncounter(false);
    setShowCreateCase(false);
    setShowCreateCaseRecurrence(false);
    setShowUpdateCase(false);
    setShowDeleteCase(false);
    setShowRelapseCase(false);
    setShowRemissionCase(false);
    setShowResolveCase(false);
    setShowUpdateEncounter(false);
    setShowCloseEncounter(false);
    setShowCancelEncounter(false);
    setShowReopenEncounter(false);
    setShowCreateDocument(false);
    setShowCancelDocument(false);
    setShowUpdateDocument(true);
  }

  function openCancelDocument() {
    setCreateSuccessMessage(null);
    setShowCreateEncounter(false);
    setShowCreateCase(false);
    setShowCreateCaseRecurrence(false);
    setShowUpdateCase(false);
    setShowDeleteCase(false);
    setShowRelapseCase(false);
    setShowRemissionCase(false);
    setShowResolveCase(false);
    setShowUpdateEncounter(false);
    setShowCloseEncounter(false);
    setShowCancelEncounter(false);
    setShowReopenEncounter(false);
    setShowCreateDocument(false);
    setShowUpdateDocument(false);
    setShowCancelDocument(true);
  }

  function openUpdateEncounter() {
    setCreateSuccessMessage(null);
    setShowCreateCase(false);
    setShowCreateCaseRecurrence(false);
    setShowUpdateCase(false);
    setShowDeleteCase(false);
    setShowRelapseCase(false);
    setShowRemissionCase(false);
    setShowResolveCase(false);
    setShowCloseEncounter(false);
    setShowCancelEncounter(false);
    setShowReopenEncounter(false);
    setShowUpdateEncounter(true);
  }

  function openCloseEncounter() {
    setCreateSuccessMessage(null);
    setShowCreateCase(false);
    setShowCreateCaseRecurrence(false);
    setShowUpdateCase(false);
    setShowDeleteCase(false);
    setShowRelapseCase(false);
    setShowRemissionCase(false);
    setShowResolveCase(false);
    setShowUpdateEncounter(false);
    setShowCancelEncounter(false);
    setShowReopenEncounter(false);
    setShowCloseEncounter(true);
  }

  function openCancelEncounter() {
    setCreateSuccessMessage(null);
    setShowCreateCase(false);
    setShowCreateCaseRecurrence(false);
    setShowUpdateCase(false);
    setShowDeleteCase(false);
    setShowRelapseCase(false);
    setShowRemissionCase(false);
    setShowResolveCase(false);
    setShowUpdateEncounter(false);
    setShowCloseEncounter(false);
    setShowReopenEncounter(false);
    setShowCancelEncounter(true);
  }

  function openReopenEncounter() {
    setCreateSuccessMessage(null);
    setShowCreateCase(false);
    setShowCreateCaseRecurrence(false);
    setShowUpdateCase(false);
    setShowDeleteCase(false);
    setShowRelapseCase(false);
    setShowRemissionCase(false);
    setShowResolveCase(false);
    setShowUpdateEncounter(false);
    setShowCloseEncounter(false);
    setShowCancelEncounter(false);
    setShowReopenEncounter(true);
  }

  function openUpdateCase() {
    setCreateSuccessMessage(null);
    setShowCreateEncounter(false);
    setShowCreateCase(false);
    setShowCreateCaseRecurrence(false);
    setShowDeleteCase(false);
    setShowRelapseCase(false);
    setShowRemissionCase(false);
    setShowResolveCase(false);
    setShowUpdateEncounter(false);
    setShowCloseEncounter(false);
    setShowCancelEncounter(false);
    setShowReopenEncounter(false);
    setShowUpdateCase(true);
  }

  function openDeleteCase() {
    setCreateSuccessMessage(null);
    setShowCreateEncounter(false);
    setShowCreateCase(false);
    setShowCreateCaseRecurrence(false);
    setShowUpdateCase(false);
    setShowRelapseCase(false);
    setShowRemissionCase(false);
    setShowResolveCase(false);
    setShowUpdateEncounter(false);
    setShowCloseEncounter(false);
    setShowCancelEncounter(false);
    setShowReopenEncounter(false);
    setShowDeleteCase(true);
  }

  function openRelapseCase() {
    setCreateSuccessMessage(null);
    setShowCreateEncounter(false);
    setShowCreateCase(false);
    setShowCreateCaseRecurrence(false);
    setShowUpdateCase(false);
    setShowDeleteCase(false);
    setShowRemissionCase(false);
    setShowResolveCase(false);
    setShowUpdateEncounter(false);
    setShowCloseEncounter(false);
    setShowCancelEncounter(false);
    setShowReopenEncounter(false);
    setShowRelapseCase(true);
  }

  function openRemissionCase() {
    setCreateSuccessMessage(null);
    setShowCreateEncounter(false);
    setShowCreateCase(false);
    setShowCreateCaseRecurrence(false);
    setShowUpdateCase(false);
    setShowDeleteCase(false);
    setShowRelapseCase(false);
    setShowResolveCase(false);
    setShowUpdateEncounter(false);
    setShowCloseEncounter(false);
    setShowCancelEncounter(false);
    setShowReopenEncounter(false);
    setShowRemissionCase(true);
  }

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
        const data = await getPatientChart(patient.id);
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

  useEffect(() => {
    if (!patient.mbo || !viewerSession || loading) return;
    void reloadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filters or patient change
  }, [patient.mbo, viewerSession, loading, documentFilters]);

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
      <div className="karton-nav-leading">
        <button type="button" className="back-button" onClick={onBack}>
          {t('karton.back')}
        </button>
        {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      </div>
      {viewerSession && (
        <div className="karton-nav-actions">
          <span
            className={`nav-action-tooltip${!canManageEncountersRole ? ' is-disabled' : ''}`}
            title={!canManageEncountersRole ? t('karton.encounterRoleNotAllowed') : undefined}
          >
            <button
              type="button"
              className="secondary-button karton-nav-action"
              disabled={!canManageEncountersRole}
              onClick={() => {
                setCreateSuccessMessage(null);
                setShowCreateCase(false);
                setShowCreateCaseRecurrence(false);
                setShowUpdateCase(false);
                setShowDeleteCase(false);
                setShowRelapseCase(false);
                setShowRemissionCase(false);
                setShowResolveCase(false);
                setShowCreateEncounter(true);
              }}
            >
              {t('karton.newEncounter')}
            </button>
          </span>
          <span
            className={`nav-action-tooltip${createCaseDisabled ? ' is-disabled' : ''}`}
            title={createCaseTitle}
          >
            <button
              type="button"
              className="secondary-button karton-nav-action"
              disabled={createCaseDisabled}
              onClick={() => {
                setCreateSuccessMessage(null);
                setShowCreateEncounter(false);
                setShowCreateCaseRecurrence(false);
                setShowUpdateCase(false);
                setShowDeleteCase(false);
                setShowRelapseCase(false);
                setShowRemissionCase(false);
                setShowResolveCase(false);
                setShowUpdateEncounter(false);
                setShowCloseEncounter(false);
                setShowCancelEncounter(false);
                setShowReopenEncounter(false);
                setShowCreateCase(true);
              }}
            >
              {t('karton.createCase')}
            </button>
          </span>
          <span
            className={`nav-action-tooltip${createCaseDisabled ? ' is-disabled' : ''}`}
            title={createCaseTitle}
          >
            <button
              type="button"
              className="secondary-button karton-nav-action"
              disabled={createCaseDisabled}
              onClick={() => {
                setCreateSuccessMessage(null);
                setShowCreateEncounter(false);
                setShowCreateCase(false);
                setShowUpdateCase(false);
                setShowDeleteCase(false);
                setShowRelapseCase(false);
                setShowRemissionCase(false);
                setShowResolveCase(false);
                setShowUpdateEncounter(false);
                setShowCloseEncounter(false);
                setShowCancelEncounter(false);
                setShowReopenEncounter(false);
                setShowCreateCaseRecurrence(true);
              }}
            >
              {t('karton.createCaseRecurrence')}
            </button>
          </span>
          <span
            className={`nav-action-tooltip${createDocumentDisabled ? ' is-disabled' : ''}`}
            title={createDocumentTitle}
          >
            <button
              type="button"
              className="secondary-button karton-nav-action"
              disabled={createDocumentDisabled}
              onClick={() => {
                setCreateSuccessMessage(null);
                setShowCreateEncounter(false);
                setShowCreateCase(false);
                setShowCreateCaseRecurrence(false);
                setShowUpdateCase(false);
                setShowDeleteCase(false);
                setShowRelapseCase(false);
                setShowRemissionCase(false);
                setShowResolveCase(false);
                setShowUpdateEncounter(false);
                setShowCloseEncounter(false);
                setShowCancelEncounter(false);
                setShowReopenEncounter(false);
                setShowCreateDocument(true);
              }}
            >
              {t('karton.submitDocument')}
            </button>
          </span>
        </div>
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

      {createSuccessMessage && <p className="success-banner">{createSuccessMessage}</p>}

      {showCreateEncounter && viewerSession && (
        <CreateEncounterForm
          patient={patient}
          session={viewerSession}
          onCancel={() => setShowCreateEncounter(false)}
          onCreated={handleEncounterCreated}
        />
      )}

      {showCreateCase && viewerSession && (
        <CreateCaseForm
          patient={patient}
          session={viewerSession}
          openEncounters={openCaseEncounters}
          onCancel={() => setShowCreateCase(false)}
          onCreated={handleCaseCreated}
        />
      )}

      {showCreateCaseRecurrence && viewerSession && (
        <CreateCaseForm
          patient={patient}
          session={viewerSession}
          openEncounters={openCaseEncounters}
          mode="recurrence"
          previousCases={resolvedCases}
          onCancel={() => setShowCreateCaseRecurrence(false)}
          onCreated={handleCaseRecurrenceCreated}
        />
      )}

      {showCreateDocument && viewerSession && (
        <CreateClinicalDocumentForm
          patient={patient}
          session={viewerSession}
          openEncounters={openCaseEncounters}
          patientCases={patientCases}
          onCancel={() => setShowCreateDocument(false)}
          onCreated={(summary, documentReferenceId) => {
            handleDocumentSubmitted(summary, documentReferenceId);
            void reloadDocuments();
          }}
        />
      )}

      {showUpdateDocument && viewerSession && selectedDocument && (
        <UpdateClinicalDocumentForm
          patient={patient}
          session={viewerSession}
          sourceDocument={selectedDocument}
          onCancel={() => setShowUpdateDocument(false)}
          onUpdated={(summary, documentReferenceId) => {
            handleDocumentUpdated(summary, documentReferenceId);
            void reloadDocuments();
          }}
        />
      )}

      {showCancelDocument && viewerSession && selectedDocument && (
        <CancelClinicalDocumentForm
          patient={patient}
          session={viewerSession}
          document={selectedDocument}
          onCancel={() => setShowCancelDocument(false)}
          onCancelled={(summary, documentReferenceId) => {
            handleDocumentCancelled(summary, documentReferenceId);
            void reloadDocuments();
          }}
        />
      )}

      {showUpdateCase && viewerSession && selectedCondition?.caseId && (
        <UpdateCaseForm
          patient={patient}
          session={viewerSession}
          condition={selectedCondition}
          onCancel={() => setShowUpdateCase(false)}
          onUpdated={handleCaseUpdated}
        />
      )}

      {showUpdateEncounter && viewerSession && selectedEncounter?.visitId && (
        <UpdateEncounterForm
          patient={patient}
          session={viewerSession}
          encounter={selectedEncounter}
          onCancel={() => setShowUpdateEncounter(false)}
          onUpdated={handleEncounterUpdated}
        />
      )}

      {showCloseEncounter && viewerSession && selectedEncounter?.visitId && (
        <CloseEncounterForm
          session={viewerSession}
          encounter={selectedEncounter}
          onCancel={() => setShowCloseEncounter(false)}
          onClosed={handleEncounterClosed}
        />
      )}

      {showCancelEncounter && viewerSession && selectedEncounter?.visitId && (
        <CancelEncounterForm
          session={viewerSession}
          encounter={selectedEncounter}
          onCancel={() => setShowCancelEncounter(false)}
          onCancelled={handleEncounterCancelled}
        />
      )}

      {showReopenEncounter && viewerSession && selectedEncounter?.visitId && (
        <ReopenEncounterForm
          session={viewerSession}
          encounter={selectedEncounter}
          onCancel={() => setShowReopenEncounter(false)}
          onReopened={handleEncounterReopened}
        />
      )}

      {showDeleteCase && viewerSession && selectedCondition?.caseId && (
        <DeleteCaseForm
          patient={patient}
          session={viewerSession}
          condition={selectedCondition}
          onCancel={() => setShowDeleteCase(false)}
          onDeleted={handleCaseDeleted}
        />
      )}

      {showRelapseCase && viewerSession && selectedCondition?.caseId && (
        <RelapseCaseForm
          patient={patient}
          session={viewerSession}
          condition={selectedCondition}
          onCancel={() => setShowRelapseCase(false)}
          onRelapsed={handleCaseRelapsed}
        />
      )}

      {showRemissionCase && viewerSession && selectedCondition?.caseId && (
        <RemissionCaseForm
          patient={patient}
          session={viewerSession}
          condition={selectedCondition}
          onCancel={() => setShowRemissionCase(false)}
          onRemissioned={handleCaseRemissioned}
        />
      )}

      {showResolveCase && viewerSession && selectedCondition?.caseId && (
        <ResolveCaseForm
          patient={patient}
          session={viewerSession}
          condition={selectedCondition}
          onCancel={() => setShowResolveCase(false)}
          onResolved={handleCaseResolved}
        />
      )}

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

          <KartonSection
            ref={(handle) => {
              sectionRefs.current[SECTION_ID_KEYS.documents] = handle;
            }}
            id={SECTION_ID_KEYS.documents}
            title={t(SECTION_TITLE_KEYS.documents)}
            count={documents.length}
            defaultOpen={documents.length > 0}
            error={documentsError ?? undefined}
          >
            {!canSearchDocumentsRole ? (
              <p className="empty-section">{t('karton.documentSearchRoleNotAllowed')}</p>
            ) : (
              <>
            <div className="document-filters">
              <label>
                {t('documentSearch.dateFrom')}
                <input
                  type="date"
                  value={documentFilters.dateFrom}
                  onChange={(e) =>
                    setDocumentFilters((current) => ({ ...current, dateFrom: e.target.value }))
                  }
                />
              </label>
              <label>
                {t('documentSearch.dateTo')}
                <input
                  type="date"
                  value={documentFilters.dateTo}
                  onChange={(e) =>
                    setDocumentFilters((current) => ({ ...current, dateTo: e.target.value }))
                  }
                />
              </label>
              <label>
                {t('documentSearch.type')}
                <select
                  value={documentFilters.typeCode}
                  onChange={(e) =>
                    setDocumentFilters((current) => ({ ...current, typeCode: e.target.value }))
                  }
                >
                  <option value="">{t('documentSearch.typeAll')}</option>
                  <option value={CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA}>
                    {CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA} — 011
                  </option>
                </select>
              </label>
              <label>
                {t('documentSearch.status')}
                <select
                  value={documentFilters.compositionStatus}
                  onChange={(e) =>
                    setDocumentFilters((current) => ({
                      ...current,
                      compositionStatus: e.target.value,
                    }))
                  }
                >
                  <option value="">{t('documentSearch.statusAll')}</option>
                  <option value="final">{formatFhirStatus('final', locale) ?? 'final'}</option>
                  <option value="entered-in-error">
                    {formatFhirStatus('entered-in-error', locale) ?? 'entered-in-error'}
                  </option>
                </select>
              </label>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void reloadDocuments()}
                disabled={documentsLoading}
              >
                {documentsLoading ? t('documentSearch.loading') : t('documentSearch.refresh')}
              </button>
            </div>

            {documentsLoading && documents.length === 0 ? (
              <p className="empty-section">{t('documentSearch.loading')}</p>
            ) : documents.length === 0 && !documentsError ? (
              <p className="empty-section">{t(SECTION_EMPTY_KEYS.documents)}</p>
            ) : (
              <ul className="card-list interactive-list">
                {documents.map((item) => {
                  const label = item.typeDisplay ?? t(FALLBACK_LABEL_KEYS.documents);
                  const statusLine =
                    formatFhirStatus(item.compositionStatus, locale) ?? item.compositionStatus;

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`card card-button ${isSelected(selection, 'document', item.id) ? 'card-selected' : ''}`}
                        onClick={() => setSelection({ kind: 'document', id: item.id })}
                      >
                        <strong>{label}</strong>
                        <span>
                          {statusLine}
                          {item.date &&
                            ` · ${formatDate(item.date, locale) ?? t('common.emDash')}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
              </>
            )}
          </KartonSection>

          {(['medications', 'allergies', 'procedures', 'referrals'] as const).map(
            (section) => {
              const items =
                section === 'medications'
                  ? detail.medications
                  : section === 'allergies'
                    ? detail.allergies
                    : section === 'procedures'
                      ? detail.procedures
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
                        const label = formatSectionItemLabel(section, item, t);
                        const dateValue = formatSectionItemDate(item);

                        const statusLine: string =
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
            viewerSession={viewerSession}
            canRetrieveDocument={canRetrieveDocumentsRole}
            encounterSummary={selectedEncounter}
            canUpdateEncounter={canUpdateSelectedEncounter}
            canCloseEncounter={canCloseSelectedEncounter}
            canCancelEncounter={canCancelSelectedEncounter}
            canReopenEncounter={canReopenSelectedEncounter}
            canUpdateCase={canUpdateSelectedCase}
            canDeleteCase={canDeleteSelectedCase}
            canRelapseCase={canRelapseSelectedCase}
            canRemissionCase={canRemissionSelectedCase}
            canResolveCase={canResolveSelectedCase}
            canNewVersionDocument={canNewVersionSelectedDocument}
            canCancelDocument={canCancelSelectedDocument}
            onUpdateEncounter={openUpdateEncounter}
            onCloseEncounter={openCloseEncounter}
            onCancelEncounter={openCancelEncounter}
            onReopenEncounter={openReopenEncounter}
            onUpdateCase={openUpdateCase}
            onDeleteCase={openDeleteCase}
            onRelapseCase={openRelapseCase}
            onRemissionCase={openRemissionCase}
            onResolveCase={openResolveCase}
            onNewVersionDocument={openNewDocumentVersion}
            onCancelDocument={openCancelDocument}
            onSelectPractitioner={(id) => setSelection({ kind: 'practitioner', id })}
            onSelectOrganization={(id) => setSelection({ kind: 'organization', id })}
            onClear={() => setSelection(null)}
          />
        )}
      </div>
    </section>
  );
}
