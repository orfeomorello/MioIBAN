package it.mioiban.app.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Un conto salvato. Corrisponde al record della PWA (MioIBAN-SPEC.md §6).
 * L'IBAN è sempre in formato elettronico (senza spazi) ed è unico.
 * ABI, CAB e conto NON vengono salvati: si ricalcolano dall'IBAN.
 */
@Entity(
    tableName = "accounts",
    indices = [Index(value = ["iban"], unique = true)],
)
data class Account(
    @PrimaryKey val id: String,
    val iban: String,
    val titolare: String = "",
    val banca: String = "",
    val bic: String = "",
    val alias: String = "",
    val note: String = "",
    val causale: String = "",
    val isFavorite: Boolean = false,
    val sortOrder: Int = 0,
    val createdAt: Long,
    val lastUsedAt: Long,
) {
    /** Nome da mostrare: alias, poi titolare, poi banca, poi l'IBAN. */
    val displayName: String
        get() = listOf(alias, titolare, banca).firstOrNull { it.isNotBlank() } ?: iban
}
