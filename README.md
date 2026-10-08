# MioIBAN

**I tuoi IBAN, chiari e pronti da copiare. Non escono mai dal tuo dispositivo.**

Archivio locale di IBAN con una funzione centrale: mostrare un IBAN in modo che
chiunque — anche anziano, sotto pressione, allo sportello di una banca — riesca a
ricopiarlo a mano **senza sbagliare un carattere**.

Nessun server, nessun account, nessuna sincronizzazione: tutto vive nel browser.

---

## Cosa fa

- **Modalità Sportello**: blocchi da 4, zeri evidenziati, gruppo in lettura illuminato e lettura vocale lenta con pausa fra i gruppi.
- **Salvataggio e ricerca**: conti con nome breve, preferiti, gruppi e ricerca istantanea, con controllo dei duplicati.
- **Controllo errori**: validazione del formato e, per gli IBAN italiani, anche del carattere di controllo nazionale (CIN); incolla intelligente da messaggi (WhatsApp, email…).
- **Copia in un tocco**, condivisione e **stampa** (il PDF con "Salva come PDF" del browser).
- **Backup** con esportazione/importazione in JSON e reimpostazione totale; funziona **offline** dopo il primo caricamento.
- **Italiano e inglese**, tema chiaro/scuro, testo ingrandibile. PWA installabile, nessun passaggio di build.

---

## Privacy

- I dati restano **solo su questo dispositivo**: niente server, niente account, niente statistiche o tracciamenti.
- L'archivio **non è cifrato**: chi usa il dispositivo può vedere gli IBAN salvati.
- In **navigazione anonima** i dati valgono solo per la sessione: esporta un backup prima di chiudere.
- Il **backup è responsabilità tua**: senza file di backup, i dati persi non sono recuperabili.
- L'app verifica la **correttezza formale** di un IBAN, non che il conto esista davvero: prima di un pagamento, verifica sempre con la tua banca.

---

## Provala in locale

```bash
npx serve .
```

Poi apri <http://localhost:3000/> (l'app) e <http://localhost:3000/test/>
(i test nel browser).

Serve HTTP perché i moduli ES non funzionano aprendo il file (`file://`).
La libreria è già inclusa in `vendor/`: non serve installare nulla.

---

## App Android

Accanto alla PWA c'è una app Android nativa, in `android/`, scritta in Kotlin
con Jetpack Compose e Material 3. Ha le stesse funzioni e lo stesso formato di
backup (`schemaVersion: 2`), quindi un file esportato da una può essere
importato nell'altra.

Non ha permessi di rete e non contiene analytics: come la PWA, tutto resta sul dispositivo.

### Requisiti per compilarla

- **JDK 21** (il progetto usa un toolchain Java 21).
- **Android SDK** con la piattaforma **android-36** (`compileSdk 36`).
- Connessione internet alla prima compilazione, per scaricare Gradle e le dipendenze.

Il wrapper di Gradle (`gradlew` / `gradlew.bat`) è incluso: non serve installare Gradle.

### Configurare l'SDK

Crea il file `android/local.properties` con il percorso del tuo SDK:

```properties
sdk.dir=C\:\\Users\\tuonome\\AppData\\Local\\Android\\Sdk
```

Su macOS o Linux: `sdk.dir=/home/tuonome/Android/Sdk`. Il file non va versionato:
è già escluso dal `.gitignore` di `android/`.

### Compilare e provare

Dalla cartella `android/`:

```bash
./gradlew :app:testDebugUnitTest    # test unitari (macOS/Linux)
./gradlew :app:assembleDebug        # APK di debug
./gradlew :app:assembleRelease      # APK di release
```

Su Windows usa `gradlew.bat` al posto di `./gradlew`.

L'APK di debug si trova in `android/app/build/outputs/apk/debug/app-debug.apk`.
Copialo sul telefono e aprilo dal gestore file, consentendo l'installazione da
questa origine.

### Firma della release

La build `release` è firmata con la **chiave di debug**: si installa, ma **non è
adatta alla pubblicazione** su uno store. Per distribuire una versione vera serve
una chiave di firma propria, da conservare con cura: va configurata in
`app/build.gradle.kts`, nel blocco `signingConfigs`, e non va committata.

### Versione

La versione è in `android/app/build.gradle.kts`:

- `versionCode` è un intero che deve **crescere a ogni installazione**, altrimenti
  Android non aggiorna l'app sopra la precedente.
