/**
 * MioIBAN — Storage locale (IndexedDB nativo)
 *
 * PERCHE' UN WRAPPER PROPRIO
 * Il vincolo di progetto e' "solo dipendenze con licenza MIT"
 * (MioIBAN-SPEC.md §5.7). Le alternative a Dexie sono tutte non conformi:
 *   - dexie            Apache-2.0  -> esclusa
 *   - idb              ISC         -> esclusa
 *   - idb-keyval       Apache-2.0  -> esclusa
 *   - localforage      Apache-2.0  -> esclusa
 * Questo file e' quindi codice del progetto (licenza MIT) e usa solo l'API
 * IndexedDB nativa. In cambio: zero dipendenze, zero KB di bundle, nessuna
 * sorpresa di licenza.
 *
 * DUE NUMERI DI VERSIONE, INDIPENDENTI
 *   - INDEXEDDB_VERSION  contatore delle migrazioni del database locale.
 *   - schemaVersion (2)  contratto del FORMATO DI EXPORT (MioIBAN-SPEC.md §6).
 * Possono divergere: cambiare il formato del file JSON non richiede di
 * toccare gli object store, e viceversa.
 *
 * SCELTE GUIDATE DAL CONTESTO
 * Il dataset e' minuscolo (5-30 record di solo testo). Quindi:
 *   - si indicizza solo `iban` (unique: impedisce i duplicati a livello di
 *     storage) e `groupId`.
 *   - ricerca e filtro per preferiti si fanno in memoria. IndexedDB non ammette
 *     booleani come chiave di indice, quindi indicizzare `isFavorite` non
 *     sarebbe nemmeno possibile.
 */

import { PREF_DEFAULTS } from "./prefs.js";

/** Migrazioni degli object store. Vedi nota sopra: non e' schemaVersion. */
const INDEXEDDB_VERSION = 1;

const DB_NAME = "mioiban";

/** Versione del formato di export/import. MioIBAN-SPEC.md §6. */
export const EXPORT_SCHEMA_VERSION = 2;

const STORE_ACCOUNTS = "accounts";
const STORE_GROUPS = "groups";

/** Codici di errore di storage, stabili. */
export const STORAGE_ERROR = Object.freeze({
  UNAVAILABLE: "UNAVAILABLE",
  QUOTA: "QUOTA",
  DUPLICATE_IBAN: "DUPLICATE_IBAN",
  SCHEMA_TOO_NEW: "SCHEMA_TOO_NEW",
  INVALID_BACKUP: "INVALID_BACKUP",
  UNKNOWN: "UNKNOWN",
});

export class StorageError extends Error {
  constructor(code, message, cause) {
    super(message || code);
    this.name = "StorageError";
    this.code = code;
    this.cause = cause;
  }
}

/* ------------------------------------------------------------------ *
 * Helper sulle promesse di IndexedDB
 * ------------------------------------------------------------------ */

/** Promisifica una IDBRequest. */
function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Attende il completamento di una transazione.
 * ATTENZIONE: una transazione IndexedDB si chiude da sola se nel frattempo si
 * attende una promessa NON-IndexedDB. Non inserire `await` estranei dentro il
 * blocco della transazione.
 */
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("transazione annullata"));
  });
}

function classifyError(err) {
  if (err instanceof StorageError) return err;
  const name = err && err.name;
  if (name === "QuotaExceededError") {
    return new StorageError(STORAGE_ERROR.QUOTA, "spazio di archiviazione esaurito", err);
  }
  if (name === "ConstraintError") {
    return new StorageError(STORAGE_ERROR.DUPLICATE_IBAN, "IBAN gia' presente", err);
  }
  return new StorageError(STORAGE_ERROR.UNKNOWN, (err && err.message) || "errore", err);
}

/* ------------------------------------------------------------------ *
 * Apertura del database
 * ------------------------------------------------------------------ */

let dbPromise = null;

