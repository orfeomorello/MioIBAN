/**
 * MioIBAN — Preferenze locali (localStorage)
 *
 * Responsabilita':
 * - Unico punto di accesso a localStorage per tutto il progetto.
 * - Namespace delle chiavi, valori di default, lettura/scrittura sicura.
 * - Non lancia MAI eccezioni verso il chiamante: in modalita' privata o con
 *   storage pieno restituisce i default e segnala il problema.
 *
 * MioIBAN-SPEC.md §3 regola 2: localStorage e' riservato alle PREFERENZE.
 * I record dei conti vanno in IndexedDB (src/core/storage.js).
 */

const NS = "mioiban.pref.";

/** Valori di default. Devono restare allineati a MioIBAN-SPEC.md §6.1. */
export const PREF_DEFAULTS = Object.freeze({
  tema: "light", // 'light' | 'dark' | 'auto' (default chiaro: lo cambia l'utente)
  vista: "schede", // 'schede' | 'righe'
  fontSize: "normal", // 'normal' | 'large' | 'xlarge'
  lang: null, // null = rileva dal browser
  onboardingCompleted: false,
});

const VALID = Object.freeze({
  tema: ["light", "dark", "auto"],
  vista: ["schede", "righe"],
  fontSize: ["normal", "large", "xlarge"],
});

let available = null;

/**
 * Verifica se localStorage e' realmente utilizzabile.
 * Su alcuni browser (Safari in navigazione privata) esiste ma lancia alla scrittura.
 */
export function isStorageAvailable() {
  if (available !== null) return available;
  try {
    const probe = NS + "__probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

/** Applica i vincoli di tipo/valore. Ritorna il default se il valore non e' ammesso. */
function coerce(key, value) {
  const allowed = VALID[key];
  if (allowed) return allowed.includes(value) ? value : PREF_DEFAULTS[key];
  if (key === "lang") return typeof value === "string" && value ? value : null;
  if (key === "onboardingCompleted") return value === true;
  return value;
}

/** Legge una preferenza. Ritorna sempre un valore valido. */
export function getPref(key) {
  if (!(key in PREF_DEFAULTS)) {
    throw new Error(`getPref: chiave sconosciuta "${key}"`);
  }
  if (!isStorageAvailable()) return PREF_DEFAULTS[key];
  try {
    const raw = window.localStorage.getItem(NS + key);
    if (raw === null) return PREF_DEFAULTS[key];
    return coerce(key, JSON.parse(raw));
  } catch {
    return PREF_DEFAULTS[key];
  }
}

/**
 * Scrive una preferenza.
 * @returns {{ok: boolean, error?: 'quota'|'unavailable'}}
 */
export function setPref(key, value) {
  if (!(key in PREF_DEFAULTS)) {
    throw new Error(`setPref: chiave sconosciuta "${key}"`);
  }
  if (!isStorageAvailable()) return { ok: false, error: "unavailable" };
  try {
    window.localStorage.setItem(NS + key, JSON.stringify(coerce(key, value)));
    return { ok: true };
  } catch (err) {
    const quota =
      err && (err.name === "QuotaExceededError" || err.code === 22 || err.code === 1014);
    return { ok: false, error: quota ? "quota" : "unavailable" };
  }
}

/** Tutte le preferenze, con i default applicati. */
export function getAllPrefs() {
  const out = {};
  for (const key of Object.keys(PREF_DEFAULTS)) out[key] = getPref(key);
  return out;
}

/**
 * Sostituisce in blocco le preferenze (usato dall'import di un backup).
 * @returns {{ok: boolean, error?: string}}
 */
export function replaceAllPrefs(prefs) {
  if (!prefs || typeof prefs !== "object") return { ok: true };
  let result = { ok: true };
  for (const key of Object.keys(PREF_DEFAULTS)) {
    if (key in prefs) {
      const r = setPref(key, prefs[key]);
      if (!r.ok) result = r;
    }
  }
  return result;
}

/** Rimuove tutte le preferenze MioIBAN. Usato dal reset e nei test. */
export function clearAllPrefs() {
  if (!isStorageAvailable()) return;
  for (const key of Object.keys(PREF_DEFAULTS)) {
    try {
      window.localStorage.removeItem(NS + key);
    } catch {
      /* ignorato */
    }
  }
}
