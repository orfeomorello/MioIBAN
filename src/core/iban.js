/**
 * MioIBAN — Adattatore IBAN
 *
 * ============================================================================
 * QUESTO E' L'UNICO FILE CHE CONOSCE LA LIBRERIA IBAN.
 * ============================================================================
 * MioIBAN-SPEC.md §4: la logica IBAN non si scrive da zero, si delega.
 * Nessun altro file del progetto puo' importare `ibantools` ne' contenere
 * mod-97, tabelle di lunghezze per paese o regex di validazione IBAN (§4.4).
 *
 * La libreria e' vendorizzata in vendor/ibantools.js (vedi tools/vendor.mjs).
 *
 * --- PERCHE' NON SI USA `electronicFormatIBAN` PER NORMALIZZARE ---
 * `electronicFormatIBAN` rimuove SOLO spazi e trattini (limite L5). Gli IBAN
 * copiati da PDF, siti web e WhatsApp contengono spesso NBSP (U+00A0),
 * narrow NBSP (U+202F) o zero-width space (U+200B): con quelli la libreria
 * rifiuterebbe un IBAN visivamente perfetto e l'utente non capirebbe perche'.
 * `normalizeIban()` qui sotto risolve il problema PRIMA di chiamare la libreria.
 *
 * --- ATTENZIONE SULL'INPUT DELLA LIBRERIA ---
 * `validateIBAN` / `isValidIBAN` si aspettano il formato ELETTRONICO (senza
 * separatori): non normalizzano da sole. `extractIBAN` invece normalizza al
 * suo interno, ma sempre e solo per spazi e trattini.
 *
 * --- CONTROLLO DEL CIN ITALIANO ---
 * `ibantools` NON verifica il carattere di controllo nazionale italiano (CIN):
 * per IT controlla solo lunghezza, formato e mod-97 internazionale (limite L2).
 * Nessuna libreria con licenza MIT lo fa (`ibankit` lo fa ma e' ISC/Apache-2.0,
 * quindi escluso dal vincolo "solo MIT"). Il CIN e' pero' il controllo piu'
 * prezioso per il pubblico di MioIBAN: intercetta esattamente l'errore di
 * trascrizione di una cifra. Lo calcoliamo quindi qui, con queste garanzie:
 *   1. si applica solo a IT e SM (gli unici paesi che usano questo algoritmo);
 *   2. NON sostituisce mai la libreria: si aggiunge a un IBAN gia' valido;
 *   3. l'esito e' un codice distinto (CIN_MISMATCH), non un generico "non valido".
 * Vedi src/core/errors.js e i vettori di test in test/cin-vectors.js.
 */

import {
  validateIBAN,
  ValidationErrorsIBAN,
  friendlyFormatIBAN,
  extractIBAN,
  validateBIC,
  ValidationErrorsBIC,
  getCountrySpecifications,
  isSEPACountry,
} from "../../vendor/ibantools.js";

import { IBAN_CODE, makeResult, BIC_CODE, makeBicResult } from "./errors.js";

/* ------------------------------------------------------------------ *
 * Normalizzazione
 * ------------------------------------------------------------------ */

/**
 * Caratteri invisibili che rompono la validazione se non rimossi (limite L5).
 * U+00A0 NBSP · U+202F narrow NBSP · U+2007 figure space · U+2009 thin space
 * U+200B zero-width space · U+FEFF BOM/zero-width no-break · U+2060 word joiner
 */
const INVISIBLE = /[\u00A0\u202F\u2007\u2009\u200B\uFEFF\u2060]/g;

/**
 * Normalizza un IBAN digitato, incollato o letto da OCR.
 * @param {string} input
 * @returns {string} solo lettere e cifre maiuscole. Stringa vuota se non valido.
 */
export function normalizeIban(input) {
  if (typeof input !== "string") return "";
  return input
    .normalize("NFKC") // converte anche le cifre/lettere a larghezza piena
    .replace(INVISIBLE, "")
    .replace(/[^A-Za-z0-9]/g, "") // spazi, trattini, punti, tab, a capo
    .toUpperCase();
}

