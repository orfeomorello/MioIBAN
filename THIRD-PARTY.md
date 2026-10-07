# Dipendenze di terze parti

MioIBAN usa **una sola dipendenza runtime**. Tutto il resto è codice del progetto,
rilasciato sotto licenza MIT (vedi [`LICENSE`](LICENSE)).

Vincolo di progetto: **sono ammesse solo dipendenze con licenza MIT**, oppure con
doppia licenza che includa MIT. Apache-2.0, ISC, BSD e GPL sono escluse.
Vedi `MioIBAN-SPEC.md` §5.7 e §5.7.1.

---

## Dipendenze runtime

### ibantools 4.5.4

| Campo | Valore |
|---|---|
| **Ruolo** | Validazione, normalizzazione, scomposizione e formattazione degli IBAN (e validazione BIC/SWIFT) |
| **Autore** | Saša Jovanić |
| **Sorgente** | https://github.com/Simplify/ibantools |
| **Pacchetto npm** | `ibantools` |
| **Licenza (SPDX)** | `MIT OR MPL-2.0` — **questo progetto sceglie la licenza MIT** |
| **File copato** | `vendor/ibantools.js` |
| **Testo della licenza scelta** | `vendor/LICENSE-ibantools-MIT.txt` |
| **Verifica** | `node tools/vendor.mjs --check` (confronto SHA-256 con `vendor/VENDOR-LOCK.json`) |

**Nota sulla doppia licenza.** Il pacchetto è rilasciato sotto doppia licenza
`MIT OR MPL-2.0`: chi lo usa può scegliere una delle due. MioIBAN sceglie **MIT**,
i cui termini sono riportati integralmente in `vendor/LICENSE-ibantools-MIT.txt`
e che richiede soltanto di conservare l'avviso di copyright e il testo della
licenza — cosa che questo file e il file copato fanno.

**Nota su GitHub.** GitHub classifica `Simplify/ibantools` come
`Other`/`NOASSERTION` invece di riconoscere la licenza. Il motivo è che il file
`LICENSE` del repository contiene soltanto la stringa `MIT OR MPL-2.0` invece del
testo integrale: è un limite del rilevatore automatico di GitHub, **non** una
licenza ambigua. Nel pacchetto npm esistono due file di licenza distinti e
completi, `LICENSE.MIT` e `LICENSE.MPL-2.0`, e il campo SPDX dichiarato nel
`package.json` è `MIT OR MPL-2.0`. Questa nota esiste perché un revisore che
vedesse solo la pagina GitHub potrebbe trarre una conclusione sbagliata.

**Perché è vendorizzata e non installata da npm.** L'app non ha build step e
promette di funzionare offline servendo solo il proprio dominio
(`MioIBAN-SPEC.md` §3 regola 5, §5.3): una dipendenza caricata da una CDN
richiederebbe di allargare la CSP `default-src 'self'`. Il copatamento è fatto da
`tools/vendor.mjs`, che scarica da URL **pinnati** e registra le impronte SHA-256.

---

## Dipendenze di sviluppo

Nessuna al momento. Gli unici strumenti sono `tools/vendor.mjs`, che usa solo
moduli nativi di Node (`node:crypto`, `node:fs/promises`, `node:path`,
`node:url`), e `test/index.html`, che gira nel browser senza alcun runner.

---

## Dipendenze valutate ed escluse

Sono documentate in `MioIBAN-SPEC.md` §5.7.1, con la licenza e il motivo
dell'esclusione. Le più rilevanti:

| Pacchetto | Licenza | Motivo |
|---|---|---|
| `dexie` | Apache-2.0 | Sostituito da un wrapper IndexedDB proprio |
| `idb` | ISC | Sarebbe la scelta migliore se la regola ammettesse ISC |
| `jspdf` | MIT | Rimossa: il browser produce già il PDF (129,8 KB gzip risparmiati) |
| `tesseract.js` | Apache-2.0 | Non conforme, fuori perimetro, e con script `postinstall` |
| `intl-messageformat` | BSD-3-Clause | Non conforme (i18n fatta in casa) |
| `@fluent/bundle`, `messageformat` | Apache-2.0 | Non conformi |
| `node-polyglot`, `polyglot.js` | BSD-2-Clause | Non conformi |
| `iban-qr-code` | GPL-3.0-or-later | Incompatibile con MIT |

---

## Come aggiornare una dipendenza

1. Modificare la versione **pinnata** in `tools/vendor.mjs`.
2. Eseguire `node tools/vendor.mjs` (le impronte cambiano: è atteso).
3. Aggiornare la tabella in `MioIBAN-SPEC.md` §5.7 e questo file.
4. Verificare che la licenza non sia cambiata: **se non è più MIT, la dipendenza
   non può entrare.**
