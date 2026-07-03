import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PractitionerSession } from "../auth/types";
import { resolveCezihDefaultOrgHzzo } from "../config/runtime";
import { getDocumentEditDefaults, updateDocument } from "../data/documentApi";
import { DOCUMENT_OUTCOME_OPTIONS } from "../data/document-management/documentOutcomeCatalog";
import {
  CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
  CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY,
} from "../fhir/types";
import type { DocumentSummary, PatientSummary } from "../domain/models";
import { useLocale } from "../i18n/LocaleContext";
import { formatDateTime } from "../utils/localeFormat";

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

interface UpdateClinicalDocumentFormProps {
  patient: PatientSummary;
  session: PractitionerSession;
  sourceDocument: DocumentSummary;
  onCancel: () => void;
  onUpdated: (summary: DocumentSummary, documentReferenceId: string) => void;
}

export function UpdateClinicalDocumentForm({
  patient,
  session,
  sourceDocument,
  onCancel,
  onUpdated,
}: UpdateClinicalDocumentFormProps) {
  const { locale, t } = useLocale();
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [encounterVisitId, setEncounterVisitId] = useState("");
  const [caseId, setCaseId] = useState("");
  const [anamnesisText, setAnamnesisText] = useState("");
  const [outcomeCode, setOutcomeCode] = useState<string>(
    DOCUMENT_OUTCOME_OPTIONS[0].code,
  );
  const [healthcareServiceName, setHealthcareServiceName] = useState("");
  const [organizationHzzoCode, setOrganizationHzzoCode] = useState(
    resolveCezihDefaultOrgHzzo(),
  );
  const [attachment, setAttachment] = useState<{
    fileName: string;
    contentType: string;
    base64Data: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const selectedOutcome = useMemo(
    () =>
      DOCUMENT_OUTCOME_OPTIONS.find((item) => item.code === outcomeCode) ??
      DOCUMENT_OUTCOME_OPTIONS[0],
    [outcomeCode],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDefaults() {
      setLoadingDefaults(true);
      setError(null);
      try {
        const defaults = await getDocumentEditDefaults(sourceDocument.id);
        if (cancelled) return;
        if (!defaults) {
          setError(t("documentUpdate.loadFailed"));
          return;
        }
        setEncounterVisitId(defaults.encounterVisitId);
        setCaseId(defaults.caseId ?? "");
        setAnamnesisText(defaults.anamnesisText);
        setOutcomeCode(defaults.outcomeCode);
        setHealthcareServiceName(defaults.healthcareServiceName ?? "");
        setOrganizationHzzoCode(
          defaults.organizationHzzoCode || resolveCezihDefaultOrgHzzo(),
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("documentUpdate.loadFailed"),
          );
        }
      } finally {
        if (!cancelled) setLoadingDefaults(false);
      }
    }

    void loadDefaults();
    return () => {
      cancelled = true;
    };
  }, [sourceDocument.id, t]);

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setAttachment(null);
      return;
    }
    if (file.type !== "application/pdf") {
      setError(t("documentUpdate.attachmentTypeInvalid"));
      setAttachment(null);
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(t("documentUpdate.attachmentTooLarge"));
      setAttachment(null);
      return;
    }
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    setAttachment({
      fileName: file.name,
      contentType: file.type,
      base64Data: btoa(binary),
    });
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors([]);

    if (!patient.mbo) {
      setError(t("documentUpdate.missingPatientMbo"));
      setLoading(false);
      return;
    }
    if (!anamnesisText.trim()) {
      setError(t("documentUpdate.missingAnamnesis"));
      setLoading(false);
      return;
    }

    try {
      const result = await updateDocument(session, {
        replacesDocumentReferenceId: sourceDocument.id,
        patientMbo: patient.mbo,
        encounterVisitId,
        practitionerHzjzId: session.hzjzId,
        organizationHzzoCode,
        caseId: caseId.trim() || undefined,
        typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
        anamnesisText: anamnesisText.trim(),
        outcomeCode,
        outcomeDisplay: selectedOutcome.display,
        healthcareServiceName: healthcareServiceName.trim() || undefined,
        attachment: attachment ?? undefined,
      });

      if (result.outcome === "success") {
        onUpdated(result.summary, result.documentReferenceId);
        return;
      }

      const messages = result.issues.map(
        (issue) => issue.diagnostics ?? `${issue.severity}: ${issue.code}`,
      );
      setFieldErrors(messages);
      setError(t("documentUpdate.failed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("documentUpdate.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-panel modal-panel--document"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-document-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="update-document-title">{t("documentUpdate.title")}</h2>
          <button
            type="button"
            className="secondary-button modal-close"
            onClick={onCancel}
          >
            {t("documentUpdate.cancel")}
          </button>
        </header>

        <p className="modal-hint">{t("documentUpdate.hint")}</p>

        {loadingDefaults ? (
          <p className="empty">{t("documentUpdate.loading")}</p>
        ) : (
          <form
            className="modal-form modal-form--document"
            onSubmit={handleSubmit}
          >
            <fieldset className="modal-form-summary">
              <legend>{t("documentUpdate.sourceDocument")}</legend>
              <ul className="summary-list">
                <li>
                  {t("documentUpdate.sourceId")}: {sourceDocument.id}
                </li>
                <li>
                  {t("documentUpdate.documentType")}:{" "}
                  {CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY}
                </li>
                <li>
                  {t("documentUpdate.encounter")}: {encounterVisitId}
                </li>
                <li>
                  {t("documentUpdate.date")}:{" "}
                  {sourceDocument.date
                    ? formatDateTime(sourceDocument.date, locale)
                    : t("common.emDash")}
                </li>
              </ul>
            </fieldset>

            <div className="modal-form-fields">
              <label>
                {t("documentUpdate.anamnesis")}
                <textarea
                  value={anamnesisText}
                  onChange={(e) => setAnamnesisText(e.target.value)}
                  rows={3}
                  required
                />
              </label>
              <label>
                {t("documentUpdate.outcome")}
                <select
                  value={outcomeCode}
                  onChange={(e) => setOutcomeCode(e.target.value)}
                >
                  {DOCUMENT_OUTCOME_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.display}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("documentUpdate.healthcareService")}
                <input
                  type="text"
                  value={healthcareServiceName}
                  onChange={(e) => setHealthcareServiceName(e.target.value)}
                  placeholder={t("documentUpdate.healthcareServiceHint")}
                />
              </label>
              <label>
                {t("documentUpdate.organizationHzzo")}
                <input
                  type="text"
                  value={organizationHzzoCode}
                  onChange={(e) => setOrganizationHzzoCode(e.target.value)}
                  required
                />
              </label>
              <label>
                {t("documentUpdate.attachment")}
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleAttachmentChange}
                />
              </label>
              {attachment && (
                <p className="hint">
                  {t("documentUpdate.attachmentSelected", {
                    fileName: attachment.fileName,
                  })}
                </p>
              )}
            </div>

            {error && <p className="error">{error}</p>}
            {fieldErrors.length > 0 && (
              <ul className="field-errors">
                {fieldErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onCancel}
                disabled={loading}
              >
                {t("documentUpdate.cancel")}
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                {loading
                  ? t("documentUpdate.submitting")
                  : t("documentUpdate.submit")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
