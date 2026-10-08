package it.mioiban.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import it.mioiban.app.ui.AppRoot
import it.mioiban.app.ui.theme.MioIbanTheme
import it.mioiban.app.ui.theme.ThemeChoice
import it.mioiban.app.ui.theme.textScaleFor

/**
 * Unica Activity. Dopo ogni cambio di tema o di testo la UI viene ricreata
 * con recreate(): più semplice e affidabile che ridisegnare a mano.
 */
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { AppShell() }
    }
}

@Composable
private fun AppShell() {
    val app = LocalContext.current.applicationContext as MioIbanApp
    MioIbanTheme(
        choice = ThemeChoice.from(app.prefs.theme),
        textScale = textScaleFor(app.prefs.fontSize),
    ) {
        AppRoot()
    }
}
