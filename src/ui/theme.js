/**
 * MioIBAN — Applicazione di tema e grandezza testo
 *
 * Le preferenze vivono in localStorage (src/core/prefs.js) e si applicano come
 * attributi `data-*` sull'elemento <html>. Il CSS fa il resto: per il tema
 * "auto" basta la media query `prefers-color-scheme`, quindi non serve
 * ascoltare i cambiamenti di sistema da JavaScript.
 */

import { getPref, setPref } from "../core/prefs.js";

const THEME_COLORS = {
  light: "#1d4ed8",
  dark: "#10131a",
  auto: "#1d4ed8",
};

function updateThemeColorMeta(tema) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const resolved =
    tema === "dark"
      ? THEME_COLORS.dark
      : tema === "light"
        ? THEME_COLORS.light
        : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? THEME_COLORS.dark
          : THEME_COLORS.light;
  meta.setAttribute("content", resolved);
}

/** Applica il tema. Senza argomento usa la preferenza salvata. */
export function applyTheme(tema) {
  const value = tema || getPref("tema");
  document.documentElement.dataset.theme = value;
  updateThemeColorMeta(value);
  return value;
}

/** Applica la grandezza del testo. Senza argomento usa la preferenza salvata. */
export function applyTextSize(size) {
  const value = size || getPref("fontSize");
  document.documentElement.dataset.size = value;
  return value;
}

/** Applica tutte le preferenze visive. Da chiamare all'avvio. */
export function applyPreferences() {
  applyTheme();
  applyTextSize();
}

/** Cambia e salva il tema. */
export function setTheme(tema) {
  const result = setPref("tema", tema);
  applyTheme(tema);
  return result;
}

/** Cambia e salva la grandezza del testo. */
export function setTextSize(size) {
  const result = setPref("fontSize", size);
  applyTextSize(size);
  return result;
}
