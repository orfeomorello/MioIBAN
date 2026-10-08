/**
 * MioIBAN — Elenco dei conti: ricerca, filtri, preferiti (MioIBAN-SPEC.md §7)
 *
 * SCELTA DI PROGETTO
 * La barra di ricerca e le chip sono DOM PERSISTENTE: solo il contenitore della
 * lista viene ridisegnato a ogni aggiornamento. Ricostruire l'intera vista
 * farebbe perdere il focus all'input a ogni carattere digitato — un difetto
 * classico e molto fastidioso in un'app senza framework.
 */

import { el, render, clear, icon } from "./dom.js";
import { t } from "../i18n/index.js";
import { filterAccounts, sortAccounts, accountDisplayName, countByGroup } from "../core/model.js";

/** Una scheda: nome, banca, IBAN a blocchi. */
function accountCard(account, handlers) {
  const iban = account.iban || "";
  const formatted = iban.replace(/(.{4})(?!$)/g, "$1 ");

  return el(
    "button",
    {
      type: "button",
      class: "account-card",
      "aria-label": t("a11y.openAccount", { alias: accountDisplayName(account, iban) }),
      onClick: () => handlers.onOpen(account),
    },
    el(
      "div",
      { class: "account-card__top" },
      el("div", {}, 
        el("div", { class: "account-card__alias", text: accountDisplayName(account, iban) }),
        account.banca ? el("div", { class: "account-card__bank", text: account.banca }) : null,
      ),
      favoriteButton(account, handlers),
    ),
    el("div", { class: "account-card__iban", text: formatted }),
  );
}

/** Una riga: piu' densa, per chi ha molti conti. */
function accountRow(account, handlers) {
  const iban = account.iban || "";
  return el(
    "div",
    { class: "account-row" },
    el("button", {
      type: "button",
      class: "account-row__main",
      "aria-label": t("a11y.openAccount", { alias: accountDisplayName(account, iban) }),
      onClick: () => handlers.onOpen(account),
    },
      el("span", { class: "account-row__name", text: accountDisplayName(account, iban) }),
      el("span", { class: "account-row__iban", text: iban }),
    ),
    favoriteButton(account, handlers),
  );
}

function favoriteButton(account, handlers) {
  return el("button", {
    type: "button",
    class: "btn btn--ghost btn--icon favorite",
    "aria-pressed": String(account.isFavorite === true),
    "aria-label": t("a11y.favoriteToggle"),
    onClick: (event) => {
      // Il pulsante sta dentro una scheda cliccabile: non deve aprirla.
      event.stopPropagation();
      handlers.onToggleFavorite(account);
    },
  },
  icon(account.isFavorite ? "star" : "starOutline"),
  );
}

/**
 * Crea la vista elenco.
 *
 * @param {object} options
 * @param {Function} options.onOpen            Apre il dettaglio di un conto.
 * @param {Function} options.onAdd             Apre il form di aggiunta.
 * @param {Function} options.onToggleFavorite
 * @param {Function} options.onFilterChange    Riceve una modifica parziale del filtro.
 * @param {Function} options.onToggleView      Passa tra schede e righe.
 * @returns {{element: HTMLElement, actionBar: HTMLElement, update: Function}}
 */
