package it.mioiban.app

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import it.mioiban.app.data.AppDatabase
import it.mioiban.app.data.Prefs
import it.mioiban.app.data.Repository

/** Contenitore dell'app: database, repository e preferenze condivisi. */
class MioIbanApp : Application() {
    lateinit var repository: Repository
        private set
    lateinit var prefs: Prefs
        private set

    override fun onCreate() {
        super.onCreate()
        repository = Repository(AppDatabase.get(this))
        prefs = Prefs(this)
        applyLanguage(prefs.language)
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
