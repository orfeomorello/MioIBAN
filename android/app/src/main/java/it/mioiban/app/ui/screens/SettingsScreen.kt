package it.mioiban.app.ui.screens

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import it.mioiban.app.BuildConfig
import it.mioiban.app.MioIbanApp
import it.mioiban.app.R
import it.mioiban.app.core.Backup
import it.mioiban.app.ui.MainViewModel
import it.mioiban.app.ui.components.ChoiceRow
import it.mioiban.app.ui.components.SectionTitle
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(vm: MainViewModel, onBack: () -> Unit) {
    val context = LocalContext.current
    val app = context.applicationContext as MioIbanApp
    val listState by vm.list.collectAsState()

    var theme by remember { mutableStateOf(app.prefs.theme) }
    var size by remember { mutableStateOf(app.prefs.fontSize) }
    var newGroup by remember { mutableStateOf("") }
    var pendingImport by remember { mutableStateOf<Backup.ParseResult.Ok?>(null) }
    var pendingImportCount by remember { mutableStateOf(0) }
    var confirmReset by remember { mutableStateOf(false) }
    var importError by remember { mutableStateOf<String?>(null) }

    // Esportazione: il JSON viene scritto nel file scelto dall'utente (SAF, nessuna rete).
    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json"),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        vm.exportBackupJson(BuildConfig.VERSION_NAME) { json, count ->
            context.contentResolver.openOutputStream(uri)?.use { it.write(json.toByteArray()) }
            Toast.makeText(context, context.getString(R.string.settings_export_done), Toast.LENGTH_LONG).show()
        }
    }

    // Importazione: si legge il file, si mostra il riepilogo, si applica solo con conferma.
    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val text = context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
        if (text == null) {
            importError = context.getString(R.string.backup_invalid)
            return@rememberLauncherForActivityResult
        }
        vm.inspectBackup(text) { result ->
            when (result) {
                is Backup.ParseResult.Ok -> {
                    importError = null
                    pendingImport = result
                    pendingImportCount = listState.totalCount
                }
                is Backup.ParseResult.Error -> importError = context.getString(
                    when (result.reason) {
                        "backup_newer" -> R.string.backup_newer
                        "backup_incomplete" -> R.string.backup_incomplete
                        else -> R.string.backup_invalid
                    },
                )
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.action_settings)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = stringResource(R.string.action_back))
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            SectionTitle(stringResource(R.string.settings_appearance))
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
                    (context as? Activity)?.recreate()
                },
            )

            SectionTitle(stringResource(R.string.settings_text))
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
                    (context as? Activity)?.recreate()
                },
            )

            SectionTitle(stringResource(R.string.settings_groups))
            Text(stringResource(R.string.settings_groups_hint), style = MaterialTheme.typography.bodySmall)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = newGroup,
                    onValueChange = { newGroup = it.take(40) },
                    placeholder = { Text(stringResource(R.string.settings_group_placeholder)) },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                Button(onClick = {
                    vm.addGroup(newGroup)
                    newGroup = ""
                }) { Text(stringResource(R.string.settings_group_add)) }
            }
            val groups = vm.list.collectAsState().value.groups
            if (groups.isEmpty()) {
                Text(stringResource(R.string.settings_group_empty), style = MaterialTheme.typography.bodySmall)
            }
            groups.forEach { g ->
                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Text(g.name, modifier = Modifier.weight(1f))
                    TextButton(onClick = { vm.deleteGroup(g.id) }) {
                        Text(stringResource(R.string.action_delete))
                    }
                }
            }

            SectionTitle(stringResource(R.string.settings_backup))
            Text(stringResource(R.string.settings_backup_hint), style = MaterialTheme.typography.bodySmall)
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = { exportLauncher.launch("mioiban-backup.json") },
            ) { Text(stringResource(R.string.settings_export)) }
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = { importLauncher.launch(arrayOf("application/json")) },
            ) { Text(stringResource(R.string.settings_import)) }
            importError?.let { Text(it, style = MaterialTheme.typography.bodySmall) }

            SectionTitle(stringResource(R.string.settings_reset))
            Text(stringResource(R.string.settings_reset_hint), style = MaterialTheme.typography.bodySmall)
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = { confirmReset = true },
            ) { Text(stringResource(R.string.settings_reset_btn)) }

            SectionTitle(stringResource(R.string.settings_about))
            Text(stringResource(R.string.settings_version, BuildConfig.VERSION_NAME))
            Text(stringResource(R.string.settings_privacy_hint), style = MaterialTheme.typography.bodySmall)
        }

        pendingImport?.let { ok ->
            AlertDialog(
                onDismissRequest = { pendingImport = null },
                title = { Text(stringResource(R.string.settings_import_title)) },
                text = {
                    Column {
                        Text(stringResource(R.string.settings_import_summary, ok.accounts.size, pendingImportCount))
                        if (ok.skipped > 0) {
                            Text(
                                stringResource(R.string.settings_import_skipped, ok.skipped),
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = {
                        pendingImport = null
                        vm.applyBackup(ok) {
                            Toast.makeText(context, context.getString(R.string.settings_import_done), Toast.LENGTH_LONG).show()
                        }
                    }) { Text(stringResource(R.string.settings_import_confirm)) }
                },
                dismissButton = {
                    TextButton(onClick = { pendingImport = null }) {
                        Text(stringResource(R.string.action_cancel))
                    }
                },
            )
        }

        if (confirmReset) {
            AlertDialog(
                onDismissRequest = { confirmReset = false },
                title = { Text(stringResource(R.string.settings_reset_btn)) },
                text = { Text(stringResource(R.string.settings_reset_body)) },
                confirmButton = {
                    TextButton(onClick = {
                        confirmReset = false
                        vm.resetAll { onBack() }
                    }) { Text(stringResource(R.string.settings_reset_confirm)) }
                },
                dismissButton = {
                    TextButton(onClick = { confirmReset = false }) {
                        Text(stringResource(R.string.action_cancel))
                    }
                },
            )
        }
    }
}
