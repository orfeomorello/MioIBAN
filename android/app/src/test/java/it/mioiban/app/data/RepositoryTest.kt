package it.mioiban.app.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Test del Repository con un DAO in memoria. Prima il Repository era legato alla
 * classe concreta `AppDatabase`, quindi non era testabile: questi test coprono i
 * comportamenti che riguardano i dati dell'utente (ordine, preferiti, modifiche).
 */
class RepositoryTest {

    private val ibanA = "IT60X0542811101000000123456"
    private val ibanB = "GB82WEST12345698765432"
    private val ibanC = "IT21Q054280160000ABCD12ZE34"

    /** DAO in memoria: stessa interfaccia di Room, nessun database. */
    private class FakeAccountDao : AccountDao {
        private val items = mutableListOf<Account>()
        private val state = MutableStateFlow<List<Account>>(emptyList())

        /** Numero di chiamate per tipo: serve a verificare che non si facciano delete+insert. */
        var updates = 0
        var inserts = 0
        var deletes = 0

        private fun publish() {
            state.value = items.toList()
        }

        override fun observeAll(): Flow<List<Account>> = state

        override suspend fun getAll(): List<Account> = items.toList()

        override suspend fun getById(id: String): Account? = items.firstOrNull { it.id == id }

        override suspend fun findByIban(iban: String): Account? = items.firstOrNull { it.iban == iban }

        override suspend fun insert(account: Account) {
            require(items.none { it.id == account.id }) { "id duplicato: $account.id" }
            inserts += 1
            items += account
            publish()
        }

        override suspend fun update(account: Account) {
            updates += 1
            val index = items.indexOfFirst { it.id == account.id }
            check(index >= 0) { "update di un conto inesistente: ${account.id}" }
            items[index] = account
            publish()
        }

        override suspend fun touch(id: String, time: Long) {
            val index = items.indexOfFirst { it.id == id }
            if (index >= 0) items[index] = items[index].copy(lastUsedAt = time)
            publish()
        }

        override suspend fun updateSortOrder(id: String, sortOrder: Int) {
            val index = items.indexOfFirst { it.id == id }
            if (index >= 0) items[index] = items[index].copy(sortOrder = sortOrder)
            publish()
        }

        override suspend fun delete(id: String) {
            deletes += 1
            items.removeAll { it.id == id }
            publish()
        }

        override suspend fun deleteAll() {
            deletes += 1
            items.clear()
            publish()
        }

        override suspend fun replaceAll(accounts: List<Account>) {
            items.clear()
            items += accounts
            publish()
        }
    }

    private fun draft(iban: String, alias: String) = AccountDraft(iban = iban, alias = alias)

    private fun repo(): Pair<Repository, FakeAccountDao> {
        val dao = FakeAccountDao()
        return Repository(dao) to dao
    }

    /** Ordine che vede l'utente con il filtro Preferiti attivo. */
    private suspend fun Repository.favoritesAliases(): List<String> =
        AccountFilter.apply(accounts.first(), AccountFilter.Filter(favoritesOnly = true)).map { it.alias }

    @Test
    fun newAccountGoesToTheEndNotInAlphabeticalOrder() = runBlocking {
        val (repository, _) = repo()
        repository.save(draft(ibanA, "Zeta"), editingId = null)
        repository.save(draft(ibanB, "Alfa"), editingId = null)
        repository.save(draft(ibanC, "Mario"), editingId = null)

        val accounts = repository.allAccounts()
        assertEquals(listOf("Zeta", "Alfa", "Mario"), accounts.map { it.alias })
    }

    @Test
    fun favoriteDoesNotMoveTheAccount() = runBlocking {
        val (repository, _) = repo()
        repository.save(draft(ibanA, "Zeta"), editingId = null)
        val alfa = (repository.save(draft(ibanB, "Alfa"), editingId = null) as SaveResult.Saved).account

        repository.setFavorite(alfa, true)

        // Il preferito resta dov'è: l'ordine lo decide solo l'utente.
        assertEquals(listOf("Zeta", "Alfa"), repository.allAccounts().map { it.alias })
        assertTrue(repository.allAccounts().single { it.alias == "Alfa" }.isFavorite)
    }

