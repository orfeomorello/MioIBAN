package it.mioiban.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import it.mioiban.app.MioIbanApp
import it.mioiban.app.data.Account
import it.mioiban.app.data.AccountDraft
import it.mioiban.app.data.AccountFilter
import it.mioiban.app.data.Prefs
import it.mioiban.app.data.Repository
import it.mioiban.app.data.SaveResult
import it.mioiban.app.core.Backup
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Stato dell'elenco: conti visibili e filtri correnti. */
data class ListState(
    val accounts: List<Account> = emptyList(),
    val filter: AccountFilter.Filter = AccountFilter.Filter(),
    val totalCount: Int = 0,
)

/**
 * ViewModel unico dell'app: tiene in memoria filtri e dati, e fa da ponte
 * fra le schermate e il Repository.
 */
class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as MioIbanApp
    val repository: Repository = app.repository
    val prefs: Prefs = app.prefs

    private val filter = MutableStateFlow(AccountFilter.Filter())

    val list: StateFlow<ListState> = combine(repository.accounts, filter) { accounts, f ->
        ListState(
            accounts = AccountFilter.apply(accounts, f),
            filter = f,
            totalCount = accounts.size,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ListState())

    fun setQuery(query: String) = filter.value.let { filter.value = it.copy(query = query) }
    fun setFavoritesOnly(on: Boolean) = filter.value.let { filter.value = it.copy(favoritesOnly = on) }
    fun clearFilters() {
        filter.value = AccountFilter.Filter()
    }

    /** Salva un conto; `onResult` riceve l'esito sul thread principale. */
    fun save(draft: AccountDraft, editingId: String?, onResult: (SaveResult) -> Unit) {
        viewModelScope.launch { onResult(repository.save(draft, editingId)) }
    }

    fun touch(id: String) {
        viewModelScope.launch { repository.touch(id) }
    }

    fun toggleFavorite(account: Account) {
        viewModelScope.launch { repository.setFavorite(account, !account.isFavorite) }
    }

    fun reorderAccounts(orderedIds: List<String>) {
        viewModelScope.launch { repository.reorderAccounts(orderedIds) }
    }

    fun delete(id: String, onDone: () -> Unit) {
        viewModelScope.launch {
            repository.delete(id)
            onDone()
        }
    }

    /** Esporta il JSON completo del backup. */
    fun exportBackupJson(appVersion: String, onReady: (String, Int) -> Unit) {
        viewModelScope.launch {
            val accounts = repository.allAccounts()
            val json = Backup.write(
                accounts = accounts,
                preferences = prefs.toMap(),
                appVersion = appVersion,
                exportedAt = System.currentTimeMillis(),
            )
            onReady(json, accounts.size)
        }
    }

    /** Legge un backup e, solo se valido, prepara il riepilogo per la conferma. */
    fun inspectBackup(json: String, onResult: (Backup.ParseResult) -> Unit) = onResult(Backup.read(json))

    /** Applica un backup già confermato dall'utente: sostituzione atomica. */
    fun applyBackup(result: Backup.ParseResult.Ok, onDone: () -> Unit) {
        viewModelScope.launch {
            repository.replaceAll(result.accounts)
            prefs.restore(result.preferences)
            onDone()
        }
    }

    fun resetAll(onDone: () -> Unit) {
        viewModelScope.launch {
            repository.resetAll()
            prefs.clear()
            onDone()
        }
    }
}
