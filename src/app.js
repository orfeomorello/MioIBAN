/**
 * MioIBAN — Controller dell'applicazione
 *
 * Responsabilita':
 *  - avvio: preferenze, lingua, Service Worker, controllo dello storage;
 *  - caricamento dei dati in memoria (il dataset e' minuscolo: 5-30 record,
 *    quindi si tiene tutto in RAM e si filtra senza interrogare IndexedDB);
 *  - navigazione fra le viste e montaggio della barra azioni;
 *  - orchestrazione delle operazioni: salva, elimina, copia, stampa, condividi.
 *
 * Le viste sono funzioni che restituiscono `{ element, actionBar }` e non
 * conoscono lo stato globale: tutta la logica di stato vive qui.
 */

import { el, render, clear, mustFind, icon } from "./ui/dom.js";
import { initI18n, t, getCollator, onLanguageChange } from "./i18n/index.js";
import { getPref, setPref, isStorageAvailable } from "./core/prefs.js";
import * as storage from "./core/storage.js";
import {
  createAccount,
  updateAccount,
  touchAccount,
  toggleFavorite,
  accountDisplayName,
  filterAccounts,
  sortAccounts,
  countByGroup,
  sanitizeText,
  newId,
} from "./core/model.js";
import { formatIban } from "./core/iban.js";
import { applyPreferences } from "./ui/theme.js";
import { showToast, copyIbanWithFeedback, shareText } from "./ui/actions.js";
import { printAccounts, clearPrintArea } from "./ui/print.js";
import { confirmSheet } from "./ui/sheet.js";
import { createListView } from "./ui/list.js";
import { createDetailView } from "./ui/detail.js";
import { createFormView } from "./ui/form.js";
import { createSettingsView } from "./ui/settings.js";
import { createOnboarding } from "./ui/onboarding.js";

/** Versione dell'app. Compare nel backup e nelle impostazioni. */
const APP_VERSION = "1.0.0";

/* ------------------------------------------------------------------ *
 * Stato
 * ------------------------------------------------------------------ */

const state = {
  view: "list", // 'list' | 'detail' | 'form' | 'settings' | 'onboarding'
  accounts: [],
  groups: [],
  filter: { query: "", favoritesOnly: false, groupId: null },
  viewMode: getPref("vista"), // 'schede' | 'righe', ricordata fra le sessioni
  currentId: null, // conto aperto nel dettaglio
  editingId: null, // conto in modifica (null = nuovo)
};

/** Vista montata correntemente, per poterne chiamare destroy() e refreshLanguage(). */
let mounted = null;

let headerEl = null;
let mainEl = null;
let actionsEl = null;

/* ------------------------------------------------------------------ *
 * Utilità
 * ------------------------------------------------------------------ */

function findAccount(id) {
  return state.accounts.find((a) => a.id === id) || null;
}

/** Sostituisce (o inserisce) un conto nella copia in memoria e riordina. */
function replaceInMemory(account) {
  const index = state.accounts.findIndex((a) => a.id === account.id);
  if (index >= 0) state.accounts[index] = account;
  else state.accounts.push(account);
}

function removeFromMemory(id) {
  state.accounts = state.accounts.filter((a) => a.id !== id);
}

/** La lista dei conti attualmente visibile, filtrata e ordinata. */
function visibleAccounts() {
  return sortAccounts(filterAccounts(state.accounts, state.filter), getCollator());
}

/** Titolo e pulsante "indietro" dell'intestazione, per la vista corrente. */
function paintHeader() {
  const showBack = state.view === "detail" || state.view === "form" || state.view === "settings";

  let title = t("accounts.title");
  if (state.view === "detail") {
    const account = findAccount(state.currentId);
    title = account ? accountDisplayName(account, account.iban) : t("accounts.title");
  } else if (state.view === "form") {
    title = state.editingId ? t("actions.edit") : t("actions.add");
  } else if (state.view === "settings") {
    title = t("settings.title");
  } else if (state.view === "onboarding") {
    title = t("app.name");
  }

  render(
    headerEl,
    showBack
      ? el("button", {
          type: "button",
          class: "btn btn--ghost btn--icon",
          "aria-label": t("nav.back"),
          onClick: goBack,
        },
        icon("back"),
        )
      : el("img", {
          class: "app-header__brand",
          src: "./icons/icon.svg",
          alt: "",
          width: "28",
          height: "28",
          "aria-hidden": "true",
        }),
    el("span", { class: "app-header__title", text: title }),
    // Azioni della vista corrente in alto a destra (es. modifica ed elimina
    // nel dettaglio): il pattern standard delle app mobili.
    mounted && mounted.headerActions ? mounted.headerActions : null,
  );
}

