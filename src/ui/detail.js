/**
 * MioIBAN — Dettaglio di un conto
 *
 * Mette insieme:
 *  - l'intestazione (nome, banca, preferito) e l'IBANAnalyzer, che e' la
 *    ragione per cui l'app esiste (§8);
 *  - solo i dati che l'intestazione non mostra gia' (BIC, note ed
 *    eventualmente il titolare, se diverso dal nome): niente doppioni;
 *  - le azioni rapide (copia, copia compatto, stampa, condividi);
 *  - modifica ed elimina, come icone in alto a destra nell'header.
 *
 * POSIZIONE DI MODIFICA/ELIMINA (scelta deliberata)
 * E' il pattern standard delle app mobili (Contatti, Note): matita e cestino
 * stanno nella barra in alto della scheda aperta, sempre visibili senza dover
 * scorrere. NON stanno nell'elenco: un "Elimina" a un tocco dalla lista,
 * mentre si scorre, sarebbe un danno irreparabile. E restano lontani dal
 * "Copia" in basso, cosi' un tocco accidentale non puo' cancellare nulla.
 */

import { el, render, icon } from "./dom.js";
import { t } from "../i18n/index.js";
import { createAnalyzer } from "./analyzer.js";
import { accountDisplayName } from "../core/model.js";

/** Riga etichetta/valore. Nulla se il valore e' assente. */
function metaRow(labelKey, value) {
  if (!value) return null;
  return el(
    "div",
    { class: "kv" },
    el("span", { class: "kv__key", text: t(labelKey) }),
    el("span", { class: "kv__value", text: value }),
  );
}

/**
 * @param {object} options
 * @param {object} options.account
 * @param {Function} options.onEdit
 * @param {Function} options.onDeleteConfirmed
 * @param {Function} options.onCopy            (account, 'spaced'|'compact')
 * @param {Function} options.onPrint
 * @param {Function} options.onShare
 * @param {Function} options.confirmDelete     (account, onConfirm)
 * @returns {{element: HTMLElement, actionBar: HTMLElement, headerActions: HTMLElement, destroy: Function, refreshLanguage: Function}}
 */
export function createDetailView(options) {
  const opts = options || {};
  const account = opts.account;
  const name = accountDisplayName(account, account.iban);

  const analyzer = createAnalyzer({ account });

  const header = el("header", { class: "detail-header" });
  const details = el("div", { class: "kv-list" });
  const actionBar = el("div", { class: "action-bar__inner" });

  // Modifica ed elimina vivono nell'header (in alto a destra): app.js monta
  // `headerActions` nella barra superiore. Pulsanti icona con aria-label,
  // come nel resto dell'app.
  const editBtn = el("button", {
    type: "button",
    class: "btn btn--ghost btn--icon",
    "aria-label": t("actions.edit"),
    title: t("actions.edit"),
    onClick: () => opts.onEdit(account),
  },
  icon("edit"),
  );

  const deleteBtn = el("button", {
    type: "button",
    class: "btn btn--ghost btn--icon btn--danger",
    "aria-label": t("actions.delete"),
    title: t("actions.delete"),
    onClick: () => opts.confirmDelete(account, () => opts.onDeleteConfirmed(account)),
  },
  icon("trash"),
  );

  const headerActions = el("div", { class: "app-header__actions" }, editBtn, deleteBtn);

  /** Ridisegna le parti tradotte. Chiamata anche al cambio di lingua. */
  function paint() {
    render(
      header,
      // Il nome e' gia' nell'header dell'app (accanto alla freccia): qui
      // resta solo per i lettori di schermo, nascosto alla vista per non
      // ripeterlo due volte.
      el("h1", { class: "visually-hidden", text: name }),
      account.banca ? el("p", { class: "detail-header__bank", text: account.banca }) : null,
      account.isFavorite
        ? el("p", { class: "detail-header__fav" }, icon("star"), el("span", { text: t("fields.favorite") }))
        : null,
    );

    // Titolare e banca sono gia' nell'intestazione: ripeterli qui sotto
    // sarebbe rumore. Si mostrano solo i dati che sopra non ci sono (BIC e
    // note); il titolare compare solo se aggiunge qualcosa, cioe' se e'
    // diverso dal nome gia' mostrato. La validita' dell'IBAN e' gia' stata
    // verificata all'inserimento: ripeterla qui non aiuta a copiarlo meglio.
    const extraRows = [
      account.titolare && account.titolare !== name
        ? metaRow("fields.holder", account.titolare)
        : null,
      metaRow("fields.bic", account.bic),
      metaRow("fields.note", account.note),
    ].filter(Boolean);

    render(details, extraRows);
    details.hidden = extraRows.length === 0;

    // Le etichette dei pulsanti dell'header vanno aggiornate al cambio lingua.
    editBtn.setAttribute("aria-label", t("actions.edit"));
    editBtn.setAttribute("title", t("actions.edit"));
    deleteBtn.setAttribute("aria-label", t("actions.delete"));
    deleteBtn.setAttribute("title", t("actions.delete"));

    // Tre azioni su una sola riga: una sola copia (compatta, quella che si
    // incolla nel bonifico), stampa e condivisione.
    render(
      actionBar,
      el(
        "button",
        {
          type: "button",
          class: "btn btn--primary btn--big",
          onClick: () => opts.onCopy(account, "compact"),
        },
        icon("copy"),
        el("span", { text: t("actions.copyCompact") }),
      ),
      el(
        "button",
        { type: "button", class: "btn btn--big", onClick: () => opts.onPrint(account) },
        icon("print"),
        el("span", { text: t("actions.print") }),
      ),
      el(
        "button",
        { type: "button", class: "btn btn--big", onClick: () => opts.onShare(account) },
        icon("share"),
        el("span", { text: t("actions.share") }),
      ),
    );
  }

  paint();

  const element = el("div", {}, header, analyzer.element, details);

  return {
    element,
    actionBar,
    headerActions,
    destroy: () => analyzer.destroy(),
    refreshLanguage: () => {
      analyzer.refreshLanguage();
      paint();
    },
  };
}
