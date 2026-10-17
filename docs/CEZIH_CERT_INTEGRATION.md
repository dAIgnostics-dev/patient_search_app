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
U oba CERT načina demo prijava i audit koriste lokalni middleware, a HealthLake
base URL usmjerava se na lokalni CEZIH gateway bez HealthLake ruta. AWS URL-ovi iz
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

Za konfiguraciju koristite `.env.cert-live.local`, koji je isključen iz Gita.
Ako ne postoji, kopirajte `.env.cert-live.example`. Za automatski OAuth2 potrebni
su client ID i client secret; TLS datoteke ovise o zahtjevima CEZIH-a:

| Varijabla | Svrha |
| --- | --- |
| `CEZIH_CLIENT_ID` | Identifikator registrirane instance aplikacije |
| `CEZIH_CLIENT_SECRET` | Zaporka registrirane instance; čuva se samo na serveru |
| `CEZIH_TOKEN_AUTH_METHOD` | `client_secret_basic` (zadano) ili `client_secret_post` prema potvrdi CEZIH-a |
| `CEZIH_SCOPE` | Opcionalni scopeovi, odvojeni razmakom, samo ako ih propiše CEZIH |
| `CEZIH_APPLICATION_ENDPOINTS` | Kataloški ID-evi aplikacijskih HTTP usluga, odvojeni zarezom; zadano `CodeSystem.search,ValueSet.search,notification.pull` |
| `CEZIH_ACCESS_TOKEN` | Opcionalni ručni token bez `Bearer`; za rute s nepotvrđenim auth ugovorom te aplikacijske rute bez client credentials. Ne zamjenjuje korisničku sesiju na kliničkim rutama i ne obnavlja se automatski |
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

VPN mora biti dostupan računalu na kojem radi Vite. Aplikacijska ruta bez
konfiguriranih vjerodajnica ili ručnog tokena vraća lokalni 503
`CEZIH_AUTH_UNCONFIGURED`, bez slanja udaljenog zahtjeva. Kliničke rute sada zahtijevaju
provjerenu korisničku sesiju: bez nje, uključujući MBO pretragu, vraćaju lokalni 401
`CEZIH_USER_AUTH_REQUIRED` i ne šalju ništa CEZIH-u. Taj 401 ne potvrđuje dostupnost
udaljenog endpointa. Za druge rute moguć je udaljeni 401/403 ili lokalni 502 zbog
VPN-a/DNS-a/TLS-a. Mock bridge služi samo prijavi u demo aplikaciju i ne prijavljuje liječnika CEZIH-u.

## OAuth2 Client Credentials

`server/cezihTokenProvider.ts` šalje serverski POST na `oauth.token` iz kataloga,
s `Content-Type: application/x-www-form-urlencoded` i `grant_type=client_credentials`.
Kod `client_secret_basic` vrijednosti se zasebno form-URL-kodiraju, spoje dvotočkom,
Base64-kodiraju i šalju u `Authorization: Basic`. Kod `client_secret_post` šalju
se kao polja `client_id` i `client_secret` u tijelu. Metode se ne kombiniraju i
nema automatskog prelaska s jedne na drugu nakon odbijanja. Basic je izbor prema
standardu; stvarnu metodu i scopeove vaše CEZIH registracije treba potvrditi.

Token se traži tek na zahtjev aplikacijske usluge ili klikom na **Provjeri OAuth2**.
Čuva se samo u memoriji Vite procesa, zajedno s `expires_in`; ponovni dohvat radi
se na sljedeći zahtjev malo prije isteka. Istodobni pozivi dijele isti dohvat.
Ne sprema se na disk niti vraća browseru. Prikazani `refresh_token` iz primjera
ne koristi se; novi token traži se ponovnim Client Credentials zahtjevom.
Token servis ima timeout od 10 sekundi i ograničenje odgovora od 64 KiB.
Isti TLS agent s uključenom provjerom certifikata koristi se za token i servisne pozive.

