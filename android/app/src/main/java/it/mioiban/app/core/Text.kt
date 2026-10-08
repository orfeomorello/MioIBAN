package it.mioiban.app.core

import java.text.Normalizer

/** Minuscolo e senza accenti, per una ricerca che trova "Perugia" con "perugia". */
fun foldForSearch(value: String): String =
    Normalizer.normalize(value.lowercase(), Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "")

/** Pulisce un testo libero: comprime gli spazi (anche NBSP) e applica il limite. */
fun String.clean(max: Int): String =
    trim().replace(Regex("[\\s\\u00A0\\u202F\\u200B\\uFEFF]+"), " ").trim().take(max)
