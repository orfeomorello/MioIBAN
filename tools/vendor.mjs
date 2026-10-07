#!/usr/bin/env node
/**
 * MioIBAN — Vendoring delle dipendenze
 *
 * PERCHE' ESISTE
 * MioIBAN non ha build step e promette di funzionare offline servendo solo il
 * proprio dominio (MioIBAN-SPEC.md §3 regola 5, §5.3, §11.1: CSP
 * `default-src 'self'`). Le dipendenze vanno quindi COPATE nel repository,
 * non caricate da una CDN.
 *
 * Questo script e' l'unico modo con cui entrano le dipendenze: e' leggibile,
 * verificabile e ripetibile (MioIBAN-SPEC.md §3 regola 6, "trasparenza").
 * NON installa nulla da npm e NON esegue script di terze parti: si limita a
 * scaricare file da URL pinnati e a calcolarne l'impronta.
 *
 * USO
 *   node tools/vendor.mjs            scarica e verifica
 *   node tools/vendor.mjs --check    verifica soltanto (non scrive)
 *
 * VERIFICA DI INTEGRITA'
 * Al primo giro lo script calcola gli SHA-256 e li registra in
 * vendor/VENDOR-LOCK.json. Ai giri successivi li RIVERIFICA: se un file
 * cambia, lo script esce con errore. Cosi' una sostituzione silenziosa della
 * dipendenza non puo' passare inosservata.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR_DIR = join(ROOT, "vendor");
const LOCK_FILE = join(VENDOR_DIR, "VENDOR-LOCK.json");

/**
 * Dipendenze da copare. Versione PINNATA: aggiornarla e' una decisione
 * esplicita, che va riportata in THIRD-PARTY.md e in MioIBAN-SPEC.md §5.7.
 *
 * ibantools e' doppia licenza "MIT OR MPL-2.0": questo progetto sceglie MIT
 * (MioIBAN-SPEC.md §4.1).
 */
const DEPENDENCIES = [
  {
    name: "ibantools",
    version: "4.5.4",
    license: "MIT OR MPL-2.0 (si sceglie MIT)",
    files: [
      {
        url: "https://cdn.jsdelivr.net/npm/ibantools@4.5.4/jsnext/ibantools.js",
        out: "ibantools.js",
        // Controllo di sanita': se il file non esporta queste funzioni,
        // non e' la libreria che ci aspettiamo.
        mustContain: [
          "export function isValidIBAN",
          "export function validateIBAN",
          "export function extractIBAN",
          "export function friendlyFormatIBAN",
          "export function getCountrySpecifications",
        ],
      },
      {
        url: "https://cdn.jsdelivr.net/npm/ibantools@4.5.4/LICENSE.MIT",
        out: "LICENSE-ibantools-MIT.txt",
        mustContain: ["MIT License"],
      },
    ],
  },
];

const checkOnly = process.argv.includes("--check");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadLock() {
  if (!(await exists(LOCK_FILE))) return {};
  try {
    return JSON.parse(await readFile(LOCK_FILE, "utf8"));
  } catch {
    console.warn("VENDOR-LOCK.json illeggibile: verra' rigenerato.");
    return {};
  }
}

async function download(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} su ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  await mkdir(VENDOR_DIR, { recursive: true });
  const lock = await loadLock();
  const nextLock = {};
  let problems = 0;

  for (const dep of DEPENDENCIES) {
    nextLock[dep.name] = { version: dep.version, license: dep.license, files: {} };

    for (const file of dep.files) {
      const target = join(VENDOR_DIR, file.out);
      const expected = lock[dep.name]?.files?.[file.out]?.sha256;
      let buffer = null;

      if (checkOnly) {
        if (!(await exists(target))) {
          console.error(`MANCANTE  ${file.out}`);
          problems++;
          continue;
        }
        buffer = await readFile(target);
      } else {
        try {
          buffer = await download(file.url);
        } catch (err) {
          console.error(`ERRORE   ${file.out}: ${err.message}`);
          problems++;
          continue;
        }
      }

      const digest = sha256(buffer);
      const text = buffer.toString("utf8");

      // Controllo di sanita' sul contenuto atteso.
      const missing = (file.mustContain || []).filter((needle) => !text.includes(needle));
      if (missing.length) {
        console.error(`SOSPETTO ${file.out}: mancano ${missing.join(", ")}`);
        problems++;
        continue;
      }

      // Verifica contro l'impronta registrata.
      if (expected && expected !== digest) {
        console.error(
          `INTEGRITA' ${file.out}: impronta diversa da VENDOR-LOCK.json\n` +
            `           attesa ${expected}\n` +
            `           trovata ${digest}`,
        );
        problems++;
        continue;
      }

      if (!checkOnly && buffer) {
        await writeFile(target, buffer);
      }

      nextLock[dep.name].files[file.out] = {
        url: file.url,
        sha256: digest,
        bytes: buffer.length,
      };
      console.log(
        `${expected ? "OK       " : "NUOVO    "}${file.out}  ${(buffer.length / 1024).toFixed(1)} KB  ${digest.slice(0, 16)}…`,
      );
    }
  }

  if (!checkOnly && problems === 0) {
    await writeFile(LOCK_FILE, JSON.stringify(nextLock, null, 2) + "\n");
    console.log(`\nImpronte registrate in vendor/VENDOR-LOCK.json`);
  }

  if (problems) {
    console.error(`\n${problems} problema/i. Vendorizzazione NON completata.`);
    process.exit(1);
  }
  console.log("\nVendorizzazione completata.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
