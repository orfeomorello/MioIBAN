/**
 * MioIBAN — Runtime multilingua (i18n)
 *
 * Nessuna dipendenza esterna: solo dizionari ES Module e API Intl nativa.
 * Funziona offline e senza build step.
 *
 * Uso:
 *   import { initI18n, t, setLanguage, formatDate } from './i18n/index.js';
 *   initI18n();
 *   el.textContent = t('accounts.empty');
 *
 * MioIBAN-SPEC.md:
 * - §3 regola 5: nessuna risorsa remota. I dizionari sono moduli locali.
 * - §7.1: i testi di validazione sono vincolanti e non vanno tradotti
 *   liberamente: le traduzioni devono conservare il significato esatto.
 */

import it from "./it.js";
import en from "./en.js";
import { getPref, setPref } from "../core/prefs.js";

/** Dizionari disponibili. Aggiungere una lingua = aggiungere una voce qui. */
const DICTS = { it, en };

/**
 * Metadati delle lingue, nell'ordine in cui vengono mostrate all'utente.
 * `name` e' il nome NATIVO (endonimo): si mostra sempre quello, cosi' chi
 * parla solo quella lingua la riconosce senza sapere l'italiano.
 */
export const LANGUAGES = Object.freeze([
  { code: "it", name: "Italiano", englishName: "Italian", dir: "ltr" },
  { code: "en", name: "English", englishName: "English", dir: "ltr" },
]);

export const FALLBACK_LANG = "it";

let currentLang = FALLBACK_LANG;
let pluralRules = new Intl.PluralRules(FALLBACK_LANG);
const listeners = new Set();

/* ------------------------------------------------------------------ *
 * Rilevamento della lingua
 * ------------------------------------------------------------------ */

/**
 * Sceglie la lingua migliore a partire da una lista di codici BCP 47,
 * confrontando solo la parte primaria (es. "it-CH" -> "it").
 */
export function pickLanguage(candidates) {
  for (const tag of candidates || []) {
    if (typeof tag !== "string") continue;
    const primary = tag.toLowerCase().split("-")[0];
    if (primary in DICTS) return primary;
  }
  return FALLBACK_LANG;
}

/**
 * Legge la lingua dalla query string (?lang=en).
 * E' il criterio con priorita' piu' alta: un link condiviso deve aprire l'app
 * nella lingua dell'URL. Compatibile con la cache del service worker, che usa
 * `ignoreSearch` (vedi sw.js).
 */
export function readLangFromUrl() {
  if (typeof location === "undefined") return null;
  try {
    const value = new URLSearchParams(location.search).get("lang");
    if (!value) return null;
    const primary = value.toLowerCase().split("-")[0];
    return primary in DICTS ? primary : null;
  } catch {
    return null;
  }
}

/**
 * Lingua da usare all'avvio. Ordine di priorita':
 *   1. `?lang=` nell'URL      (link condiviso)
 *   2. scelta esplicita dell'utente, salvata in localStorage
 *   3. `navigator.languages`  (lingue preferite dal browser, in ordine)
 *   4. FALLBACK_LANG
 * @returns {{code: string, fromUrl: boolean}}
 */
export function detectLanguage() {
  const fromUrl = readLangFromUrl();
  if (fromUrl) return { code: fromUrl, fromUrl: true };

  const saved = getPref("lang");
  if (saved && saved in DICTS) return { code: saved, fromUrl: false };

  const nav = typeof navigator !== "undefined" ? navigator : {};
  const list = nav.languages && nav.languages.length ? nav.languages : [nav.language];
  return { code: pickLanguage(list), fromUrl: false };
}

/* ------------------------------------------------------------------ *
 * Accesso alle stringhe
 * ------------------------------------------------------------------ */

/** Risolve un percorso puntato ("accounts.empty") dentro un dizionario. */
function resolve(dict, path) {
  let node = dict;
  for (const part of path.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Sostituisce i segnaposto {nome} con i valori forniti. */
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
  );
}

/**
 * Traduce una chiave.
 *
 * @param {string} key    Percorso nel dizionario, es. "actions.copy".
 * @param {object} [params] Valori per i segnaposto. Se presente `count`,
 *                          viene scelta la forma plurale corretta
 *                          (chiave_one / chiave_other) via Intl.PluralRules.
 * @returns {string} La stringa tradotta. Se la chiave manca ovunque,
 *                   restituisce la chiave stessa (visibile in sviluppo).
 */
export function t(key, params) {
  let lookup = key;

  if (params && typeof params.count === "number") {
    const category = pluralRules.select(params.count);
    const withCategory = `${key}_${category}`;
    if (resolve(DICTS[currentLang], withCategory) !== undefined) {
      lookup = withCategory;
    } else if (resolve(DICTS[FALLBACK_LANG], withCategory) !== undefined) {
      lookup = withCategory;
    } else {
      lookup = `${key}_other`;
    }
  }

  const value =
    resolve(DICTS[currentLang], lookup) ??
    resolve(DICTS[FALLBACK_LANG], lookup) ??
    (lookup !== key ? resolve(DICTS[FALLBACK_LANG], key) : undefined);

  if (value === undefined) {
    if (typeof console !== "undefined") {
      console.warn(`[i18n] chiave mancante: "${key}" (${currentLang})`);
    }
    return key;
  }
  return interpolate(value, params);
}