HTTP 401 aplikacijske usluge uklanja odgovarajući spremljeni token; sljedeći
poziv traži novi. Stariji 401 ne uklanja noviji token. HTTP 403 ne izaziva obnovu.
Poslovni zahtjevi se nikad automatski ne ponavljaju. Privremena greška token servisa
zaustavlja nove pokušaje 5 sekundi; `invalid_client`, `invalid_scope`,
`unauthorized_client` i `unsupported_grant_type` zahtijevaju provjeru konfiguracije
i ponovno pokretanje Vitea. Istekli client secret treba zamijeniti podatkom od administratora.
Zaporke, tokeni i izvorni tekst greške token servisa ne vraćaju se u dijagnostiku.

Zadano su povezane samo aplikacijske usluge iz dostavljenih uputa: CodeSystem,
ValueSet i Pull notifikacije. `CEZIH_APPLICATION_ENDPOINTS` proširujte tek uz potvrđen
ugovor pojedine usluge. Aplikacijski token ne zamjenjuje token liječnika, uloge,
prijavu karticom ni digitalni potpis. Push WebSocket i dalje se ne otvara.
Sirovi `/api/cezih/oauth.token` u live načinu vraća 403; token endpoint dostupan je
samo internom serverskom klijentu. Offline katalog i dalje prikazuje svih 50 zapisa
i provjerava 49 HTTP ruta; live proxy ima 48 servisnih HTTP ruta.

U kartici **CEZIH endpointi** novi blok **Autentikacija informacijskog sustava**
prikazuje metodu, konfigurirane aplikacijske rute, stanje, istek i sigurnu poruku
greške. **Osvježi status** šalje samo lokalni GET `/api/cezih/auth.status`, bez
mrežnog poziva CEZIH-u. **Provjeri OAuth2** šalje lokalni POST `/api/cezih/auth.check`:
traži token ako nema spremljenog važećeg tokena. Token uspješno dohvaćen od
izdavatelja nije potvrda ovlasti za svaku uslugu; njih provjerava CEZIH pri pozivu.
Ručni token prikazuje se kao ručni, bez tvrdnje da je njegova valjanost provjerena.

## Priprema korisničke prijave pametnom karticom

U razvojnoj aplikaciji **CEZIH endpointi → Prijava u CEZIH pametnom karticom**
dostupna je lokalna simulacija u `mock` i `cert-offline` načinu. Za rad bez VPN-a:

```bash
npm run dev:with-bridge
```

Prijavite se postojećom mock karticom, otvorite karticu **CEZIH endpointi**,
odaberite simuliranog djelatnika i ishod pa kliknite **Pokreni simuliranu prijavu**
i **Završi simuliranu prijavu**. Dostupni su odustajanje, nedostupna kartica,
odbijanje prijave, provjera zaštićenog pristupa (200), simulirani 403 i istek (401).
Simulirani 403 ne odjavljuje sesiju. **Odjavi CEZIH sesiju** prekida samo tu sesiju;
odjava iz aplikacije također briše serversku CEZIH sesiju prije lokalne odjave.
Uspješna nova demo prijava briše prethodnu CEZIH sesiju radi promjene djelatnika.
Simulacija ne mijenja demo korisnički račun i nikada ne odobrava live CEZIH pozive.
Panel ne traži PIN, certifikat, privatni ključ ni vrijednost `mod_auth_openid_session`.

`server/cezihUserSession.ts` čuva odvojene sesije u memoriji. Browser dobiva slučajni
opaque identifikator u `HttpOnly; SameSite=Lax` cookieju s putanjom `/api/cezih`;
`Secure` se dodaje na HTTPS vezi. HTTP je dopušten samo za lokalni razvoj uz
provjeru loopback adrese i Host/Origin zaglavlja. Za produkciju treba HTTPS i
odgovarajuće sesijsko spremište; ovaj Vite gateway nije produkcijski auth backend.

