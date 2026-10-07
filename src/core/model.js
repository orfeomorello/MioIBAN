/**
 * MioIBAN — Modello dei dati
 *
 * Responsabilita':
 * - Creare record di conto validi e normalizzati.
 * - Applicare i limiti di lunghezza e la pulizia del testo in ingresso.
 * - Cercare, filtrare e ordinare i conti (in memoria: il dataset e' minuscolo).
 *
 * Questo file NON conosce IndexedDB (se ne occupa src/core/storage.js) e NON
 * conosce il DOM: e' logica pura, quindi testabile e riutilizzabile.
 *
 * MioIBAN-SPEC.md §6.1: l'IBAN si salva SEMPRE in formato elettronico (senza
 * spazi) e NESSUN dato derivato (ABI, CAB, conto, paese) viene persistito.
 */

import { validateIban, validateBic } from "./iban.js";

/** Limiti di lunghezza dei campi liberi. Evitano record spropositati. */
export const LIMITS = Object.freeze({
  alias: 60,
  titolare: 80,
  banca: 80,
  bic: 11,
  note: 500,
});

/** Campi testuali del conto, con il limite da applicare. */
const TEXT_FIELDS = ["alias", "titolare", "banca", "note"];

/**
 * Genera un UUID v4.
 * `crypto.randomUUID()` richiede un secure context (HTTPS o localhost): se non
 * e' disponibile — per esempio aprendo l'app da un IP di rete locale — si
 * ricade su `getRandomValues`, che non ha quel requisito.
 */