- `versionName` è il testo mostrato all'utente (es. `1.0.1`).

### Struttura

```
android/
  app/src/main/java/it/mioiban/app/
    core/        Validazione IBAN, CIN, estrazione dal testo, backup (puro Kotlin)
    data/        Room (SQLite), preferenze, repository
    ui/          Schermate Compose, navigazione, tema Material 3
    ui/print/    Stampa e PDF
  app/src/test/  Test unitari (IbanTest, BackupTest)
```

Il file `core/IbanRegistry.kt` è **generato**: non modificarlo a mano. Si rigenera
con `tools/gen-android-registry.mjs` (nella radice del progetto) quando cambia la
libreria IBAN.

Il file `FUNZIONALITA.md` mette in corrispondenza ogni funzione dell'app Android
con il file corrispondente della PWA.

## Test

- `npm test` — test automatici in Node, nessuna dipendenza da installare.
- La pagina `test/` nel browser — normalizzazione, validazione, vettori del CIN
  italiano, incolla intelligente, IBANAnalyzer e completezza dei dizionari.

---

## Note tecniche

- Unica dipendenza runtime: [`ibantools`](https://github.com/Simplify/ibantools)
  (MIT, 4.5.4), vendorizzata in `vendor/`.
  Zero framework, zero build step: HTML, CSS e moduli ES serviti così come sono.
- La libreria non controlla il CIN italiano: lo calcola l'app, coperto da
  6 vettori di test reali — e i messaggi descrivono solo ciò che è stato
  controllato, mai più di quello.
- Storage: `IndexedDB` per i conti, `localStorage` per le preferenze.
- L'integrità della libreria vendorizzata si verifica con
  `node tools/vendor.mjs --check` (impronte SHA-256 in `vendor/VENDOR-LOCK.json`).

---

## Struttura del progetto

```
package.json          Tipo ES module e comandi di test Node nativi
android/              App Android nativa (Kotlin + Compose), vedi sezione dedicata
LICENSE                MIT
THIRD-PARTY.md         Dipendenze e licenze
README.md              Questo file
manifest.json          Web App Manifest
index.html             App-shell: intestazione, contenitore viste, area di stampa
sw.js                  Service Worker: solo precaching

src/
  app.js               Controller: avvio, navigazione, operazioni sui conti
  core/
    iban.js            UNICO file che conosce la libreria IBAN + calcolo del CIN
    errors.js          Tassonomia interna degli esiti di validazione
    model.js           Record, limiti dei campi, ricerca/filtri/ordinamento
    storage.js         Wrapper IndexedDB (nessuna libreria)
    backup.js          Export/import del backup (JSON, locale)
    prefs.js           Preferenze in localStorage
  i18n/
    index.js           Runtime multilingua: t(), plurali, Intl, ?lang=
    it.js              Dizionario italiano (lingua di riferimento)
    en.js              Dizionario inglese
  ui/
    dom.js             Costruttore di DOM che vieta innerHTML
    analyzer.js        IBANAnalyzer + Modalità Sportello + sintesi vocale
    list.js             Elenco, ricerca, filtri, preferiti
    detail.js           Dettaglio conto e azioni rapide
    form.js             Inserimento/modifica, formattazione IBAN e incolla intelligente
    settings.js         Impostazioni, lingua, backup
    onboarding.js      Primo avvio: lingua, tema, testo, disclaimer
    print.js           Foglio di stampa A4 (solo bianco e nero)
    sheet.js           Finestre modali di conferma
    actions.js         Copia, condivisione, toast
    theme.js           Applicazione di tema e grandezza testo
  styles/
    main.css           Design system, temi, accessibilità
    print.css          Foglio di stampa A4, solo bianco e nero

vendor/                Dipendenze copiate (generate da tools/vendor.mjs)
tools/
  vendor.mjs           Copiatura riproducibile con verifica SHA-256
  gen-android-registry.mjs  Genera il registro IBAN dell'app Android
test/
  index.html           Test d'integrazione eseguibili nel browser
  cin-vectors.js       Vettori di test del CIN italiano
  iban-extract.test.js Test automatici Node dell'estrazione e del flusso d'incolla
```

---

## Licenza

[MIT](LICENSE). Dipendenze: vedi [`THIRD-PARTY.md`](THIRD-PARTY.md).

`MioIBAN` è fornito "così com'è", senza garanzie. Non invia pagamenti, non
gestisce scadenze e non sincronizza dati. Il backup è responsabilità esclusiva
dell'utente.