Promjene sesije zahtijevaju POST i prilagođeno zaglavlje koje browser sa strane
ne može poslati bez dopuštenog CORS preflighta. Simulirani povratni korak vezan
je uz cookie i jednokratni challenge (60 sekundi). Identifikator cookieja rotira
se pri početku i završetku prijave. Raniji identifikatori ne mogu autorizirati
pozive, ali mogu odjaviti povezanu rotiranu sesiju radi sigurnosti pri istodobnoj
prijavi i odjavi. Simulirana prijava traje 5 minuta; istekom se brišu identitet
i eventualna upstream sesija. Spremište ima granicu 1000 zapisa, zadržavanje do
30 minuta i najviše 64 rotacije po zapisu. Vite restart briše sve sesije.

Lokalne rute su `/api/cezih/user-auth/status` (GET), te `start`, `complete`,
`test`, `expire` i `logout` (POST). Status vraća samo oznaku načina rada, stanje,
identitet/uloge, istek i simulacijski challenge, bez cookie ID-a i CEZIH tajne sesije.
U `cert-live` načinu svi pokušaji početka ili simuliranja prijave vraćaju 501,
bez preusmjeravanja ili mrežnih poziva. Status i lokalna odjava rade. Ne postoji
izmišljeni callback ni javna ruta za postavljanje identiteta, uloga ili upstream sesije.

`completeVerified` je isključivo serverska točka povezivanja budućeg provjerenog
SSO povrata. Ne provodi OIDC validaciju i nije dostupna preko HTTP-a. Budući
adapter mora najprije provjeriti protokol povrata, identitet, uloge, istek i vezu
s prijavom/browserom. Ugovor CEZIH preuzimanja sesije, službeni SSO URL-ovi,
odobreni callback i način mapiranja identiteta još nisu dostavljeni; stvarni TLS
login karticom, validacija OIDC odgovora i SSO logout nisu implementirani.

Poznate korisničke rute nalaze se u `CEZIH_USER_ENDPOINTS`: pacijent, posjete,
slučajevi, dokumenti, uputnice, stranci i udaljeni potpis. Proxy uklanja browserov
`mod_auth_openid_session`, cookies i Authorization te provjerava serversku sesiju
sa stvarnim izvorom `cezih`. Aplikacijski ni ručni token ne mogu zaobići tu provjeru.
Te rute ne mogu se dodati u `CEZIH_APPLICATION_ENDPOINTS`. Tek provjerena serverska
sesija može postaviti `mod_auth_openid_session` za odgovarajućeg korisnika.
Za slučajeve, posjete i pretragu/dohvat dokumenata ponavljaju se postojeće provjere
uloga na serveru. Registracija dokumenata i druge posebne operacije i dalje imaju
nedostajuće poslovne ugovore; ovaj sloj ne proglašava te tokove dovršenima.
Uloge dobivene iz budućeg provjerenog povrata neće se uzimati iz React sessionStoragea.
Upstream 401 poništava korištenu sesiju; 403 je ne poništava, a stariji 401 ne
poništava noviju sesiju. Zahtjevi se ne ponavljaju automatski, redirekcije se ne prate.

## Uloge djelatnika za funkcionalnosti

Jedinstveni popisi su u `src/auth/roles.ts` i odgovaraju dostavljenim CEZIH pravilima:

| Funkcionalnost | Broj dopuštenih uloga | Serverska ruta |
| --- | --- | --- |
| Upravljanje slučajevima | 17 | `case.manage` |
| Upravljanje posjetama | 30 | `encounter.manage` |
| Pretraga dokumenata ITI-67 | 26 | `DocumentReference.search` |
| Dohvat dokumenta ITI-68 | 22 | `document.retrieve` |

Dovoljna je jedna dopuštena uloga. Nepoznata ili nedostajuća uloga ne daje prava.
`specialistic_nurse`, `specialistic_technician`, `private_care_specialistic_nurse`
i `private_care_specialistic_technician` smiju pretraživati, ali ne dohvaćati dokumente.
`helpdesk_clinical_documents` smije pretraživati i dohvaćati sve vrste dokumenata;
ta uloga sama po sebi ne daje prava upravljanja slučajevima ili posjetama.

