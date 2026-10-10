package it.mioiban.app.data

import it.mioiban.app.core.Iban
import it.mioiban.app.core.IbanCheck
import kotlinx.coroutines.flow.Flow
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
    val causale: String = "",
    val isFavorite: Boolean = false,
)

/**
 * Accesso ai dati. Unico punto che conosce i DAO: la UI parla solo con questa classe.
 * Il dataset è piccolo (5-30 conti), quindi la ricerca è fatta in memoria.
 */
class Repository(private val dao: AccountDao) {

    val accounts: Flow<List<Account>> = dao.observeAll()

    suspend fun get(id: String): Account? = dao.getById(id)

    suspend fun save(draft: AccountDraft, editingId: String?): SaveResult {
        val check = Iban.validate(draft.iban)
        if (!check.isValid) return SaveResult.InvalidIban(check)

        val existing = dao.findByIban(check.electronic)
        if (existing != null && existing.id != editingId) return SaveResult.Duplicate(existing)

        val now = System.currentTimeMillis()
        val previous = editingId?.let { dao.getById(it) }
        val account = Account(
            id = editingId ?: UUID.randomUUID().toString(),
            iban = check.electronic,
            titolare = cleanText(draft.titolare, 80),
            banca = cleanText(draft.banca, 80),
            bic = Iban.normalize(draft.bic).take(11),
            alias = cleanText(draft.alias, 60),
            note = cleanText(draft.note, 500),
            causale = cleanText(draft.causale, 200),
            isFavorite = draft.isFavorite,
            // Un conto nuovo finisce in fondo all'elenco; in modifica l'ordine resta quello scelto a mano.
            sortOrder = previous?.sortOrder ?: nextSortOrder(),
            createdAt = previous?.createdAt ?: now,
            lastUsedAt = previous?.lastUsedAt ?: now,
        )
        // Nessuna delete+insert: si aggiorna la riga esistente, così un guasto
        // durante il salvataggio non può cancellare il conto.
        if (previous != null) {
            dao.update(account)
        } else {
            dao.insert(account)
        }
        return SaveResult.Saved(account)
    }

    suspend fun delete(id: String) = dao.delete(id)

    suspend fun touch(id: String) = dao.touch(id, System.currentTimeMillis())

    suspend fun setFavorite(account: Account, favorite: Boolean) {
        dao.update(account.copy(isFavorite = favorite))
    }

    /**
     * Riordina le schede. `visibleOrder` sono gli id nell'ordine appena trascinato;
     * se l'elenco era filtrato, i conti non visibili tengono il loro posto e quelli
     * visibili scorrono dentro le posizioni che già occupavano.
     */
    suspend fun reorderAccounts(visibleOrder: List<String>) {
        val all = dao.getAll().sortedWith(AccountFilter.comparator)
        val merged = AccountFilter.mergeOrder(all.map { it.id }, visibleOrder)
        writeOrder(merged)
    }

    /** Sposta un conto di una posizione su o giù nell'elenco. */
    suspend fun moveAccount(id: String, up: Boolean) {
        val all = dao.getAll().sortedWith(AccountFilter.comparator)
        val index = all.indexOfFirst { it.id == id }
        if (index < 0) return
        val target = if (up) index - 1 else index + 1
        if (target !in all.indices) return
        val order = all.map { it.id }.toMutableList()
        order.add(target, order.removeAt(index))
        writeOrder(order)
    }

    /** Scrive l'ordine nuovo, toccando solo i conti la cui posizione cambia. */
    private suspend fun writeOrder(orderedIds: List<String>) {
        val byId = dao.getAll().associateBy { it.id }
        orderedIds.forEachIndexed { index, id ->
            val account = byId[id] ?: return@forEachIndexed
            if (account.sortOrder != index) dao.updateSortOrder(id, index)
        }
    }

    /** Posizione per un conto nuovo: dopo tutti gli altri. */
    private suspend fun nextSortOrder(): Int =
        (dao.getAll().maxOfOrNull { it.sortOrder }?.plus(1)) ?: 0

    suspend fun allAccounts(): List<Account> =
        dao.getAll().sortedWith(AccountFilter.comparator)

    /** Sostituisce tutti i conti (import backup, ripristino dati precedenti). */
    suspend fun replaceAll(accounts: List<Account>) {
        dao.replaceAll(accounts)
    }

    suspend fun resetAll() {
        dao.deleteAll()
    }

    private fun cleanText(value: String, max: Int): String =
        value.replace(Regex("[\\u0000-\\u001F\\u007F]"), " ")
            .replace(Regex("[\\s\\u00A0\\u202F\\u200B\\uFEFF]+"), " ")
            .trim()
            .take(max)
}

/** Ricerca, filtri e ordinamento, come in src/core/model.js della PWA. */
object AccountFilter {
    data class Filter(val query: String = "", val favoritesOnly: Boolean = false)

    /**
     * Ordinamento di presentazione: l'ordine manuale scelto dall'utente comanda,
     * con il nome solo a parità di posizione. I preferiti non galleggiano più in
     * cima: il chip «Preferiti» mostra solo quelli, ma l'ordine resta deciso a mano.
     */
    val comparator: Comparator<Account> =
        compareBy<Account> { it.sortOrder }
            .thenBy(String.CASE_INSENSITIVE_ORDER) { it.displayName }
            .thenBy { it.iban }

    fun apply(accounts: List<Account>, filter: Filter): List<Account> {
        val q = filter.query.trim().lowercase()
        return accounts
            .asSequence()
            .filter { !filter.favoritesOnly || it.isFavorite }
            .filter { a ->
                q.isEmpty() || listOf(a.alias, a.titolare, a.banca, a.note, a.iban)
                    .any { it.lowercase().contains(q) }
            }
            .sortedWith(comparator)
            .toList()
    }

    /**
     * Fonde il nuovo ordine delle schede visibili con l'elenco completo:
     * i conti non mostrati dai filtri tengono la loro posizione, quelli visibili
     * vengono distribuiti, nel nuovo ordine, dentro le posizioni che occupavano.
     * Senza filtri l'elenco visibile è l'elenco completo, quindi il risultato è
     * esattamente l'ordine trascinato.
     */
    fun mergeOrder(allIds: List<String>, visibleOrder: List<String>): List<String> {
        val known = allIds.toHashSet()
        val visible = visibleOrder.filter { it in known }.distinct()
        val visibleSet = visible.toHashSet()
        val queue = ArrayDeque(visible)
        return allIds.map { id -> if (id in visibleSet) queue.removeFirst() else id }
    }
}
