package it.mioiban.app.core

import it.mioiban.app.data.Account
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

/**
 * Formato di backup condiviso con la PWA (MioIBAN-SPEC.md §6).
 *
 * Lettura compatibile con i file della PWA:
 *  - la chiave `app` è facoltativa (la PWA non la scrive);
 *  - la data può essere `exportDate` (ISO della PWA) oppure `exportedAt`;
 *  - un conto non valido o duplicato viene SALTATO e conteggiato, non blocca l'import.
 *
 * Scrittura: il file contiene anche `exportDate`, così la PWA lo legge senza differenze.
 */
object Backup {

    const val SCHEMA_VERSION = 2
    const val APP_NAME = "MioIBAN"

    sealed interface ParseResult {
        data class Ok(
            val accounts: List<Account>,
            val preferences: Map<String, Any?>,
            /** Conti del file che non sono stati importati (IBAN non valido o duplicato). */
            val skipped: Int,
        ) : ParseResult

        data class Error(val reason: String) : ParseResult
    }

    fun write(
        accounts: List<Account>,
        preferences: Map<String, Any>,
        appVersion: String,
        exportedAt: Long,
    ): String {
        val root = JSONObject()
        root.put("app", APP_NAME)
        root.put("appVersion", appVersion)
        root.put("schemaVersion", SCHEMA_VERSION)
        root.put("exportDate", Instant.ofEpochMilli(exportedAt).toString())

        val accountsJson = JSONArray()
        for (a in accounts) {
            accountsJson.put(
                JSONObject()
                    .put("id", a.id)
                    .put("iban", a.iban)
                    .put("titolare", a.titolare)
                    .put("banca", a.banca)
                    .put("bic", a.bic)
                    .put("alias", a.alias)
                    .put("note", a.note)
                    .put("causale", a.causale)
                    .put("isFavorite", a.isFavorite)
                    .put("sortOrder", a.sortOrder)
                    .put("createdAt", a.createdAt)
                    .put("lastUsedAt", a.lastUsedAt),
            )
        }
        root.put("accounts", accountsJson)

        val prefs = JSONObject()
        for ((k, v) in preferences) prefs.put(k, v)
        root.put("preferences", prefs)

        return root.toString(2)
    }

    /**
     * Legge un backup (Android o PWA). Rifiuta solo ciò che non è un backup
     * di MioIBAN o che è stato creato da una versione più recente.
     */
    fun read(json: String): ParseResult {
        val root = try {
            JSONObject(json)
        } catch (e: Exception) {
            return ParseResult.Error("backup_invalid")
        }

        // `app` può mancare nei file della PWA; se c'è, deve essere MioIBAN.
        if (root.has("app") && root.optString("app") != APP_NAME) {
            return ParseResult.Error("backup_invalid")
        }
        if (!root.has("schemaVersion")) return ParseResult.Error("backup_invalid")
        val version = root.optInt("schemaVersion", -1)
        if (version < 1) return ParseResult.Error("backup_invalid")
        if (version > SCHEMA_VERSION) return ParseResult.Error("backup_newer")

        val accountsJson = root.optJSONArray("accounts") ?: return ParseResult.Error("backup_invalid")

        val now = System.currentTimeMillis()
        val accounts = mutableListOf<Account>()
        val seenIban = HashSet<String>()
        var skipped = 0
        for (i in 0 until accountsJson.length()) {
            val a = accountsJson.optJSONObject(i)
            if (a == null) {
                skipped += 1
                continue
            }
            val check = Iban.validate(a.optString("iban"))
            if (!check.isValid || !seenIban.add(check.electronic)) {
                skipped += 1
                continue
            }
            accounts += Account(
                id = a.optString("id").ifBlank { UUID.randomUUID().toString() },
                iban = check.electronic,
                titolare = a.optString("titolare"),
                banca = a.optString("banca"),
                bic = a.optString("bic").uppercase(),
                alias = a.optString("alias"),
                note = a.optString("note"),
                causale = a.optString("causale"),
                isFavorite = a.optBoolean("isFavorite", false),
                sortOrder = a.optInt("sortOrder", 0),
                createdAt = a.optLong("createdAt", now),
                lastUsedAt = a.optLong("lastUsedAt", now),
            )
        }

        val prefs = mutableMapOf<String, Any?>()
        root.optJSONObject("preferences")?.let { p ->
            for (key in p.keys()) {
                val value = p.opt(key)
                prefs[key] = if (value == JSONObject.NULL) null else value
            }
        }

        return ParseResult.Ok(accounts, prefs, skipped)
    }
}
