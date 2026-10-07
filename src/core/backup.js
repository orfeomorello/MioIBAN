/**
 * MioIBAN — Export e import del backup (MioIBAN-SPEC.md §6.2, §6.3)
 *
 * Regole che questo file deve rispettare:
 *  - l'export rappresenta lo STATO INTERO dell'app (conti + gruppi + preferenze);
 *  - l'import verifica `schemaVersion` e blocca un backup piu' recente;
 *  - l'import NON sovrascrive nulla senza conferma esplicita (regola 4, §3);
 *  - l'operazione di sostituzione e' atomica (vedi storage.importState).
 *
 * Nessun dato lascia il dispositivo: il file viene creato e letto localmente
 * con Blob e FileReader (regola 1, §3).
 */

import {
  exportState,
  validateBackup,
  importState,
  EXPORT_SCHEMA_VERSION,
} from "../core/storage.js";
import { getAllPrefs, replaceAllPrefs } from "../core/prefs.js";
import { formatFileStamp } from "../i18n/index.js";

/**
 * Crea ed esporta il file di backup.
 * @param {string} appVersion
 * @returns {Promise<{fileName: string, accounts: number}>}
 */
export async function downloadBackup(appVersion) {
  const state = await exportState(getAllPrefs(), appVersion);

  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const fileName = `MioIBAN-backup-${formatFileStamp(new Date())}.json`;

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Il rilascio dell'URL va fatto dopo che il browser ha avviato il download.
  setTimeout(() => URL.revokeObjectURL(url), 30000);

  return { fileName, accounts: state.accounts.length };
}

/**
 * Legge un file di backup scelto dall'utente.
 * @param {File} file
 * @returns {Promise<object>} Il payload gia' parsato.
 * @throws {Error} con `code` = 'importInvalid' se non e' JSON valido.
 */
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      const err = new Error("lettura del file fallita");
      err.code = "importInvalid";
      reject(err);
    };
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        const err = new Error("JSON non valido");
        err.code = "importInvalid";
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}

/**
 * Esamina un backup e prepara il riepilogo da mostrare all'utente.
 * @param {object} payload
 * @returns {{ok: true, accounts: object[], groups: object[], preferences: object, schemaVersion: number}
 *          | {ok: false, errorKey: string}}
 */
export function inspectBackup(payload) {
  const check = validateBackup(payload);
  if (!check.ok) {
    // `validateBackup` restituisce gia' le chiavi i18n di backup.*
    return { ok: false, errorKey: `backup.${check.error}` };
  }
  return {
    ok: true,
    accounts: check.accounts,
    groups: check.groups,
    preferences: payload.preferences && typeof payload.preferences === "object" ? payload.preferences : {},
    schemaVersion: typeof payload.schemaVersion === "number" ? payload.schemaVersion : EXPORT_SCHEMA_VERSION,
  };
}

/**
 * Applica un backup ispezionato. Da chiamare SOLO dopo conferma esplicita.
 * @param {{accounts: object[], groups: object[], preferences: object}} inspected
 * @returns {Promise<{count: number}>}
 */
export async function applyBackup(inspected) {
  const result = await importState(inspected.accounts, inspected.groups);
  if (inspected.preferences && Object.keys(inspected.preferences).length) {
    replaceAllPrefs(inspected.preferences);
  }
  return result;
}
