/**
 * MioIBAN — Helper per la costruzione del DOM
 *
 * PERCHE' ESISTE
 * MioIBAN-SPEC.md §11.2 impone una regola di sicurezza: **mai `innerHTML` con
 * dati dell'utente**. È l'unico vettore XSS realistico in un'app che mostra
 * testo inserito dall'utente. Invece di affidarsi alla disciplina di chi
 * scrive il codice, questo helper rende la cosa strutturale:
 *
 *   - `el()` accetta solo testo, che viene assegnato con `textContent`;
 *   - passare una proprietà `innerHTML` o `outerHTML` **lancia un errore**.
 *
 * Cosi' la regola non puo' essere violata per distrazione.
 */

/** Proprietà vietate: qualunque tentativo di usarle e' un errore di programmazione. */
const FORBIDDEN_PROPS = new Set(["innerHTML", "outerHTML", "insertAdjacentHTML", "html"]);

function appendChildren(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue;

    if (Array.isArray(child)) {
      appendChildren(node, child);
      continue;
    }
    if (child instanceof Node) {
      node.appendChild(child);
      continue;
    }
    // Qualunque altra cosa e' testo: textContent, mai innerHTML.
    node.appendChild(document.createTextNode(String(child)));
  }
}

/**
 * Crea un elemento.
 *
 * @param {string} tag
 * @param {object|null} props
 *   - `class`      -> className
 *   - `dataset`    -> data-* (oggetto)
 *   - `style`      -> stili inline (oggetto)
 *   - `onClick`    -> addEventListener('click', ...)  (qualsiasi `onXxx`)
 *   - `text`       -> contenuto testuale
 *   - `hidden`, `disabled`, `checked`, `selected` -> proprietà booleane
 *   - `aria-*`, `role`, `type`, ... -> attributi
 * @param {...unknown} children Stringhe, numeri, nodi o array annidati.
 * @returns {HTMLElement}
 */
export function el(tag, props, ...children) {
  const node = document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (FORBIDDEN_PROPS.has(key)) {
        throw new Error(
          `el(): "${key}" e' vietato (MioIBAN-SPEC.md §11.2). Usa textContent o passa testo come figlio.`,
        );
      }
      if (value === null || value === undefined || value === false) continue;

      if (key === "class") {
        node.className = value;
      } else if (key === "text") {
        node.textContent = String(value);
      } else if (key === "dataset") {
        Object.assign(node.dataset, value);
      } else if (key === "style" && typeof value === "object") {
        for (const [prop, val] of Object.entries(value)) {
          if (val !== null && val !== undefined) node.style.setProperty(prop, String(val));
        }
      } else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (
        value === true &&
        (key === "hidden" || key === "disabled" || key === "checked" || key === "selected")
      ) {
        node[key] = true;
      } else if (value === true) {
        node.setAttribute(key, "");
      } else {
        node.setAttribute(key, String(value));
      }
    }
  }

  appendChildren(node, children);
  return node;
}

/** DocumentFragment da una lista di figli. */
export function frag(...children) {
  const f = document.createDocumentFragment();
  appendChildren(f, children);
  return f;
}

/** Svuota un nodo. */
export function clear(node) {
  if (!node) return node;
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Sostituisce il contenuto di un nodo. */
export function render(node, ...children) {
  clear(node);
  appendChildren(node, children);
  return node;
}

/** Rimuove un nodo dal DOM, se presente. */
export function remove(node) {
  if (node && node.parentNode) node.parentNode.removeChild(node);
  return node;
}

/** Cerca il primo elemento che soddisfa il selettore, con errore se manca. */
export function mustFind(selector, root) {
  const found = (root || document).querySelector(selector);
  if (!found) throw new Error(`Elemento obbligatorio non trovato: ${selector}`);
  return found;
}

/**
 * Icone testuali.
 * Sono caratteri, non immagini: nessuna risorsa remota, nessun font di icone
 * (MioIBAN-SPEC.md §5.3). Sono sempre accompagnate da testo o `aria-label`.
 */
export const ICON = Object.freeze({
  ok: "\u2713",
  warn: "\u26A0",
  error: "\u2715",
  star: "\u2605",
  starOutline: "\u2606",
  back: "\u2190",
  close: "\u2715",
  search: "\u2315",
  copy: "\u29C9",
  print: "\u2399",
  share: "\u21AA",
  edit: "\u270E",
  trash: "\u{1F5D1}", // cestino dei rifiuti: riconoscibile anche senza testo
  speaker: "\u25B6",
  stop: "\u25A0",
  invert: "\u25D1",
  expand: "\u26F6",
  plus: "\uFF0B",
  settings: "\u2699",
});

/** Restituisce l'icona di stato corrispondente a un livello di errore. */
export function levelIcon(level) {
  if (level === "ok") return ICON.ok;
  if (level === "warn") return ICON.warn;
  return ICON.error;
}
