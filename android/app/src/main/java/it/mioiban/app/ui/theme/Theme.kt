package it.mioiban.app.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density

/** Scelta del tema: chiaro, scuro o quello del sistema. */
enum class ThemeChoice {
    LIGHT, DARK, AUTO;

    companion object {
        fun from(value: String): ThemeChoice = when (value) {
            "light" -> LIGHT
            "dark" -> DARK
            else -> AUTO
        }
    }
}

/** Scala del testo per le tre impostazioni dell'app (normale, grande, molto grande). */
fun textScaleFor(value: String): Float = when (value) {
    "large" -> 1.15f
    "xlarge" -> 1.35f
    else -> 1.0f
}

// Palette di riserva, usata sotto Android 12 (senza Material You).
private val LightColors = lightColorScheme(
    primary = Color(0xFF1D4ED8),
    secondary = Color(0xFF0F766E),
)
private val DarkColors = darkColorScheme(
    primary = Color(0xFF9DB7FF),
    secondary = Color(0xFF7DD3C7),
)

/**
 * Tema Material 3. Su Android 12+ usa i colori dinamici del sistema (Material You),
 * altrimenti la palette di riserva. La scala del testo si applica a tutta l'app.
 */
@Composable
fun MioIbanTheme(
    choice: ThemeChoice,
    textScale: Float,
    content: @Composable () -> Unit,
) {
    val dark = when (choice) {
        ThemeChoice.LIGHT -> false
        ThemeChoice.DARK -> true
        ThemeChoice.AUTO -> isSystemInDarkTheme()
    }
    val context = LocalContext.current
    val colors = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> DarkColors
        else -> LightColors
    }

    val density = LocalDensity.current
    CompositionLocalProvider(
        LocalDensity provides Density(density.density, density.fontScale * textScale),
    ) {
        MaterialTheme(colorScheme = colors, content = content)
    }
}