export function newId() {
  const c = typeof crypto !== "undefined" ? crypto : null;

  if (c && typeof c.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      /* si prosegue con il fallback */
    }
  }

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Versione 4 e variante RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return (
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-${hex.slice(20)}`
  );
}

/**
 * Pulisce un campo testuale: rimuove i caratteri di controllo, comprime gli
 * spazi e applica il limite di lunghezza.
 * @param {unknown} value
 * @param {number} maxLength
 * @returns {string}
 */
export function sanitizeText(value, maxLength) {
  if (value === null || value === undefined) return "";
  let out = String(value)
    // Caratteri di controllo (inclusi tab e a capo): si trasformano in spazio,
    // poi si comprimono. Nessun carattere di controllo entra nei dati.
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[\u00A0\u202F\u2007\u2009\u200B\uFEFF\u2060]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (typeof maxLength === "number" && out.length > maxLength) {
    out = out.slice(0, maxLength).trim();
  }
  return out;
}

/** Nome da mostrare per un conto: alias, poi titolare, poi l'IBAN formattato. */
export function accountDisplayName(account, fallbackIban) {
  if (!account) return "";
  return (
    account.alias ||
    account.titolare ||
    account.banca ||
    fallbackIban ||
    account.iban ||
    ""
  );
}

/**
 * Crea un record di conto pronto per essere salvato.
 * L'IBAN viene normalizzato qui: se non e' formalmente valido, lancia.
 *
 * @param {object} draft Campi grezzi provenienti dal form.
 * @param {object} [options]
 * @param {string} [options.id]      Per gli aggiornamenti: id esistente.
 * @param {number} [options.createdAt] Per gli aggiornamenti: data di creazione.
 * @returns {object} Il record completo.
 */
export function createAccount(draft, options) {
  const opts = options || {};
  const ibanResult = validateIban(draft.iban);
  if (!ibanResult.valid) {
    throw new Error("createAccount: IBAN non valido");
  }

  const bicInput = sanitizeText(draft.bic, LIMITS.bic).toUpperCase();
  const bicResult = bicInput ? validateBic(bicInput) : null;
  if (bicResult && !bicResult.valid) {
    throw new Error("createAccount: BIC non valido");
  }

  const now = Date.now();
  const account = {
    id: opts.id || newId(),
    // Sempre elettronico, senza spazi: e' la chiave dei duplicati (§6.1).
    iban: ibanResult.electronic,
    titolare: sanitizeText(draft.titolare, LIMITS.titolare),
    banca: sanitizeText(draft.banca, LIMITS.banca),
    bic: bicInput,
    alias: sanitizeText(draft.alias, LIMITS.alias),
    note: sanitizeText(draft.note, LIMITS.note),
    groupId: typeof draft.groupId === "string" && draft.groupId ? draft.groupId : null,
    isFavorite: draft.isFavorite === true,
    createdAt: typeof opts.createdAt === "number" ? opts.createdAt : now,
    lastUsedAt: now,
  };

  return account;
}

/**
 * Applica una modifica a un conto esistente mantenendo id e createdAt.
 * @returns {object} Il record aggiornato.
 */
export function updateAccount(existing, patch) {
  return createAccount(
    Object.assign({}, existing, patch),
    { id: existing.id, createdAt: existing.createdAt },
  );
}

/** Restituisce una copia del conto con `lastUsedAt` aggiornato. */
export function touchAccount(account) {
  return Object.assign({}, account, { lastUsedAt: Date.now() });
}

/** Inverte il flag dei preferiti. */
export function toggleFavorite(account) {
  return Object.assign({}, account, { isFavorite: !account.isFavorite });
}

/**
 * Esito della validazione di una bozza dal form.
 * @typedef {object} DraftValidation
 * @property {boolean} ok
 * @property {object}  iban   Esito di validateIban()
 * @property {object|null} bic Esito di validateBic(), o null se il BIC e' vuoto
 * @property {object}  fieldErrors  Errori per campo, come chiavi i18n
 */

/**
 * Valida una bozza senza salvarla.
 * L'IBAN e' obbligatorio; il BIC e' opzionale ma, se presente, deve essere valido.
 * @param {object} draft
 * @returns {DraftValidation}
 */
export function validateDraft(draft) {
  const ibanResult = validateIban(draft && draft.iban);
  const fieldErrors = {};

  if (!ibanResult.valid && ibanResult.code !== "EMPTY") {
    fieldErrors.iban = ibanResult.i18nKey;
  }

  const bicInput = sanitizeText(draft && draft.bic, LIMITS.bic).toUpperCase();
  const bicResult = bicInput ? validateBic(bicInput) : null;
  if (bicResult && !bicResult.valid) {
    fieldErrors.bic = bicResult.i18nKey;
  }

  return {
    ok: Object.keys(fieldErrors).length === 0 && ibanResult.valid,
    iban: ibanResult,
    bic: bicResult,
    fieldErrors,
  };
}

/* ------------------------------------------------------------------ *
 * Ricerca, filtri e ordinamento
 * ------------------------------------------------------------------ */

/**
 * Normalizza una stringa per la ricerca: minuscolo e senza accenti, cosi' che
 * cercare "perugia" trovi "Perugia" e cercare "e" trovi "è".
 */
export function foldForSearch(value) {
  const s = typeof value === "string" ? value : String(value || "");
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Costruisce l'indice di ricerca testuale di un conto. */
function searchableText(account) {
  return foldForSearch(
    [
      account.alias,
      account.titolare,
      account.banca,
      account.note,
      account.bic,
      account.iban,
      // L'utente cerca spesso l'IBAN con gli spazi: si indicizza anche formattato.
      account.iban ? account.iban.replace(/(.{4})(?!$)/g, "$1 ") : "",
    ]
      .filter(Boolean)
      .join(" \u0000 "),
  );
}

/**
 * Filtra i conti.
 * Il dataset e' di 5-30 record: si filtra in memoria, senza indici. E' piu'
 * semplice, piu' prevedibile e sufficientemente veloce (MioIBAN-SPEC.md §5.7).
 *
 * @param {object[]} accounts
 * @param {{query?: string, favoritesOnly?: boolean, groupId?: string|null}} filter
 * @returns {object[]}
 */
export function filterAccounts(accounts, filter) {
  const f = filter || {};
  const query = foldForSearch(sanitizeText(f.query, 100));

  return (accounts || []).filter((account) => {
    if (f.favoritesOnly && !account.isFavorite) return false;
    if (f.groupId && account.groupId !== f.groupId) return false;
    if (!query) return true;
    return searchableText(account).includes(query);
  });
}

/**
 * Ordina i conti: prima i preferiti, poi per nome visualizzato, con l'ordine
 * alfabetico della lingua attiva (senza Intl.Collator i nomi accentati
 * finirebbero in fondo).
 *
 * @param {object[]} accounts
 * @param {Intl.Collator} collator
 * @param {'nome'|'recente'} [mode]
 * @returns {object[]} Una nuova lista ordinata.
 */
export function sortAccounts(accounts, collator, mode) {
  const coll = collator || new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
  const list = (accounts || []).slice();

  if (mode === "recente") {
    return list.sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
  }

  return list.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    const nameA = accountDisplayName(a, a.iban);
    const nameB = accountDisplayName(b, b.iban);
    const byName = coll.compare(nameA, nameB);
    if (byName !== 0) return byName;
    return coll.compare(a.iban || "", b.iban || "");
  });
}

/** Raggruppa i conti per `groupId`. I conti senza gruppo finiscono sotto `null`. */
export function groupByGroup(accounts) {
  const map = new Map();
  for (const account of accounts || []) {
    const key = account.groupId || null;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(account);
  }
  return map;
}

/** Conteggio dei conti per un gruppo, per le chip dei filtri. */
export function countByGroup(accounts) {
  const counts = new Map();
  for (const account of accounts || []) {
    const key = account.groupId || null;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}
