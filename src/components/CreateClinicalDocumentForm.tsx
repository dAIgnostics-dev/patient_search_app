import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import type { PractitionerSession } from "../auth/types";
import { resolveCezihDefaultOrgHzzo } from "../config/runtime";
import { submitDocument } from "../data/documentApi";
import { DOCUMENT_OUTCOME_OPTIONS } from "../data/document-management/documentOutcomeCatalog";
import {
  CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
  CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY,
} from "../fhir/types";
import type {
  ConditionSummary,
  DocumentSummary,
  EncounterSummary,
  PatientSummary,
} from "../domain/models";
import { useLocale } from "../i18n/LocaleContext";
import type { TranslationKey } from "../i18n/translations";
import { formatDateTime } from "../utils/localeFormat";

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

function formatOpenEncounterLabel(
  encounter: EncounterSummary,
  locale: "hr" | "en",
  t: (key: TranslationKey) => string,
): string {
  const parts = [
    formatDateTime(encounter.start, locale),
    encounter.classDisplay ?? encounter.classCode,
    encounter.organizationName,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : t("karton.encounter");
}

function formatCaseLabel(
  condition: ConditionSummary,
  t: (key: TranslationKey) => string,
): string {
  const diagnosis = [condition.icd10Code, condition.display]
    .filter(Boolean)
    .join(" — ");
  const caseId = condition.caseId ? `ID ${condition.caseId}` : null;
  return [diagnosis || t("karton.conditions"), caseId]
    .filter(Boolean)
    .join(" · ");
}

interface CreateClinicalDocumentFormProps {
  patient: PatientSummary;
  session: PractitionerSession;
  openEncounters: EncounterSummary[];
  patientCases: ConditionSummary[];
  onCancel: () => void;
  onCreated: (summary: DocumentSummary, documentReferenceId: string) => void;
}

export function CreateClinicalDocumentForm({
  patient,
  session,
  openEncounters,
  patientCases,
  onCancel,
  onCreated,
}: CreateClinicalDocumentFormProps) {
  const { locale, t } = useLocale();
  const [step, setStep] = useState(1);
  const [encounterVisitId, setEncounterVisitId] = useState(
    openEncounters[0]?.visitId ?? "",
  );
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

  const selectedCase = useMemo(
    () => patientCases.find((item) => item.caseId === caseId) ?? null,
    [caseId, patientCases],
  );

  const selectedOutcome = useMemo(
    () =>
      DOCUMENT_OUTCOME_OPTIONS.find((item) => item.code === outcomeCode) ??
      DOCUMENT_OUTCOME_OPTIONS[0],
    [outcomeCode],
  );

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setAttachment(null);
      return;
    }
    if (file.type !== "application/pdf") {
      setError(t("documentCreate.attachmentTypeInvalid"));
      setAttachment(null);
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(t("documentCreate.attachmentTooLarge"));
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

  function goNext() {
    setError(null);
    if (step === 1 && !encounterVisitId) {
      setError(t("documentCreate.requiresOpenEncounter"));
      return;
    }
    if (step === 4 && !anamnesisText.trim()) {
      setError(t("documentCreate.missingAnamnesis"));
      return;
    }
    setStep((current) => Math.min(current + 1, 5));
  }

  function goBack() {
    setError(null);
    setStep((current) => Math.max(current - 1, 1));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors([]);

    if (!patient.mbo) {
      setError(t("documentCreate.missingPatientMbo"));
      setLoading(false);
      return;
    }
    if (!encounterVisitId) {
      setError(t("documentCreate.requiresOpenEncounter"));
      setLoading(false);
      return;
    }

    try {
      const result = await submitDocument(session, {
        patientMbo: patient.mbo,
        encounterVisitId,
        practitionerHzjzId: session.hzjzId,
        organizationHzzoCode,
        caseId: selectedCase?.caseId ?? undefined,
        caseIcd10Code: selectedCase?.icd10Code ?? undefined,
        caseDisplay: selectedCase?.display ?? undefined,
        typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
        anamnesisText: anamnesisText.trim(),
        outcomeCode,
        outcomeDisplay: selectedOutcome.display,
        healthcareServiceName: healthcareServiceName.trim() || undefined,
        attachment: attachment ?? undefined,
      });

      if (result.outcome === "success") {
        onCreated(result.summary, result.documentReferenceId);
        return;
      }

      const messages = result.issues.map(
        (issue) => issue.diagnostics ?? `${issue.severity}: ${issue.code}`,
      );
      setFieldErrors(messages);
      setError(t("documentCreate.failed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("documentCreate.failed"));
    } finally {
      setLoading(false);
    }
  }

  const selectedEncounter =
    openEncounters.find((item) => item.visitId === encounterVisitId) ??
    openEncounters[0];

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-panel modal-panel--document"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-document-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="create-document-title">{t("documentCreate.title")}</h2>
          <button
            type="button"
            className="secondary-button modal-close"
            onClick={onCancel}
          >
            {t("documentCreate.cancel")}
          </button>
        </header>

        <div className="modal-panel-intro">
          <p className="modal-hint">{t("documentCreate.hint")}</p>
          <p className="modal-step-indicator">
            {t("documentCreate.step", { step: String(step), total: "5" })}
          </p>
        </div>

        <form
          className="modal-form modal-form--document"
          onSubmit={handleSubmit}
        >
          {step === 1 && (
            <fieldset>
              <legend>{t("documentCreate.stepEncounter")}</legend>
              {openEncounters.length === 0 ? (
                <p className="empty">
                  {t("documentCreate.requiresOpenEncounter")}
                </p>
              ) : (
                <label>
                  {t("documentCreate.encounter")}
                  <select
                    value={encounterVisitId}
                    onChange={(e) => setEncounterVisitId(e.target.value)}
                    required
                  >
                    {openEncounters.map((encounter) => (
                      <option
                        key={encounter.visitId}
                        value={encounter.visitId ?? ""}
                      >
                        {formatOpenEncounterLabel(encounter, locale, t)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </fieldset>
          )}

          {step === 2 && (
            <fieldset>
              <legend>{t("documentCreate.stepCase")}</legend>
              <label>
                {t("documentCreate.case")}
                <select
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                >
                  <option value="">{t("documentCreate.noCase")}</option>
                  {patientCases.map((condition) => (
                    <option key={condition.id} value={condition.caseId ?? ""}>
                      {formatCaseLabel(condition, t)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="text-button"
                onClick={() => setCaseId("")}
              >
                {t("documentCreate.skipCase")}
              </button>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset>
              <legend>{t("documentCreate.stepType")}</legend>
              <p>
                <strong>{CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA}</strong> —{" "}
                {CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY}
              </p>
            </fieldset>
          )}

          {step === 4 && (
            <fieldset className="modal-form-fields">
              <legend>{t("documentCreate.stepContent")}</legend>
              <label>
                {t("documentCreate.anamnesis")}
                <textarea
                  value={anamnesisText}
                  onChange={(e) => setAnamnesisText(e.target.value)}
                  rows={3}
                  required
                />
              </label>
              <label>
                {t("documentCreate.outcome")}
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
                {t("documentCreate.healthcareService")}
                <input
                  type="text"
                  value={healthcareServiceName}
                  onChange={(e) => setHealthcareServiceName(e.target.value)}
                  placeholder={t("documentCreate.healthcareServiceHint")}
                />
              </label>
              <label>
                {t("documentCreate.organizationHzzo")}
                <input
                  type="text"
                  value={organizationHzzoCode}
                  onChange={(e) => setOrganizationHzzoCode(e.target.value)}
                  required
                />
              </label>
              <label>
                {t("documentCreate.attachment")}
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleAttachmentChange}
                />
              </label>
              {attachment && (
                <p className="hint">
                  {t("documentCreate.attachmentSelected", {
                    fileName: attachment.fileName,
                  })}
                </p>
              )}
            </fieldset>
          )}

          {step === 5 && (
            <fieldset>
              <legend>{t("documentCreate.stepConfirm")}</legend>
              <ul className="summary-list">
                <li>
                  {t("documentCreate.encounter")}:{" "}
                  {selectedEncounter
                    ? formatOpenEncounterLabel(selectedEncounter, locale, t)
                    : encounterVisitId}
                </li>
                <li>
                  {t("documentCreate.case")}:{" "}
                  {selectedCase
                    ? formatCaseLabel(selectedCase, t)
                    : t("documentCreate.noCase")}
                </li>
                <li>
                  {t("documentCreate.documentType")}:{" "}
                  {CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY}
                </li>
                <li>
                  {t("documentCreate.outcome")}: {selectedOutcome.display}
                </li>
                <li>
                  {t("documentCreate.attachment")}:{" "}
                  {attachment
                    ? attachment.fileName
                    : t("documentCreate.noAttachment")}
                </li>
              </ul>
            </fieldset>
          )}

          {error && <p className="error">{error}</p>}
          {fieldErrors.length > 0 && (
            <ul className="field-errors">
              {fieldErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}

          <div className="modal-actions">
            {step > 1 && (
              <button
                type="button"
                className="secondary-button"
                onClick={goBack}
                disabled={loading}
              >
                {t("documentCreate.back")}
              </button>
            )}
            {step < 5 ? (
              <button
                type="button"
                className="primary-button"
                onClick={goNext}
                disabled={
                  loading || (step === 1 && openEncounters.length === 0)
                }
              >
                {t("documentCreate.next")}
              </button>
            ) : (
              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                {loading
                  ? t("documentCreate.submitting")
                  : t("documentCreate.submit")}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
