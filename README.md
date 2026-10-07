# MioIBAN

**I tuoi IBAN, chiari e pronti da copiare. Non escono mai dal tuo dispositivo.**

Archivio locale di IBAN con una funzione centrale: mostrare un IBAN in modo che
chiunque — anche anziano, sotto pressione, allo sportello di una banca — riesca a
ricopiarlo a mano **senza sbagliare un carattere**.

Nessun server, nessun account, nessuna sincronizzazione: tutto vive nel browser.

---

## Cosa fa

- **Modalità Sportello**: IBAN a tutto schermo, blocchi da 4, zeri evidenziati, conteggio e lettura vocale.
- **Salvataggio e ricerca**: conti con nome breve, preferiti, gruppi e ricerca istantanea, con controllo dei duplicati.
- **Controllo errori**: validazione del formato e, per gli IBAN italiani, anche del carattere di controllo nazionale (CIN); incolla intelligente da messaggi (WhatsApp, email…).
- **Copia in un tocco**, condivisione e **stampa** (il PDF con "Salva come PDF" del browser).
- **Backup** con esportazione/importazione in JSON; funziona **offline** dopo il primo caricamento.
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
