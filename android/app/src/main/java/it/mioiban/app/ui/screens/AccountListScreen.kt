package it.mioiban.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListLayoutInfo
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import it.mioiban.app.R
import it.mioiban.app.core.Iban
import it.mioiban.app.data.Account
import it.mioiban.app.ui.MainViewModel
import it.mioiban.app.ui.components.EmptyState
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

/** Fascia di bordo (in px) oltre la quale l'elenco scorre da solo durante il trascinamento. */
private const val AUTOSCROLL_ZONE_PX = 96f

/** Pixel di scorrimento per frame durante lo scorrimento automatico. */
private const val AUTOSCROLL_STEP_PX = 22f

/**
 * Trascinamento in corso di una scheda. `fingerY` è la posizione verticale assoluta
 * del dito dentro la finestra dell'elenco; `touchOffsetY` è dove è stato premuto il
 * dito dentro la scheda (per tenerla sotto il dito mentre si muove).
 */
private data class DragSession(
    val id: String,
    val order: List<String>,
    val fingerY: Float,
    val touchOffsetY: Float,
) {
    /** Posizione attuale della scheda trascinata dentro `order` (-1 se non c'è più). */
    val index: Int get() = order.indexOf(id)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountListScreen(
    vm: MainViewModel,
    onOpen: (String) -> Unit,
    onAdd: () -> Unit,
    onSettings: () -> Unit,
) {
    val state by vm.list.collectAsState()
    val accounts = state.accounts

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.list_title)) },
                actions = {
                    IconButton(onClick = onSettings) {
                        Icon(Icons.Filled.Settings, contentDescription = stringResource(R.string.action_settings))
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onAdd) {
                Icon(Icons.Filled.Add, contentDescription = stringResource(R.string.action_add))
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = state.filter.query,
                onValueChange = vm::setQuery,
                placeholder = { Text(stringResource(R.string.list_search_hint)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            )

            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FilterChip(
                    selected = state.filter.favoritesOnly,
                    onClick = { vm.setFavoritesOnly(!state.filter.favoritesOnly) },
                    label = { Text(stringResource(R.string.list_favorites)) },
                )
            }

            if (state.totalCount == 0) {
                EmptyState(
                    title = stringResource(R.string.list_empty_title),
                    hint = stringResource(R.string.list_empty_hint),
                )
            } else if (accounts.isEmpty()) {
                EmptyState(title = stringResource(R.string.list_no_results), hint = null)
            } else {
                val listState = rememberLazyListState()

                var drag by remember { mutableStateOf<DragSession?>(null) }
                var autoScroll by remember { mutableStateOf(0) }

                // Con una ricerca attiva non si riordina: l'elenco è un sottoinsieme
                // e spostare le schede visibili cambierebbe l'ordine di tutte le altre.
                val reorderEnabled = state.filter.query.isBlank()

                // Valori sempre aggiornati per il gestore del trascinamento.
                val latestAccounts by rememberUpdatedState(accounts)
                val reorderEnabledNow by rememberUpdatedState(reorderEnabled)

                val byId = remember(accounts) { accounts.associateBy { it.id } }
                val visible = drag?.order?.mapNotNull { byId[it] } ?: accounts

                if (reorderEnabled) {
                    Text(
                        text = stringResource(R.string.list_reorder_hint),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }

                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    // Durante il trascinamento l'elenco si muove solo con lo scorrimento automatico.
                    userScrollEnabled = drag == null,
                ) {
                    itemsIndexed(visible, key = { _, item -> item.id }) { index, account ->
                        val dragged = drag?.id == account.id
                        val session = drag
                        AccountCard(
                            account = account,
                            dragged = dragged,
                            // Le altre schede scivolano per fare posto; la scheda
                            // trascinata no, perché deve restare sotto il dito.
                            itemModifier = if (dragged) Modifier else Modifier.animateItem(),
                            onOpen = { if (drag == null) onOpen(account.id) },
                            onToggleFavorite = { vm.toggleFavorite(account) },
                            modifier = Modifier
                                .zIndex(if (dragged) 1f else 0f)
                                .pointerInput(Unit) {
                                    detectDragGesturesAfterLongPress(
                                        onDragStart = { offset ->
                                            if (!reorderEnabledNow) return@detectDragGesturesAfterLongPress
                                            val slot = listState.layoutInfo.visibleItemsInfo
                                                .firstOrNull { it.index == index }
                                            val slotY = slot?.offset ?: 0
                                            drag = DragSession(
                                                id = account.id,
                                                order = latestAccounts.map { it.id },
                                                fingerY = slotY + offset.y,
                                                touchOffsetY = offset.y,
                                            )
                                            autoScroll = autoScrollDirection(
                                                listState.layoutInfo,
                                                slotY + offset.y,
                                            )
                                        },
                                        onDrag = { change, dragAmount ->
                                            change.consume()
                                            val current = drag ?: return@detectDragGesturesAfterLongPress
                                            val fingerY = current.fingerY + dragAmount.y
                                            val center = fingerY - current.touchOffsetY
                                            drag = current.moveIfCrossed(
                                                listState.layoutInfo,
                                                center = center,
                                                fingerY = fingerY,
                                            )
                                            autoScroll = autoScrollDirection(listState.layoutInfo, center)
                                        },
                                        onDragEnd = {
                                            val finished = drag
                                            drag = null
                                            autoScroll = 0
                                            if (finished != null) vm.reorderAccounts(finished.order)
                                        },
                                        onDragCancel = {
                                            drag = null
                                            autoScroll = 0
                                        },
                                    )
                                }
                                .graphicsLayer {
                                    // La scheda trascinata resta sotto il dito: le sue
                                    // coordinate non si muovono, la sposta solo il layer.
                                    val s = session
                                    if (dragged && s != null) {
                                        val slot = listState.layoutInfo.visibleItemsInfo
                                            .firstOrNull { it.index == index }
                                        val slotCenter = if (slot != null) {
                                            (slot.offset + slot.size / 2f).toFloat()
                                        } else {
                                            0f
                                        }
                                        translationY = (s.fingerY - s.touchOffsetY) - slotCenter
                                    } else {
                                        translationY = 0f
                                    }
                                },
                        )
                    }
                }

                // Scorrimento automatico ai bordi: tiene l'elenco in movimento anche
                // quando il dito è fermo, così si può ordinare per tutta la lista.
                LaunchedEffect(autoScroll, drag != null) {
                    if (autoScroll != 0 && drag != null) {
                        while (isActive) {
                            listState.scrollBy(AUTOSCROLL_STEP_PX * autoScroll)
                            val current = drag
                            if (current != null) {
                                val center = current.fingerY - current.touchOffsetY
                                drag = current.moveIfCrossed(listState.layoutInfo, center, current.fingerY)
                            }
                            delay(16)
                        }
                    }
                }
            }
        }
    }
}

