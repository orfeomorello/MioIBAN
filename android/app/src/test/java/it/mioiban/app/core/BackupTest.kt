package it.mioiban.app.core

import it.mioiban.app.data.Account
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupTest {

    private val account = Account(
        id = "a1",
        iban = "IT60X0542811101000000123456",
        titolare = "Mario Rossi",
        banca = "Banca Esempio",
        alias = "Affitto",
        isFavorite = true,
        createdAt = 1L,
        lastUsedAt = 2L,
    )

    @Test
    fun roundTripKeepsAccountsAndPreferences() {
        val json = Backup.write(
            accounts = listOf(account),
            preferences = mapOf("tema" to "dark"),
            appVersion = "1.0.0",
            exportedAt = 10L,
        )
        val result = Backup.read(json)
        assertTrue(result is Backup.ParseResult.Ok)
        val ok = result as Backup.ParseResult.Ok
        assertEquals(account.iban, ok.accounts.single().iban)
        assertEquals("Affitto", ok.accounts.single().alias)
        assertEquals("dark", ok.preferences["tema"])
    }

    @Test
    fun roundTripKeepsManualOrder() {
        // Ordine manuale impostato col trascinamento: il backup lo deve conservare.
        val first = account.copy(id = "a1", alias = "Zeta", sortOrder = 2)
        val second = account.copy(id = "a2", iban = "GB82WEST12345698765432", alias = "Alfa", sortOrder = 1)
        val json = Backup.write(
            accounts = listOf(first, second),
            preferences = emptyMap(),
            appVersion = "1.0.1",
            exportedAt = 10L,
        )
        val ok = Backup.read(json) as Backup.ParseResult.Ok
        // L'ordine di scrittura è quello di visualizzazione (Repository.allAccounts).
        assertEquals(listOf("Zeta", "Alfa"), ok.accounts.map { it.alias })
        assertEquals(2, ok.accounts[0].sortOrder)
        assertEquals(1, ok.accounts[1].sortOrder)
    }

    @Test
    fun missingSortOrderDefaultsToZero() {
        // I backup della PWA non hanno sortOrder: devono importarsi senza errori.
        val json = """{"app":"MioIBAN","schemaVersion":2,"accounts":[
            {"id":"x","iban":"IT60X0542811101000000123456"}]}"""
        val ok = Backup.read(json) as Backup.ParseResult.Ok
        assertEquals(0, ok.accounts.single().sortOrder)
    }

    @Test
    fun newerSchemaIsRejected() {
        val json = """{"app":"MioIBAN","schemaVersion":99,"accounts":[]}"""
        assertEquals(Backup.ParseResult.Error("backup_newer"), Backup.read(json))
    }

    @Test
    fun otherAppBackupIsRejected() {
        assertEquals(
            Backup.ParseResult.Error("backup_invalid"),
            Backup.read("""{"app":"AltraApp","schemaVersion":2,"accounts":[]}"""),
        )
    }

    @Test
    fun notABackupIsRejected() {
        assertEquals(Backup.ParseResult.Error("backup_invalid"), Backup.read("{}"))
        assertEquals(Backup.ParseResult.Error("backup_invalid"), Backup.read("non json"))
    }

    @Test
    fun invalidAccountIsSkippedNotFatal() {
        val json = """{"app":"MioIBAN","schemaVersion":2,"accounts":[
            {"id":"x","iban":"IT00X0000000000000000000000"},
            {"id":"y","iban":"IT60X0542811101000000123456"}]}"""
        val ok = Backup.read(json) as Backup.ParseResult.Ok
        assertEquals(1, ok.accounts.size)
        assertEquals(1, ok.skipped)
    }

    @Test
    fun pwaExportWithoutAppKeyIsAccepted() {
        // Forma reale dell'export PWA (src/core/storage.js exportState): niente `app`,
        // usa `exportDate`; i campi di gruppo della PWA vengono ignorati.
        val json = """{
            "schemaVersion": 2,
            "exportDate": "2025-01-10T09:30:00.000Z",
            "appVersion": "1.0.0",
            "accounts": [{
                "id": "pwa-1", "iban": "IT60X0542811101000000123456",
                "titolare": "Mario Rossi", "banca": "Banca Esempio", "bic": "",
                "alias": "Affitto", "note": "", "groupId": null,
                "isFavorite": true, "createdAt": 1700000000000, "lastUsedAt": 1700000000001
            }],
            "groups": [{"id": "g1", "name": "Casa"}],
            "preferences": {"tema": "dark", "fontSize": "large", "lang": "it", "onboardingCompleted": true}
        }"""
        val ok = Backup.read(json) as Backup.ParseResult.Ok
        assertEquals("Affitto", ok.accounts.single().alias)
        assertEquals("IT60X0542811101000000123456", ok.accounts.single().iban)
        assertEquals("dark", ok.preferences["tema"])
        assertEquals(0, ok.skipped)
    }

    @Test
    fun duplicateIbanIsSkipped() {
        val json = """{"app":"MioIBAN","schemaVersion":2,"accounts":[
            {"id":"a","iban":"IT60X0542811101000000123456"},
            {"id":"b","iban":"IT60 X054 2811 1010 0000 0123 456"}]}"""
        val ok = Backup.read(json) as Backup.ParseResult.Ok
        assertEquals(1, ok.accounts.size)
        assertEquals(1, ok.skipped)
    }

    @Test
    fun exportIncludesExportDate() {
        val json = Backup.write(emptyList(), emptyMap(), "1.0.0", 0L)
        assertTrue(json.contains("\"exportDate\""))
    }

    @Test
    fun extractsValidIbanFromMessage() {
        val text = "Ciao, il mio IBAN è IT60 X054 2811 1010 0000 0123 456, fammi sapere!"
        val found = Extract.candidates(text)
        assertEquals(1, found.size)
        assertEquals("IT60X0542811101000000123456", found.single().electronic)
    }

    @Test
    fun ignoresInvalidAndDuplicateCandidates() {
        // Ultimo candidato: ultima cifra alterata, quindi mod-97 non valido e scartato.
        val text = "IT60X0542811101000000123456 e di nuovo IT60X0542811101000000123456 ma anche IT60X0542811101000000123457"
        assertEquals(1, Extract.candidates(text).size)
    }

    @Test
    fun tooLongTextIsRejected() {
        val text = "a".repeat(Extract.MAX_TEXT_CHARS + 1)
        assertTrue(Extract.tooLong(text))
        assertEquals(0, Extract.candidates(text).size)
    }
}