/** Formatta un IBAN a blocchi di 4 (delega a ibantools, §4.2). */
export function formatIban(input) {
  const electronic = normalizeIban(input);
  if (!electronic) return "";
  return friendlyFormatIBAN(electronic, " ") || electronic;
}

/** Lunghezza attesa per un paese, o null se il paese non e' nel registro. */
export function expectedLengthFor(countryCode) {
  if (typeof countryCode !== "string" || countryCode.length !== 2) return null;
  const specs = getCountrySpecifications();
  const spec = specs[countryCode.toUpperCase()];
  return spec && spec.chars ? spec.chars : null;
}

export function isSepaCountry(countryCode) {
  if (typeof countryCode !== "string" || countryCode.length !== 2) return false;
  try {
    return isSEPACountry(countryCode.toUpperCase());
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Validazione
 * ------------------------------------------------------------------ */

/**
 * Ordine di priorita' nel tradurre gli errori della libreria in un messaggio.
 * `ibantools` puo' restituire piu' codici insieme (tipicamente formato +
 * checksum). Si sceglie quello PIU' AZIONABILE per l'utente:
 * "manca un carattere" e' piu' utile di "formato sbagliato".
 * I testi corrispondenti sono vincolanti: MioIBAN-SPEC.md §7.1.
 */
const ERROR_PRIORITY = [
  [ValidationErrorsIBAN.WrongBBANLength, IBAN_CODE.WRONG_LENGTH],
  [ValidationErrorsIBAN.WrongBBANFormat, IBAN_CODE.WRONG_FORMAT],
  [ValidationErrorsIBAN.ChecksumNotNumber, IBAN_CODE.CHECKSUM_NOT_NUMBER],
  [ValidationErrorsIBAN.WrongIBANChecksum, IBAN_CODE.CHECKSUM],
  [ValidationErrorsIBAN.NoIBANCountry, IBAN_CODE.UNKNOWN_COUNTRY],
  [ValidationErrorsIBAN.NoIBANProvided, IBAN_CODE.EMPTY],
];

function pickCode(errorCodes) {
  for (const [libCode, ourCode] of ERROR_PRIORITY) {
    if (errorCodes.includes(libCode)) return ourCode;
  }
  return IBAN_CODE.INTERNAL;
}

/* ------------------------------------------------------------------ *
 * CIN italiano / sammarinese
 * ------------------------------------------------------------------ */

/** Paesi che usano il carattere di controllo nazionale CIN. */
const CIN_COUNTRIES = ["IT", "SM"];

/**
 * Valori per le posizioni DISPARI (1a, 3a, 5a ...) dell'algoritmo CIN.
 * Per le posizioni PARI il valore e' invece il valore posizionale della cifra
 * (0-9) oppure, per le lettere, l'indice A=0 ... Z=25.
 */
const CIN_ODD = Object.freeze({
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
});

/** Valore di una posizione PARI. */
function evenValue(ch) {
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48; // cifra
  if (code >= 65 && code <= 90) return code - 65; // A=0 ... Z=25
  return null;
}

/**
 * Calcola il carattere di controllo nazionale (CIN) italiano.
 *
 * @param {string} body I 22 caratteri ABI(5) + CAB(5) + conto(12), in
 *                      maiuscolo e senza separatori.
 * @returns {string|null} Una lettera A-Z, oppure null se l'input non e' valido.
 *
 * Vettore di riferimento: per "0542811101000000123456" deve restituire "X",
 * cioe' il CIN dell'IBAN di esempio IT60X0542811101000000123456.
 */
export function computeCin(body) {
  if (typeof body !== "string" || body.length !== 22) return null;
  let sum = 0;
  for (let i = 0; i < 22; i += 1) {
    const ch = body[i];
    // i pari  -> posizione DISPARI (1a, 3a, ...) -> tabella CIN_ODD
    // i dispari -> posizione PARI  (2a, 4a, ...) -> valore posizionale
    if (i % 2 === 0) {
      const value = CIN_ODD[ch];
      if (value === undefined) return null;
      sum += value;
    } else {
      const value = evenValue(ch);
      if (value === null) return null;
      sum += value;
    }
  }
  return String.fromCharCode(65 + (sum % 26));
}

/** Estrae il CIN da un IBAN elettronico italiano, o null. */
export function cinOf(electronic) {
  const s = normalizeIban(electronic);
  if (!CIN_COUNTRIES.includes(s.slice(0, 2))) return null;
  if (!s[4]) return null;
  return s[4];
}

/** Verifica il CIN. Ritorna {applicable, expected, actual, ok}. */
export function checkCin(electronic) {
  const s = normalizeIban(electronic);
  const country = s.slice(0, 2);
  if (!CIN_COUNTRIES.includes(country)) return { applicable: false };
  const expected = computeCin(s.slice(5));
  if (expected === null) return { applicable: false };
  const actual = s[4];
  return { applicable: true, expected, actual, ok: expected === actual };
}

/* ------------------------------------------------------------------ *
 * Validazione completa
 * ------------------------------------------------------------------ */

/**
 * @typedef {object} IbanValidationFull
 * @property {string} code      Codice di src/core/errors.js
 * @property {string} level     'ok' | 'warn' | 'error'
 * @property {boolean} valid
 * @property {string} i18nKey
 * @property {string[]} details
 * @property {string} electronic IBAN normalizzato (stringa vuota se assente)
 * @property {string} formatted  IBAN a blocchi di 4 (stringa vuota se assente)
 * @property {string|null} countryCode
 * @property {boolean} sepa
 * @property {object|null} cin   Esito del controllo CIN, se applicabile
 */

/**
 * Valida un IBAN e restituisce un esito normalizzato e gia' pronto per la UI.
 * @param {string} input
 * @returns {IbanValidationFull}
 */
export function validateIban(input) {
  const electronic = normalizeIban(input);

  if (!electronic) {
    return {
      ...makeResult(IBAN_CODE.EMPTY),
      electronic: "",
      formatted: "",
      countryCode: null,
      sepa: false,
      cin: null,
    };
  }

  const { errorCodes } = validateIBAN(electronic);

  if (errorCodes.length > 0) {
    const code = pickCode(errorCodes);
    const details = errorCodes.map((c) => ValidationErrorsIBAN[c]).filter(Boolean);
    return {
      ...makeResult(code, details),
      electronic,
      formatted: formatIban(electronic),
      countryCode: electronic.slice(0, 2) || null,
      sepa: false,
      cin: null,
    };
  }

  // Formalmente valido secondo la libreria. Ora il controllo nazionale.
  const countryCode = electronic.slice(0, 2);
  const formatted = formatIban(electronic);
  const sepa = isSepaCountry(countryCode);

  const cin = checkCin(electronic);
  if (cin.applicable && !cin.ok) {
    return {
      ...makeResult(IBAN_CODE.CIN_MISMATCH, ["CIN"]),
      electronic,
      formatted,
      countryCode,
      sepa,
      cin,
    };
  }

  // Per IT e SM, con CIN corretto, il messaggio puo' essere piu' preciso e piu'
  // rassicurante: sono stati verificati ANCHE il carattere di controllo
  // nazionale, non solo quello internazionale. Resta comunque la descrizione
  // di cio' che e' stato controllato, non una garanzia sul conto reale (§7.1).
  const result = makeResult(IBAN_CODE.VALID);
  if (cin.applicable && cin.ok) {
    result.i18nKey = "validation.validWithCin";
  }

  return {
    ...result,
    electronic,
    formatted,
    countryCode,
    sepa,
    cin: cin.applicable ? cin : null,
  };
}

/* ------------------------------------------------------------------ *
 * Componenti (ABI / CAB / conto)
 * ------------------------------------------------------------------ */

/**
 * Estrae le componenti di un IBAN valido.
 *
 * ATTENZIONE — limite L3 di ibantools: per l'Italia `extractIBAN().accountNumber`
 * NON e' il numero di conto (il registro applica '4-27' all'IBAN completo e
 * restituisce l'intero BBAN). `bankIdentifier` (ABI) e `branchIdentifier` (CAB)
 * sono invece corretti. Il conto lo ricaviamo qui.
 *
 * MioIBAN-SPEC.md §6.1: questi valori NON vanno salvati nel record, si
 * ricalcolano a runtime. Salvarli creerebbe disallineamenti se l'IBAN cambia.
 *
 * @param {string} electronic
 * @returns {{countryCode: string, bban: string, cin: string|null,
 *            abi: string|null, cab: string|null, conto: string|null,
 *            sepa: boolean}|null}
 */
export function extractComponents(electronic) {
  const s = normalizeIban(electronic);
  if (!s) return null;

  const info = extractIBAN(s);
  if (!info || !info.valid) return null;

  const countryCode = info.countryCode || s.slice(0, 2);
  const out = {
    countryCode,
    bban: info.bban || s.slice(4),
    cin: null,
    abi: null,
    cab: null,
    conto: null,
    sepa: isSepaCountry(countryCode),
  };

  if (CIN_COUNTRIES.includes(countryCode)) {
    out.cin = s[4] || null;
    // ABI e CAB arrivano dalla libreria (indici corretti nel registro).
    out.abi = info.bankIdentifier || s.slice(5, 10) || null;
    out.cab = info.branchIdentifier || s.slice(10, 15) || null;
    // Il conto lo dobbiamo ricavare noi: vedi nota L3 qui sopra.
    out.conto = s.slice(15, 27) || null;
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * BIC / SWIFT
 * ------------------------------------------------------------------ */

const BIC_ERROR_PRIORITY = [
  [ValidationErrorsBIC.NoBICCountry, BIC_CODE.UNKNOWN_COUNTRY],
  [ValidationErrorsBIC.WrongBICFormat, BIC_CODE.WRONG_FORMAT],
  [ValidationErrorsBIC.NoBICProvided, BIC_CODE.EMPTY],
];

/**
 * Valida un BIC inserito a mano.
 * Il BIC non e' MAI derivato dall'IBAN: non esiste alcuna funzione che lo faccia
 * (limite L1) e MioIBAN non deve prometterlo. Vedi decisione D-08.
 */
export function validateBic(input) {
  const bic = typeof input === "string" ? input.replace(/\s+/g, "").toUpperCase() : "";
  if (!bic) {
    return { ...makeBicResult(BIC_CODE.EMPTY), bic: "" };
  }
  const { errorCodes } = validateBIC(bic);
  if (errorCodes.length === 0) {
    return { ...makeBicResult(BIC_CODE.VALID), bic };
  }
  let code = BIC_CODE.INTERNAL;
  for (const [libCode, ourCode] of BIC_ERROR_PRIORITY) {
    if (errorCodes.includes(libCode)) {
      code = ourCode;
      break;
    }
  }
  return { ...makeBicResult(code), bic };
}

/* ------------------------------------------------------------------ *
 * Estrazione di IBAN candidati da testo libero
 * ------------------------------------------------------------------ */

/**
 * Trova gli IBAN presenti in un testo sporco (WhatsApp, email, PDF).
 *
 * `extractIBAN` della libreria NON cerca dentro un testo: si limita a
 * normalizzare la stringa che riceve (limite L4). Serve quindi un ritaglio
 * preliminare. Questo e' l'UNICO punto del progetto in cui e' ammessa una
 * regex su un IBAN (MioIBAN-SPEC.md §4.4) e NON valida nulla: delega tutto a
 * `validateIban`.
 *
 * @param {string} text
 * @returns {string[]} IBAN elettronici validi, senza duplicati.
 */
export function extractCandidates(text) {
  if (typeof text !== "string" || !text) return [];

  // 1. Normalizza i caratteri invisibili e uniforma gli spazi.
  const clean = text
    .normalize("NFKC")
    .replace(INVISIBLE, " ")
    .replace(/[\t\r\n]+/g, " ")
    .toUpperCase();

  const specs = getCountrySpecifications();
  const found = new Set();

  // 2. Ogni possibile inizio: 2 lettere di paese + 2 cifre di controllo.
  const startRe = /[A-Z]{2}[0-9]{2}/g;
  let match;

  while ((match = startRe.exec(clean)) !== null) {
    const countryCode = match[0].slice(0, 2);
    const spec = specs[countryCode];
    if (!spec || !spec.chars) continue; // paese non nel registro IBAN

    // 3. Ritaglia la lunghezza esatta prevista per quel paese, ignorando i
    //    separatori visivi. La lunghezza viene dal registro della libreria:
    //    non e' una tabella scritta a mano.
    const tail = clean.slice(match.index);
    const compact = tail.replace(/[^A-Z0-9]/g, "").slice(0, spec.chars);
    if (compact.length !== spec.chars) continue;

    // 4. La validazione la fa SEMPRE la libreria.
    const result = validateIban(compact);
    if (result.valid) found.add(result.electronic);
  }

  return [...found];
}

/* ------------------------------------------------------------------ *
 * Struttura per l'IBANAnalyzer
 * ------------------------------------------------------------------ */

/**
 * Divide un IBAN in blocchi di 4 con i metadati che servono alla Modalita'
 * Sportello (MioIBAN-SPEC.md §8):
 *  - `isZero`      per evidenziare gli zeri (causa n.1 di errore, §8.3)
 *  - `inZeroRun`   per marcare gli zeri CONSECUTIVI in modo piu' marcato
 *  - `isAmbiguous` per O e I, che si confondono con 0 e 1
 *  - `seq`         il conteggio 1-2-3-4 da mostrare sotto il blocco
 *  - `position`    la posizione assoluta, per la numerazione progressiva
 *
 * @param {string} input
 * @returns {{electronic: string, formatted: string, blocks: Array}}
 */
export function splitForAnalyzer(input) {
  const electronic = normalizeIban(input);
  const blocks = [];

  for (let i = 0; i < electronic.length; i += 4) {
    const chunk = electronic.slice(i, i + 4);
    blocks.push({
      index: blocks.length,
      countFrom: i + 1,
      chars: Array.from(chunk, (ch, j) => ({
        ch,
        seq: j + 1,
        position: i + j + 1,
        isZero: ch === "0",
        inZeroRun: false,
        isAmbiguous: ch === "O" || ch === "I",
      })),
    });
  }

  // Marca le sequenze di 2 o piu' zeri consecutivi. Gli oggetti sono condivisi
  // per riferimento, quindi la modifica si riflette nei blocchi.
  const flat = blocks.flatMap((b) => b.chars);
  let runStart = -1;
  for (let i = 0; i <= flat.length; i += 1) {
    const isZero = i < flat.length && flat[i].isZero;
    if (isZero && runStart === -1) runStart = i;
    if (!isZero && runStart !== -1) {
      if (i - runStart >= 2) {
        for (let k = runStart; k < i; k += 1) flat[k].inZeroRun = true;
      }
      runStart = -1;
    }
  }

  return { electronic, formatted: formatIban(electronic), blocks };
}

/**
 * Testo per la sintesi vocale, carattere per carattere.
 * `speechSynthesis` deve pronunciare le cifre singolarmente e lo zero come
 * "zero": leggere un IBAN tutto di fila e' incomprensibile (§8.4).
 *
 * @param {string} input
 * @param {(key: string) => string} translate Funzione t() per la lingua attiva.
 * @returns {string[]} Un elemento per blocco, gia' separato da virgole.
 */
export function speechChunks(input, translate) {
  const { blocks } = splitForAnalyzer(input);
  const zeroWord = translate ? translate("speech.zero") : "0";
  return blocks.map((block) =>
    block.chars.map((c) => (c.isZero ? zeroWord : c.ch)).join(", "),
  );
}