export function createListView(options) {
  const opts = options || {};
  const handlers = {
    onOpen: opts.onOpen,
    onToggleFavorite: opts.onToggleFavorite,
  };

  /* --- Barra di ricerca (persistente) --- */

  const searchInput = el("input", {
    type: "search",
    class: "field__input",
    id: "search-input",
    placeholder: t("placeholders.search"),
    "aria-label": t("actions.search"),
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: "false",
    value: opts.filter && opts.filter.query ? opts.filter.query : "",
    onInput: (event) => {
      opts.onFilterChange({ query: event.target.value });
      // Il filtro cambia i risultati: si aggiorna solo il contenitore lista.
      scheduleUpdate();
    },
  });

  const chipsContainer = el("div", { class: "chips" });
  const countLine = el("p", { class: "list-count" });
  const listContainer = el("div", { class: "account-list" });

  const element = el(
    "div",
    {},
    el(
      "div",
      { class: "search-bar" },
      el("span", { class: "search-bar__icon", "aria-hidden": "true" }, icon("search")),
      searchInput,
    ),
    chipsContainer,
    countLine,
    listContainer,
  );

  /* --- Barra azioni --- */
  const actionBar = el("div", { class: "action-bar__inner" });

  const printAllBtn = el("button", {
    type: "button",
    class: "btn btn--big",
    "aria-label": t("actions.printAll"),
    title: t("actions.printAll"),
    disabled: true,
    onClick: () => opts.onPrintAll(),
  },
  icon("print"),
  );

  function paintActionBar() {
    printAllBtn.setAttribute("aria-label", t("actions.printAll"));
    printAllBtn.title = t("actions.printAll");
    render(
      actionBar,
      el("button", {
        type: "button",
        class: "btn btn--primary btn--big",
        onClick: () => opts.onAdd(),
      },
        icon("plus"),
        el("span", { text: t("actions.add") }),
      ),
      printAllBtn,
      el("button", {
        type: "button",
        class: "btn btn--big",
        "aria-label": t("settings.title"),
        onClick: () => opts.onOpenSettings(),
      },
      icon("settings"),
      ),
    );
  }
  paintActionBar();

  let latest = { accounts: [], groups: [], filter: {}, collator: null, view: "schede" };

  function scheduleUpdate() {
    update(latest);
  }

  function buildChips() {
    clear(chipsContainer);
    const { filter, groups, accounts, collator } = latest;
    const counts = countByGroup(accounts);

    const favChip = el("button", {
      type: "button",
      class: "chip",
      "aria-pressed": String(!!filter.favoritesOnly),
      onClick: () => {
        opts.onFilterChange({ favoritesOnly: !filter.favoritesOnly });
        scheduleUpdate();
      },
    },
    el("span", { text: t("accounts.favoritesOnly") }),
    );
    chipsContainer.appendChild(favChip);

    // Passaggio schede/righe. Sta fra le chip e non nella barra azioni perche'
    // e' una preferenza di visualizzazione, non un'azione sui dati.
    chipsContainer.appendChild(
      el("button", {
        type: "button",
        class: "chip",
        "aria-pressed": String(latest.view === "righe"),
        text: latest.view === "righe" ? t("accounts.showAsCards") : t("accounts.showAsRows"),
        onClick: () => opts.onToggleView(),
      }),
    );

    if (!groups || !groups.length) return;

    // Chip "tutti i gruppi"
    chipsContainer.appendChild(
      el("button", {
        type: "button",
        class: "chip",
        "aria-pressed": String(!filter.groupId),
        text: t("accounts.allGroups"),
        onClick: () => {
          opts.onFilterChange({ groupId: null });
          scheduleUpdate();
        },
      }),
    );

    for (const group of groups) {
      const count = counts.get(group.id) || 0;
      if (!count) continue; // i gruppi vuoti non occupano spazio
      chipsContainer.appendChild(
        el("button", {
          type: "button",
          class: "chip",
          "aria-pressed": String(filter.groupId === group.id),
          text: count > 1 ? `${group.name} (${count})` : group.name,
          onClick: () => {
            opts.onFilterChange({ groupId: filter.groupId === group.id ? null : group.id });
            scheduleUpdate();
          },
        }),
      );
    }
    void collator;
  }

  /** Aggiorna la vista con lo stato corrente. */
  function update(state) {
    latest = Object.assign({}, latest, state || {});

    // Le chip si ricostruiscono solo se cambia qualcosa che le riguarda.
    buildChips();

    const filtered = filterAccounts(latest.accounts, latest.filter);
    const sorted = sortAccounts(filtered, latest.collator);

    countLine.textContent = sorted.length
      ? t("accounts.count", { count: sorted.length })
      : "";
    countLine.hidden = sorted.length === 0;
    // "Stampa tutti" non ha senso quando non c'e' nulla da stampare.
    printAllBtn.disabled = sorted.length === 0;

    clear(listContainer);

    if (!sorted.length) {
      const hasFilter =
        (latest.filter && latest.filter.query) ||
        (latest.filter && latest.filter.favoritesOnly) ||
        (latest.filter && latest.filter.groupId);
      const isFirstRun = !latest.accounts.length;

      listContainer.appendChild(
        el(
          "div",
          { class: "empty-state" },
          el("p", { text: isFirstRun ? t("accounts.empty") : t("accounts.noResults") }),
          isFirstRun ? el("p", { class: "hint", text: t("accounts.emptyHint") }) : null,
          hasFilter
            ? el("button", {
                type: "button",
                class: "btn",
                text: t("actions.clear"),
                onClick: () => {
                  searchInput.value = "";
                  opts.onFilterChange({ query: "", favoritesOnly: false, groupId: null });
                  scheduleUpdate();
                },
              })
            : null,
        ),
      );
      return;
    }

    const asRows = latest.view === "righe";
    render(
      listContainer,
      sorted.map((account) => (asRows ? accountRow(account, handlers) : accountCard(account, handlers))),
    );
  }

  /** Ridisegna le stringhe statiche dopo un cambio di lingua. */
  function refreshLanguage() {
    searchInput.placeholder = t("placeholders.search");
    searchInput.setAttribute("aria-label", t("actions.search"));
    paintActionBar();
    update(latest);
  }

  // Prima costruzione.
  buildChips();

  return { element, actionBar, update, refreshLanguage, focusSearch: () => searchInput.focus() };
}
