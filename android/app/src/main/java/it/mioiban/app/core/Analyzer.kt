package it.mioiban.app.core

/**
 * Suddivisione dell'IBAN per la Modalità Sportello (porting di splitForAnalyzer
 * in src/core/iban.js). Ogni carattere sa se è uno zero e se fa parte di una
 * serie di zeri consecutivi (quelli da evidenziare di più).
 */
object Analyzer {

    data class Glyph(val ch: kotlin.Char, val isZero: Boolean, val inZeroRun: Boolean)
    data class Block(val index: Int, val chars: List<Glyph>)

    /** Blocchi da 4 caratteri, con gli zeri marcati. */
    fun blocks(input: String): List<Block> {
        val electronic = Iban.normalize(input)
        val flat = electronic.map { Glyph(it, it == '0', false) }.toMutableList()

        // Zeri consecutivi di lunghezza >= 2: marcati come "run".
        var runStart = -1
        for (i in 0..flat.size) {
            val isZero = i < flat.size && flat[i].isZero
            if (isZero) {
                if (runStart < 0) runStart = i
            } else if (runStart >= 0) {
                if (i - runStart >= 2) {
                    for (k in runStart until i) flat[k] = flat[k].copy(inZeroRun = true)
                }
                runStart = -1
            }
        }

        return flat.chunked(4).mapIndexed { index, chunk -> Block(index + 1, chunk) }
    }

    /** Testo per la lettura vocale: ogni carattere separato, lo zero detto come "zero". */
    fun speechChunks(input: String, zeroWord: String): List<String> =
        blocks(input).map { block ->
            block.chars.joinToString(", ") { if (it.isZero) zeroWord else it.ch.toString() }
        }
}
