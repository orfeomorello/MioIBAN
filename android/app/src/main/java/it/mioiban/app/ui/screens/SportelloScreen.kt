package it.mioiban.app.ui.screens

import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.compose.foundation.background
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import it.mioiban.app.R
import it.mioiban.app.core.Analyzer
import it.mioiban.app.data.Account
import it.mioiban.app.ui.MainViewModel
import java.util.Locale

/** Velocità di lettura: più lenta della normale, per dare tempo di trascrivere. */
private const val SPEECH_RATE = 0.6f

/** Pausa fra un gruppo e l'altro, in millisecondi. */
private const val PAUSE_BETWEEN_BLOCKS_MS = 900L

private const val BLOCK_PREFIX = "block-"
private const val SPEECH_END = "mioiban-end"

/**
 * Modalità Sportello (SPEC §8). Un pulsante "Leggi a blocchi" in alto al centro.
 * Durante la lettura il gruppo in corso è evidenziato; gli zeri restano in rosso
 * e grassetto, così si distinguono dalle altre cifre anche quando sono illuminati.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SportelloScreen(vm: MainViewModel, accountId: String, onBack: () -> Unit) {
    val context = LocalContext.current
    var account by remember { mutableStateOf<Account?>(null) }
    var reading by remember { mutableStateOf(false) }
    var litBlock by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(accountId) { account = vm.repository.get(accountId) }

    // Un solo motore di sintesi vocale per schermata, fermato e rilasciato all'uscita.
    val tts = remember {
        lateinit var engine: TextToSpeech
        engine = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) engine.language = Locale.getDefault()
        }
        val mainHandler = Handler(Looper.getMainLooper())
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                if (utteranceId != null && utteranceId.startsWith(BLOCK_PREFIX)) {
                    val index = utteranceId.removePrefix(BLOCK_PREFIX).toIntOrNull()
                    mainHandler.post { litBlock = index }
                }
            }

            override fun onDone(utteranceId: String?) {
                if (utteranceId == SPEECH_END) {
                    mainHandler.post {
                        reading = false
                        litBlock = null
                    }
                }
            }

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                mainHandler.post {
                    reading = false
                    litBlock = null
                }
            }
        })
        engine
    }
    DisposableEffect(Unit) {
        onDispose {
            tts.stop()
            tts.shutdown()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.sportello_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = stringResource(R.string.action_back))
                    }
                },
            )
        },
    ) { padding ->
        val acc = account ?: return@Scaffold
        val zeroWord = stringResource(R.string.tts_zero)
        val blocks = Analyzer.blocks(acc.iban)
        val fg = MaterialTheme.colorScheme.onBackground
        val litFg = MaterialTheme.colorScheme.onPrimaryContainer
        val zeroColor = MaterialTheme.colorScheme.error

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Pulsante unico di lettura, al centro in alto.
            Button(
                onClick = {
                    tts.stop()
                    if (reading) {
                        reading = false
                        litBlock = null
                    } else {
                        reading = true
                        speakBlocks(tts, acc.iban, zeroWord)
                    }
                },
                modifier = Modifier.fillMaxWidth(0.8f).defaultMinSize(minHeight = 56.dp),
            ) {
                Icon(
                    if (reading) Icons.Filled.Stop else Icons.Filled.VolumeUp,
                    contentDescription = null,
                )
                Text(
                    if (reading) "  " + stringResource(R.string.action_stop)
                    else "  " + stringResource(R.string.sportello_read_blocks),
                )
            }

            Text(
                stringResource(R.string.sportello_hint),
                color = fg,
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )

            // I gruppi sono un unico elemento per i lettori di schermo: l'IBAN viene letto tutto di fila.
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics(mergeDescendants = true) { contentDescription = acc.iban },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                blocks.forEach { block ->
                    val lit = litBlock == block.index
                    Column(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (lit) MaterialTheme.colorScheme.primaryContainer else Color.Transparent)
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            block.chars.forEach { c ->
                                Box(modifier = Modifier.padding(vertical = 2.dp), contentAlignment = Alignment.Center) {
                                    Text(
                                        c.ch.toString(),
                                        color = when {
                                            c.isZero -> zeroColor
                                            lit -> litFg
                                            else -> fg
                                        },
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = when {
                                            c.inZeroRun -> FontWeight.ExtraBold
                                            c.isZero -> FontWeight.Bold
                                            else -> FontWeight.Normal
                                        },
                                        fontSize = 30.sp,
                                        textAlign = TextAlign.Center,
                                    )
                                }
                            }
                        }

                    }
                }
            }
        }
    }
}

/**
 * Lettura a blocchi: voce più lenta, ogni gruppo di 4 detto carattere per carattere
 * con una pausa netta fra un gruppo e l'altro. Lo zero è detto "zero".
 * Ogni gruppo ha un identificativo, così la schermata sa quale illuminare.
 */
private fun speakBlocks(tts: TextToSpeech, iban: String, zeroWord: String) {
    tts.setSpeechRate(SPEECH_RATE)
    Analyzer.blocks(iban).forEach { block ->
        val text = block.chars.joinToString(", ") { if (it.isZero) zeroWord else it.ch.toString() }
        tts.speak(text, TextToSpeech.QUEUE_ADD, null, "$BLOCK_PREFIX${block.index}")
        tts.playSilentUtterance(PAUSE_BETWEEN_BLOCKS_MS, TextToSpeech.QUEUE_ADD, "pause-${block.index}")
    }
    tts.playSilentUtterance(1L, TextToSpeech.QUEUE_ADD, SPEECH_END)
}
