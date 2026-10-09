package it.mioiban.app.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import it.mioiban.app.R
import it.mioiban.app.core.Iban
import it.mioiban.app.data.Account
import it.mioiban.app.ui.MainViewModel
import it.mioiban.app.ui.components.SectionTitle
import it.mioiban.app.ui.print.PrintService
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountDetailScreen(
    vm: MainViewModel,
    accountId: String,
    onBack: () -> Unit,
    onEdit: (String) -> Unit,
    onSportello: (String) -> Unit,
    onDeleted: () -> Unit,
) {
    val context = LocalContext.current
    var account by remember { mutableStateOf<Account?>(null) }
    var confirmDelete by remember { mutableStateOf(false) }
    var showCausaleDialog by remember { mutableStateOf(false) }
    var causaleTarget by remember { mutableStateOf("") } // "print" o "pdf"

    LaunchedEffect(accountId) {
        account = vm.repository.get(accountId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(account?.displayName ?: "") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = stringResource(R.string.action_back))
                    }
                },
                actions = {
                    account?.let { acc ->
                        IconButton(onClick = { onEdit(acc.id) }) {
                            Icon(Icons.Filled.Edit, contentDescription = stringResource(R.string.action_edit))
                        }
                        IconButton(onClick = { confirmDelete = true }) {
                            Icon(Icons.Filled.Delete, contentDescription = stringResource(R.string.action_delete))
                        }
                    }
                },
            )
        },
    ) { padding ->
        val acc = account
        if (acc == null) {
            Column(modifier = Modifier.fillMaxSize().padding(padding)) {}
            return@Scaffold
        }
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (acc.banca.isNotBlank()) {
                Text(acc.banca, style = MaterialTheme.typography.titleMedium)
            }
            if (acc.isFavorite) {
                Text("★ " + stringResource(R.string.favorite_toggle), style = MaterialTheme.typography.labelLarge)
            }

            Text(
                Iban.format(acc.iban),
                fontFamily = FontFamily.Monospace,
                style = MaterialTheme.typography.headlineSmall,
            )

            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    copyToClipboard(context, acc.iban)
                    vm.touch(acc.id)
                },
            ) {
                Icon(Icons.Filled.ContentCopy, contentDescription = null)
                Text("  " + stringResource(R.string.detail_copy_compact))
            }
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = { onSportello(acc.id) },
            ) {
                Icon(Icons.Filled.RecordVoiceOver, contentDescription = null)
                Text("  " + stringResource(R.string.action_sportello))
            }
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    causaleTarget = "print"
                    showCausaleDialog = true
                },
            ) {
                Icon(Icons.Filled.Print, contentDescription = null)
                Text("  " + stringResource(R.string.action_print))
            }
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    causaleTarget = "pdf"
                    showCausaleDialog = true
                },
            ) {
                Icon(Icons.Filled.PictureAsPdf, contentDescription = null)
                Text("  " + stringResource(R.string.action_pdf))
            }
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = { shareAccount(context, acc) },
            ) {
                Icon(Icons.Filled.Share, contentDescription = null)
                Text("  " + stringResource(R.string.action_share))
            }

            if (acc.titolare.isNotBlank() && acc.titolare != acc.displayName) {
                SectionTitle(stringResource(R.string.detail_holder))
                Text(acc.titolare)
            }
            if (acc.bic.isNotBlank()) {
                SectionTitle(stringResource(R.string.detail_bic))
                Text(acc.bic, fontFamily = FontFamily.Monospace)
            }
            if (acc.note.isNotBlank()) {
                SectionTitle(stringResource(R.string.detail_note))
                Text(acc.note)
            }
        }

        if (confirmDelete) {
            AlertDialog(
                onDismissRequest = { confirmDelete = false },
                title = { Text(stringResource(R.string.detail_delete_title)) },
                text = {
                    Text(
                        if (acc.alias.isNotBlank()) {
                            stringResource(R.string.detail_delete_body, acc.alias)
                        } else {
                            stringResource(R.string.detail_delete_body_noalias)
                        },
                    )
                },
                confirmButton = {
                    TextButton(onClick = {
                        confirmDelete = false
                        vm.delete(acc.id, onDeleted)
                    }) { Text(stringResource(R.string.action_delete)) }
                },
                dismissButton = {
                    TextButton(onClick = { confirmDelete = false }) {
                        Text(stringResource(R.string.action_cancel))
                    }
                },
            )
        }

        if (showCausaleDialog) {
            CausaleDialog(
                account = acc,
                onDismiss = { showCausaleDialog = false },
                onConfirm = { causale ->
                    showCausaleDialog = false
                    if (causaleTarget == "print") {
                        PrintService.printAccount(context, acc, causale)
                    } else {
                        PrintService.sharePdf(context, acc, causale)
                    }
                },
            )
        }
    }
}

/** Copia l'IBAN compatto negli appunti di sistema. */
fun copyToClipboard(context: Context, iban: String) {
    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    cm.setPrimaryClip(ClipData.newPlainText("IBAN", iban))
}

/** Condivide il testo con alias e IBAN formattato, tramite il foglio di sistema. */
fun shareAccount(context: Context, account: Account) {
    val text = if (account.alias.isNotBlank()) {
        context.getString(R.string.share_text, account.alias, Iban.format(account.iban))
    } else {
        context.getString(R.string.share_text_noalias, Iban.format(account.iban))
    }
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
    }
    context.startActivity(Intent.createChooser(send, context.getString(R.string.share_title)))
}

@Composable
private fun CausaleDialog(
    account: Account,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    var causale by remember { mutableStateOf("") }
    var useNote by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.causale_dialog_title)) },
        text = {
            Column {
                Text(stringResource(R.string.causale_dialog_hint))
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = if (useNote) account.note else causale,
                    onValueChange = { causale = it },
                    label = { Text(stringResource(R.string.causale_label)) },
                    enabled = !useNote,
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                )
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = useNote,
                        onCheckedChange = { useNote = it },
                    )
                    Text(stringResource(R.string.causale_use_note))
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val finalCausale = if (useNote) account.note else causale
                onConfirm(finalCausale)
            }) { Text(stringResource(R.string.action_confirm)) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel))
            }
        },
    )
}