/**
 * Monta una vista.
 * @param {{element: HTMLElement, actionBar: HTMLElement|null, headerActions?: HTMLElement, destroy?: Function}} view
 */
function mount(view) {
  if (mounted && typeof mounted.destroy === "function") {
    try {
      mounted.destroy();
    } catch {
      /* una vista che non si smonta non deve bloccare la navigazione */
    }
  }

  mounted = view;
  render(mainEl, view.element);
  clearPrintArea();

  if (view.actionBar) {
    render(actionsEl, view.actionBar);
    actionsEl.hidden = false;
  } else {
    clear(actionsEl);
    actionsEl.hidden = true;
  }

  paintHeader();
  // Il contenitore principale riceve il focus: i lettori di schermo
  // annunciano la nuova schermata.
  mainEl.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "auto" });
}

/* ------------------------------------------------------------------ *
 * Navigazione
 * ------------------------------------------------------------------ */

function goBack() {
  if (state.view === "form") {
    // Tornando indietro da una modifica si riapre il dettaglio; da una nuova
    // aggiunta si torna all'elenco.
    if (state.editingId) showDetail(state.editingId);
    else showList();
    return;
  }
  showList();
}

function showList() {
  state.view = "list";
  state.currentId = null;
  state.editingId = null;

  const view = createListView({
    filter: state.filter,
    onOpen: (account) => showDetail(account.id),
    onAdd: () => showForm(null),
    onOpenSettings: () => showSettings(),
    onPrintAll: () => printAccounts(visibleAccounts()),
    onToggleView: () => {
      state.viewMode = state.viewMode === "schede" ? "righe" : "schede";
      setPref("vista", state.viewMode);
      view.update({ view: state.viewMode });
    },
    onToggleFavorite: onToggleFavorite,
    onFilterChange: (patch) => {
      state.filter = Object.assign({}, state.filter, patch);
      view.update({ filter: state.filter });
    },
  });

  view.update({
    accounts: state.accounts,
    groups: state.groups,
    filter: state.filter,
    collator: getCollator(),
    view: state.viewMode,
  });

  mount(view);
}

function showDetail(id) {
  const account = findAccount(id);
  if (!account) {
    showList();
    return;
  }
  state.view = "detail";
  state.currentId = id;

  mount(
    createDetailView({
      account,
      onEdit: (acc) => showForm(acc),
      onDeleteConfirmed: onDeleteAccount,
      confirmDelete: confirmDeleteAccount,
      onCopy: onCopyAccount,
      onPrint: (acc) => printAccounts([acc]),
      onShare: onShareAccount,
    }),
  );
}

function showForm(account) {
  state.view = "form";
  state.editingId = account ? account.id : null;

  mount(
    createFormView({
      account: account || null,
      groups: state.groups,
      onSave: onSaveAccount,
      onCancel: () => (account ? showDetail(account.id) : showList()),
      checkDuplicate: checkDuplicate,
      onOpenExisting: (existing) => showDetail(existing.id),
    }),
  );
}

function showSettings() {
  state.view = "settings";
  mount(
    createSettingsView({
      appVersion: APP_VERSION,
      accountCount: state.accounts.length,
      groups: state.groups,
      groupCounts: countByGroup(state.accounts),
      onCreateGroup,
      onDeleteGroup,
      onReload: async () => {
        await loadData();
        showList();
      },
      onLanguageChange: () => showSettings(),
    }),
  );
}

/**
 * Crea un gruppo e ridisegna le impostazioni.
 * Il nome e' un campo libero: passa dalla stessa pulizia degli altri campi.
 */