Provjere koriste sučelje, aplikacijski API i live proxy. Proxy čita uloge iz
provjerene serverske korisničke sesije; ne prihvaća ih iz browser zaglavlja,
lokalnog POC računa ili aplikacijskog OAuth2 tokena. Bez korisničke sesije vraća
401, a za sesiju bez odgovarajuće uloge 403 prije prosljeđivanja. Prava za ITI-65
ostaju definirana zasebnom matricom po tipu dokumenta.

Neovisna testna specifikacija `scripts/fixtures/cezih-role-policy.json` čuva
dostavljene popise. `npm run validate:cezih-user-session` bez mreže provjerava
točno članstvo, sve uloge kroz sve četiri serverske rute, više uloga na korisniku,
zabranu zaobilaženja putem zaglavlja i odbijanje u aplikacijskim API funkcijama.

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
| OAuth2 | `oauth.token` | Serverski Client Credentials, Basic/POST, cache i obnova na zahtjev; bez stvarnog CERT testa |
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

1. OAuth2: dobiti client secret i potvrditi Basic/POST metodu, scopeove i popis
   aplikacijskih usluga za registriranu instancu. Client Credentials tok je implementiran;
   autentikacija liječnika ostaje zaseban nedovršen tok.
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
6. Spojiti pripremljeno serversko spremište korisničkih sesija na službeni SSO
   ugovor: TLS karticom, siguran povrat sesije, potvrđen identitet/uloge i SSO odjava.
   Postojeća demo prijava i simulacija nisu autentikacija CEZIH djelatnika.
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
npm run validate:cezih-oauth
npm run validate:cezih-user-session
npm run validate:cezih-signing
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
provjeru, live konfiguracijsku, OAuth2, korisničku sesijsku i provjeru potpisa s istom zabranom mreže (ukupno 22).
Proxy događaji i odgovori token servisa simuliraju se u memoriji; ne pokreće se
live Vite niti kontaktira CEZIH. Provjeravaju se oba načina slanja vjerodajnica,
istek, istodobni zahtjevi, greške, odvajanje aplikacijskih i kliničkih ruta te
status bez tajni. Korisnička provjera dodatno testira sve simulacijske ishode,
cookie/CSRF zaštitu, jednokratni povrat, istek, odjavu tijekom rotacije, odvajanje
korisnika, provjeru uloga i zabranu korištenja simulacije ili lažnog zaglavlja za live pozive.

Za postojeće validatore isti preload može se koristiti pri pokretanju:

```bash
node --import ./scripts/offline-only.mjs --import tsx scripts/validate-document-submit.ts
```

Validator čitanja dokumenata sada povezuje bundle i DocumentReference po
identifikatoru dokumenta. Time podržava i postojeće zamijenjene dokumente koji
nemaju identifikator izveden iz `Bundle.id`, bez promjene mock podataka.

## Lokalno testno potpisivanje FHIR Bundlea

U razvojnim načinima `mock` i `cert-offline` panel **CEZIH endpointi → Testno
potpisivanje FHIR poruka i dokumenata** demonstrira stvarnu kriptografsku izradu
i provjeru potpisa. Panel nema mrežne pozive, ne traži karticu, PIN, OAuth2 ni
CEZIH sesiju te koristi isključivo sintetički Bundle. Ne mijenja postojeće
kliničke zahtjeve i ne šalje testne potpise na gateway. U `cert-live` načinu
panel je skriven, a produkcijski build ne uključuje testni UI ni ključeve.

Postupak demonstracije:

