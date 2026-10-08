package it.mioiban.app.data

import android.content.Context

/**
 * Preferenze locali (equivalente di localStorage della PWA, SPEC §3 regola 2).
 * Tutto il progetto legge e scrive le preferenze solo da qui.
 */
class Prefs(context: Context) {
    private val sp = context.applicationContext
        .getSharedPreferences("mioiban_prefs", Context.MODE_PRIVATE)

    var theme: String
        get() = sp.getString("tema", "light") ?: "light"
        set(value) = sp.edit().putString("tema", value).apply()

    var fontSize: String
        get() = sp.getString("fontSize", "normal") ?: "normal"
        set(value) = sp.edit().putString("fontSize", value).apply()

    /** Lingua scelta dall'utente: "system", "it" oppure "en". */
    var language: String
        get() = sp.getString("lang", "system") ?: "system"
        set(value) = sp.edit().putString("lang", value).apply()

    var listView: String
        get() = sp.getString("vista", "schede") ?: "schede"
        set(value) = sp.edit().putString("vista", value).apply()

    var onboardingCompleted: Boolean
        get() = sp.getBoolean("onboardingCompleted", false)
        set(value) = sp.edit().putBoolean("onboardingCompleted", value).apply()

    /** Esporta le preferenze nel formato del backup (stesse chiavi della PWA). */
    fun toMap(): Map<String, Any> = mapOf(
        "tema" to theme,
        "fontSize" to fontSize,
        "lang" to language,
        "vista" to listView,
        "onboardingCompleted" to onboardingCompleted,
    )

    /** Ripristina le preferenze da un backup; le chiavi sconosciute vengono ignorate. */
    fun restore(values: Map<String, Any?>) {
        values["tema"]?.let { if (it in listOf("light", "dark", "auto")) theme = it.toString() }
        values["fontSize"]?.let { if (it in listOf("normal", "large", "xlarge")) fontSize = it.toString() }
        values["lang"]?.let { if (it is String) language = it }
        values["vista"]?.let { if (it in listOf("schede", "righe")) listView = it.toString() }
        values["onboardingCompleted"]?.let { if (it is Boolean) onboardingCompleted = it }
    }

    fun clear() = sp.edit().clear().apply()
}
