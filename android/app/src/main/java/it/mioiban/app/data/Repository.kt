package it.mioiban.app.data

import it.mioiban.app.core.Iban
import it.mioiban.app.core.IbanCheck
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.UUID

/** Esito di un salvataggio: il conto salvato oppure il duplicato già presente. */
sealed interface SaveResult {
    data class Saved(val account: Account) : SaveResult
    data class Duplicate(val existing: Account) : SaveResult
    data class InvalidIban(val check: IbanCheck) : SaveResult
}

/** Dati del form, prima della normalizzazione. */
data class AccountDraft(
    val iban: String,
    val titolare: String = "",
    val banca: String = "",
    val bic: String = "",
    val alias: String = "",
    val note: String = "",
    val groupId: String? = null,
    val isFavorite: Boolean = false,
)

/**
 * Accesso ai dati. Unico punto che conosce Room: la UI parla solo con questa classe.
 * Il dataset è piccolo (5-30 conti), quindi la ricerca è fatta in memoria.
 */
class Repository(private val db: AppDatabase) {

    val accounts: Flow<List<Account>> = db.accounts().observeAll()
    val groups: Flow<List<Group>> = db.groups().observeAll()

    suspend fun get(id: String): Account? = db.accounts().getById(id)

    suspend fun save(draft: AccountDraft, editingId: String?): SaveResult {
        val check = Iban.validate(draft.iban)
        if (!check.isValid) return SaveResult.InvalidIban(check)

        val existing = db.accounts().findByIban(check.electronic)
        if (existing != null && existing.id != editingId) return SaveResult.Duplicate(existing)

        val now = System.currentTimeMillis()
        val previous = editingId?.let { db.accounts().getById(it) }
        val account = Account(
            id = editingId ?: UUID.randomUUID().toString(),
            iban = check.electronic,
            titolare = cleanText(draft.titolare, 80),
            banca = cleanText(draft.banca, 80),
            bic = Iban.normalize(draft.bic).take(11),
            alias = cleanText(draft.alias, 60),
            note = cleanText(draft.note, 500),
            groupId = draft.groupId,
            isFavorite = draft.isFavorite,
            createdAt = previous?.createdAt ?: now,
            lastUsedAt = previous?.lastUsedAt ?: now,
        )
        // Con upsert, se il conto esiste già si sostituisce; altrimenti si inserisce.
        if (previous != null) {
            db.accounts().delete(previous.id)
        }
        db.accounts().insert(account)
        return SaveResult.Saved(account)
    }

    suspend fun delete(id: String) = db.accounts().delete(id)

    suspend fun touch(id: String) = db.accounts().touch(id, System.currentTimeMillis())

    suspend fun setFavorite(account: Account, favorite: Boolean) {
        db.accounts().delete(account.id)
        db.accounts().insert(account.copy(isFavorite = favorite))
    }

    suspend fun addGroup(name: String): Group? {
        val clean = cleanText(name, 40)
        if (clean.isEmpty()) return null
        val group = Group(id = UUID.randomUUID().toString(), name = clean)
        db.groups().insert(group)
        return group
    }

    /** Eliminare un gruppo NON elimina i conti: restano senza gruppo (SPEC F-10). */
    suspend fun deleteGroup(id: String) {
        db.accounts().clearGroup(id)
        db.groups().delete(id)
    }

    suspend fun allAccounts(): List<Account> = db.accounts().getAll()
    suspend fun allGroups(): List<Group> = db.groups().getAll()

    suspend fun replaceAll(accounts: List<Account>, groups: List<Group>) {
        db.groups().replaceAll(groups)
        db.accounts().replaceAll(accounts)
    }

    suspend fun resetAll() {
        db.accounts().deleteAll()
        db.groups().deleteAll()
    }

    private fun cleanText(value: String, max: Int): String =
        value.replace(Regex("[\\u0000-\\u001F\\u007F]"), " ")
            .replace(Regex("[\\s\\u00A0\\u202F\\u200B\\uFEFF]+"), " ")
            .trim()
            .take(max)
}

/** Ricerca, filtri e ordinamento, come in src/core/model.js della PWA. */
object AccountFilter {
    data class Filter(val query: String = "", val favoritesOnly: Boolean = false, val groupId: String? = null)

    fun apply(accounts: List<Account>, filter: Filter): List<Account> {
        val q = filter.query.trim().lowercase()
        return accounts
            .asSequence()
            .filter { !filter.favoritesOnly || it.isFavorite }
            .filter { filter.groupId == null || it.groupId == filter.groupId }
            .filter { a ->
                q.isEmpty() || listOf(a.alias, a.titolare, a.banca, a.note, a.iban)
                    .any { it.lowercase().contains(q) }
            }
            .sortedWith(
                compareByDescending<Account> { it.isFavorite }
                    .thenBy(String.CASE_INSENSITIVE_ORDER) { it.displayName }
                    .thenBy { it.iban },
            )
            .toList()
    }

    fun countByGroup(accounts: List<Account>): Map<String?, Int> =
        accounts.groupingBy { it.groupId }.eachCount()
}

fun Flow<List<Account>>.visible(filter: AccountFilter.Filter): Flow<List<Account>> =
    map { AccountFilter.apply(it, filter) }
