// Genera il registro dei paesi IBAN dalla libreria vendorizzata (una riga per paese).
// Uso: node tools/dump-registry.mjs
import { getCountrySpecifications } from "../vendor/ibantools.js";

const specs = getCountrySpecifications();
const rows = [];
for (const [code, spec] of Object.entries(specs)) {
  if (spec && spec.chars) rows.push(`${code}:${spec.chars}`);
}
console.log(rows.join(" "));
console.log("TOTAL", rows.length);