async function onCreateGroup(name) {
  const clean = sanitizeText(name, 40);
  if (!clean) return;
  try {
    await storage.saveGroup({ id: newId(), name: clean, color: null });
    state.groups = await storage.getAllGroups();
  } catch {
    showToast(t("errors.unexpected"), { duration: 3500 });
  }
  showSettings();
}

/**
 * Elimina un gruppo.
 * I conti del gruppo NON vengono eliminati: restano, senza gruppo. Eliminare
 * dei conti come effetto collaterale della rimozione di un'etichetta sarebbe
 * un comportamento pericoloso e inatteso.
 */
async function onDeleteGroup(group) {
  try {
    const affected = state.accounts.filter((a) => a.groupId === group.id);
    for (const account of affected) {
      const updated = Object.assign({}, account, { groupId: null });
      await storage.saveAccount(updated);
      replaceInMemory(updated);
    }
    await storage.deleteGroup(group.id);
    state.groups = await storage.getAllGroups();
  } catch {
    showToast(t("errors.unexpected"), { duration: 3500 });
  }
  showSettings();
}

function showOnboarding() {
  state.view = "onboarding";
  mount(
    createOnboarding({
      onComplete: () => showList(),
      onLanguageChange: () => showOnboarding(),
    }),
  );
}

/* ------------------------------------------------------------------ *
 * Operazioni sui conti
 * ------------------------------------------------------------------ */

async function onSaveAccount(draft) {
  try {
    const existing = state.editingId ? findAccount(state.editingId) : null;
    const record = existing ? updateAccount(existing, draft) : createAccount(draft);

    await storage.saveAccount(record);
    replaceInMemory(record);
    showDetail(record.id);
  } catch (err) {
    if (err && err.code === storage.STORAGE_ERROR.DUPLICATE_IBAN) {
      // Difesa in profondita': l'indice unico ha rifiutato il duplicato anche
      // se il controllo applicativo non l'aveva rilevato.
      showToast(t("accounts.duplicateWarningNoAlias"), { duration: 4000 });
      return;
    }
    if (err && err.code === storage.STORAGE_ERROR.QUOTA) {
      showToast(t("errors.storageQuota"), { duration: 4000 });
      return;
    }
    showToast(t("errors.unexpected"), { duration: 4000 });
  }
}

/** Controllo duplicati per il form. */
async function checkDuplicate(iban, excludeId) {
  try {
    const found = await storage.findAccountByIban(iban);
    if (found && found.id !== excludeId) return found;
    return null;
  } catch {
    return null;
  }
}

async function onToggleFavorite(account) {
  const updated = toggleFavorite(account);
  replaceInMemory(updated);
  try {
    await storage.saveAccount(updated);
  } catch {
    showToast(t("errors.unexpected"), { duration: 3000 });
  }
  if (mounted && typeof mounted.update === "function") {
    mounted.update({ accounts: state.accounts });
  }
}

function confirmDeleteAccount(account, onConfirm) {
  const name = accountDisplayName(account, account.iban);
  confirmSheet({
    title: t("actions.delete"),
    body: account.alias
      ? t("accounts.deleteConfirm", { alias: name })
      : t("accounts.deleteConfirmNoAlias"),
    confirmLabel: t("actions.delete"),
    cancelLabel: t("actions.cancel"),
    destructive: true,
    onConfirm,
  });
}

async function onDeleteAccount(account) {
  try {
    await storage.deleteAccount(account.id);
    removeFromMemory(account.id);
    showToast(t("actions.delete"), { duration: 2000 });
    showList();
  } catch {
    showToast(t("errors.unexpected"), { duration: 3500 });
  }
}

/**
 * Copia l'IBAN e aggiorna `lastUsedAt`.
 * `lastUsedAt` serve solo a ordinare i piu' usati: resta sul dispositivo e non
 * e' una cronologia d'uso (MioIBAN-SPEC.md §6.1).
 */
