package it.mioiban.app.core

/**
 * Estrazione dei candidati IBAN da un testo incollato (porting di extractCandidates
 * in src/core/iban.js). Trova sequenze che sembrano IBAN, anche se spezzate da
 * spazi, trattini o caratteri invisibili, e tiene solo quelle formalmente valide.
 */
object Extract {

    /** Limite di sicurezza: un testo più lungo viene rifiutato (SPEC §7). */
    const val MAX_TEXT_CHARS = 20_000

    /** Candidato valido, con la posizione nel testo originale per l'anteprima. */
    data class Candidate(val electronic: String, val formatted: String)

    /** Lunghezza massima di un IBAN (registro IBAN). */
    private const val MAX_IBAN_CHARS = 34

    /** Quanti token consecutivi provare a unire per ricomporre un IBAN spezzato. */
    private const val MAX_TOKENS_PER_IBAN = 9

    /** Separa il testo in token alfanumerici; spazi e caratteri invisibili fanno da separatore. */
    private fun tokens(text: String): List<String> =
        text.replace(Regex("[\\s\\u00A0\\u202F\\u2007\\u2009\\u200B\\uFEFF\\u2060]+"), " ")
            .split(' ')
            .map { token -> token.filter { it.isLetterOrDigit() }.uppercase() }
            .filter { it.isNotEmpty() }

    /**
     * Cerca IBAN validi. Per ogni token che inizia con due lettere prova a unire
     * i token successivi (IBAN spezzati in gruppi da 4) fino a un IBAN valido.
     * Non dipende da una regex greedy: non inghiotte mai le parole vicine.
     *
     * @return candidati validi, senza duplicati, nell'ordine in cui compaiono.
     *         Lista vuota se il testo supera il limite.
     */
    fun candidates(text: String): List<Candidate> {
        if (text.length > MAX_TEXT_CHARS) return emptyList()
        val parts = tokens(text)
        val seen = LinkedHashSet<String>()
        val result = mutableListOf<Candidate>()

        var i = 0
        while (i < parts.size) {
            var joined = ""
            var found: Candidate? = null
            var last = i
            var j = i
            while (j < parts.size && j < i + MAX_TOKENS_PER_IBAN) {
                joined += parts[j]
                if (joined.length > MAX_IBAN_CHARS) break
                if (joined.length >= 15) {
                    val check = Iban.validate(joined)
                    if (check.isValid) {
                        found = Candidate(check.electronic, check.formatted)
                        last = j
                        break
                    }
                }
                j += 1
            }
            if (found != null) {
                if (seen.add(found.electronic)) result += found
                i = last + 1
            } else {
                i += 1
            }
        }
        return result
    }

    fun tooLong(text: String): Boolean = text.length > MAX_TEXT_CHARS
}
