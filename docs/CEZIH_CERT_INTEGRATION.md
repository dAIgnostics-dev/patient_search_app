# CEZIH CERT konfiguracija

Izvori: `CERT_linkovi_GET-POST (2).xlsx`, Sheet1, retci 2–51, i `cezih_info.rtf`.
Excel sadrži 50 ruta za 26 servisa. Sve vrijednosti URL/metoda prenesene su u
`src/config/cezihCertEndpoints.json`, s izvornim nazivom servisa i brojem retka.
Prazna metoda za Push notifikacije ostaje `null`; URL koristi `wss://`.
POST rute direktorija označene su `.post`; namjena tijela nije pretpostavljena.

## Rad bez pristupa CEZIH-u

U korijenu projekta pripremljene su lokalne datoteke isključene iz Gita:

- `.env.local`: `VITE_CEZIH_MODE=mock`, postojeći lokalni demo.
- `.cezih-cert.local.json`: dobiveni `clientId` i podaci testnog pacijenta.

Za pregled povezivanja može se postaviti `VITE_CEZIH_MODE=cert-offline` i ponovno
pokrenuti Vite. Taj način usmjerava pozive na lokalne `/api/cezih/{id}` rute.
`server/cezihMiddleware.ts` provjerava rutu i metodu te vraća 503
`CEZIH_NETWORK_DISABLED`. U `mock` i `cert-offline` načinu nema prosljeđivanja
prema CEZIH-u. Za stvarne HTTP pozive postoji zaseban način `cert-live`, opisan
ispod. Middleware je uključen u Vite dev i preview; nije produkcijski backend.
U oba CERT načina auth i audit koriste lokalni middleware, a HealthLake
base URL usmjerava se na blokirani lokalni gateway. AWS URL-ovi iz
`amplify_outputs.json` i environment overrideovi tada se ne koriste.

`cezihFetch.ts` odbija izravne vanjske URL-ove. Legacy CEZIH URL varijable ostaju
čitljive, ali izravni pozivi na njih sada su blokirani. Za ovaj pripremljeni tok
koristi se CERT način i katalog ruta, bez upisivanja URL-ova u forme.
Autentifikacijski podaci i testni pacijent nisu uključeni u frontend build.
Pacijent nije dodan u postojeći mock store; offline test čita lokalne podatke
i konstruira simulirani odgovor, s izričito izmišljenim lokalnim FHIR ID-em.
To nije dohvat ni potvrda CEZIH zapisa tog pacijenta.

## Pokretanje sa stvarnim CERT pozivima

Zaustavite postojeći Vite i pokrenite:

```bash
# Aplikacija s postojećim bridgeom
npm run dev:cert-live

# Ili aplikacija i mock bridge za lokalnu demo prijavu bez kartice
npm run dev:cert-live:with-bridge
```

Otvorite `http://127.0.0.1:5173`. `.env.cert-live` odabire `VITE_CEZIH_MODE=cert-live`
samo pri `--mode cert-live` i ima prednost pred `.env.local`. Zadani `npm run dev`
i dalje koristi postojeći način. Environment varijable postavljene izravno u
shellu imaju prednost nad datotekama. Ako `VITE_CEZIH_MODE` iz shella prepiše live način, pokretanje se odbija;
uklonite ga naredbom `unset VITE_CEZIH_MODE`. Ako je port zauzet, zaustavite prethodni
Vite; ovaj način koristi `strictPort`. Nemojte odabrati `cert-live` u `.env.local`:
Vite zahtijeva eksplicitni razvojni način i odbija live build/preview.

Za dodatnu konfiguraciju kopirajte `.env.cert-live.example` u
`.env.cert-live.local`, koji je isključen iz Gita. Sve vrijednosti su opcionalne:

| Varijabla | Svrha |
| --- | --- |
| `CEZIH_ACCESS_TOKEN` | Važeći OAuth2 access token, bez prefiksa `Bearer`; server dodaje Authorization zaglavlje |
| `CEZIH_CA_FILE` | Putanja do CA certifikata u PEM formatu, ako standardni CA-ovi nisu dovoljni |
| `CEZIH_CERT_FILE` i `CEZIH_KEY_FILE` | Par PEM datoteka za klijentski TLS certifikat, samo ako ga CEZIH zahtijeva |

Putanje mogu biti apsolutne ili relativne prema projektu. Nakon promjene
konfiguracije ponovno pokrenite Vite. Token i ključevi nemaju `VITE_` prefiks,
ne ugrađuju se u browser, a Vite blokira posluživanje lokalnih konfiguracijskih
datoteka i navedenih PEM datoteka. TLS provjera ostaje uključena.
PEM klijentski certifikat nije implementacija prijave ili potpisivanja pametnom
karticom; privatni ključ kartice ne izvozi se ovim putem.

