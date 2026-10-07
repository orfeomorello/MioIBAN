import test from "node:test";
import assert from "node:assert/strict";
import { extractCandidates, formatIban } from "../src/core/iban.js";
import { createFormView } from "../src/ui/form.js";
import { checkCatalogues, setLanguage, t } from "../src/i18n/index.js";

const IT_IBAN = "IT60X0542811101000000123456";
const DE_IBAN = "DE89370400440532013000";

class TestNode {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.dataset = {};
    this.style = { setProperty() {} };
    this.className = "";
    this.value = "";
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this._textContent = "";
    this.classList = {
      add: (...classes) => {
        this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...classes])].join(" ");
      },
    };
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join("");
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "id") this.id = String(value);
    if (name === "class") this.className = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  get firstChild() {
    return this.children[0] ?? null;
  }

  get firstElementChild() {
    return this.children.find((child) => child.tagName !== "#TEXT") ?? null;
  }

  addEventListener(type, handler) {
    (this.listeners[type] ||= []).push(handler);
  }

  dispatchEvent(event) {
    event.target = this;
    for (const handler of this.listeners[event.type] || []) handler(event);
    return true;
  }

  focus() {}
  setSelectionRange() {}
  remove() { this.parentNode?.removeChild(this); }
  click() { this.dispatchEvent({ type: "click" }); }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const isMatch = (node) => {
      if (selector.startsWith("#")) return node.id === selector.slice(1);
      if (selector.startsWith(".")) return node.className.split(/\s+/).includes(selector.slice(1));
      return node.tagName.toLowerCase() === selector.toLowerCase();
    };
    const matches = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (isMatch(child)) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }
}

const documentStub = {
  createElement(tag) { return new TestNode(tag, this); },
  createTextNode(text) {
    const node = new TestNode("#text", this);
    node._textContent = String(text);
    return node;
  },
};

function withDocument(fn) {
  const previousDocument = globalThis.document;
  const previousNode = globalThis.Node;
  globalThis.document = documentStub;
  globalThis.Node = TestNode;
  try {
    return fn();
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousNode === undefined) delete globalThis.Node;
    else globalThis.Node = previousNode;
  }
}

test("estrae un IBAN italiano da testo libero", () => {
  assert.deepEqual(extractCandidates(`Ciao, il mio IBAN è ${IT_IBAN}, grazie!`), [IT_IBAN]);
});

test("estrae più IBAN validi, rimuove i duplicati e ignora un checksum errato", () => {
  const invalid = `${IT_IBAN.slice(0, -1)}7`;
  assert.deepEqual(
    extractCandidates(`IT: ${IT_IBAN}\nDE: ${formatIban(DE_IBAN)}\nRipetuto: ${IT_IBAN}\nFalso: ${invalid}`),
    [IT_IBAN, DE_IBAN],
  );
});

test("estrae un IBAN spezzato da a capo e caratteri invisibili", () => {
  assert.deepEqual(
    extractCandidates(`IBAN:\u00a0IT60X0542811101000\n000123456\u200b`),
    [IT_IBAN],
  );
});

test("ignora paese sconosciuto, testo senza IBAN e input non testuale", () => {
  assert.deepEqual(extractCandidates("US64SVBKUS6S3300958879"), []);
  assert.deepEqual(extractCandidates("nessun conto presente"), []);
  assert.deepEqual(extractCandidates(null), []);
});

test("il form riempie l'unico candidato senza salvare automaticamente", () => withDocument(() => {
  let saved = 0;
  const view = createFormView({
    groups: [],
    onSave: () => { saved += 1; },
    onCancel() {},
    checkDuplicate: async () => null,
    onOpenExisting() {},
  });
  const host = documentStub.createElement("div");
  host.appendChild(view.element);
  const message = host.querySelector("#paste-message");
  const ibanInput = host.querySelector("#field-iban");
  message.value = `Ciao, il mio IBAN è ${IT_IBAN}, grazie`;
  message.dispatchEvent({ type: "input" });
  assert.equal(ibanInput.value, "IT60 X054 2811 1010 0000 0123 456");
  assert.match(host.textContent, /La scelta è nel campo IBAN/);
  message.value = `Questo è testo innocuo. ${"x".repeat(20_001)} ${IT_IBAN}`;
  message.dispatchEvent({ type: "input" });
  assert.equal(ibanInput.value, "");
  assert.ok(host.textContent.includes("Il testo supera il limite di sicurezza"));
  assert.ok(host.querySelector(".iban-paste__results").textContent.includes("Il testo supera il limite di sicurezza"));
  assert.equal(saved, 0);
  message.value = "Questo messaggio non contiene un IBAN";
  message.dispatchEvent({ type: "input" });
  assert.equal(ibanInput.value, "");
  assert.match(host.textContent, /Non ho trovato IBAN/);
}));

