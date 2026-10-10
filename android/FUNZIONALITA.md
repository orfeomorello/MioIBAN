# MioIBAN — Inventario funzionalità per la versione Android

Questo documento è l'analisi della PWA attuale (`C:\iban`) come base per la versione
nativa Android (cartella `android/`, Kotlin + Jetpack Compose). Riferimento vincolante:
`MioIBAN-SPEC.md`. La sezione 7 elenca le divergenze deliberate dell'app Android
rispetto alla PWA.

## 1. Cosa fa l'app oggi

Archivio **locale** di IBAN. Nessun server, nessun account, nessuna sincronizzazione.
Obiettivo primario: far copiare a mano un IBAN **senza errori** (anche a persone anziane allo sportello).

## 2. Funzionalità (con file di origine)

| # | Funzione | Descrizione | File di origine |
|---|---|---|---|
| F-01 | CRUD conti | Creare, leggere, modificare, eliminare un conto | `src/app.js`, `src/core/model.js`, `src/core/storage.js` |
| F-02 | Inserimento + validazione | Formattazione IBAN a blocchi di 4 mentre si digita (con cursore preservato), messaggi d'errore umani, validazione BIC opzionale | `src/ui/form.js`, `src/core/iban.js`, `src/core/errors.js` |
| F-03 | Incolla intelligente | Incolla un messaggio (WhatsApp, email, PDF, max 20.000 caratteri): estrae i candidati IBAN e li valida; un candidato compila il campo, più candidati richiedono scelta | `src/ui/form.js`, `src/core/iban.js` (`extractCandidates`) |
| F-04 | Lettura QR | **Fuori perimetro v1.0** (D-13) | — |
| F-05 | Ricerca, filtri, preferiti, duplicati | Ricerca su alias/titolare/banca/note/IBAN (senza accenti), filtro preferiti, controllo duplicati su IBAN | `src/ui/list.js`, `src/core/model.js` |
| F-06 | Modalità Sportello (IBANAnalyzer) | IBAN a tutto schermo, blocchi da 4, zeri evidenziati (zeri consecutivi più marcati), O/I ambigue marcate, conteggio 1-2-3-4, lettura vocale, inversione colori | `src/ui/analyzer.js`, `src/core/iban.js` (`splitForAnalyzer`, `speechChunks`) |
| F-07 | Copia | Copia IBAN in formato compatto o spaziato; aggiorna `lastUsedAt` | `src/ui/detail.js`, `src/ui/actions.js`, `src/app.js` |
| F-08 | Stampa | Foglio A4 bianco e nero per singolo conto; "Salva come PDF" del sistema | `src/ui/print.js`, `src/styles/print.css` |
| F-09 | Condivisione | Condivide testo con alias + IBAN formattato (Web Share API) | `src/app.js` (`onShareAccount`), `src/ui/actions.js` |
| F-10 | Gruppi | **Solo PWA**: creare/eliminare gruppi; eliminare un gruppo NON elimina i conti (li rende "senza gruppo"). Rimossi nell'app Android (vedi §7) | `src/ui/settings.js`, `src/app.js` |
| F-11 | Preferiti | Stella su scheda/riga; sono solo un filtro: il chip «Preferiti» mostra quelli, ma l'ordine dell'elenco non cambia | `src/ui/list.js`, `src/core/model.js` |
| F-12 | Vista schede / righe | Due modalità di elenco, ricordata fra le sessioni | `src/ui/list.js`, `src/core/prefs.js` |
| F-13 | Backup export/import | Export JSON completo (`schemaVersion: 2`); import con controllo versione, riepilogo e **conferma esplicita**; sostituzione atomica | `src/core/backup.js`, `src/core/storage.js` |
| F-14 | Reimposta app | Cancella conti, gruppi (solo PWA), preferenze, cache; torna all'onboarding | `src/ui/settings.js` |
| F-15 | Onboarding | Primo avvio: scelta lingua, tema, dimensione testo, disclaimer | `src/ui/onboarding.js` |
| F-16 | Impostazioni | Tema (chiaro/scuro/auto), testo (normale/grande/molto grande), lingua, backup, reset, info, disclaimer | `src/ui/settings.js`, `src/ui/theme.js` |
| F-17 | Multilingua | Italiano (riferimento) e inglese; priorità: `?lang=` → scelta salvata → lingua del sistema → it | `src/i18n/index.js`, `src/i18n/it.js`, `src/i18n/en.js` |
| F-18 | Validazione CIN italiano | Calcolo del carattere di controllo nazionale per IT/SM (`CIN_MISMATCH`) | `src/core/iban.js` (`computeCin`, `checkCin`) |

## 3. Regole da rispettare anche nel porting (Hard Rules, SPEC §3)

