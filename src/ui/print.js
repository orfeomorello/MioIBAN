/**
 * MioIBAN — Layout di stampa (MioIBAN-SPEC.md §9)
 *
 * Il PDF si ottiene con "Salva come PDF" del browser: nessuna libreria
 * (decisione D-22). Qui si costruisce soltanto il foglio.
 *
 * Requisiti:
 * - Il foglio e' SOLO bianco e nero (print.css forza la palette).
 * - L'IBAN e' l'elemento piu' grande della pagina.
 * - Il pie' di pagina con la data e' obbligatorio.
 * - "Stampa tutti" interrompe la pagina tra un conto e l'altro.
 */

import { el, render, clear } from "./dom.js";
import { t, formatDate } from "../i18n/index.js";
import { formatIban } from "../core/iban.js";
import { accountDisplayName } from "../core/model.js";

/**
 * Data leggibile per il pie' di pagina.
 * Si usa la data locale del dispositivo: e' quella che l'utente si aspetta su
 * un foglio che ha appena stampato.
 */
function today() {
  return formatDate(new Date(), { dateStyle: "long" });
}

/** Una riga etichetta/valore del foglio. Vuota se il valore manca. */
function sheetRow(labelKey, value) {
  if (!value) return null;
  return el(
    "div",
    { class: "print-sheet__row" },
    el("span", { class: "print-sheet__label", text: t(labelKey) }),
    el("span", { class: "print-sheet__value", text: value }),
  );
}

/**
 * Dimensione del carattere IBAN sul foglio, calcolata sulla lunghezza reale.
 *
 * Un 20pt fisso non ci sta: un IBAN italiano formattato a blocchi e' lungo
 * 33 caratteri e con le spaziature del CSS sfora la larghezza utile dell'A4,
 * andando a capo nel punto peggiore (in mezzo al codice da ricopiare).
 * La formula stima l'avanzamento medio del monospace (0.6em) piu' le
 * spaziature di print.css (letter-spacing 0.12em, word-spacing 0.3em) e
 * sceglie la misura piu' grande che sta su una riga, con un margine di
 * sicurezza per i font e i margini delle stampanti (che non sempre seguono
 * quelli di `@page`). Minimo e massimo tengono l'IBAN comunque leggibile e
 * comunque l'elemento piu' grande del foglio (§9.2).
 *
 * @param {string} formatted IBAN formattato a blocchi di 4.
 * @returns {string} Misura in px (nel print 96px = 1in).
 */
export function ibanPrintSize(formatted) {
  const text = typeof formatted === "string" ? formatted : "";
  const spaces = (text.match(/ /g) || []).length;
  const units = (text.length - spaces) * 0.74 + spaces * 1.04;
  if (units <= 0) return "22px";
  const px = (640 * 0.92) / units;
  return `${Math.min(25, Math.max(17, px)).toFixed(1)}px`;
}

/**
 * Costruisce il foglio di stampa di un conto.
 * @param {object} account
 * @returns {HTMLElement}
 */
export function buildPrintSheet(account) {
  const name = accountDisplayName(account, account.iban);
  const iban = formatIban(account.iban);

  const rows = [
    sheetRow("fields.holder", account.titolare || (account.alias ? name : "")),
    sheetRow("fields.bank", account.banca),
    // Il BIC si stampa solo se c'e': non viene mai derivato (limite L1).
    sheetRow("fields.bic", account.bic),
  ].filter(Boolean);

  return el(
    "section",
    { class: "print-sheet" },
    el("h1", { class: "print-sheet__heading", text: t("print.title") }),
    rows.length ? el("div", {}, rows) : null,

    el("div", { class: "print-sheet__iban-label", text: t("print.iban") }),
    el("div", {
      class: "print-sheet__iban",
      style: { "font-size": ibanPrintSize(iban) },
      text: iban,
    }),

    el(
      "div",
      { class: "print-sheet__reason" },
      el("div", { text: t("print.reason") }),
      el("span", { class: "print-sheet__reason-line" }),
    ),

    el("div", { class: "print-sheet__footer", text: t("print.footer", { date: today() }) }),
  );
}

/**
 * Riempie l'area di stampa e avvia la stampa del browser.
 * @param {object[]} accounts Uno o piu' conti.
 */
export function printAccounts(accounts) {
  const host = document.getElementById("print-host");
  if (!host) return;

  const list = (accounts || []).filter(Boolean);
  if (!list.length) return;

  render(host, list.map(buildPrintSheet));

  // Si stampa dopo che il browser ha applicato il layout dei fogli.
  // requestAnimationFrame una volta sola non basta in tutti i browser:
  // si usa un doppio rAF, che e' il modo affidabile senza timer arbitrari.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();
      // Il contenuto resta nel DOM: serve se l'utente riapre l'anteprima.
      // E' nascosto a schermo da `#print-host { display: none }`.
    });
  });
}

/** Svuota l'area di stampa. */
export function clearPrintArea() {
  const host = document.getElementById("print-host");
  if (host) clear(host);
}
