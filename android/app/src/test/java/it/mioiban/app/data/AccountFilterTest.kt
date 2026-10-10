package it.mioiban.app.data

import org.junit.Assert.assertEquals
import org.junit.Test

class AccountFilterTest {

    private fun account(
        id: String,
        alias: String,
        sortOrder: Int = 0,
        favorite: Boolean = false,
    ) = Account(
        id = id,
        iban = "IT60X05428111010000001234${id.padStart(2, '0')}",
        alias = alias,
        sortOrder = sortOrder,
        isFavorite = favorite,
        createdAt = 1L,
        lastUsedAt = 1L,
    )

    @Test
    fun manualOrderBeatsAlphabetical() {
        val list = listOf(
            account("a", "Zeta", sortOrder = 0),
            account("b", "Alfa", sortOrder = 1),
            account("c", "Mario", sortOrder = 2),
        )
        val sorted = AccountFilter.apply(list, AccountFilter.Filter())
        assertEquals(listOf("Zeta", "Alfa", "Mario"), sorted.map { it.alias })
    }

    @Test
    fun favoritesFollowManualOrder() {
        // Il preferito NON sale in cima: l'utente ha scelto l'ordine con le sue mani.
        val list = listOf(
            account("a", "Zeta", sortOrder = 0),
            account("b", "Alfa", sortOrder = 1, favorite = true),
        )
        val sorted = AccountFilter.apply(list, AccountFilter.Filter())
        assertEquals(listOf("Zeta", "Alfa"), sorted.map { it.alias })
    }

    @Test
    fun sameOrderFallsBackToName() {
        val list = listOf(
            account("a", "Zeta", sortOrder = 0),
            account("b", "Alfa", sortOrder = 0),
        )
        val sorted = AccountFilter.apply(list, AccountFilter.Filter())
        assertEquals(listOf("Alfa", "Zeta"), sorted.map { it.alias })
    }

    @Test
    fun queryFiltersAcrossFields() {
        val list = listOf(
            account("a", "Affitto Milano"),
            account("b", "Spesa condominio"),
        )
        val filter = AccountFilter.Filter(query = "affitto")
        val sorted = AccountFilter.apply(list, filter)
        assertEquals(listOf("Affitto Milano"), sorted.map { it.alias })
    }

    @Test
    fun favoritesOnlyFilter() {
        val list = listOf(
            account("a", "Uno", sortOrder = 0),
            account("b", "Due", sortOrder = 1, favorite = true),
        )
        val sorted = AccountFilter.apply(list, AccountFilter.Filter(favoritesOnly = true))
        assertEquals(listOf("Due"), sorted.map { it.alias })
    }

    @Test
    fun mergeOrderKeepsHiddenAccountsInTheirSlots() {
        // Riordino con il filtro Preferiti attivo: solo "a" e "c" erano visibili,
        // nell'ordine nuovo [c, a]. "b" resta al suo posto.
        val merged = AccountFilter.mergeOrder(listOf("a", "b", "c"), listOf("c", "a"))
        assertEquals(listOf("c", "b", "a"), merged)
    }

    @Test
    fun mergeOrderWithoutFiltersReturnsTheNewOrder() {
        val all = listOf("a", "b", "c")
        // Senza filtri l'elenco visibile è tutto: il nuovo ordine vale per tutti.
        assertEquals(
            listOf("c", "b", "a"),
            AccountFilter.mergeOrder(all, listOf("c", "b", "a")),
        )
    }

    @Test
    fun mergeOrderIgnoresUnknownIds() {
        val merged = AccountFilter.mergeOrder(listOf("a", "b"), listOf("b", "x", "a"))
        assertEquals(listOf("b", "a"), merged)
    }
}
