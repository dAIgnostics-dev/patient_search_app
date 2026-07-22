export type PractitionerRole = string;

/**
 * Uloge koje smiju izvoditi operacije nad slučajevima (CEZIH events 2.1–2.7).
 * Popis je zadan specifikacijom i namjerno se čuva doslovno (uključujući
 * `physicians` i `emergency_tehnician`) radi buduće usklađenosti s
 * dokumentacijom pametne kartice.
 */
export const CASE_MANAGEMENT_ROLES: ReadonlySet<PractitionerRole> = new Set([
  'specialist',
  'physicians',
  'pediatrician',
  'gynecologist',
  'physician_school',
  'emergency_tehnician',
  'emergency_physician',
  'specialist_colonoscopy',
  'specialist_cytology',
  'specialist_epidemiology',
  'specialist_patology',
  'specialist_pulmology',
  'specialist_radiology',
  'radiology_manager',
  'private_care_specialist',
  'resident',
  'dentist',
]);

/**
 * Uloge koje smiju izvoditi operacije nad posjetama (CEZIH events 1.x).
 * Popis je zadan specifikacijom i namjerno se čuva doslovno.
 */
export const ENCOUNTER_MANAGEMENT_ROLES: ReadonlySet<PractitionerRole> = new Set([
  'sgp_administrator',
  'sgp_laboratory_technician',
  'specialist',
  'specialistic_nurse',
  'specialistic_technician',
  'admission_officer',
  'physicians',
  'pediatrician',
  'gynecologist',
  'physician_school',
  'emergency_tehnician',
  'emergency_physician',
  'resident',
  'specialist_colonoscopy',
  'specialist_cytology',
  'specialist_epidemiology',
  'specialist_patology',
  'specialist_pulmology',
  'specialist_radiology',
  'radiology_manager',
  'radiology_engineer',
  'private_care_specialist',
  'private_care_specialistic_nurse',
  'private_care_specialistic_technician',
  'dentist',
  'nurse',
  'laboratory_technician',
  'biochemistry_engineer',
  'home_therapist',
  'home_caregiver',
]);

/**
 * Uloge koje smiju pretraživati kliničke dokumente u registru i repozitoriju
 * [ITI-67]. Popis je zadan specifikacijom i namjerno se čuva doslovno.
 */
export const DOCUMENT_SEARCH_ROLES: ReadonlySet<PractitionerRole> = new Set([
  'dentist',
  'emergency_physician',
  'emergency_tehnician',
  'gynecologist',
  'health_visitor',
  'home_caregiver',
  'home_therapist',
  'occupational_physician',
  'pediatrician',
  'physician_school',
  'physicians',
  'radiology_manager',
  'resident',
  'specialist',
  'specialist_colonoscopy',
  'specialist_cytology',
  'specialist_epidemiology',
  'specialist_patology',
  'specialist_pulmology',
  'specialist_radiology',
  'specialistic_nurse',
  'specialistic_technician',
  'private_care_specialist',
  'private_care_specialistic_nurse',
  'private_care_specialistic_technician',
  'helpdesk_clinical_documents',
]);

/**
 * Uloge koje smiju dohvatiti klinički dokument iz registra i repozitorija
 * [ITI-68]. Popis je zadan specifikacijom i namjerno se čuva doslovno.
 */
export const DOCUMENT_RETRIEVE_ROLES: ReadonlySet<PractitionerRole> = new Set([
  'dentist',
  'emergency_physician',
  'emergency_tehnician',
  'gynecologist',
  'health_visitor',
  'home_caregiver',
  'home_therapist',
  'occupational_physician',
  'pediatrician',
  'physician_school',
  'physicians',
  'radiology_manager',
  'resident',
  'specialist',
  'specialist_colonoscopy',
  'specialist_cytology',
  'specialist_epidemiology',
  'specialist_patology',
  'specialist_pulmology',
  'specialist_radiology',
  'private_care_specialist',
  'helpdesk_clinical_documents',
]);

/**
 * Uloge koje smiju registrirati (ITI-65) sve vrste kliničkih dokumenata,
 * neovisno o tipu dokumenta.
 */
