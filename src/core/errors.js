/**
 * MioIBAN — Tassonomia interna degli esiti di validazione
 *
 * PERCHE' ESISTE QUESTO FILE
 * Le librerie IBAN usano nomi di errore diversi tra loro (ibantools usa un enum
 * numerico, validator.js non restituisce alcun codice). La UI e le traduzioni
 * non devono dipendere da quella scelta.
 *
 * Regola architetturale (MioIBAN-SPEC.md §4):
 *   libreria IBAN  ->  [src/core/iban.js]  ->  CODICI DI QUESTO FILE  ->  UI + i18n
 *
 * Quindi: cambiare libreria significa riscrivere UN SOLO file (iban.js),
 * senza toccare la UI, i CSS, i dizionari di traduzione o i test di livello alto.
 */

/** Codici stabili. Non rinominare: sono riferiti dai dizionari i18n. */
export const IBAN_CODE = Object.freeze({
  EMPTY: "EMPTY",
  VALID: "VALID",
  UNKNOWN_COUNTRY: "UNKNOWN_COUNTRY",
  WRONG_LENGTH: "WRONG_LENGTH",
  WRONG_FORMAT: "WRONG_FORMAT",
  CHECKSUM_NOT_NUMBER: "CHECKSUM_NOT_NUMBER",
  CHECKSUM: "CHECKSUM",
  /**
   * Specifico dell'Italia (e San Marino): il carattere di controllo nazionale
   * (CIN) non corrisponde ad ABI+CAB+conto.
   *
   * Nessuna libreria MIT lo verifica: `ibantools` controlla solo lunghezza,
   * formato e mod-97 internazionale. Lo calcoliamo noi in src/core/iban.js.
   * Un CIN sbagliato e' la prova che una cifra e' stata copiata male, quindi
   * vale come errore: ma il messaggio deve restare specifico, non generico.
   */
  CIN_MISMATCH: "CIN_MISMATCH",
  INTERNAL: "INTERNAL",
});

/**
 * Livello di gravita', usato dalla UI per colore e icona.
 *  - "ok"    nessun problema (verde)
 *  - "warn"  problema di forma, probabilmente un refuso correggibile (ambra)
 *  - "error" checksum non valido: l'IBAN non esiste (rosso)
 */
export const IBAN_LEVEL = Object.freeze({
  [IBAN_CODE.EMPTY]: "ok",
  [IBAN_CODE.VALID]: "ok",
  [IBAN_CODE.UNKNOWN_COUNTRY]: "warn",
  [IBAN_CODE.WRONG_LENGTH]: "warn",
  [IBAN_CODE.WRONG_FORMAT]: "warn",
  [IBAN_CODE.CHECKSUM_NOT_NUMBER]: "warn",
  [IBAN_CODE.CHECKSUM]: "error",
  [IBAN_CODE.CIN_MISMATCH]: "error",
  [IBAN_CODE.INTERNAL]: "error",
});

/**
 * Chiave i18n associata a ogni codice.
 * I testi corrispondenti sono VINCOLANTI: MioIBAN-SPEC.md §7.1.
 * In particolare, per CHECKSUM e VALID non si usano mai le parole
 * "verificato" / "esiste" / "garantito": il CIN italiano non e' controllato.
 */
export const IBAN_I18N_KEY = Object.freeze({
  [IBAN_CODE.EMPTY]: "validation.empty",
  [IBAN_CODE.VALID]: "validation.valid",
  [IBAN_CODE.UNKNOWN_COUNTRY]: "validation.unknownCountry",
  [IBAN_CODE.WRONG_LENGTH]: "validation.wrongLength",
  [IBAN_CODE.WRONG_FORMAT]: "validation.wrongFormat",
  [IBAN_CODE.CHECKSUM_NOT_NUMBER]: "validation.checksumNotNumber",
  [IBAN_CODE.CHECKSUM]: "validation.checksum",
  [IBAN_CODE.CIN_MISMATCH]: "validation.cinMismatch",
  [IBAN_CODE.INTERNAL]: "errors.unexpected",
});

/**
 * Esito di validazione di un IBAN.
 * @typedef {object} IbanValidation
 * @property {string}   code    Uno di IBAN_CODE.
 * @property {string}   level   Uno di 'ok' | 'warn' | 'error'.
 * @property {boolean}  valid   true solo per IBAN_CODE.VALID.
 * @property {string}   i18nKey Chiave da passare a t().
 * @property {string[]} details Codici aggiuntivi, quando la libreria ne
 *                              segnala piu' di uno (es. lunghezza + checksum).
 */

/**
 * Costruisce un esito normalizzato.
 * @param {string} code
 * @param {string[]} [details]
 * @returns {IbanValidation}
 */
export function makeResult(code, details) {
  return {
    code,
    level: IBAN_LEVEL[code] || "error",
    valid: code === IBAN_CODE.VALID,
    i18nKey: IBAN_I18N_KEY[code] || "errors.unexpected",
    details: details || [],
  };
}

/** Codici BIC/SWIFT. Stessa logica, alfabeto ridotto. */
export const BIC_CODE = Object.freeze({
  EMPTY: "EMPTY",
  VALID: "VALID",
  UNKNOWN_COUNTRY: "UNKNOWN_COUNTRY",
  WRONG_FORMAT: "WRONG_FORMAT",
  INTERNAL: "INTERNAL",
});

const BIC_I18N_KEY = Object.freeze({
  [BIC_CODE.EMPTY]: "validation.bicEmpty",
  [BIC_CODE.VALID]: "validation.bicValid",
  [BIC_CODE.UNKNOWN_COUNTRY]: "validation.bicUnknownCountry",
  [BIC_CODE.WRONG_FORMAT]: "validation.bicWrongFormat",
  [BIC_CODE.INTERNAL]: "errors.unexpected",
});

const BIC_LEVEL = Object.freeze({
  [BIC_CODE.EMPTY]: "ok",
  [BIC_CODE.VALID]: "ok",
  [BIC_CODE.UNKNOWN_COUNTRY]: "warn",
  [BIC_CODE.WRONG_FORMAT]: "warn",
  [BIC_CODE.INTERNAL]: "error",
});

/**
 * @param {string} code
 * @returns {{code: string, level: string, valid: boolean, i18nKey: string, details: string[]}}
 */
export function makeBicResult(code, details) {
  return {
    code,
    level: BIC_LEVEL[code] || "error",
    valid: code === BIC_CODE.VALID,
    i18nKey: BIC_I18N_KEY[code] || "errors.unexpected",
    details: details || [],
  };
}
