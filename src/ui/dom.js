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
 * Icone vettoriali dell'app (SVG inline).
 *
 * PERCHE' DISEGNATE QUI
 * MioIBAN-SPEC.md §5.3 vieta le risorse remote: niente font di icone da CDN.
 * I glifi testuali (← ✎ ⚙) si vedono diversi su ogni telefono e in alcuni
 * casi diventano emoji colorate. Queste icone sono geometria pura in stile
 * Feather (licenza MIT, vedi THIRD-PARTY.md): nitide ovunque, seguono il
 * colore del testo (`currentColor`, quindi anche tema chiaro/scuro) e non
 * scaricano nulla. Sono sempre decorative (`aria-hidden`): ogni pulsante
 * icona ha comunque testo o `aria-label` (§10).
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** Nome -> elementi interni dell'SVG (solo geometria, niente testo). */
const ICONS = Object.freeze({
  back: [
    ["line", { x1: "19", y1: "12", x2: "5", y2: "12" }],
    ["polyline", { points: "12 19 5 12 12 5" }],
  ],
  edit: [
    ["path", { d: "M12 20h9" }],
    ["path", { d: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" }],
  ],
  trash: [
    ["polyline", { points: "3 6 5 6 21 6" }],
    ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }],
    ["line", { x1: "10", y1: "11", x2: "10", y2: "17" }],
    ["line", { x1: "14", y1: "11", x2: "14", y2: "17" }],
  ],
  copy: [
    ["rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }],
    ["path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }],
  ],
  print: [
    ["polyline", { points: "6 9 6 2 18 2 18 9" }],
    ["path", { d: "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" }],
    ["rect", { x: "6", y: "14", width: "12", height: "8" }],
  ],
  share: [
    ["circle", { cx: "18", cy: "5", r: "3" }],
    ["circle", { cx: "6", cy: "12", r: "3" }],
    ["circle", { cx: "18", cy: "19", r: "3" }],
    ["line", { x1: "8.59", y1: "13.51", x2: "15.42", y2: "17.49" }],
    ["line", { x1: "15.41", y1: "6.51", x2: "8.59", y2: "10.49" }],
  ],
  search: [
    ["circle", { cx: "11", cy: "11", r: "8" }],
    ["line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }],
  ],
  settings: [
    ["line", { x1: "4", y1: "21", x2: "4", y2: "14" }],
    ["line", { x1: "4", y1: "10", x2: "4", y2: "3" }],
    ["line", { x1: "12", y1: "21", x2: "12", y2: "12" }],
    ["line", { x1: "12", y1: "8", x2: "12", y2: "3" }],
    ["line", { x1: "20", y1: "21", x2: "20", y2: "16" }],
    ["line", { x1: "20", y1: "12", x2: "20", y2: "3" }],
    ["line", { x1: "1", y1: "14", x2: "7", y2: "14" }],
    ["line", { x1: "9", y1: "8", x2: "15", y2: "8" }],
    ["line", { x1: "17", y1: "16", x2: "23", y2: "16" }],
  ],
  star: [
    ["polygon", {
      points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2",
      fill: "currentColor",
      stroke: "none",
    }],
  ],
  starOutline: [
    ["polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" }],
  ],
  check: [[
    "polyline", { points: "20 6 9 17 4 12" },
  ]],
  x: [
    ["line", { x1: "18", y1: "6", x2: "6", y2: "18" }],
    ["line", { x1: "6", y1: "6", x2: "18", y2: "18" }],
  ],
  alert: [
    ["path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }],
    ["line", { x1: "12", y1: "9", x2: "12", y2: "13" }],
    ["line", { x1: "12", y1: "17", x2: "12.01", y2: "17" }],
  ],
  play: [
    ["polygon", { points: "5 3 19 12 5 21 5 3", fill: "currentColor", stroke: "none" }],
  ],
  stop: [
    ["rect", { x: "6", y: "6", width: "12", height: "12", rx: "1", fill: "currentColor", stroke: "none" }],
  ],
  invert: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 2a10 10 0 0 1 0 20z", fill: "currentColor", stroke: "none" }],
  ],
  plus: [
    ["line", { x1: "12", y1: "5", x2: "12", y2: "19" }],
    ["line", { x1: "5", y1: "12", x2: "19", y2: "12" }],
  ],
});

/**
 * Crea un'icona SVG inline.
 * Si costruisce con createElementNS (mai innerHTML, come tutto il resto).
 * @param {string} name Uno dei nomi di ICONS.
 * @returns {SVGSVGElement}
 */
export function icon(name) {
  const parts = ICONS[name];
  if (!parts) {
    throw new Error(`icon(): nome sconosciuto "${name}"`);
  }
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const [tag, attrs] of parts) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
      node.setAttribute(key, value);
    }
    svg.appendChild(node);
  }
  return svg;
}

/** Restituisce l'icona di stato corrispondente a un livello di errore. */
export function levelIcon(level) {
  if (level === "ok") return icon("check");
  if (level === "warn") return icon("alert");
  return icon("x");
}
