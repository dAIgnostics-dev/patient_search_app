# CEZIH PAA (Practitioner) — tehnička i certifikacijska dokumentacija

Aplikacija za rad zdravstvenog djelatnika s pacijentskim kartonom. Ovaj README opisuje **samo lokalni POC razvoj** — bez AWS deploya, Amplify sandboxa i produkcijskih integracija.

## 1) Što je uključeno u lokalni POC

- prijava djelatnika (tekstualni accounti)
- MBO pretraga i „Moji pacijenti”
- pregled kartona (timeline, sekcije, detalji)
- lifecycle posjeta i slučajeva (CEZIH message eventi `1.x` i `2.x`)
- lifecycle kliničkih dokumenata (MHD: submit/search/retrieve/update/cancel)
- LOM outbound notifikacija nakon uspješnog submita dokumenta
- terminology servisni sloj (mock/static provideri)
- audit zapis u lokalni JSONL

Svi CEZIH/MHD/LOM pozivi u lokalnom modu idu na **mock implementacije** dok ne postavite live URL-ove i certifikat.

## 2) Preduvjeti

- Node.js 20+
- `npm install` u root direktoriju projekta

**Nije potrebno:** AWS račun, Amplify sandbox, HealthLake datastore, CEZIH certifikat.

## 3) Brzo pokretanje

```bash
npm install

# Potrebno za build (datoteka je u .gitignore)
cp amplify_outputs.example.json amplify_outputs.json

npm run dev
```

Aplikacija je dostupna na `http://localhost:5173`.

### Demo korisnici

Zadana lozinka za sve accounte: **`cezih-demo`**

| Korisničko ime | Djelatnik    | HZJZ ID   |
| -------------- | ------------ | --------- |
| `ana.markovic` | Ana Marković | `1234567` |
| `luka.novak`   | Luka Novak   | `2233445` |
| `ivana.juric`  | Ivana Jurić  | `3344556` |
| `ana.knezevic` | Ana Knezevic | `1234568` |

Account datoteke: `auth/accounts/*.txt`

### Primjer MBO-ova (mock podaci)

| MBO         | Pacijent      |
| ----------- | ------------- |
| `180223069` | Ivan Horvat   |
| `290334170` | Petra Kovačić |
| `480556182` | Ana Horvat    |

## 4) Lokalna arhitektura

```mermaid
flowchart TB
  Browser[React UI localhost:5173]

  subgraph viteMiddleware [Vite dev middleware]
    AuthMw["/api/auth/*"]
    AuditMw["/api/audit/*"]
    LomMw["/api/lom-notifications"]
    MockCezihMw["/api/mock-cezih/resources"]
  end

  subgraph mockStorage [Lokalni mock podaci]
    Accounts[auth/accounts]
    CezihStore[mock-data/cezih-fhir-store.json]
    LomQueue[mock-data/lom-notifications.jsonl]
    AuditLog[audit/access.jsonl]
    Terminology[mock-data/terminology]
  end

  subgraph appServices [Aplikacijski servisi]
    CaseSvc[CaseManagementService]
    EncounterSvc[EncounterManagementService]
    DocumentSvc[DocumentManagementService]
    ChartSvc[PatientChartService]
    TermSvc[TerminologyService]
  end

  Browser --> viteMiddleware
  Browser --> appServices
  AuthMw --> Accounts
  AuditMw --> AuditLog
  LomMw --> LomQueue
  MockCezihMw --> CezihStore
  appServices --> MockCezihMw
  CaseSvc --> MockMessage[Mock CEZIH message client]
  EncounterSvc --> MockMessage
  DocumentSvc --> MockMhd[Mock MHD client]
  TermSvc --> MockTerm[Mock terminology provider]
  ChartSvc --> MockCezihClient[Mock CEZIH FHIR client]
```

### Kako lokalni fallback radi

| Komponenta                        | Lokalno ponašanje                                               |
| --------------------------------- | --------------------------------------------------------------- |
| Auth                              | `POST /api/auth/login` (Vite middleware)                        |
| Audit                             | `POST /api/audit/access` → `audit/access.jsonl`                 |
| CEZIH FHIR read/search            | `MockCezihFhirClient` + `mock-data/cezih-fhir-store.json`       |
| CEZIH message (posjete/slučajevi) | `MockCezihMessageClient` (bez `VITE_CEZIH_MESSAGE_URL`)         |
| MHD (dokumenti)                   | `MockMhdClient` (bez `VITE_CEZIH_MHD_URL`)                      |
| LOM notifikacija                  | lokalni queue `mock-data/lom-notifications.jsonl`               |
| Terminologija                     | `VITE_TERMINOLOGY_PROVIDER=mock` (default kad nema CEZIH URL-a) |

## 5) Korisnički tokovi