    @Test
    fun editKeepsIdPositionAndTimestamp() = runBlocking {
        val (repository, dao) = repo()
        val zeta = (repository.save(draft(ibanA, "Zeta"), editingId = null) as SaveResult.Saved).account
        repository.save(draft(ibanB, "Alfa"), editingId = null)

        repository.save(draft(ibanA, "Zeta Cambiato"), editingId = zeta.id)

        val accounts = repository.allAccounts()
        assertEquals(listOf("Zeta Cambiato", "Alfa"), accounts.map { it.alias })
        assertEquals(zeta.id, accounts.first().id)
        assertEquals(zeta.createdAt, accounts.first().createdAt)
        // Nessuna delete+insert: una modifica è un solo UPDATE.
        assertEquals(0, dao.deletes)
        assertTrue(dao.updates >= 1)
    }

    @Test
    fun reorderWritesNewOrder() = runBlocking {
        val (repository, _) = repo()
        val zeta = (repository.save(draft(ibanA, "Zeta"), editingId = null) as SaveResult.Saved).account
        val alfa = (repository.save(draft(ibanB, "Alfa"), editingId = null) as SaveResult.Saved).account
        val mario = (repository.save(draft(ibanC, "Mario"), editingId = null) as SaveResult.Saved).account

        repository.reorderAccounts(listOf(mario.id, alfa.id, zeta.id))

        assertEquals(
            listOf("Mario", "Alfa", "Zeta"),
            repository.allAccounts().map { it.alias },
        )
    }

    @Test
    fun reorderWhileFilteredKeepsHiddenAccountsInTheirSlots() = runBlocking {
        val (repository, _) = repo()
        val a = (repository.save(draft(ibanA, "Primo"), editingId = null) as SaveResult.Saved).account
        val b = (repository.save(draft(ibanB, "Secondo"), editingId = null) as SaveResult.Saved).account
        val c = (repository.save(draft(ibanC, "Terzo"), editingId = null) as SaveResult.Saved).account

        // Filtro Preferiti attivo: si vedono solo "b" e "c" (qui b e c preferiti).
        repository.setFavorite(b, true)
        repository.setFavorite(c, true)
        repository.reorderAccounts(listOf(c.id, b.id))

        // "a" resta al suo posto; "b" e "c" si scambiano le posizioni.
        assertEquals(listOf("Primo", "Terzo", "Secondo"), repository.allAccounts().map { it.alias })
        // Con il filtro Preferiti attivo si vede il nuovo ordine scelto.
        assertEquals(listOf("Terzo", "Secondo"), repository.favoritesAliases())
    }

    @Test
    fun moveSwapsWithTheNeighbour() = runBlocking {
        val (repository, _) = repo()
        val primo = (repository.save(draft(ibanA, "Primo"), editingId = null) as SaveResult.Saved).account
        repository.save(draft(ibanB, "Secondo"), editingId = null)
        repository.save(draft(ibanC, "Terzo"), editingId = null)

        repository.moveAccount(primo.id, up = false)
        assertEquals(listOf("Secondo", "Primo", "Terzo"), repository.allAccounts().map { it.alias })

        repository.moveAccount(primo.id, up = true)
        assertEquals(listOf("Primo", "Secondo", "Terzo"), repository.allAccounts().map { it.alias })

        // Primo della lista: non si può andare più su.
        repository.moveAccount(primo.id, up = true)
        assertEquals(listOf("Primo", "Secondo", "Terzo"), repository.allAccounts().map { it.alias })
    }

    @Test
    fun duplicateIbanIsRejected() = runBlocking {
        val (repository, _) = repo()
        repository.save(draft(ibanA, "Zeta"), editingId = null)
        val result = repository.save(draft(ibanA, "Altro"), editingId = null)
        assertTrue(result is SaveResult.Duplicate)
        assertEquals(1, repository.allAccounts().size)
    }

    @Test
    fun invalidIbanIsRejected() = runBlocking {
        val (repository, _) = repo()
        val result = repository.save(draft("IT00X0000000000000000000000", "X"), editingId = null)
        assertTrue(result is SaveResult.InvalidIban)
        assertNull(repository.get("inesistente"))
    }

    @Test
    fun deleteRemovesTheAccount() = runBlocking {
        val (repository, _) = repo()
        val zeta = (repository.save(draft(ibanA, "Zeta"), editingId = null) as SaveResult.Saved).account
        repository.delete(zeta.id)
        assertEquals(0, repository.allAccounts().size)
    }
}