/** True se IndexedDB esiste in questo browser. */
export function isAvailable() {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/** Apre (una sola volta) il database. */
export function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!isAvailable()) {
      reject(new StorageError(STORAGE_ERROR.UNAVAILABLE, "IndexedDB non disponibile"));
      return;
    }

    let request;
    try {
      request = indexedDB.open(DB_NAME, INDEXEDDB_VERSION);
    } catch (err) {
      reject(new StorageError(STORAGE_ERROR.UNAVAILABLE, "apertura fallita", err));
      return;
    }

    request.onupgradeneeded = (event) => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
        const accounts = db.createObjectStore(STORE_ACCOUNTS, { keyPath: "id" });
        // Unico: e' la garanzia a livello di storage che non esistano duplicati.
        accounts.createIndex("iban", "iban", { unique: true });
        accounts.createIndex("groupId", "groupId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_GROUPS)) {
        db.createObjectStore(STORE_GROUPS, { keyPath: "id" });
      }
      void event;
    };

    request.onsuccess = () => {
      const db = request.result;
      // Se un'altra scheda apre una versione piu' recente, chiudiamo per non
      // bloccare l'aggiornamento.
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () =>
      reject(new StorageError(STORAGE_ERROR.UNAVAILABLE, "apertura fallita", request.error));

    request.onblocked = () => {
      // Un'altra scheda tiene il DB aperto su una versione precedente.
      reject(
        new StorageError(
          STORAGE_ERROR.UNAVAILABLE,
          "chiudi le altre schede di MioIBAN e riprova",
        ),
      );
    };
  });

  return dbPromise;
}

/** Chiude il database (usato nei test e alla dismissione). */
export async function closeDatabase() {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    db.close();
  } catch {
    /* ignorato */
  }
  dbPromise = null;
}

async function withStore(storeName, mode, fn) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  let result;
  try {
    result = await fn(store);
  } catch (err) {
    try {
      tx.abort();
    } catch {
      /* ignorato */
    }
    throw classifyError(err);
  }
  await txDone(tx);
  return result;
}

/* ------------------------------------------------------------------ *
 * Conti
 * ------------------------------------------------------------------ */

/** Tutti i conti, ordinati dal piu' recente usato. */
export async function getAllAccounts() {
  const rows = await withStore(STORE_ACCOUNTS, "readonly", (store) => req(store.getAll()));
  return rows.sort((a, b) => (b.lastUsedAt || b.createdAt || 0) - (a.lastUsedAt || a.createdAt || 0));
}

export async function getAccount(id) {
  return withStore(STORE_ACCOUNTS, "readonly", (store) => req(store.get(id)));
}

/** Inserisce o aggiorna un conto. Lancia StorageError DUPLICATE_IBAN se l'IBAN esiste gia'. */
export async function saveAccount(account) {
  if (!account || !account.id) {
    throw new StorageError(STORAGE_ERROR.UNKNOWN, "conto senza id");
  }
  return withStore(STORE_ACCOUNTS, "readwrite", (store) => req(store.put(account)));
}

export async function deleteAccount(id) {
  return withStore(STORE_ACCOUNTS, "readwrite", (store) => req(store.delete(id)));
}

/**
 * Cerca un conto per IBAN (formato elettronico, senza spazi).
 * Usa l'indice unico: e' il controllo duplicati di MioIBAN-SPEC.md §7 (F-05).
 */
export async function findAccountByIban(ibanElectronic) {
  return withStore(STORE_ACCOUNTS, "readonly", (store) =>
    req(store.index("iban").get(ibanElectronic)),
  );
}

export async function countAccounts() {
  return withStore(STORE_ACCOUNTS, "readonly", (store) => req(store.count()));
}

/* ------------------------------------------------------------------ *
 * Gruppi
 * ------------------------------------------------------------------ */

