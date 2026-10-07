/**
 * MioIBAN — Azioni rivolte all'utente: toast, copia, condivisione
 *
 * Tutte locali, tutte senza rete (MioIBAN-SPEC.md §3 regole 1 e 5).
 */

import { el, remove } from "./dom.js";
import { t } from "../i18n/index.js";

/* ------------------------------------------------------------------ *
 * Toast
 * ------------------------------------------------------------------ */

let toastTimer = null;

/** Mostra un messaggio breve. Sostituisce quello eventualmente presente. */
export function showToast(message, options) {
  const host = document.getElementById("toast-host");
  if (!host) return null;

  const opts = options || {};
  const previous = host.querySelector(".toast");
  if (previous) remove(previous);

  const toast = el("div", {
    class: "toast",
    role: "status",
    "aria-live": "polite",
    text: String(message),
  });
  host.appendChild(toast);

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    remove(toast);
    toastTimer = null;
  }, typeof opts.duration === "number" ? opts.duration : 2500);

  return toast;
}

/* ------------------------------------------------------------------ *
 * Copia negli appunti
 * ------------------------------------------------------------------ */

/**
 * Copia testo negli appunti.
 *
 * La Clipboard API richiede un secure context (HTTPS o localhost). Dove non
 * c'e', si ricade sulla vecchia tecnica della textarea: meglio un metodo
 * datato che un pulsante che non fa nulla.
 *
 * @param {string} text
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function copyText(text) {
  const value = String(text == null ? "" : text);

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return { ok: true };
    }
  } catch {
    /* si prova il fallback */
  }

  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.setAttribute("aria-hidden", "true");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    remove(area);
    return ok ? { ok: true } : { ok: false, error: "clipboardDenied" };
  } catch {
    return { ok: false, error: "clipboardDenied" };
  }
}

/** Feedback aptico, se il dispositivo lo supporta. Silenzioso se non c'e'. */
export function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern || 12);
  } catch {
    /* ignorato */
  }
}

/**
 * Copia un IBAN e fornisce il feedback completo: toast, vibrazione, e messaggio
 * di errore comprensibile se la copia non riesce.
 *
 * @param {string} ibanText
 * @returns {Promise<boolean>}
 */
export async function copyIbanWithFeedback(ibanText) {
  const result = await copyText(ibanText);
  if (result.ok) {
    vibrate(12);
    showToast(t("actions.copied"));
    return true;
  }
  showToast(t("errors.clipboardDenied"), { duration: 4000 });
  return false;
}

/* ------------------------------------------------------------------ *
 * Condivisione
 * ------------------------------------------------------------------ */

/**
 * Condivide testo con le app del sistema (Web Share API).
 * Se non e' disponibile, copia negli appunti: l'utente ottiene comunque
 * il risultato che voleva (MioIBAN-SPEC.md §7, F-11).
 *
 * @param {{title?: string, text: string, fileName?: string}} payload
 * @returns {Promise<{ok: boolean, method: 'share'|'copy'|'none'}>}
 */
export async function shareText(payload) {
  const text = String(payload.text || "");

  if (navigator.share) {
    try {
      await navigator.share({ title: payload.title || "MioIBAN", text });
      return { ok: true, method: "share" };
    } catch (err) {
      // L'utente ha annullato: non e' un errore da segnalare.
      if (err && err.name === "AbortError") return { ok: false, method: "none" };
      /* si prova la copia */
    }
  }

  const copied = await copyIbanWithFeedback(text);
  if (copied) showToast(t("errors.shareUnavailable"), { duration: 3500 });
  return { ok: copied, method: copied ? "copy" : "none" };
}
