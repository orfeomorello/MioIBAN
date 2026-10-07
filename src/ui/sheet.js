/**
 * MioIBAN — Bottom sheet modale
 *
 * Usato per le conferme (eliminazione di un conto, sostituzione dei dati
 * durante un import) e per mostrare di nuovo il disclaimer.
 *
 * MioIBAN-SPEC.md §6.3, regola 4: l'import NON sovrascrive mai senza conferma
 * esplicita. Questo e' il componente con cui quella conferma viene chiesta.
 */

import { el, render, remove } from "./dom.js";

/**
 * Apre una finestra modale dal basso.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {Node|string} [options.body]
 * @param {Array<{label: string, variant?: string, onClick?: Function, close?: boolean}>} options.actions
 * @param {Function} [options.onClose]
 * @returns {{close: Function, element: HTMLElement}}
 */
export function openSheet(options) {
  const opts = options || {};
  const host = document.getElementById("sheet-host") || document.body;

  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeydown);
    remove(overlay);
    if (typeof opts.onClose === "function") opts.onClose();
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  const panel = el("div", {
    class: "sheet__panel",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": opts.title || "",
  });

  const actionButtons = (opts.actions || []).map((action) =>
    el("button", {
      type: "button",
      class: `btn ${action.variant ? `btn--${action.variant}` : ""} btn--big`,
      text: action.label,
      onClick: () => {
        if (typeof action.onClick === "function") action.onClick();
        if (action.close !== false) close();
      },
    }),
  );

  render(
    panel,
    el("h2", { class: "sheet__title", text: opts.title || "" }),
    opts.body ? el("div", { class: "sheet__body" }, opts.body) : null,
    el("div", { class: "sheet__actions" }, actionButtons),
  );

  // Clic sul fondoscurato: chiude. Clic sul pannello: no.
  const overlay = el(
    "div",
    {
      class: "sheet",
      onClick: (event) => {
        if (event.target === overlay) close();
      },
    },
    panel,
  );

  host.appendChild(overlay);
  document.addEventListener("keydown", onKeydown);

  // Il focus va sul primo pulsante, per la navigazione da tastiera.
  if (actionButtons.length) actionButtons[0].focus();

  return { close, element: overlay };
}

/**
 * Scorciatoia per una conferma a due scelte.
 * @param {{title: string, body?: Node|string, confirmLabel: string,
 *          cancelLabel: string, destructive?: boolean, onConfirm: Function}} options
 */
export function confirmSheet(options) {
  const opts = options || {};
  return openSheet({
    title: opts.title,
    body: opts.body,
    actions: [
      { label: opts.cancelLabel, variant: "ghost", close: true },
      {
        label: opts.confirmLabel,
        variant: opts.destructive ? "danger" : "primary",
        onClick: opts.onConfirm,
      },
    ],
  });
}