export async function getAllGroups() {
  const rows = await withStore(STORE_GROUPS, "readonly", (store) => req(store.getAll()));
  return rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

export async function saveGroup(group) {
  if (!group || !group.id) {
    throw new StorageError(STORAGE_ERROR.UNKNOWN, "gruppo senza id");
  }
  return withStore(STORE_GROUPS, "readwrite", (store) => req(store.put(group)));
}

export async function deleteGroup(id) {
  return withStore(STORE_GROUPS, "readwrite", (store) => req(store.delete(id)));
}

/* ------------------------------------------------------------------ *
 * Export / Import full-state
 * ------------------------------------------------------------------ */

/**
 * Esporta lo stato completo: conti, gruppi e preferenze.
 * Non include nulla di derivato: MioIBAN-SPEC.md §6.1.
 */
export async function exportState(prefs, appVersion) {
  const [accounts, groups] = await Promise.all([getAllAccounts(), getAllGroups()]);
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportDate: new Date().toISOString(),
    appVersion: appVersion || "1.0.0",
    accounts,
    groups,
    preferences: Object.assign({}, PREF_DEFAULTS, prefs || {}),
  };
}

/** Legge il solo schemaVersion di un oggetto gia' parsato, senza validare il resto. */
export function readSchemaVersion(payload) {
  if (!payload || typeof payload !== "object") return null;
  const v = payload.schemaVersion;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Verifica che un backup abbia la forma attesa.
 * @returns {{ok: true, accounts: object[], groups: object[]} |
 *           {ok: false, error: string}}
 */
export function validateBackup(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "importInvalid" };
  }
  const version = readSchemaVersion(payload);
  if (version === null) return { ok: false, error: "importInvalid" };
  // Un backup piu' nuovo non e' importabile: MioIBAN-SPEC.md §6.3.
  if (version > EXPORT_SCHEMA_VERSION) return { ok: false, error: "importNewerSchema" };

  if (!Array.isArray(payload.accounts)) return { ok: false, error: "importIncomplete" };

  const accounts = [];
  for (const raw of payload.accounts) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "importIncomplete" };
    const id = typeof raw.id === "string" && raw.id ? raw.id : null;
    const iban = typeof raw.iban === "string" && raw.iban ? raw.iban : null;
    if (!id || !iban) return { ok: false, error: "importIncomplete" };
    accounts.push(raw);
  }

  const groups = Array.isArray(payload.groups)
    ? payload.groups.filter((g) => g && typeof g === "object" && typeof g.id === "string")
    : [];

  return { ok: true, accounts, groups };
}

/**
 * Sostituisce integralmente lo stato locale. Operazione ATOMICA: o entra tutto
 * o non entra nulla. La conferma esplicita dell'utente e' responsabilita' del
 * chiamante (MioIBAN-SPEC.md §6.3, regola 4).
 *
 * @returns {{count: number}}
 */
export async function importState(accounts, groups) {
  const db = await openDatabase();

  let tx;
  try {
    tx = db.transaction([STORE_ACCOUNTS, STORE_GROUPS], "readwrite");
  } catch (err) {
    throw classifyError(err);
  }

  const accountsStore = tx.objectStore(STORE_ACCOUNTS);
  const groupsStore = tx.objectStore(STORE_GROUPS);

  // Nessun await estraneo qui dentro: la transazione si chiuderebbe.
  accountsStore.clear();
  groupsStore.clear();
  for (const account of accounts) accountsStore.put(account);
  for (const group of groups) groupsStore.put(group);

  try {
    await txDone(tx);
  } catch (err) {
    throw classifyError(err);
  }
  return { count: accounts.length };
}

/** Svuota tutto (conti e gruppi). Usato dai test e dal reset manuale. */
export async function clearAll() {
  const db = await openDatabase();
  const tx = db.transaction([STORE_ACCOUNTS, STORE_GROUPS], "readwrite");
  tx.objectStore(STORE_ACCOUNTS).clear();
  tx.objectStore(STORE_GROUPS).clear();
  await txDone(tx);
}