export const DOCUMENT_REGISTRATION_UNIVERSAL_ROLES: ReadonlySet<PractitionerRole> = new Set([
  'helpdesk_clinical_documents',
]);

/**
 * Matrica uloga za registraciju/zamjenu/storniranje dokumenta [ITI-65]. Uloge
 * koje smiju registrirati dokument razlikuju se ovisno o tipu dokumenta.
 *
 * Aplikacija trenutno implementira samo tip `011` ("Izvješće nakon pregleda u
 * ambulanti privatne zdravstvene ustanove"), pa je provedba trenutno moguća
 * samo za taj tip. Ostali tipovi iz specifikacije dodaju se kada budu dostupni
 * njihovi CEZIH kodovi. Puna matrica iz specifikacije:
 *   - Nalaz nakon hitnog prijema u bolnicu -> resident, specialist,
 *     specialist_colonoscopy, specialist_cytology, specialist_epidemiology,
 *     specialist_patology, specialist_pulmology, specialist_radiology
 *   - Otpusno pismo nakon hitnog prijema u bolnicu -> (isto kao gore)
 *   - Opći nalaz na internu uputnicu -> (isto kao gore) + radiology_manager
 *   - Izvješće nakon intervencije hitne pomoći -> emergency_tehnician,
 *     emergency_physician
 *   - Izvješće nakon pregleda u ambulanti privatne zdravstvene ustanove (011),
 *     Nalazi iz specijalističke ordinacije privatne zdravstvene ustanove,
 *     Otpusno pismo iz privatne zdravstvene ustanove -> private_care_specialist
 *   - Sve vrste -> helpdesk_clinical_documents (vidi UNIVERSAL_ROLES)
 */
export const DOCUMENT_REGISTRATION_ROLES_BY_TYPE: Readonly<
  Record<string, ReadonlySet<PractitionerRole>>
> = {
  '011': new Set(['private_care_specialist']),
};

/**
 * POC default: aplikacija je namijenjena privatnicima, pa liječnik pri prijavi
 * karticom dobiva ulogu `private_care_specialist` dok ne bude dostupna
 * dokumentacija za čitanje uloge s kartice.
 */
export const DEFAULT_PRACTITIONER_ROLE: PractitionerRole = 'private_care_specialist';

/** Vraća true ako uloga smije raditi s operacijama nad slučajevima. */
export function canManageCases(role: PractitionerRole | null | undefined): boolean {
  if (!role) return false;
  return CASE_MANAGEMENT_ROLES.has(role.trim());
}

/** Vraća true ako uloga smije raditi s operacijama nad posjetama. */
export function canManageEncounters(role: PractitionerRole | null | undefined): boolean {
  if (!role) return false;
  return ENCOUNTER_MANAGEMENT_ROLES.has(role.trim());
}

/** Vraća true ako uloga smije pretraživati kliničke dokumente [ITI-67]. */
export function canSearchDocuments(role: PractitionerRole | null | undefined): boolean {
  if (!role) return false;
  return DOCUMENT_SEARCH_ROLES.has(role.trim());
}

/** Vraća true ako uloga smije dohvatiti klinički dokument [ITI-68]. */
export function canRetrieveDocuments(role: PractitionerRole | null | undefined): boolean {
  if (!role) return false;
  return DOCUMENT_RETRIEVE_ROLES.has(role.trim());
}

/**
 * Vraća true ako uloga smije registrirati/zamijeniti/stornirati dokument
 * zadanog tipa [ITI-65]. Univerzalne uloge smiju sve tipove; ostale ovise o
 * matrici uloga po tipu dokumenta.
 */
export function canRegisterDocument(
  role: PractitionerRole | null | undefined,
  typeCode: string | null | undefined,
): boolean {
  if (!role) return false;
  const trimmed = role.trim();
  if (DOCUMENT_REGISTRATION_UNIVERSAL_ROLES.has(trimmed)) return true;
  if (!typeCode) return false;
  const allowed = DOCUMENT_REGISTRATION_ROLES_BY_TYPE[typeCode];
  return allowed ? allowed.has(trimmed) : false;
}
