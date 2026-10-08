# MioIBAN — Inventario funzionalità per il porting Android (Flutter)

Questo documento è l'analisi della PWA attuale (`C:\iban`) come base per la versione
nativa Android in Flutter (cartella `android/`). Riferimento vincolante: `MioIBAN-SPEC.md`.

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
| F-05 | Ricerca, filtri, preferiti, duplicati | Ricerca su alias/titolare/banca/note/IBAN (senza accenti), filtro preferiti, filtro per gruppo, controllo duplicati su IBAN | `src/ui/list.js`, `src/core/model.js` |
| F-06 | Modalità Sportello (IBANAnalyzer) | IBAN a tutto schermo, blocchi da 4, zeri evidenziati (zeri consecutivi più marcati), O/I ambigue marcate, conteggio 1-2-3-4, lettura vocale, inversione colori | `src/ui/analyzer.js`, `src/core/iban.js` (`splitForAnalyzer`, `speechChunks`) |
| F-07 | Copia | Copia IBAN in formato compatto o spaziato; aggiorna `lastUsedAt` | `src/ui/detail.js`, `src/ui/actions.js`, `src/app.js` |
| F-08 | Stampa | Foglio A4 bianco e nero per singolo conto o per tutti i conti visibili; "Salva come PDF" del sistema | `src/ui/print.js`, `src/styles/print.css` |
| F-09 | Condivisione | Condivide testo con alias + IBAN formattato (Web Share API) | `src/app.js` (`onShareAccount`), `src/ui/actions.js` |
| F-10 | Gruppi | Creare/eliminare gruppi; eliminare un gruppo NON elimina i conti (li rende "senza gruppo") | `src/ui/settings.js`, `src/app.js` |
| F-11 | Preferiti | Stella su scheda/riga; i preferiti salgono in cima all'elenco | `src/ui/list.js`, `src/core/model.js` |
| F-12 | Vista schede / righe | Due modalità di elenco, ricordata fra le sessioni | `src/ui/list.js`, `src/core/prefs.js` |
| F-13 | Backup export/import | Export JSON completo (`schemaVersion: 2`); import con controllo versione, riepilogo e **conferma esplicita**; sostituzione atomica | `src/core/backup.js`, `src/core/storage.js` |
| F-14 | Reimposta app | Cancella conti, gruppi, preferenze, cache; torna all'onboarding | `src/ui/settings.js` |
| F-15 | Onboarding | Primo avvio: scelta lingua, tema, dimensione testo, disclaimer | `src/ui/onboarding.js` |
| F-16 | Impostazioni | Tema (chiaro/scuro/auto), testo (normale/grande/molto grande), lingua, gruppi, backup, reset, info, disclaimer | `src/ui/settings.js`, `src/ui/theme.js` |
| F-17 | Multilingua | Italiano (riferimento) e inglese; priorità: `?lang=` → scelta salvata → lingua del sistema → it | `src/i18n/index.js`, `src/i18n/it.js`, `src/i18n/en.js` |
| F-18 | Validazione CIN italiano | Calcolo del carattere di controllo nazionale per IT/SM (`CIN_MISMATCH`) | `src/core/iban.js` (`computeCin`, `checkCin`) |

## 3. Regole da rispettare anche nel porting (Hard Rules, SPEC §3)

1. **Zero server**: nessuna chiamata di rete verso terzi (l'app Android non deve aggiungere SDK di rete).
2. **Storage solo locale**: i record vanno in un database locale (es. SQLite/Drift o Hive); le preferenze in `SharedPreferences` / `shared_preferences`.
3. **Export completo** con `schemaVersion` → lo stesso JSON della PWA deve poter essere importato dalla versione Android e viceversa.
4. **Import con conferma**, mai sovrascrittura silenziosa.
5. **Zero analytics / tracking / telemetria**.
6. **Dipendenze minime e con licenza MIT** (il progetto originale esclude Apache-2.0, ISC, BSD, GPL per le dipendenze runtime: da verificare per i pacchetti pub.dev scelti).
7. Nessuna funzione di pagamento, scadenza o notifica (D-02, D-03, regola 8).

## 4. Punti critici per il porting

- **Logica IBAN**: nella PWA è delegata alla libreria `ibantools` (MIT OR MPL-2.0). In Flutter serve un equivalente su pub.dev **oppure** un port in Dart della tabella dei paesi (lunghezza, formato BBAN) e del modulo 97. La regola SPEC §4.4 vieta di riscrivere questa logica a caso: il porting va fatto con test contro gli stessi vettori (`test/cin-vectors.js`, `test/iban-extract.test.js`).
- **CIN italiano** (`computeCin`): algoritmo da portare identico; vettore di riferimento `IT60X0542811101000000123456` → CIN `X`.
- **Normalizzazione**: rimuovere NBSP (U+00A0), U+202F, U+200B, U+FEFF, U+2060 prima della validazione (limite L5).
- **Sintesi vocale**: in Flutter usare `flutter_tts`; leggere lo zero come "zero" e settare la lingua; gestire il caso di voce non installata.
- **Stampa**: su Android il foglio A4 si traduce in generazione PDF (`pdf` + `printing`), mantenendo il layout bianco e nero e l'IBAN come elemento più grande.
- **Condivisione**: `share_plus`.
- **Copia**: `Clipboard` di Flutter.
- **Tema e dimensione testo**: `ThemeData` chiaro/scuro e `textScaleFactor` (o scala interna a tre livelli).
- **Modalità Sportello**: schermata a tutto schermo, blocchi da 4, font monospace, conteggio sotto i blocchi, bottone "inverti colori".

## 5. Mappatura proposta (Flutter)

| Area PWA | Equivalente Flutter proposto |
|---|---|
| `src/core/iban.js` | `lib/core/iban.dart` (+ test) |
| `src/core/model.js` | `lib/core/account.dart`, `lib/core/search.dart` |
| `src/core/storage.js` | `lib/data/database.dart` (SQLite) |
| `src/core/backup.dart` | `lib/data/backup.dart` (stesso JSON `schemaVersion: 2`) |
| `src/core/prefs.js` | `shared_preferences` |
| `src/i18n/*` | `lib/i18n/` con `intl` / ARB (IT, EN) |
| `src/ui/analyzer.js` | `lib/screens/sportello_screen.dart` |
| `src/ui/list.js` | `lib/screens/list_screen.dart` |
| `src/ui/form.js` | `lib/screens/form_screen.dart` |
| `src/ui/detail.js` | `lib/screens/detail_screen.dart` |
| `src/ui/settings.js` | `lib/screens/settings_screen.dart` |
| `src/ui/onboarding.js` | `lib/screens/onboarding_screen.dart` |
| `src/ui/print.js` | `lib/services/print_service.dart` |

## 6. Domande aperte per la fase successiva

1. Il database locale: SQLite (`drift`/`sqflite`) oppure Hive? (Attenzione alle licenze.)
2. Lettura QR: resta fuori dalla v1.0 come nella PWA?
3. Nome pacchetto Android (es. `it.mioiban.app`) e minimo SDK.
4. Validazione IBAN: preferite un package pub.dev già esistente (da verificarne la licenza) oppure il port Dart della logica?
