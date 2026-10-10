package it.mioiban.app.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import it.mioiban.app.core.Iban
import java.util.UUID

/**
 * Recupero dei conti dal database scritto da una versione precedente dell'app.
 *
 * Room, quando cambia lo schema, sostituisce il file del database e i conti dentro
 * sparirebbero. Questa classe legge il file vecchio **prima** che Room lo apra
 * (accesso diretto in sola lettura, senza migrazioni da indovinare) e restituisce
 * i conti da reinserire nello schema nuovo.
 *
 * È difensiva per costruzione: una colonna che non esiste (o un IBAN non valido,
 * o un id duplicato) non blocca il recupero del resto.
 */
object LegacyImport {

    private const val TAG = "LegacyImport"

    /** Colonne della tabella `accounts` nelle versioni precedenti dell'app. */
    private val COLUMNS = listOf(
        "id", "iban", "titolare", "banca", "bic", "alias", "note",
        "causale", "isFavorite", "sortOrder", "createdAt", "lastUsedAt",
    )

    /**
     * Legge i conti dal database precedente. Restituisce null se non c'è nulla da
     * recuperare: file assente (prima installazione) oppure tabella mancante.
     */
    private fun readLegacy(context: Context): List<Account>? {
        val file = context.getDatabasePath("mioiban.db")
        if (!file.exists()) return null

        var db: SQLiteDatabase? = null
        return try {
            db = SQLiteDatabase.openDatabase(file.absolutePath, null, SQLiteDatabase.OPEN_READONLY)
            val cursor = db.rawQuery("SELECT * FROM accounts", null)
            cursor.use {
                val columns = it.columnNames.toSet()
                val present = COLUMNS.filter { c -> c in columns }
                fun text(name: String): String =
                    if (name in present && !it.isNull(it.getColumnIndexOrThrow(name))) {
                        it.getString(it.getColumnIndexOrThrow(name))
                    } else {
                        ""
                    }

                fun int(name: String, default: Int): Int =
                    if (name in present && !it.isNull(it.getColumnIndexOrThrow(name))) {
                        it.getInt(it.getColumnIndexOrThrow(name))
                    } else {
                        default
                    }

                // I timestamp sono millisecondi epoch: in SQLite stanno in INTEGER (64 bit).
                fun long(name: String, default: Long): Long =
                    if (name in present && !it.isNull(it.getColumnIndexOrThrow(name))) {
                        it.getLong(it.getColumnIndexOrThrow(name))
                    } else {
                        default
                    }

                val now = System.currentTimeMillis()
                val seenIban = HashSet<String>()
                val seenIds = HashSet<String>()
                val accounts = mutableListOf<Account>()
                while (it.moveToNext()) {
                    val check = Iban.validate(text("iban"))
                    if (!check.isValid || !seenIban.add(check.electronic)) continue
                    val id = text("id").ifBlank { UUID.randomUUID().toString() }
                    if (!seenIds.add(id)) continue
                    accounts += Account(
                        id = id,
                        iban = check.electronic,
                        titolare = text("titolare").take(80),
                        banca = text("banca").take(80),
                        bic = text("bic").take(11),
                        alias = text("alias").take(60),
                        note = text("note").take(500),
                        causale = text("causale").take(200),
                        isFavorite = int("isFavorite", 0) != 0,
                        sortOrder = int("sortOrder", accounts.size),
                        createdAt = long("createdAt", now),
                        lastUsedAt = long("lastUsedAt", now),
                    )
                }
                accounts.ifEmpty { null }
            }
        } catch (e: Exception) {
            // File assente o illeggibile: prima installazione, o database mai scritto.
            Log.w(TAG, "Nessun database precedente da recuperare", e)
            null
        } finally {
            db?.close()
        }
    }

    /**
     * Recupera i conti dal database precedente, se di versione diversa da quella
     * attuale, e li riscrive nello schema nuovo. Da chiamare una sola volta,
     * prima che la UI legga i dati.
     *
     * @return quanti conti sono stati recuperati.
     */
    suspend fun recover(context: Context, repository: Repository, prefs: Prefs): Int {
        if (prefs.dbVersion == AppDatabase.VERSION) return 0
        val legacy = readLegacy(context)
        if (legacy != null) {
            try {
                // A questo punto Room sostituisce il file vuoto: i conti vecchi
                // vengono riscritti nello schema nuovo.
                repository.replaceAll(legacy)
            } catch (e: Exception) {
                Log.e(TAG, "Recupero del database precedente non riuscito", e)
            }
        }
        prefs.dbVersion = AppDatabase.VERSION
        return legacy?.size ?: 0
    }
}
