package it.mioiban.app

import android.app.Application
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
    }
}