```mermaid
flowchart TD
  Login[Prijava]
  MboLookup[MBO pretraga]
  MyPatients[Moji pacijenti]
  Karton[Otvaranje kartona]
  EncounterOps[Posjeta]
  CaseOps[Slučaj]
  DocumentOps[Dokument]

  Login --> MboLookup
  Login --> MyPatients
  MboLookup --> Karton
  MyPatients --> Karton
  Karton --> EncounterOps
  Karton --> CaseOps
  Karton --> DocumentOps
```

Tipičan radni tok na kartonu:

1. Kreiraj ili odaberi otvorenu posjetu
2. Kreiraj slučaj na toj posjeti
3. Pošalji klinički dokument za posjetu
4. Po potrebi ažuriraj ili storniraj dokument unutar edit prozora

## 6) Funkcionalni pregled (mapa za certifikaciju)

### 6.1 Upravljanje slučajem

| Funkcionalnost            | CEZIH  | API                    | UI                  |
| ------------------------- | ------ | ---------------------- | ------------------- |
| Kreiraj novi slučaj       | `2.1`  | `createCase`           | `CreateCaseForm`    |
| Kreiraj ponovljeni slučaj | `2.2`  | `createCaseRecurrence` | `CreateCaseForm`    |
| Promjena u remisiju       | `2.3`  | `remissionCase`        | `RemissionCaseForm` |
| Zatvori slučaj            | `2.4`  | `resolveCase`          | `ResolveCaseForm`   |
| Promjena u recidiv        | `2.5`  | `relapseCase`          | `RelapseCaseForm`   |
| Obriši slučaj             | `2.7`  | `deleteCase`           | `DeleteCaseForm`    |
| Izmijeni slučaj           | update | `updateCase`           | `UpdateCaseForm`    |

### 6.2 Upravljanje posjetom

| Funkcionalnost         | CEZIH | API               | UI                    |
| ---------------------- | ----- | ----------------- | --------------------- |
| Kreiraj posjetu        | `1.1` | `createEncounter` | `CreateEncounterForm` |
| Izmijeni posjetu       | `1.2` | `updateEncounter` | `UpdateEncounterForm` |
| Zatvori posjetu        | `1.3` | `closeEncounter`  | `CloseEncounterForm`  |
| Obriši posjetu         | `1.4` | `cancelEncounter` | `CancelEncounterForm` |
| Ponovno otvori posjetu | `1.5` | `reopenEncounter` | `ReopenEncounterForm` |

### 6.3 Klinički dokumenti

| Funkcionalnost   | IHE/MHD      | API                                         | UI                           |
| ---------------- | ------------ | ------------------------------------------- | ---------------------------- |
| Slanje dokumenta | ITI-65       | `submitDocument`                            | `CreateClinicalDocumentForm` |
| Pretraživanje    | ITI-67       | `searchDocuments`                           | `PatientKarton`              |
| Dohvat           | ITI-68       | `getDocumentMetadata`, `getDocumentContent` | selection panel              |
| Ažuriranje       | nova verzija | `updateDocument`                            | `UpdateClinicalDocumentForm` |
| Storniranje      | cancel       | `cancelDocument`                            | `CancelClinicalDocumentForm` |

### 6.4 Terminologija

| Funkcionalnost                             | IHE SVCM | API                                     |
| ------------------------------------------ | -------- | --------------------------------------- |
| Query CodeSystem                           | ITI-96   | `getCodeSystemByUrl`, `syncTerminology` |
| Query ValueSet                             | ITI-95   | `getValueSetByUrl`                      |
| Hijerarhija (`parent-id`, `notSelectable`) | parser   | `getConceptTreeByUrl`                   |

Napomena: UI forme u POC-u još koriste statičke kataloge; terminology servis je pripremljen za buduću integraciju.

### 6.5 Poslovna pravila

Dostupnost akcija definirana je u `src/components/PatientKarton.tsx` (`isEncounter*`, `isCase*`, `isDocument*`), npr.:

- recidiv samo iz statusa remisije
- uređivanje dokumenta samo za `final` unutar edit prozora

## 7) Konfiguracija lokalnog POC-a

Za čisti lokalni rad **ne morate** postavljati `.env`. Default ponašanje koristi mock fallbacke.

Ako želite eksplicitnu konfiguraciju, kreirajte `.env`:

```bash
# Preporučeno za lokalni POC — svi resursi iz mock storea
VITE_RESOURCE_SOURCE_DEFAULT=mock-cezih

# CEZIH integracije — ostavite prazno za mock
VITE_CEZIH_API_BASE_URL=
VITE_CEZIH_MESSAGE_URL=
VITE_CEZIH_MHD_URL=
VITE_LOM_NOTIFICATION_URL=

# Terminologija
VITE_TERMINOLOGY_PROVIDER=mock

# Dokumenti — bez vremenskog ograničenja za edit/cancel
VITE_DOCUMENT_EDIT_WINDOW_MS=unlimited

# CEZIH message metadata
VITE_CEZIH_SOURCE_ENDPOINT=urn:oid:1.2.3.4.5.6
VITE_CEZIH_DEFAULT_ORG_HZZO=1234
```

### Env varijable (referenca)