`server/cezihProxy.ts` koristi Viteov proxy: prosljeđuje HTTP metodu, query i tijelo
na unaprijed određenu rutu iz kataloga, uz timeout od 10 sekundi za udaljeni poziv.
Ne prihvaća proizvoljne target URL-ove, ne prati redirekcije ni WebSocket veze.
`server/cezihMiddleware.ts` prije prosljeđivanja provjerava rutu, metodu, FHIR ID,
lokalnu adresu i browser Origin. Live server sluša na `127.0.0.1`;
browser cookies i browser Authorization ne prosljeđuju se CEZIH-u.
Odgovori se ne spremaju u cache. Ovo je lokalni razvojni gateway, bez produkcijske
serverske sesije/ovlasti.

VPN mora biti dostupan računalu na kojem radi Vite. Bez tokena gateway svejedno
šalje zahtjev; moguć je HTTP 401/403 ako je server dosegnut, ili 502 ako nije
dobiven HTTP odgovor zbog mreže, DNS-a, TLS-a ili timeouta. MBO pretraga u ovom
načinu šalje stvarni upit. Mock bridge služi samo prijavi u demo aplikaciju i ne
prijavljuje korisnika CEZIH-u. Dobiveni `client_id` nije access token; automatski
dohvat i obnova OAuth2 tokena nisu implementirani jer ugovor nije dostavljen.

## Mapa servisa

| Servis | ID u katalogu | Stanje implementacije |
| --- | --- | --- |
| Upravljanje slučajevima | `case.manage` | Postojeći builderi/parseri; odvojen klijent od posjeta |
| Upravljanje posjetama | `encounter.manage` | Postojeći builderi/parseri; odvojen klijent od slučajeva |
| Registracija dokumenta | `document.submit` | URL/metoda evidentirani; operacija blokirana prije poziva zbog nedostajućeg ugovora odgovora i OID-a/potpisa |
| Pretraga dokumenata | `DocumentReference.search` | Povezana ruta i postojeći parametri, pagination i lokalni filter statusa |
| Dohvat dokumenta | `document.retrieve` | Blokirano prije poziva: nedostaju parametri i format ITI-68 odgovora |
| Pretraga posjeta | `Encounter.search` | FHIR klijent povezan |
| Pretraga slučajeva | `Condition.search` | FHIR klijent povezan |
| Dohvat pacijenta | `Patient.search` | Povezan; MBO šalje se kao `identifier`, uz provjeru točnog rezultata |
| Registar identifikatora | `identifier.generate` | URL/metoda evidentirani; nedostaje ugovor batch OID zahtjeva |
| Sinkronizacija šifrarnika | `CodeSystem.search` | Terminology servis povezan; forme ostaju na postojećim katalozima |
| OAuth2 | `oauth.token` | URL/metoda i lokalni client ID; nije implementiran dohvat tokena |
| SGP uputnica | `referral.manage` | Evidentirano; nedostaje ugovor upravljačkih poruka |
| Pull notifikacije | `notification.pull` | Evidentirano; nedostaje ugovor filtriranja/potvrde primitka |
| Push notifikacije | `notification.push` | Evidentiran WebSocket; nema povezivanja ni pretplate |
| Pacijenti stranci | `patient.foreign.manage` | Evidentirano; nedostaje ITI-93 ugovor |
| ValueSet | `ValueSet.search` | Terminology servis povezan |
| StructureDefinition | `StructureDefinition.search` | Generički dohvat/pretraga; nema validacijskog sustava prema profilima |
| Udaljeni potpis | `signature.submit` | Evidentirano; nedostaje zahtjev i životni ciklus potpisa |
| Dohvat potpisa | `signature.retrieve` | Evidentirano; nedostaju parametri i odgovor |
| Organizacije | `Organization.*` | Generički GET search/read; POST i history rute evidentirane |
| Lokacije | `Location.*` | Generički GET search/read; nema nove UI forme |
| Practitioner | `Practitioner.*` | Generički GET search/read |
| PractitionerRole | `PractitionerRole.*` | Generički GET search/read; nije povezan s autorizacijom prijave |
| Zdravstvene usluge | `HealthcareService.*` | Generički GET search/read; nema nove UI forme |
| Relacije organizacija | `OrganizationAffiliation.*` | Generički GET search/read |
| Endpoint resursi | `Endpoint.*` | Generički GET search/read |

Katalog je inventar, a ne dokaz da je svaki poslovni tok implementiran.
GET dohvat po ID-u koristi eksplicitne `{id}` rute gdje postoje u Excelu;
za ostale resurse koristi FHIR `_id` pretragu. FHIR klijent čuva base putanju,
obrađuje više stranica rezultata i odbija pagination URL izvan pripadne rute.
Parametri pretrage, uključujući `_id`, `identifier` i MHD filtre, još zahtijevaju
provjeru prema CEZIH ugovoru. Ovdje su testirani isključivo simuliranim odgovorima.

## Preostali preduvjeti za stvarnu integraciju

1. OAuth2: `grant_type`, autentifikacija klijenta, scopeovi, trajanje i obnova
   tokena. Sam `client_id` nije dovoljan za implementaciju ispravnog zahtjeva.
