/**
 * MioIBAN — Vettori di test per il carattere di controllo italiano (CIN)
 *
 * ============================================================================
 * PERCHE' QUESTO FILE E' UN PRESIDIO DI SICUREZZA
 * ============================================================================
 * Il CIN è l'unica parte della validazione che MioIBAN calcola da sé
 * (MioIBAN-SPEC.md §4.6): l'unica libreria MIT che lo implementa è stata
 * valutata e scartata (pesa 286 KB gzip, è una prerelease e non ha test per
 * l'Italia), e le librerie MIT leggere non lo guardano affatto.
 *
 * Il rischio non è "non accorgersi di un IBAN sbagliato": è l'opposto.
 * Un errore nell'algoritmo farebbe RIFIUTARE IBAN VALIDI, impedendo all'utente
 * di salvare un conto corretto. Un falso negativo è peggio di un controllo
 * mancante, quindi questo file è vincolante: la checklist di rilascio
 * (§16, punto 17) richiede che TUTTI i vettori passino.
 *
 * REGOLA: non aggiungere mai un vettore "calcolato dal nostro codice".
 * I vettori devono venire da IBAN reali e pubblici, con fonte citata.
 * Un vettore copiato dall'output del nostro algoritmo non prova nulla.
 */

/**
 * Vettore di riferimento, verificato con calcolo manuale indipendente.
 *
 * Corpo su cui si applica il CIN: ABI + CAB + conto
 *   ABI   = 05428
 *   CAB   = 11101
 *   conto = 000000123456
 *   corpo = "0542811101000000123456"  (22 caratteri)
 *
 * Posizioni dispari (1a, 3a, ...) con la tabella ABI, posizioni pari con il
 * valore posizionale. Somma = 75. 75 mod 26 = 23. 23 -> 'X' (A=0 ... X=23).
 *
 * Il CIN atteso è quindi 'X', esattamente il 5° carattere dell'IBAN di
 * riferimento.
 */
export const CIN_REFERENCE = Object.freeze({
  body: "0542811101000000123456",
  expected: "X",
});

/**
 * IBAN completi che devono risultare VALIDI, con CIN verificato.
 *
 * Set completo per il rilascio (6 vettori verificati, vedi §4.6, garanzia
 * n. 4): il primo è l'esempio classico della documentazione tecnica, gli
 * altri quattro vengono dagli esempi italiani del documento ECBS TR201 v3.9
 * (riportati nella issue #78 di schwifty) e l'ultimo dalla test-suite
 * pubblica di schwifty. Ognuno è stato riverificato in modo indipendente
 * (mod-97 = 1 e CIN ricalcolato a mano).
 *
 * @type {Array<{iban: string, source: string, verified: boolean}>}
 */
export const CIN_VECTORS = Object.freeze([
  {
    iban: "IT60X0542811101000000123456",
    source:
      "IBAN italiano di esempio di uso comune nella documentazione tecnica. " +
      "Verificato in modo indipendente: mod-97 della forma riordinata = 1 (valido) " +
      "e CIN calcolato a mano = 'X' (somma 75, 75 mod 26 = 23 -> 'X'), " +
      "che coincide con il 5° carattere dell'IBAN.",
    verified: true,
  },
  {
    iban: "IT21Q054280160000ABCD12ZE34",
    source:
      "Esempi italiani del documento ECBS TR201 v3.9, pag. 79 (riportati nella " +
      "issue #78 di mdomke/schwifty e aggiunti alla sua test-suite). Verificato " +
      "in modo indipendente: mod-97 = 1 e CIN ricalcolato = 'Q'.",
    verified: true,
  },
  {
    iban: "IT30C0800001000123VALE456NA",
    source:
      "Esempi italiani del documento ECBS TR201 v3.9, pag. 79 (riportati nella " +
      "issue #78 di mdomke/schwifty e aggiunti alla sua test-suite). Verificato " +
      "in modo indipendente: mod-97 = 1 e CIN ricalcolato = 'C'.",
    verified: true,
  },
  {
    iban: "IT11V0600003200000011556BFE",
    source:
      "Esempi italiani del documento ECBS TR201 v3.9, pag. 79 (riportati nella " +
      "issue #78 di mdomke/schwifty e aggiunti alla sua test-suite). Verificato " +
      "in modo indipendente: mod-97 = 1 e CIN ricalcolato = 'V'.",
    verified: true,
  },
  {
    iban: "IT21J0100516052120050012345",
    source:
      "Esempi italiani del documento ECBS TR201 v3.9, pag. 79 (riportati nella " +
      "issue #78 di mdomke/schwifty e aggiunti alla sua test-suite). Verificato " +
      "in modo indipendente: mod-97 = 1 e CIN ricalcolato = 'J'.",
    verified: true,
  },
  {
    iban: "IT22K4348207900DNNDKPHAGTIB",
    source:
      "Test-suite pubblica di mdomke/schwifty (tests/test_iban.py, esempi " +
      "discussi nella issue #78). Verificato in modo indipendente: mod-97 = 1 " +
      "e CIN ricalcolato = 'K'.",
    verified: true,
  },
]);

/**
 * IBAN che devono essere RIFIUTATI con `CIN_MISMATCH`.
 *
 * ATTENZIONE — TRAPPOLA DA NON RIPETERE.
 * Un vettore negativo NON si costruisce cambiando il CIN e basta. Se si prende
 * `IT60X0542811101000000123456` e si scrive `IT60A0542811101000000123456`, il
 * BBAN cambia e il checksum internazionale mod-97 NON è più valido: `ibantools`
 * lo rifiuta per `WrongIBANChecksum`, e `CIN_MISMATCH` non viene mai raggiunto.
 * Il test fallirebbe per il motivo sbagliato.
 *
 * Un vettore negativo corretto ha le cifre di controllo **ricalcolate**, così
 * che il mod-97 sia valido e l'unico difetto sia il CIN. Si ottiene con
 * `composeIBAN({ countryCode: 'IT', bban })` di ibantools.
 *
 * @type {Array<{iban: string, wrongCin: string, expectedCin: string, source: string}>}
 */
export const CIN_NEGATIVE_VECTORS = Object.freeze([
  {
    // composeIBAN({ countryCode: 'IT', bban: 'Y0542811101000000123456' })
    //   -> 98 - mod97 = 98 - 34 = 64  ->  "IT64Y..."
    iban: "IT64Y0542811101000000123456",
    wrongCin: "Y",
    expectedCin: "X",
    source:
      "Costruito ricalcolando le cifre di controllo sul BBAN con CIN errato 'Y' " +
      "(checksum = 98 - 34 = 64). Serve anche come prova del limite L2 di " +
      "ibantools: isValidIBAN() e validateIBAN() lo dichiarano VALIDO, perché " +
      "per l'Italia non esiste alcun bban_validation_func. MioIBAN lo rifiuta.",
  },
]);

/** Numero minimo di vettori positivi richiesto per il rilascio (§4.6, §16). */
export const MINIMUM_POSITIVE_VECTORS = 6;

/**
 * Verifica se il set di vettori è sufficiente per il rilascio.
 * @returns {{ready: boolean, missing: number, verified: number, unverified: number}}
 */
export function vectorSetStatus() {
  const verifiedPositives = CIN_VECTORS.filter((v) => v.verified).length;
  return {
    ready: verifiedPositives >= MINIMUM_POSITIVE_VECTORS,
    missing: Math.max(0, MINIMUM_POSITIVE_VECTORS - verifiedPositives),
    verified: verifiedPositives,
    unverified: CIN_VECTORS.filter((v) => !v.verified).length,
  };
}
