package it.mioiban.app.ui.print

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import it.mioiban.app.R
import it.mioiban.app.core.Iban
import it.mioiban.app.data.Account
import java.io.File
import java.text.DateFormat
import java.util.Date

/**
 * Foglio A4 in bianco e nero con i dati del conto (SPEC §9): IBAN grande,
 * pie' di pagina con la data. Il PDF viene creato nella cache e condiviso
 * tramite FileProvider, così l'utente lo stampa o lo salva dal foglio di sistema.
 */
object PrintService {

    fun printAccount(context: Context, account: Account) {
        val file = createSheet(context, listOf(account))
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(send, context.getString(R.string.action_print)))
    }

    /** Crea il PDF con un foglio per conto. Richiamata anche per "Stampa tutti". */
    fun createSheet(context: Context, accounts: List<Account>): File {
        val dir = File(context.cacheDir, "pdf").apply { mkdirs() }
        val file = File(dir, "MioIBAN-stampa.pdf")

        val doc = PdfDocument()
        val pageWidth = 595   // A4 in punti
        val pageHeight = 842

        accounts.forEachIndexed { index, account ->
            val info = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, index + 1).create()
            val page = doc.startPage(info)
            drawAccount(page.canvas, context, account, pageWidth)
            doc.finishPage(page)
        }

        file.outputStream().use { doc.writeTo(it) }
        doc.close()
        return file
    }

    private fun drawAccount(canvas: android.graphics.Canvas, context: Context, account: Account, width: Int) {
        val black = Paint().apply { color = Color.BLACK; isAntiAlias = true }
        val margin = 56f
        var y = 110f

        black.textSize = 14f
        black.isFakeBoldText = true
        canvas.drawText(context.getString(R.string.print_title), margin, y, black)
        y += 40f

        black.isFakeBoldText = false
        black.textSize = 14f
        fun row(label: String, value: String) {
            if (value.isBlank()) return
            black.textSize = 12f
            canvas.drawText(label.uppercase(), margin, y, black)
            y += 18f
            black.textSize = 16f
            canvas.drawText(value, margin, y, black)
            y += 30f
        }
        row(context.getString(R.string.print_holder), account.titolare)
        row(context.getString(R.string.print_bank), account.banca)
        row(context.getString(R.string.print_bic), account.bic)

        y += 16f
        black.textSize = 12f
        canvas.drawText(context.getString(R.string.print_iban), margin, y, black)
        y += 28f

        // IBAN: il testo più grande della pagina, in monospace, su una riga.
        val iban = Iban.format(account.iban)
        val ibanPaint = Paint().apply {
            color = Color.BLACK
            isAntiAlias = true
            typeface = android.graphics.Typeface.MONOSPACE
            textSize = fitTextSize(iban, width - margin * 2)
        }
        canvas.drawText(iban, margin, y + 10f, ibanPaint)
        y += 90f

        black.textSize = 12f
        canvas.drawText(context.getString(R.string.print_reason), margin, y, black)
        canvas.drawLine(margin, y + 8f, width - margin, y + 8f, black)

        val footerDate = DateFormat.getDateInstance(DateFormat.LONG).format(Date())
        val footer = context.getString(R.string.print_footer, footerDate)
        black.textSize = 10f
        canvas.drawText(footer, margin, 800f, black)
    }

    /** Dimensione del testo tale che l'IBAN stia nella larghezza disponibile. */
    private fun fitTextSize(text: String, maxWidth: Float): Float {
        val probe = Paint().apply {
            typeface = android.graphics.Typeface.MONOSPACE
            textSize = 100f
        }
        val measured = probe.measureText(text)
        return (100f * maxWidth / measured).coerceIn(12f, 28f)
    }
}