async function onCopyAccount(account, format) {
  const text = format === "compact" ? account.iban : formatIban(account.iban);
  const ok = await copyIbanWithFeedback(text);
  if (!ok) return;

  const updated = touchAccount(account);
  replaceInMemory(updated);
  try {
    await storage.saveAccount(updated);
  } catch {
    /* l'aggiornamento della data non e' critico */
  }
}

async function onShareAccount(account) {
  const name = accountDisplayName(account, account.iban);
  const text = account.alias
    ? t("share.text", { alias: name, iban: formatIban(account.iban) })
    : t("share.textNoAlias", { iban: formatIban(account.iban) });
  await shareText({ title: t("share.title"), text });
}

/* ------------------------------------------------------------------ *
 * Cambio lingua
 * ------------------------------------------------------------------ */

function onLanguageChanged() {
  switch (state.view) {
    case "list":
      if (mounted && typeof mounted.refreshLanguage === "function") mounted.refreshLanguage();
      else showList();
      break;
    case "detail":
      if (mounted && typeof mounted.refreshLanguage === "function") mounted.refreshLanguage();
      break;
    case "form":
      // Ridisegnare il form da capo perderebbe quello che l'utente ha scritto:
      // la vista aggiorna solo le proprie etichette.
      if (mounted && typeof mounted.refreshLanguage === "function") mounted.refreshLanguage();
      break;
    case "settings":
      showSettings();
      break;
    case "onboarding":
      showOnboarding();
      break;
    default:
      showList();
  }
  paintHeader();
}

/* ------------------------------------------------------------------ *
 * Avvio
 * ------------------------------------------------------------------ */

async function loadData() {
  const [accounts, groups] = await Promise.all([
    storage.getAllAccounts(),
    storage.getAllGroups(),
  ]);
  state.accounts = accounts;
  state.groups = groups;
}

/** Schermata di errore non recuperabile. */
function showFatal(messageKey, detail) {
  state.view = "list";
  render(
    mainEl,
    el(
      "div",
      { class: "status status--error" },
      el("span", { class: "status__icon", "aria-hidden": "true" }, icon("x")),
      el("div", {},
        el("p", { text: t(messageKey) }),
        detail ? el("p", { class: "hint", text: String(detail) }) : null,
      ),
    ),
  );
  clear(actionsEl);
  actionsEl.hidden = true;
  paintHeader();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Da file:// il Service Worker non e' ammesso: la pagina funziona comunque,
  // semplicemente senza cache offline.
  if (location.protocol !== "http:" && location.protocol !== "https:") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      // Un Service Worker mancante non deve impedire l'uso dell'app.
      if (typeof console !== "undefined") {
        console.warn("[MioIBAN] Service Worker non registrato:", err && err.message);
      }
    });
  });
}

/** Azione richiesta dal manifest (`?action=add` / `?action=search`). */
function handleStartAction() {
  let action = null;
  try {
    action = new URLSearchParams(location.search).get("action");
  } catch {
    return;
  }
  if (action === "add") showForm(null);
  else if (action === "search" && mounted && typeof mounted.focusSearch === "function") {
    mounted.focusSearch();
  }
}

async function boot() {
  headerEl = mustFind("#app-header");
  mainEl = mustFind("#app-main");
  actionsEl = mustFind("#app-actions");

  applyPreferences();
  initI18n();

  // Il cambio lingua è gestito da un solo punto.
  onLanguageChange(onLanguageChanged);

  registerServiceWorker();

  if (!isStorageAvailable()) {
    showFatal("errors.storageUnavailable");
    return;
  }
  if (!storage.isAvailable()) {
    showFatal("errors.storageUnavailable");
    return;
  }

  try {
    await loadData();
  } catch (err) {
    showFatal("errors.storageUnavailable", err && err.message);
    return;
  }

  if (!getPref("onboardingCompleted")) {
    showOnboarding();
  } else {
    showList();
    handleStartAction();
  }
}

/* `onLanguageChange` e' importato in cima con gli altri simboli di i18n. */

boot().catch((err) => {
  if (typeof console !== "undefined") console.error("[MioIBAN] avvio fallito:", err);
  if (mainEl) showFatal("errors.unexpected", err && err.message);
});