test("il limite di 20.000 caratteri e le relative stringhe sono presenti in entrambe le lingue", () => {
  assert.match(createFormView.toString(), /PASTE_TEXT_MAX_CHARS/);
  assert.equal(checkCatalogues().ok, true);
  for (const lang of ["it", "en"]) {
    setLanguage(lang, { persist: false, updateUrl: false });
    assert.ok(t("paste.messageTooLong"));
    assert.ok(t("paste.resultsLabel"));
    assert.ok(t("paste.singleFoundExisting"));
  }
  setLanguage("it", { persist: false, updateUrl: false });
});

test("i cataloghi e i plurali dell'incolla intelligente sono completi in it/en", () => {
  assert.equal(checkCatalogues().ok, true);
  for (const [lang, forms] of [
    ["it", ["Ho trovato 1 IBAN formalmente valido. Scegli quello da archiviare:", "Ho trovato 2 IBAN formalmente validi. Scegli quelli da archiviare:"]],
    ["en", ["I found 1 formally valid IBAN. Choose the one to save:", "I found 2 formally valid IBANs. Choose which one to save:"]],
  ]) {
    setLanguage(lang, { persist: false, updateUrl: false });
    assert.equal(t("paste.multipleFound", { count: 1 }), forms[0]);
    assert.equal(t("paste.multipleFound", { count: 2 }), forms[1]);
    assert.ok(t("paste.chooseCandidate"));
    assert.ok(t("paste.resultsLabel"));
    assert.ok(t("paste.messageTooLong"));
    assert.ok(t("paste.singleFoundExisting"));
  }
  setLanguage("it", { persist: false, updateUrl: false });
});

test("un solo candidato non sovrascrive un IBAN già digitato senza scelta", () => withDocument(() => {
  const view = createFormView({ groups: [], onSave() {}, onCancel() {}, checkDuplicate: async () => null, onOpenExisting() {} });
  const host = documentStub.createElement("div");
  host.appendChild(view.element);
  const message = host.querySelector("#paste-message");
  const ibanInput = host.querySelector("#field-iban");
  ibanInput.value = `DE89 3704 0044 0532 0130 00`;
  message.value = `Il nuovo IBAN è ${IT_IBAN}`;
  message.dispatchEvent({ type: "input" });
  assert.equal(ibanInput.value, "DE89 3704 0044 0532 0130 00");
  assert.match(host.textContent, /non verrà sostituito senza il tuo consenso/);
  host.querySelector(".iban-paste__candidate").click();
  assert.equal(ibanInput.value, "IT60 X054 2811 1010 0000 0123 456");
}));

test("il form richiede la scelta quando il messaggio contiene più IBAN", () => withDocument(() => {
  const view = createFormView({
    groups: [],
    onSave() {},
    onCancel() {},
    checkDuplicate: async () => null,
    onOpenExisting() {},
  });
  const host = documentStub.createElement("div");
  host.appendChild(view.element);
  const message = host.querySelector("#paste-message");
  const ibanInput = host.querySelector("#field-iban");
  message.value = `IBAN italiano ${IT_IBAN}; IBAN tedesco ${DE_IBAN}`;
  message.dispatchEvent({ type: "input" });
  const choices = host.querySelectorAll(".iban-paste__candidate");
  assert.equal(choices.length, 2);
  assert.equal(ibanInput.value, "");
  choices[1].click();
  assert.equal(ibanInput.value, "DE89 3704 0044 0532 0130 00");
  message.value = `Solo il tedesco: ${DE_IBAN}`;
  message.dispatchEvent({ type: "input" });
  assert.equal(ibanInput.value, "DE89 3704 0044 0532 0130 00");
}));

test("incollare più candidati non sovrascrive un IBAN digitato manualmente", () => withDocument(() => {
  const view = createFormView({
    groups: [],
    onSave() {},
    onCancel() {},
    checkDuplicate: async () => null,
    onOpenExisting() {},
  });
  const host = documentStub.createElement("div");
  host.appendChild(view.element);
  const message = host.querySelector("#paste-message");
  const ibanInput = host.querySelector("#field-iban");
  ibanInput.value = "GB29 NWBK 6016 1331 9268 19";
  message.value = `Italiano ${IT_IBAN}; Tedesco ${DE_IBAN}`;
  message.dispatchEvent({ type: "input" });
  assert.equal(ibanInput.value, "GB29 NWBK 6016 1331 9268 19");
}));
