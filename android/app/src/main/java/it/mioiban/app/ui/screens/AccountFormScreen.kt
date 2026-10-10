package it.mioiban.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import it.mioiban.app.R
import it.mioiban.app.core.Extract
import it.mioiban.app.core.Iban
import it.mioiban.app.core.IbanCode
import it.mioiban.app.data.AccountDraft
import it.mioiban.app.data.SaveResult
import it.mioiban.app.ui.MainViewModel
import it.mioiban.app.ui.components.SectionTitle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountFormScreen(
    vm: MainViewModel,
    editingId: String?,
    onDone: (String?) -> Unit,
    onBack: () -> Unit,
) {
    var loaded by remember { mutableStateOf(editingId == null) }
    var iban by remember { mutableStateOf("") }
    var titolare by remember { mutableStateOf("") }
    var banca by remember { mutableStateOf("") }
    var bic by remember { mutableStateOf("") }
    var alias by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var causale by remember { mutableStateOf("") }
    var favorite by remember { mutableStateOf(false) }
    var duplicateOf by remember { mutableStateOf<String?>(null) }
    var pasteText by remember { mutableStateOf("") }
    var pasteCandidates by remember { mutableStateOf(emptyList<Extract.Candidate>()) }
    var pasteMessage by remember { mutableStateOf<String?>(null) }
    var saveError by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current

    LaunchedEffect(editingId) {
        if (editingId != null) {
            vm.repository.get(editingId)?.let { a ->
                iban = Iban.format(a.iban)
                titolare = a.titolare
                banca = a.banca
                bic = a.bic
                alias = a.alias
                note = a.note
                causale = a.causale
                favorite = a.isFavorite
            }
            loaded = true
        }
    }

    val check = Iban.validate(iban)
    val ibanStatus = when {
        iban.isBlank() -> null
        check.code == IbanCode.VALID_WITH_CIN -> stringResource(R.string.form_iban_ok_cin)
        check.code == IbanCode.VALID -> stringResource(R.string.form_iban_ok)
        check.code == IbanCode.CIN_MISMATCH -> stringResource(R.string.err_cin)
        check.code == IbanCode.CHECKSUM -> stringResource(R.string.err_checksum)
        check.code == IbanCode.UNKNOWN_COUNTRY -> stringResource(R.string.err_unknown_country)
        check.code == IbanCode.WRONG_LENGTH -> stringResource(R.string.err_wrong_length)
        else -> stringResource(R.string.err_wrong_format)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(stringResource(if (editingId == null) R.string.form_new_title else R.string.form_edit_title))
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.action_back))
                    }
                },
            )
        },
    ) { padding ->
        if (!loaded) return@Scaffold
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            SectionTitle(stringResource(R.string.form_paste_title))
            Text(stringResource(R.string.form_paste_hint), style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(
                value = pasteText,
                onValueChange = {
                    pasteText = it
                    pasteMessage = null
                    pasteCandidates = emptyList()
                },
                label = { Text(stringResource(R.string.form_paste_label)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
            )
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    if (Extract.tooLong(pasteText)) {
                        pasteMessage = context.getString(R.string.form_paste_too_long)
                        return@OutlinedButton
                    }
                    val found = Extract.candidates(pasteText)
                    pasteCandidates = found
                    pasteMessage = when (found.size) {
                        0 -> context.getString(R.string.form_paste_none)
                        1 -> {
                            // Compila solo se il campo è vuoto o contiene già lo stesso IBAN.
                            val current = Iban.normalize(iban)
                            if (current.isEmpty() || current == found.single().electronic) {
                                iban = found.single().formatted
                                context.getString(R.string.form_paste_single)
                            } else {
                                // Un IBAN diverso da quello già scritto: non si sostituisce in silenzio.
                                context.getString(R.string.form_paste_choose)
                            }
                        }
                        else -> context.resources.getQuantityString(R.plurals.paste_found, found.size, found.size)
                    }
                },
            ) {
                Text(stringResource(R.string.form_paste_title))
            }
            pasteMessage?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            if (pasteCandidates.size > 1) {
                Text(stringResource(R.string.form_paste_choose), style = MaterialTheme.typography.bodySmall)
                pasteCandidates.forEach { c ->
                    OutlinedButton(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { iban = c.formatted },
                    ) {
                        Text(c.formatted, fontFamily = FontFamily.Monospace)
                    }
                }
            }

            OutlinedTextField(
                value = iban,
                onValueChange = {
                    iban = it
                    duplicateOf = null
                    saveError = null
                },
                label = { Text(stringResource(R.string.form_iban)) },
                placeholder = { Text(stringResource(R.string.form_iban_placeholder)) },
                textStyle = MaterialTheme.typography.bodyLarge.copy(fontFamily = FontFamily.Monospace),
                isError = iban.isNotBlank() && !check.isValid,
                supportingText = { ibanStatus?.let { Text(it) } },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            OutlinedTextField(
                value = alias,
                onValueChange = { alias = it.take(60) },
                label = { Text(stringResource(R.string.form_alias)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = titolare,
                onValueChange = { titolare = it.take(80) },
                label = { Text(stringResource(R.string.form_holder)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = banca,
                onValueChange = { banca = it.take(80) },
                label = { Text(stringResource(R.string.form_bank)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = bic,
                onValueChange = { bic = it.take(11).uppercase() },
                label = { Text(stringResource(R.string.form_bic)) },
                singleLine = true,
                isError = bic.isNotBlank() && !Iban.isValidBic(bic),
                supportingText = {
                    if (bic.isNotBlank() && !Iban.isValidBic(bic)) Text(stringResource(R.string.err_bic))
                },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = note,
                onValueChange = { note = it.take(500) },
                label = { Text(stringResource(R.string.form_note)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
            )
            OutlinedTextField(
                value = causale,
                onValueChange = { causale = it.take(200) },
                label = { Text(stringResource(R.string.form_causale)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            duplicateOf?.let { dupId ->
                Text(stringResource(R.string.form_duplicate_noalias), style = MaterialTheme.typography.bodyMedium)
                OutlinedButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { onDone(dupId) },
                ) { Text(stringResource(R.string.action_open_existing)) }
            }
            saveError?.let { Text(it, style = MaterialTheme.typography.bodySmall) }

            Button(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                enabled = check.isValid,
                onClick = {
                    val draft = AccountDraft(
                        iban = iban,
                        titolare = titolare,
                        banca = banca,
                        bic = bic,
                        alias = alias,
                        note = note,
                        causale = causale,
                        isFavorite = favorite,
                    )
                    vm.save(draft, editingId) { result ->
                        when (result) {
                            is SaveResult.Saved -> onDone(result.account.id)
                            is SaveResult.Duplicate -> duplicateOf = result.existing.id
                            is SaveResult.InvalidIban -> saveError = ibanStatus
                        }
                    }
                },
            ) {
                Text(stringResource(R.string.action_save))
            }
        }
    }
}