/**
 * Sposta la scheda trascinata quando il suo centro scivola sopra un'altra scheda.
 * Restituisce una sessione aggiornata (l'ordine cambia subito, così l'elenco
 * riordina dal vivo mentre si trascina).
 */
private fun DragSession.moveIfCrossed(
    layout: LazyListLayoutInfo,
    center: Float,
    fingerY: Float,
): DragSession {
    val from = index
    if (from < 0 || from >= order.size) return copy(fingerY = fingerY)
    val over = layout.visibleItemsInfo.firstOrNull { info ->
        info.index != from && center >= info.offset && center < info.offset + info.size
    } ?: return copy(fingerY = fingerY)
    if (over.index >= order.size) return copy(fingerY = fingerY)
    val newOrder = order.toMutableList()
    newOrder.add(over.index, newOrder.removeAt(from))
    return copy(order = newOrder, fingerY = fingerY)
}

/** -1 in alto, 1 in basso, 0 al centro: direzione dello scorrimento automatico. */
private fun autoScrollDirection(layout: LazyListLayoutInfo, center: Float): Int = when {
    center < layout.viewportStartOffset + AUTOSCROLL_ZONE_PX -> -1
    center > layout.viewportEndOffset - AUTOSCROLL_ZONE_PX -> 1
    else -> 0
}

@Composable
private fun AccountCard(
    account: Account,
    dragged: Boolean,
    onOpen: () -> Unit,
    onToggleFavorite: () -> Unit,
    /** Modificatore di posizionamento nell'elenco (animazione dello spostamento). */
    itemModifier: Modifier = Modifier,
    /** Modificatori propri della scheda: gesti di trascinamento, livello e spostamento. */
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = itemModifier.then(modifier).fillMaxWidth().clickable(onClick = onOpen),
        elevation = CardDefaults.cardElevation(defaultElevation = if (dragged) 8.dp else 1.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(account.displayName, style = MaterialTheme.typography.titleMedium)
                    if (account.banca.isNotBlank()) {
                        Text(account.banca, style = MaterialTheme.typography.bodyMedium)
                    }
                }
                IconButton(onClick = onToggleFavorite) {
                    Icon(
                        if (account.isFavorite) Icons.Filled.Star else Icons.Outlined.StarBorder,
                        contentDescription = stringResource(R.string.favorite_toggle),
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(
                Iban.format(account.iban),
                fontFamily = FontFamily.Monospace,
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}
