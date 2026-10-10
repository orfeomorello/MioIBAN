package it.mioiban.app

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import it.mioiban.app.data.AppDatabase
import it.mioiban.app.data.LegacyImport
import it.mioiban.app.data.Prefs
import it.mioiban.app.data.Repository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Contenitore dell'app: database, repository e preferenze condivisi. */
class MioIbanApp : Application() {

    lateinit var repository: Repository
        private set
    lateinit var prefs: Prefs
        private set

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        // Room apre il file solo al primo accesso: costruire l'istanza qui non tocca i dati.
        repository = Repository(AppDatabase.get(this).accounts())
        prefs = Prefs(this)
        applyLanguage(prefs.language)
        recoverPreviousAccounts()
    }

    /**
     * Al primo avvio dopo un cambio di schema, Room sostituisce il database.
     * Recuperiamo prima i conti dal file vecchio e li riscriviamo, così un
     * aggiornamento non cancella nulla.
     */
    private fun recoverPreviousAccounts() {
        if (prefs.dbVersion == AppDatabase.VERSION) return
        appScope.launch {
            val recovered = LegacyImport.recover(applicationContext, repository, prefs)
            if (recovered > 0) {
                withContext(Dispatchers.Main) {
                    android.widget.Toast.makeText(
                        applicationContext,
                        getString(R.string.legacy_recovered, recovered),
                        android.widget.Toast.LENGTH_LONG,
                    ).show()
                }
            }
        }
    }

    companion object {
        /** Applica la lingua scelta: "it" o "en". Per "system" non si fa nulla. */
        fun applyLanguage(code: String) {
            val locales = when (code) {
                "it", "en" -> LocaleListCompat.forLanguageTags(code)
                else -> LocaleListCompat.getEmptyLocaleList()
            }
            AppCompatDelegate.setApplicationLocales(locales)
        }
    }
}
