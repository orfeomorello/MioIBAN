package it.mioiban.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

// Versione 4: lo schema è cambiato rispetto alla versione 3 installata in precedenza
// (rimossi i gruppi). Senza un aumento di versione Room rifiuta di aprire il vecchio file.
@Database(entities = [Account::class], version = 4, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun accounts(): AccountDao

    companion object {
        /** Deve corrispondere al `version` dell'annotazione [Database]. */
        const val VERSION = 4

        @Volatile
        private var instance: AppDatabase? = null

        fun get(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "mioiban.db",
                )
                    // Il database precedente (con i gruppi) viene sostituito: l'app
                    // recupera prima i conti con LegacyImport, così non si perde niente.
                    .fallbackToDestructiveMigration()
                    .build().also { instance = it }
            }
    }
}