1. Pokrenuti `npm run dev:with-bridge` i prijaviti se mock karticom Ana/Luka.
2. U navedenom panelu odabrati **FHIR poruka** ili **FHIR dokument** i algoritam.
3. Odabrati **Izradi i potpiši testni Bundle**, zatim **Provjeri potpis** — prolazi.
4. Odabrati **Izmijeni potpisani sadržaj**, zatim provjeru — ne prolazi.
5. Vratiti izvorni Bundle, promijeniti redoslijed JSON ključeva i provjeriti — prolazi.
6. U detaljima se vidi konačni JSON s `signature.data` i otisak testnog certifikata.

`src/fhir/bundleSignature.ts` implementira JCS po RFC 8785, pripremu potpisnog
sadržaja, detached compact JWS i vanjski obični Base64 za `signature.data`.
Izuzeće obuhvaća isključivo korijenski `Bundle.signature.data`; ostali podatci,
uključujući `Binary.data`, ostaju potpisani. Metadata potpisa postavlja se prije
kanonikalizacije. Izvorni objekt se ne mijenja. Provjeravaju se potpisnik poruke,
lokalna Practitioner referenca dokumenta i autor/ovjeritelj prema kodovima iz
priloženih osnovnih profila. To nije puna validacija svih FHIR/CEZIH profila.

Web Crypto podržava RS256/RS384/RS512 i ES256/ES384/ES512; ES512 koristi P-521,
a ECDSA potpisi JWS zapis `r || s`. Potpisni modul prima funkciju `sign` kako bi
se kasnije mogla povezati kartica bez promjene kanonikalizacije. `RS1` se sada
izričito odbija; Web Crypto ga ne podržava i nema tihog prelaska na drugi algoritam.

`src/data/signing/cezih-signing-test-keys.json` sadrži **javne razvojne privatne
ključeve**, pripadajuće javne JWK-ove i samopotpisane X.509 certifikate. To nisu
tajne ni CEZIH certifikati i ne smiju se koristiti za zdravstvene podatke ili
autentikaciju. PKCS#8 ključ u pregledniku uvozi se kao neizvoziv CryptoKey;
izvorni razvojni ključ ipak je javna fixture datoteka. Ništa se ne sprema u
localStorage, na disk ili u logove prilikom demonstracije.

Provjera zahtijeva unaprijed poznat testni ključ/certifikat. Ne vjeruje automatski
ključu ugrađenom u zaprimljeni JWS. Provjerava točan lokalni ugovor za zaštićeno
JOSE zaglavlje (`alg`, `jwk`, `x5c`), uključujući njegov kanonikalizirani zapis;
ovo nije univerzalni verifier za sve zapise vanjskih JWS zaglavlja. Testovi
neovisno potvrđuju podudaranje JWK-a, privatnog ključa i certifikata te provjeravaju
potpise koristeći Node crypto i javni ključ iz X.509 certifikata. Uspjeh u UI-u
znači kriptografsku ispravnost prema poznatoj testnoj fixture, bez CEZIH povjerenja
u certifikat, provjere opoziva ili potvrde identiteta stvarnog djelatnika.

Prije produkcijske integracije preostaju: stvarno PKCS#11 potpisivanje i lokalni
PIN dijalog, povezivanje identifikatora certifikata s djelatnikom, provjera
certifikacijskog lanca/valjanosti/opoziva prema potvrđenim pravilima i zaštita
lokalnog potpisnog poziva. Poslovni transport i serverska kontrola pravog potpisa
još nisu povezani. Dokumentni ITI-65 ugovor i SSO povrat imaju svoja postojeća
ograničenja.

Za potvrdu CEZIH interoperabilnosti potrebni su službeni testni vektori zbog
nesklada u dobivenim primjerima: izostavljen `signature.data` nasuprot praznom
stringu, `x5c` na vrhu zaglavlja nasuprot unutar `jwk` i padding u JWS segmentima.
Ova implementacija uklanja `signature.data`, koristi vršni `x5c` i Base64URL
bez paddinga unutar JWS-a. Nikakvi CEZIH, OCSP, CRL ni drugi vanjski pozivi nisu
dio ovih testova.
