package it.mioiban.app.core

import java.text.Normalizer

/** Esito della validazione. Ogni codice ha un messaggio dedicato nella UI. */
enum class IbanCode {
    EMPTY,
    UNKNOWN_COUNTRY,
    WRONG_LENGTH,
    WRONG_FORMAT,
    CHECKSUM,
    CIN_MISMATCH,
    VALID,
    VALID_WITH_CIN,
}

data class IbanCheck(
    val code: IbanCode,
    /** IBAN normalizzato (solo lettere e cifre maiuscole). */
    val electronic: String,
    /** IBAN a blocchi di 4, per la visualizzazione. */
    val formatted: String,
) {
    val isValid: Boolean
        get() = code == IbanCode.VALID || code == IbanCode.VALID_WITH_CIN
}

/**
 * Logica IBAN di MioIBAN (porting della PWA: src/core/iban.js).
 *
 * ATTENZIONE: la PWA delega la validazione alla libreria `ibantools`. In Kotlin
 * non esiste un equivalente verificato, quindi qui ci sono:
 *  - la tabella di lunghezze per i paesi SEPA (lista parziale: vedi README);
 *  - il controllo mod-97 ISO 13616;
 *  - il calcolo del CIN italiano (unica eccezione prevista dalla specifica §4.6).
 * I test in src/test usano gli stessi vettori della PWA.
 */
object Iban {

    private val ITALIAN_BBAN = Regex("[A-Z][0-9]{10}[A-Z0-9]{12}")
    private val BIC = Regex("[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?")
    private val INVISIBLE = Regex("[\u00A0\u202F\u2007\u2009\u200B\uFEFF\u2060]")

    /* Valori delle posizioni DISPARI nell'algoritmo CIN (indice 0 = '0' o 'A'). */
    private val CIN_ODD_DIGITS = intArrayOf(1, 0, 5, 7, 9, 13, 15, 17, 19, 21)
    private val CIN_ODD_LETTERS = intArrayOf(
        1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23,
    )

    /**
     * Normalizza un IBAN incollato o digitato: rimuove spazi, trattini e
     * caratteri invisibili (NBSP, zero-width), e porta tutto in maiuscolo.
     */
    fun normalize(input: String): String {
        val nfkc = Normalizer.normalize(input, Normalizer.Form.NFKC)
        val cleaned = INVISIBLE.replace(nfkc, "").uppercase()
        return buildString {
            for (c in cleaned) {
                if (c in 'A'..'Z' || c in '0'..'9') append(c)
            }
        }
    }

    /** IBAN a blocchi di 4 separati da spazio. */
    fun format(input: String): String = normalize(input).chunked(4).joinToString(" ")

    /** Valida un IBAN e restituisce un esito pronto per la UI. */
    fun validate(input: String): IbanCheck {
        val e = normalize(input)
        if (e.isEmpty()) return IbanCheck(IbanCode.EMPTY, "", "")
        val formatted = format(e)
        fun fail(code: IbanCode) = IbanCheck(code, e, formatted)

        if (e.length < 2 || !e.take(2).all { it in 'A'..'Z' }) return fail(IbanCode.WRONG_FORMAT)
        val country = e.take(2)
        val spec = IbanRegistry.countries[country] ?: return fail(IbanCode.UNKNOWN_COUNTRY)
        if (e.length != spec.length) return fail(IbanCode.WRONG_LENGTH)
        if (!e.substring(2, 4).all { it in '0'..'9' }) return fail(IbanCode.WRONG_FORMAT)

        val bban = e.substring(4)
        val bbanOk = when {
            country == "IT" || country == "SM" -> ITALIAN_BBAN.matches(bban)
            spec.bbanRegex != null -> Regex(spec.bbanRegex).matches(bban)
            else -> bban.all { it in 'A'..'Z' || it in '0'..'9' }
        }
        if (!bbanOk) return fail(IbanCode.WRONG_FORMAT)

        // Mod-97 ISO 13616: spostare i primi 4 caratteri in fondo, lettere -> numeri (A=10).
        val rearranged = e.substring(4) + e.substring(0, 4)
        var remainder = 0
        for (c in rearranged) {
            val digits = if (c in '0'..'9') c.toString() else (c - 'A' + 10).toString()
            for (d in digits) remainder = (remainder * 10 + (d - '0')) % 97
        }
        if (remainder != 1) return fail(IbanCode.CHECKSUM)

        // Carattere di controllo nazionale: solo IT e SM (specifica §4.6).
        if (country == "IT" || country == "SM") {
            val expectedCin = computeCin(e.substring(5)) ?: return fail(IbanCode.WRONG_FORMAT)
            if (e[4] != expectedCin) return fail(IbanCode.CIN_MISMATCH)
            return IbanCheck(IbanCode.VALID_WITH_CIN, e, formatted)
        }
        return IbanCheck(IbanCode.VALID, e, formatted)
    }

    /**
     * Calcola il CIN italiano dai 22 caratteri ABI(5)+CAB(5)+conto(12).
     * Vettore di riferimento: "0542811101000000123456" -> 'X'
     * (IBAN di esempio IT60X0542811101000000123456).
     */
    fun computeCin(body: String): Char? {
        if (body.length != 22) return null
        var sum = 0
        for (i in body.indices) {
            val ch = body[i]
            if (i % 2 == 0) {
                // Posizione dispari (1a, 3a, ...): tabella dedicata.
                sum += when (ch) {
                    in '0'..'9' -> CIN_ODD_DIGITS[ch - '0']
                    in 'A'..'Z' -> CIN_ODD_LETTERS[ch - 'A']
                    else -> return null
                }
            } else {
                // Posizione pari (2a, 4a, ...): valore posizionale.
                sum += when (ch) {
                    in '0'..'9' -> ch - '0'
                    in 'A'..'Z' -> ch - 'A'
                    else -> return null
                }
            }
        }
        return 'A' + (sum % 26)
    }

    /** Formato BIC: 8 o 11 caratteri. Il BIC è sempre inserito a mano (D-08). */
    fun isValidBic(input: String): Boolean {
        val bic = input.replace(" ", "").uppercase()
        return BIC.matches(bic)
    }
}
