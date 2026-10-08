// Genera android/app/src/main/java/it/mioiban/app/core/IbanRegistry.kt
// dal registro di ibantools vendorizzato (lunghezza e regex BBAN per paese).
// Uso: node tools/gen-android-registry.mjs
import { getCountrySpecifications } from "../vendor/ibantools.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, "..", "android", "app", "src", "main", "java", "it", "mioiban", "app", "core", "IbanRegistry.kt");

const specs = getCountrySpecifications();
const entries = [];
for (const [code, spec] of Object.entries(specs)) {
  if (!spec || !spec.chars) continue;
  const regex = spec.bban_regexp
    ? JSON.stringify(spec.bban_regexp).replace(/\$/g, "\\$")
    : "null";
  entries.push(`        "${code}" to Country(${spec.chars}, ${regex}),`);
}

const source = `package it.mioiban.app.core

// FILE GENERATO da tools/gen-android-registry.mjs a partire da ibantools 4.5.4
// (vendor/ibantools.js). Non modificare a mano: rigenerare il file.

/** Registro di un paese: lunghezza totale e regex del BBAN (null = nessuna). */
data class Country(val length: Int, val bbanRegex: String?)

object IbanRegistry {
    val countries: Map<String, Country> = mapOf(
${entries.join("\n")}
    )
}
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, source, "utf8");
console.log("Paesi generati:", entries.length, "->", outFile);