1. **Zero server**: nessuna chiamata di rete verso terzi (l'app Android non deve aggiungere SDK di rete).
2. **Storage solo locale**: i record vanno in un database locale (es. SQLite/Drift o Hive); le preferenze in `SharedPreferences` / `shared_preferences`.
3. **Export completo** con `schemaVersion` → lo stesso JSON della PWA deve poter essere importato dalla versione Android e viceversa.
4. **Import con conferma**, mai sovrascrittura silenziosa.
5. **Zero analytics / tracking / telemetria**.
6. **Dipendenze minime e con licenza MIT** (il progetto originale esclude Apache-2.0, ISC, BSD, GPL per le dipendenze runtime: l'app Android usa solo AndroidX, Room e Navigation).
7. Nessuna funzione di pagamento, scadenza o notifica (D-02, D-03, regola 8).

## 4. Punti critici e scelte adottate

- **Logica IBAN**: nella PWA è delegata alla libreria `ibantools` (MIT OR MPL-2.0). In Android è un port Kotlin puro (`core/Iban.kt`: tabella dei paesi, modulo 97) con test contro gli stessi vettori (`test/cin-vectors.js`, `test/iban-extract.test.js`).
- **CIN italiano** (`computeCin`): algoritmo portato identico; vettore di riferimento `IT60X0542811101000000123456` → CIN `X`.
- **Normalizzazione**: rimuovere NBSP (U+00A0), U+202F, U+200B, U+FEFF, U+2060 prima della validazione (limite L5).
- **Sintesi vocale**: Android `TextToSpeech`; leggere lo zero come "zero", impostare la lingua, gestire il caso di voce non installata.
- **Stampa**: generazione PDF con `android.graphics.pdf.PdfDocument` (una dipendenza in meno), layout bianco e nero, IBAN come elemento più grande; condivisione via `FileProvider`.
- **Condivisione**: `Intent.ACTION_SEND` del sistema.
- **Copia**: `ClipboardManager` del sistema.
- **Tema e dimensione testo**: Material 3 chiaro/scuro/auto e scala interna a tre livelli.
- **Modalità Sportello**: schermata a tutto schermo, blocchi da 4, font monospace, conteggio sotto i blocchi, bottone "inverti colori".

## 5. Mappatura realizzata (Android / Kotlin)

| Area PWA | Equivalente Android |
|---|---|
| `src/core/iban.js` | `app/src/main/java/it/mioiban/app/core/Iban.kt` (+ test) |
| `src/core/model.js` | `data/Entities.kt`, `data/Repository.kt` (`AccountFilter`) |
| `src/core/storage.js` | `data/AppDatabase.kt`, `data/Daos.kt` (Room) |
| `src/core/backup.js` | `core/Backup.kt` (stesso JSON `schemaVersion: 2`) |
| `src/core/prefs.js` | `data/Prefs.kt` (SharedPreferences) |
| `src/i18n/*` | `res/values/strings.xml` (IT), `res/values-en/strings.xml` (EN) |
| `src/ui/analyzer.js` | `ui/screens/SportelloScreen.kt` |
| `src/ui/list.js` | `ui/screens/AccountListScreen.kt` |
| `src/ui/form.js` | `ui/screens/AccountFormScreen.kt` |
| `src/ui/detail.js` | `ui/screens/AccountDetailScreen.kt` |
| `src/ui/settings.js` | `ui/screens/SettingsScreen.kt` |
| `src/ui/onboarding.js` | `ui/screens/OnboardingScreen.kt` |
| `src/ui/print.js` | `ui/print/PrintService.kt` |

## 6. Domande aperte per la fase successiva

1. Il database locale: SQLite (`drift`/`sqflite`) oppure Hive? (Attenzione alle licenze.) — **risolto**: Room (SQLite).
2. Lettura QR: resta fuori dalla v1.0 come nella PWA?
3. Nome pacchetto Android (es. `it.mioiban.app`) e minimo SDK? — **risolto**: `it.mioiban.app`, minSdk 26.
4. Validazione IBAN: preferite un package pub.dev già esistente (da verificarne la licenza) oppure il port Dart della logica? — **risolto**: port Kotlin puro (`core/Iban.kt`), con test.

## 7. Divergenze Android rispetto alla PWA

L'app Android non è una copia speciale: alcune scelte sono deliberate.

| # | Divergenza | Dettaglio |
|---|---|---|
| D-A1 | **Gruppi rimossi** (F-10, F-05, F-16) | Non erano utilizzabili dalla lista conti (nessun filtro visibile). Rimossi da entità, DB, impostazioni e backup: i backup vecchi importano senza errori, i campi `groupId`/`groups` vengono ignorati. |
| D-A2 | **Stampa e PDF separati** (F-08) | Due bottoni distinti: "Stampa" e "PDF". Entrambi chiedono prima una causale. |
| D-A3 | **Causale** | Nuovo campo del conto (max 200 caratteri, anche nel form). Nel dialog di stampa/PDF si può scrivere a mano o spuntare "Usa le note come causale". Nel foglio A4: se la causale è presente viene stampata, altrimenti resta la riga vuota per scriverla a mano. |
| D-A4 | **Riordinamento manuale** | Tocco singolo apre il conto, tocco lungo + trascina ordina le schede. Posizione alternativa nel dettaglio («Sposta su/giù»), usabile anche con la lettura dello schermo. L'ordine è persistito (`sortOrder`) e comanda su tutto, preferiti compresi: il chip «Preferiti» è l'unico modo di vederli da soli. L'export del backup conserva l'ordine. |
| D-A5 | **Selezione lingua anche in impostazioni** | In aggiunta all'onboarding: Sistema / Italiano / English, con riavvio dell'attività come per tema e testo. |
| D-A6 | **Vista schede/righe (F-12)** | La preferenza `vista` esiste nel backup ma la lista è sempre a schede. |
| D-A7 | **Database locale versionato** | Room `mioiban.db`, schema v4 (v2: `causale` + `sortOrder`; v3: rimozione `groupId`; v4: schema attuale). Al cambio schema `LegacyImport` recupera i conti dal file vecchio prima che Room lo sostituisca, così un aggiornamento non cancella i dati. |
