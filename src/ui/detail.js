/**
 * MioIBAN — Dettaglio di un conto
 *
 * Mette insieme:
 *  - i dati del conto (titolare, banca, BIC, note);
 *  - l'IBANAnalyzer, che e' la ragione per cui l'app esiste (§8);
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

import { el, render, ICON } from "./dom.js";
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

/** True se per questo IBAN e' stato verificato anche il CIN nazionale. */
function hasNationalCheck(iban) {
  const country = String(iban || "").slice(0, 2);
  return country === "IT" || country === "SM";
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
  const honesty = el("p", { class: "hint" });
  const actionBar = el("div", { class: "action-bar__inner action-bar__inner--wrap" });

  // Modifica ed elimina vivono nell'header (in alto a destra): app.js monta
  // `headerActions` nella barra superiore. Pulsanti icona con aria-label,
  // come nel resto dell'app.
  const editBtn = el("button", {
    type: "button",
    class: "btn btn--ghost btn--icon",
    "aria-label": t("actions.edit"),
    title: t("actions.edit"),
    text: ICON.edit,
    onClick: () => opts.onEdit(account),
  });

  const deleteBtn = el("button", {
    type: "button",
    class: "btn btn--ghost btn--icon btn--danger",
    "aria-label": t("actions.delete"),
    title: t("actions.delete"),
    text: ICON.trash,
    onClick: () => opts.confirmDelete(account, () => opts.onDeleteConfirmed(account)),
  });

  const headerActions = el("div", { class: "app-header__actions" }, editBtn, deleteBtn);

  /** Ridisegna le parti tradotte. Chiamata anche al cambio di lingua. */
  function paint() {
    render(
      header,
      el("h1", { class: "view-title", text: name }),
      account.banca ? el("p", { class: "detail-header__bank", text: account.banca }) : null,
      account.isFavorite
        ? el("p", { class: "detail-header__fav", text: `${ICON.star} ${t("fields.favorite")}` })
        : null,
    );

    render(
      details,
      metaRow("fields.holder", account.titolare),
      metaRow("fields.bank", account.banca),
      metaRow("fields.bic", account.bic),
      metaRow("fields.note", account.note),
    );

    // Nota onesta sui limiti del controllo (§7.1): per IT/SM e' stato
    // verificato anche il CIN nazionale, altrove solo il checksum
    // internazionale. Non si promette mai piu' di cio' che si e' controllato.
    honesty.textContent = hasNationalCheck(account.iban)
      ? t("validation.validWithCin")
      : t("validation.valid");

    // Le etichette dei pulsanti dell'header vanno aggiornate al cambio lingua.
    editBtn.setAttribute("aria-label", t("actions.edit"));
    editBtn.setAttribute("title", t("actions.edit"));
    deleteBtn.setAttribute("aria-label", t("actions.delete"));
    deleteBtn.setAttribute("title", t("actions.delete"));

    render(
      actionBar,
      el(
        "button",
        {
          type: "button",
          class: "btn btn--primary btn--big",
          onClick: () => opts.onCopy(account, "spaced"),
        },
        el("span", { "aria-hidden": "true", text: ICON.copy }),
        el("span", { text: t("actions.copy") }),
      ),
      el(
        "button",
        {
          type: "button",
          class: "btn btn--big",
          onClick: () => opts.onCopy(account, "compact"),
        },
        el("span", { text: t("actions.copyCompact") }),
      ),
      el(
        "button",
        { type: "button", class: "btn btn--big", onClick: () => opts.onPrint(account) },
        el("span", { "aria-hidden": "true", text: ICON.print }),
        el("span", { text: t("actions.print") }),
      ),
      el(
        "button",
        { type: "button", class: "btn btn--big", onClick: () => opts.onShare(account) },
        el("span", { "aria-hidden": "true", text: ICON.share }),
        el("span", { text: t("actions.share") }),
      ),
    );
  }

  paint();

  const element = el("div", {}, header, analyzer.element, details, honesty);

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
