package it.mioiban.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class IbanTest {

    @Test
    fun cinReferenceVector() {
        // Vettore della specifica §4.6: IT60X0542811101000000123456 -> CIN 'X'.
        assertEquals('X', Iban.computeCin("0542811101000000123456"))
    }

    @Test
    fun validItalianIbanWithCin() {
        val r = Iban.validate("IT60 X054 2811 1010 0000 0123 456")
        assertTrue(r.isValid)
        assertEquals(IbanCode.VALID_WITH_CIN, r.code)
        assertEquals("IT60X0542811101000000123456", r.electronic)
        assertEquals("IT60 X054 2811 1010 0000 0123 456", r.formatted)
    }

    @Test
    fun wrongCinIsDetected() {
        // Stesso IBAN ma CIN 'Y' invece di 'X': cifre di controllo ricalcolate.
        val r = Iban.validate("IT60Y0542811101000000123456")
        assertFalse(r.isValid)
    }

    @Test
    fun invisibleCharactersAreRemoved() {
        val r = Iban.validate("IT60\u00A0X054\u200B2811101000000123456")
        assertTrue(r.isValid)
    }

    @Test
    fun emptyInput() {
        assertEquals(IbanCode.EMPTY, Iban.validate("   ").code)
    }

    @Test
    fun wrongChecksumIsRejected() {
        // GB82WEST12345698765432 e' il valido di riferimento; alterata l'ultima cifra fallisce.
        assertTrue(Iban.validate("GB82WEST12345698765432").isValid)
        assertEquals(IbanCode.CHECKSUM, Iban.validate("GB82WEST12345698765433").code)
    }

    @Test
    fun cinNegativeVectorIsRejected() {
        // Vettore negativo della PWA (test/cin-vectors.js): mod-97 valido, CIN 'Y' errato.
        assertEquals(IbanCode.CIN_MISMATCH, Iban.validate("IT64Y0542811101000000123456").code)
    }

    @Test
    fun italianCinVectorsAreAccepted() {
        val vectors = listOf(
            "IT21Q054280160000ABCD12ZE34",
            "IT30C0800001000123VALE456NA",
            "IT11V0600003200000011556BFE",
            "IT21J0100516052120050012345",
            "IT22K4348207900DNNDKPHAGTIB",
        )
        for (v in vectors) assertTrue(v, Iban.validate(v).isValid)
    }

    @Test
    fun unknownCountryIsRejected() {
        assertEquals(IbanCode.UNKNOWN_COUNTRY, Iban.validate("US12345678901234567890").code)
    }

    @Test
    fun bicFormat() {
        assertTrue(Iban.isValidBic("BCITITMM"))
        assertTrue(Iban.isValidBic("BCITITMM123"))
        assertFalse(Iban.isValidBic("BCIT"))
    }
}
