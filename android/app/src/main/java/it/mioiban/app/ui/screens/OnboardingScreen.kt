package it.mioiban.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import it.mioiban.app.MioIbanApp
import it.mioiban.app.R
import it.mioiban.app.ui.components.ChoiceRow
import it.mioiban.app.ui.components.SectionTitle

/** Primo avvio: lingua, tema, testo e disclaimer (SPEC §12.2). Un solo pulsante per entrare. */
@Composable
fun OnboardingScreen(onFinished: () -> Unit) {
    val app = LocalContext.current.applicationContext as MioIbanApp
    var theme by remember { mutableStateOf(app.prefs.theme) }
    var size by remember { mutableStateOf(app.prefs.fontSize) }

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(stringResource(R.string.onb_welcome), style = MaterialTheme.typography.headlineMedium)
            Text(stringResource(R.string.tagline), style = MaterialTheme.typography.titleMedium)
            Text(stringResource(R.string.privacy_line), style = MaterialTheme.typography.bodyMedium)

            SectionTitle(stringResource(R.string.onb_theme))
            ChoiceRow(
                options = listOf(
                    "light" to stringResource(R.string.theme_light),
                    "dark" to stringResource(R.string.theme_dark),
                    "auto" to stringResource(R.string.theme_auto),
                ),
                selected = theme,
                onSelect = {
                    theme = it
                    app.prefs.theme = it
                },
            )

            SectionTitle(stringResource(R.string.onb_text_size))
            ChoiceRow(
                options = listOf(
                    "normal" to stringResource(R.string.text_normal),
                    "large" to stringResource(R.string.text_large),
                    "xlarge" to stringResource(R.string.text_xlarge),
                ),
                selected = size,
                onSelect = {
                    size = it
                    app.prefs.fontSize = it
                },
            )

            SectionTitle(stringResource(R.string.onb_disclaimer_title))
            Text(stringResource(R.string.disclaimer), style = MaterialTheme.typography.bodyMedium)

            Button(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                onClick = {
                    app.prefs.onboardingCompleted = true
                    onFinished()
                },
            ) {
                Text(stringResource(R.string.onb_accept))
            }
        }
    }
}