2. Transport: zahtjevi za VPN/TLS/mTLS, certifikati i mjesto rada backend servisa.
   URL-ovi i VPN adrese iz priloga nisu posjećeni niti provjeravani.
3. ITI-65: stvarni zahtjev/odgovor, korelacija registriranih identifikatora,
   zamjena/storno, OID batch servis i potpisivanje. Trenutni builder generira
   demo OID, pa nije spreman za stvarni submit. HTTP klijent ne proglašava
   `Bundle.id` identifikatorom registriranog `DocumentReference` resursa.
4. ITI-68: parametri zahtjeva, veza DocumentReference/document ID i format
   sadržaja. Uklonjena je pretpostavka `/Bundle/{id}`. Zamjena i storno u HTTP
   klijentu također su blokirani dok ne postoji njihov ugovor; mock tokovi rade.
5. Udaljeni potpis, registar OID-ova, notifikacije, SGP i stranci: ugovori tijela,
   odgovora i grešaka. Ti tokovi nisu izmišljeni iz samog naziva endpointa.
6. Stvarno mapiranje kartice/djelatnika, serverska sesija i ovlasti te audit
   promjena. Postojeća demo prijava i klijentske uloge ostaju POC.
7. Ciljane upite za karton i „Moji pacijenti” uskladiti s dopuštenim parametrima;
   dio repozitorija još učitava kolekcije i filtrira ih lokalno.
8. Tek nakon izričitog odobrenja pristupa: testovi na CERT-u i potvrda poslovnog
   opsega potrebnog za privatnu ordinaciju.

## Lokalne provjere

U razvojnoj web aplikaciji nakon prijave dostupna je kartica **CEZIH endpointi**.
Prikazuje svih 50 zapisa, izvorni URL i metodu. Gumb **Provjeri** šalje lokalni
zahtjev za odabranu HTTP rutu; **Provjeri sve HTTP rute** provjerava svih 49.
Ovo ponašanje vrijedi za offline način. WebSocket zapis samo se prikazuje, bez otvaranja veze. Za rute s `{id}` koristi
se `demo-id`; ne šalju se pacijenti, tijela kliničkih poruka ni vjerodajnice.

Rezultat **Ruta usklađena — pristup blokiran** zahtijeva HTTP 503,
`CEZIH_NETWORK_DISABLED` i podudaranje URL-a/metode iz odgovora gatewaya s
katalogom. Sam HTTP 503 ne smatra se dovoljnim. U **Zahtjev i odgovor** može se
pregledati lokalna putanja i cijeli odgovor. Ekran provjerava usmjeravanje i
blokadu, a ne stvarnu dostupnost servisa, kliničke poruke ili prijavu CEZIH-u.
Kartica je skrivena u produkcijskom buildu.

U `cert-live` načinu isti ekran jasno prikazuje **CERT LIVE**. Gumbi šalju stvarne
GET zahtjeve; kolekcijske pretrage koriste `_count=1`, a read/history rute
`demo-id`. Prikazuje se udaljeni HTTP status i tijelo odgovora, koje može sadržavati
podatke pacijenata. 401/403 prikazuje odbijen pristup, a 400/404 može označavati
nedostajući parametar ili zapis. HTTP odgovor ne dokazuje da je poslovni ugovor
ispravno implementiran. Proxy dodaje oznaku udaljenog odgovora kako se lokalni
502/503 ne bi prikazivao kao odgovor CEZIH-a. POST gumbi u tom ekranu su isključeni;
slučajevi i posjete šalju POST kroz svoje postojeće forme s pripremljenom porukom.
Dokumentne operacije s nedostajućim ugovorom i dalje su blokirane u HTTP klijentu.

```bash
npm run validate:cezih-cert-offline
npm run validate:cezih-live
npm run validate:architecture:offline
npm run build
```

Offline test presreće HTTP odgovore u memoriji. Preload
`scripts/offline-only.mjs` blokira fetch, HTTP(S), WebSocket i izlazne TCP veze;
Unix-domain IPC je dopušten za tsx. Test provjerava sve katalogizirane HTTP
rute, metode, zabranu izravnih poziva, razdvojene poruke, pagination,
nedokumentirane operacije i lokalnog testnog pacijenta ako postoji njegova
datoteka. Ne šalje podatke pacijenta ni client ID.
`validate:architecture:offline` pokreće svih 17 postojećih provjera, offline CERT
provjeru i novu live konfiguracijsku provjeru s istom zabranom mreže. Live provjera
simulira proxy događaje i HTTP odgovore u memoriji; ne pokreće live Vite ni kontaktira CEZIH.

Za postojeće validatore isti preload može se koristiti pri pokretanju:

```bash
node --import ./scripts/offline-only.mjs --import tsx scripts/validate-document-submit.ts
```

Validator čitanja dokumenata sada povezuje bundle i DocumentReference po
identifikatoru dokumenta. Time podržava i postojeće zamijenjene dokumente koji
nemaju identifikator izveden iz `Bundle.id`, bez promjene mock podataka.