/** Come t(), ma ritorna null se la chiave non esiste (per testi opzionali). */
export function tOptional(key, params) {
  const value = t(key, params);
  return value === key ? null : value;
}

/* ------------------------------------------------------------------ *
 * Cambio lingua
 * ------------------------------------------------------------------ */

export function currentLanguage() {
  return currentLang;
}

export function currentDir() {
  const meta = LANGUAGES.find((l) => l.code === currentLang);
  return meta ? meta.dir : "ltr";
}

/** Aggiorna lang/dir sull'elemento <html>. */
function applyDocumentLanguage() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = currentLang;
  root.dir = currentDir();
}

/** Riflette la lingua nell'URL senza ricaricare la pagina, cosi' il link e' condivisibile. */
export function updateUrlLang(code) {
  if (typeof history === "undefined" || !history.replaceState || typeof location === "undefined") {
    return;
  }
  try {
    const url = new URL(location.href);
    url.searchParams.set("lang", code);
    history.replaceState(null, "", url);
  } catch {
    /* URL non manipolabile: si prosegue senza */
  }
}

/**
 * Imposta la lingua attiva.
 *
 * @param {string} code
 * @param {{persist?: boolean, updateUrl?: boolean}} [options]
 *   `persist`   salva la scelta dell'utente (default true). Si passa false
 *               quando la lingua arriva da un link condiviso: aprire un link
 *               non deve cambiare le preferenze salvate.
 *   `updateUrl` riflette la lingua nell'URL (default: come `persist`).
 * @returns {boolean} true se la lingua e' effettivamente cambiata.
 */
export function setLanguage(code, options) {
  if (!(code in DICTS)) return false;
  const opts = Object.assign({ persist: true }, options);
  const changed = code !== currentLang;

  currentLang = code;
  pluralRules = new Intl.PluralRules(code);

  if (opts.persist) setPref("lang", code);
  if (opts.updateUrl !== false && opts.persist) updateUrlLang(code);

  applyDocumentLanguage();
  if (changed) for (const fn of listeners) fn(code);
  return changed;
}

/** Registra un listener per il cambio lingua. Ritorna la funzione di rimozione. */
export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Inizializza il runtime. Da chiamare una sola volta, all'avvio.
 * NON persiste la lingua rilevata: la preferenza si salva solo quando l'utente
 * la sceglie esplicitamente (setLanguage). Cosi' chi non ha mai scelto nulla
 * continua a seguire la lingua del browser.
 */
export function initI18n() {
  const detected = detectLanguage();
  currentLang = detected.code;
  pluralRules = new Intl.PluralRules(currentLang);
  applyDocumentLanguage();
  return currentLang;
}

/* ------------------------------------------------------------------ *
 * Formattazione locale (numeri e date)
 * ------------------------------------------------------------------ */

export function formatDate(date, options) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(currentLang, options || { dateStyle: "long" }).format(d);
}

/** Data compatta per i nomi di file: 20260115-1030 */
export function formatFileStamp(date) {
  const d = date instanceof Date ? date : new Date(date);
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}`
  );
}

export function formatNumber(value, options) {
  return new Intl.NumberFormat(currentLang, options).format(value);
}

/** Importo in euro, localizzato. */
export function formatCurrency(value) {
  return new Intl.NumberFormat(currentLang, { style: "currency", currency: "EUR" }).format(value);
}

/**
 * Collatore per ordinare stringhe (alias, banca, titolare) secondo la lingua
 * attiva. L'ordine delle chiavi di IndexedDB NON e' locale-aware: senza
 * Intl.Collator i nomi accentati finirebbero in fondo all'elenco.
 */
export function getCollator() {
  return new Intl.Collator(currentLang, { sensitivity: "base", numeric: true });
}

/* ------------------------------------------------------------------ *
 * Controllo di completezza dei dizionari
 * ------------------------------------------------------------------ */

function flatten(obj, prefix, out) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, path, out);
    else out.add(path);
  }
  return out;
}

/**
 * Verifica che tutte le lingue abbiano esattamente le stesse chiavi.
 * Regola dichiarata in src/i18n/it.js: ogni chiave deve esistere ovunque.
 *
 * @returns {{ok: boolean, problems: string[]}}
 */
export function checkCatalogues() {
  const problems = [];
  const sets = {};
  for (const [code, dict] of Object.entries(DICTS)) {
    sets[code] = flatten(dict, "", new Set());
  }
  const reference = FALLBACK_LANG;
  for (const [code, keys] of Object.entries(sets)) {
    if (code === reference) continue;
    for (const key of sets[reference]) {
      if (!keys.has(key)) problems.push(`${code}: manca "${key}"`);
    }
    for (const key of keys) {
      if (!sets[reference].has(key)) problems.push(`${code}: chiave in piu' "${key}"`);
    }
  }
  return { ok: problems.length === 0, problems };
}