| Varijabla                      | Lokalni POC default      | Svrha                  |
| ------------------------------ | ------------------------ | ---------------------- |
| `VITE_RESOURCE_SOURCE_DEFAULT` | `mock-cezih` (preporuka) | Izvor FHIR podataka    |
| `VITE_CEZIH_MESSAGE_URL`       | prazno → mock            | CEZIH message endpoint |
| `VITE_CEZIH_MHD_URL`           | prazno → mock            | MHD endpoint           |
| `VITE_CEZIH_API_BASE_URL`      | prazno → mock            | CEZIH FHIR base        |
| `VITE_LOM_NOTIFICATION_URL`    | prazno → lokalni queue   | LOM outbound           |
| `VITE_TERMINOLOGY_PROVIDER`    | `mock`                   | Terminology provider   |
| `VITE_DOCUMENT_EDIT_WINDOW_MS` | `unlimited`              | Edit/cancel prozor     |

Varijable `VITE_API_BASE_URL`, `VITE_AUTH_API_URL`, `VITE_AUDIT_API_URL` **nisu potrebne** u lokalnom POC-u jer auth i audit idu kroz Vite middleware.

## 8) Validacija lokalnog rada

Pokrenite integracijske provjere:

```bash
npm run validate:architecture
```

Pojedinačne provjere:

| Skripta                      | Što provjerava                   |
| ---------------------------- | -------------------------------- |
| `validate:encounter-message` | CEZIH encounter poruke (`1.x`)   |
| `validate:case-message`      | CEZIH case poruke (`2.x`)        |
| `validate:document-submit`   | MHD submit (ITI-65)              |
| `validate:document-search`   | MHD pretraga (ITI-67)            |
| `validate:document-read`     | MHD dohvat (ITI-68)              |
| `validate:document-update`   | Nova verzija dokumenta           |
| `validate:document-cancel`   | Storno dokumenta                 |
| `validate:terminology`       | Parser, hijerarhija, cache, sync |
| `validate:lom-notification`  | LOM event nakon submita          |

## 9) Struktura projekta (lokalni POC)

| Putanja                      | Opis                                           |
| ---------------------------- | ---------------------------------------------- |
| `src/components/`            | UI ekrani i forme                              |
| `src/data/services/`         | Poslovna logika                                |
| `src/data/fhir-client/`      | Mock CEZIH/message klijenti                    |
| `src/data/mhd-client/`       | Mock MHD klijent                               |
| `src/data/lom-notification/` | LOM klijent + lokalni queue                    |
| `src/data/terminology/`      | Terminology servis                             |
| `server/`                    | Vite middleware (auth, audit, LOM, mock-cezih) |
| `mock-data/`                 | Mock FHIR store i terminology                  |
| `auth/accounts/`             | POC login accounti                             |
| `audit/`                     | Lokalni audit log (`access.jsonl`)             |
| `scripts/`                   | Validacijske skripte                           |

## 10) Što nije u lokalnom POC opsegu

| Funkcionalnost                               | Status                                  |
| -------------------------------------------- | --------------------------------------- |
| CEZIH Pull notifikacije (`getNotifications`) | Nije implementirano                     |
| CEZIH Push notifikacije (webhook)            | Nije implementirano                     |
| Live CEZIH endpointi s certifikatom          | Nije konfigurirano                      |
| Produkcijska autentifikacija                 | Nije implementirano (samo POC accounti) |
| Dinamičke terminologije u UI formama         | Nije implementirano (servis postoji)    |
| AWS Amplify deploy / HealthLake proxy        | Nije potrebno za lokalni POC            |

## 11) Master tablica za certifikacijsku dokumentaciju

| Područje            | Funkcionalnost                       | Lokalni POC status             |
| ------------------- | ------------------------------------ | ------------------------------ |
| Slučajevi           | 7 operacija                          | Implementirano (mock message)  |
| Posjete             | 5 operacija                          | Implementirano (mock message)  |
| Dokumenti           | Submit/Search/Retrieve/Update/Cancel | Implementirano (mock MHD)      |
| LOM                 | Outbound nakon submita               | Implementirano (lokalni queue) |
| Terminologija       | Service layer                        | Djelomično (UI još statički)   |
| CEZIH Notifications | Pull/Push                            | Nije implementirano            |
| Auth                | Login                                | Implementirano (POC)           |
| Audit               | Evidencija pristupa                  | Implementirano (lokalni JSONL) |

## 12) Sljedeći koraci (izvan lokalnog POC-a)

Kad bude dostupan CEZIH certifikat i live endpointi:

1. Postaviti `VITE_CEZIH_MESSAGE_URL`, `VITE_CEZIH_MHD_URL`, `VITE_CEZIH_API_BASE_URL`
2. Postaviti `VITE_TERMINOLOGY_PROVIDER=cezih`
3. Pokrenuti `syncTerminology()` za inkrementalni dohvat šifrarnika
4. Implementirati CEZIH notification servis (Pull/Push) u backend integracijskom sloju
