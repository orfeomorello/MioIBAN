/**
 * MioIBAN — Form di inserimento e modifica di un conto (MioIBAN-SPEC.md §7, F-02)
 *
 * Due cose delicate in questo file:
 *
 * 1. FORMATTAZIONE LIVE DELL'IBAN CON PRESERVAZIONE DEL CURSORE.
 *    Si formatta a blocchi di 4 mentre si digita, ma senza spostare il cursore
 *    a fine campo: si conta quanti caratteri "veri" stanno prima del cursore e
 *    si rimette il cursore dopo altrettanti caratteri nel testo formattato.
 *    Senza questo accorgimento, digitare al centro dell'IBAN diventa impossibile.
 *
 * 2. CONTROLLO DUPLICATI ASINCRONO.
 *    Il controllo interroga IndexedDB: se l'utente continua a digitare mentre la
 *    risposta e' in volo, il risultato vecchio non deve sovrascrivere quello
 *    nuovo. Si usa un contatore di richieste e si scartano le risposte obsolete.
 */

import { el, render, clear, levelIcon } from "./dom.js";
import { t } from "../i18n/index.js";
import { LIMITS, sanitizeText, validateDraft } from "../core/model.js";
import { formatIban, normalizeIban, extractCandidates } from "../core/iban.js";

/** Massima lunghezza di un IBAN secondo il registro (34 caratteri). */
const IBAN_MAX_CHARS = 34;

/** Limita il lavoro di estrazione a testi plausibili da messaggi copiati. */
const PASTE_TEXT_MAX_CHARS = 20000;

/**
 * Formatta un IBAN a blocchi di 4 e calcola la nuova posizione del cursore.
 * @param {string} rawValue Valore attuale del campo.
 * @param {number} caretPos Posizione attuale del cursore.
 * @returns {{value: string, caret: number}}
 */
export function formatIbanWithCaret(rawValue, caretPos) {
  const before = rawValue.slice(0, caretPos);
  const realBefore = before.replace(/[^A-Za-z0-9]/g, "").length;

  const clean = rawValue.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, IBAN_MAX_CHARS);
  const formatted = clean.replace(/(.{4})(?!$)/g, "$1 ");

  let caret = 0;
  if (realBefore > 0) {
    let seen = 0;
    caret = formatted.length;
    for (let i = 0; i < formatted.length; i += 1) {
      if (/[A-Za-z0-9]/.test(formatted[i])) {
        seen += 1;
        if (seen === realBefore) {
          caret = i + 1;
          break;
        }
      }
    }
  }

  return { value: formatted, caret };
}

/** Un campo di testo etichettato. */
function field(labelKey, input) {
  return el(
    "label",
    { class: "field" },
    el("span", { class: "field__label", text: t(labelKey) }),
    input,
  );
}

/**
 * Crea il form.
 *
 * @param {object} options
 * @param {object|null} options.account          Conto da modificare, o null.
 * @param {object[]} options.groups
 * @param {Function} options.onSave              Riceve la bozza.
 * @param {Function} options.onCancel
 * @param {Function} options.checkDuplicate      (iban) => Promise<account|null>
 * @param {Function} options.onOpenExisting      (account) => void
 * @returns {{element: HTMLElement, actionBar: HTMLElement, refreshLanguage: Function}}
 */
export function createFormView(options) {
  const opts = options || {};
  const existing = opts.account || null;
  const isEdit = !!existing;

  /* --- Campi --- */

  const ibanInput = el("input", {
    type: "text",
    class: "field__input field__input--mono",
    id: "field-iban",
    inputmode: "text",
    autocomplete: "off",
    autocapitalize: "characters",
    spellcheck: "false",
    placeholder: t("placeholders.iban"),
    value: existing ? formatIban(existing.iban) : "",
    onInput: onIbanInput,
    onBlur: () => scheduleValidate(),
  });

  const pasteTitle = el("h2", {
    class: "iban-paste__title",
    id: "paste-message-title",
    text: t("paste.title"),
  });
  const pasteHint = el("p", { class: "hint", text: t("paste.hint") });
  const pasteMessage = el("textarea", {
    class: "field__textarea",
    id: "paste-message",
    rows: "4",
    placeholder: t("paste.placeholder"),
    "aria-label": t("paste.messageLabel"),
    onInput: onPasteMessageInput,
  });
  const pasteLabelText = el("span", { class: "field__label", text: t("paste.messageLabel") });
  const pasteLabel = el(
    "label",
    { class: "field" },
    pasteLabelText,
    pasteMessage,
  );
  const pasteResults = el("div", {
    class: "iban-paste__results",
    role: "region",
    "aria-label": t("paste.resultsLabel"),
    hidden: true,
  });
  const pastePanel = el(
    "section",
    { class: "iban-paste", "aria-labelledby": "paste-message-title", hidden: isEdit },
    pasteTitle,
    pasteHint,
    pasteLabel,
    pasteResults,
  );
  let pasteCandidates = [];
  let selectedPasteCandidate = null;
  let lastPasteAppliedCandidate = null;
  let pasteOverLimit = false;

  const aliasInput = textInput("field-alias", "placeholders.alias", existing && existing.alias, LIMITS.alias);
  const holderInput = textInput("field-holder", "placeholders.holder", existing && existing.titolare, LIMITS.titolare);
  const bankInput = textInput("field-bank", "placeholders.bank", existing && existing.banca, LIMITS.banca);
  const bicInput = textInput("field-bic", "placeholders.bic", existing && existing.bic, LIMITS.bic);
  bicInput.classList.add("field__input--mono");

  const noteInput = el("textarea", {
    class: "field__textarea",
    id: "field-note",
    rows: "3",
    maxlength: String(LIMITS.note),
    placeholder: t("placeholders.note"),
    value: existing ? existing.note || "" : "",
  });

  const groupSelect = el(
    "select",
    { class: "field__select", id: "field-group" },
    el("option", { value: "", text: t("fields.none") }),
    (opts.groups || []).map((g) =>
      el("option", {
        value: g.id,
        text: g.name,
        selected: existing && existing.groupId === g.id,
      }),
    ),
  );

  const favoriteInput = el("input", {
    type: "checkbox",
    id: "field-favorite",
    checked: !!(existing && existing.isFavorite),
  });

  function textInput(id, placeholderKey, value, maxLength) {
    return el("input", {
      type: "text",
      class: "field__input",
      id,
      maxlength: String(maxLength),
      autocomplete: "off",
      placeholder: t(placeholderKey),
      value: value || "",
    });
  }

  /* --- Stato e messaggi --- */

  const ibanStatus = el("p", { class: "status", hidden: true });
  const bicStatus = el("p", { class: "status", hidden: true });
  const duplicateBox = el("div", { class: "status status--warn", hidden: true });

  const saveBtn = el("button", {
    type: "submit",
    // Il pulsante vive nella barra azioni, FUORI dal <form>: senza l'attributo
    // `form` che lo associa per id, premere "Salva" non invierebbe nulla.
    form: "account-form",
    class: "btn btn--primary btn--big",
    disabled: true,
    text: t("actions.save"),
  });

  const cancelBtn = el("button", {
    type: "button",
    class: "btn btn--big",
    text: t("actions.cancel"),
    onClick: () => opts.onCancel(),
  });

  const form = el(
    "form",
    { id: "account-form", class: "form", novalidate: true, onSubmit: onSubmit },
    pastePanel,
    field("fields.iban", ibanInput),
    ibanStatus,
    duplicateBox,
    field("fields.alias", aliasInput),
    field("fields.holder", holderInput),
    field("fields.bank", bankInput),
    field("fields.bic", bicInput),
    bicStatus,
    field("fields.note", noteInput),
    field("fields.group", groupSelect),
    el(
      "label",
      { class: "field field--inline" },
      favoriteInput,
      el("span", { text: t("fields.favorite") }),
    ),
  );

  const element = el(
    "div",
    {},
    el("h1", { class: "view-title", text: isEdit ? t("actions.edit") : t("actions.add") }),
    form,
  );

  const actionBar = el("div", { class: "action-bar__inner" }, cancelBtn, saveBtn);

  /* --- Comportamento --- */

  function onIbanInput(event) {
    lastPasteAppliedCandidate = null;
    selectedPasteCandidate = null;
    const input = event.target;
    const { value, caret } = formatIbanWithCaret(input.value, input.selectionStart || 0);
    if (input.value !== value) {
      input.value = value;
      try {
        input.setSelectionRange(caret, caret);
      } catch {
        /* alcuni browser mobili non lo permettono: si prosegue */
      }
    }
    scheduleValidate();
  }

  /**
   * Incolla intelligente: ritaglia dal testo libero tutti i candidati e li
   * valida tramite l'adattatore ibantools/CIN. Un solo candidato valido
   * compila il campo IBAN; più candidati richiedono una scelta esplicita.
   * In nessun caso il conto viene salvato senza premere "Salva".
   */
  function onPasteMessageInput() {
    const previousPasteCandidate = selectedPasteCandidate || lastPasteAppliedCandidate;
    const isOverLimit = pasteMessage.value.length > PASTE_TEXT_MAX_CHARS;
    pasteOverLimit = isOverLimit;
    if (isOverLimit) {
      pasteMessage.value = pasteMessage.value.slice(0, PASTE_TEXT_MAX_CHARS);
    }
    pasteHint.textContent = isOverLimit ? t("paste.messageTooLong") : t("paste.hint");

    // Se il campo contiene ancora l'ultimo candidato inserito da questo
    // pannello, rimuovilo prima di elaborare il nuovo testo. Un valore digitato
    // manualmente non viene mai cancellato dall'incolla intelligente.
    if (lastPasteAppliedCandidate && normalizeIban(ibanInput.value) === lastPasteAppliedCandidate) {
      ibanInput.value = "";
      scheduleValidate();
    }
    lastPasteAppliedCandidate = null;
    pasteCandidates = extractCandidates(isOverLimit ? "" : pasteMessage.value);
    selectedPasteCandidate = null;

    if (pasteCandidates.length === 1) {
      const currentIban = normalizeIban(ibanInput.value);
      if (!currentIban || currentIban === pasteCandidates[0]) {
        setIbanFromPaste(pasteCandidates[0]);
        return;
      }
    }

    // Se prima era stato selezionato un candidato fra più risultati e ora il
    // testo è stato modificato, non lasciarlo nel campo come se fosse ancora
    // la proposta corrente.
    if (previousPasteCandidate && normalizeIban(ibanInput.value) === previousPasteCandidate) {
      ibanInput.value = "";
      scheduleValidate();
    }
    renderPasteResults();
  }

  function setIbanFromPaste(candidate) {
    selectedPasteCandidate = candidate;
    lastPasteAppliedCandidate = candidate;
    ibanInput.value = formatIban(candidate);
    try {
      ibanInput.setSelectionRange(ibanInput.value.length, ibanInput.value.length);
    } catch {
      /* alcuni browser mobili non lo permettono: si prosegue */
    }
    scheduleValidate();
    renderPasteResults();
  }

  function renderPasteResults() {
    clear(pasteResults);
    if (!pasteMessage.value.trim()) {
      pasteResults.hidden = true;
      return;
    }

    pasteResults.hidden = false;
    if (pasteOverLimit) {
      pasteResults.appendChild(
        el("p", {
          class: "iban-paste__announcement status status--warn",
          role: "status",
          text: t("paste.messageTooLong"),
        }),
      );
      return;
    }
    if (pasteCandidates.length === 0) {
      pasteResults.appendChild(
        el("p", {
          class: "iban-paste__announcement status status--warn",
          role: "status",
          text: t("paste.noneFound"),
        }),
      );
      return;
    }

    if (pasteCandidates.length === 1) {
      const candidate = pasteCandidates[0];
      const alreadySelected = selectedPasteCandidate === candidate;
      const hasDifferentIban =
        normalizeIban(ibanInput.value) !== "" && normalizeIban(ibanInput.value) !== candidate;
      pasteResults.appendChild(
        el("p", {
          class: "iban-paste__announcement status status--ok",
          role: "status",
          text: alreadySelected
            ? t("paste.selected")
            : hasDifferentIban
              ? t("paste.singleFoundExisting")
              : t("paste.singleFound"),
        }),
      );
      pasteResults.appendChild(
        el("span", { class: "iban-paste__candidate-value", text: formatIban(candidate) }),
      );
      if (hasDifferentIban && !alreadySelected) {
        pasteResults.appendChild(
          el("button", {
            type: "button",
            class: "btn iban-paste__candidate",
            "aria-pressed": "false",
            text: t("paste.useCandidate"),
            onClick: () => setIbanFromPaste(candidate),
          }),
        );
      }
      return;
    }

    pasteResults.appendChild(
      el("p", {
        class: "iban-paste__announcement status status--ok",
        role: "status",
        text: t("paste.multipleFound", { count: pasteCandidates.length }),
      }),
    );
    const candidateList = el("div", {
      class: "iban-paste__candidates",
      role: "group",
      "aria-label": t("paste.chooseCandidate"),
    });
    for (const candidate of pasteCandidates) {
      candidateList.appendChild(
        el(
          "button",
          {
            type: "button",
            class: "btn iban-paste__candidate",
            "aria-pressed": selectedPasteCandidate === candidate ? "true" : "false",
            onClick: () => setIbanFromPaste(candidate),
          },
          el("span", { class: "iban-paste__candidate-value", text: formatIban(candidate) }),
          el("span", { class: "iban-paste__candidate-action", text: t("paste.useCandidate") }),
        ),
      );
    }
    pasteResults.appendChild(candidateList);
    if (selectedPasteCandidate) {
      pasteResults.appendChild(el("p", { class: "hint", text: t("paste.selected") }));
    }
  }

  /** Mostra un esito di validazione nel nodo indicato. */
  function renderStatus(node, result) {
    if (!result || !result.i18nKey || result.code === "EMPTY") {
      node.hidden = true;
      clear(node);
      return;
    }
    node.hidden = false;
    node.className = `status status--${result.level}`;
    render(
      node,
      el("span", { class: "status__icon", "aria-hidden": "true", text: levelIcon(result.level) }),
      el("span", { text: t(result.i18nKey) }),
    );
  }

  let duplicateToken = 0;
  let duplicateAccount = null;

  function renderDuplicate(account) {
    clear(duplicateBox);
    if (!account) {
      duplicateBox.hidden = true;
      return;
    }
    duplicateBox.hidden = false;
    const name = account.alias || account.titolare || formatIban(account.iban);
    render(
      duplicateBox,
      el("span", { class: "status__icon", "aria-hidden": "true", text: levelIcon("warn") }),
      el("div", {},
        el("span", {
          text: account.alias
            ? t("accounts.duplicateWarning", { alias: name })
            : t("accounts.duplicateWarningNoAlias"),
        }),
        el("button", {
          type: "button",
          class: "btn btn--ghost",
          text: t("accounts.duplicateOpen"),
          onClick: () => opts.onOpenExisting(account),
        }),
      ),
    );
  }

  /** Valida la bozza corrente e aggiorna l'interfaccia. */
  function scheduleValidate() {
    const draft = readDraft();
    const result = validateDraft(draft);

    renderStatus(ibanStatus, result.iban);
    if (result.bic) renderStatus(bicStatus, result.bic);
    else {
      bicStatus.hidden = true;
      clear(bicStatus);
    }

    saveBtn.disabled = !result.ok;

    // Controllo duplicati: solo se l'IBAN e' valido.
    duplicateToken += 1;
    const token = duplicateToken;

    if (!result.iban.valid || typeof opts.checkDuplicate !== "function") {
      duplicateAccount = null;
      renderDuplicate(null);
      return;
    }

    const electronic = result.iban.electronic;
    opts
      .checkDuplicate(electronic, isEdit ? existing.id : null)
      .then((found) => {
        if (token !== duplicateToken) return; // risposta obsoleta
        duplicateAccount = found || null;
        renderDuplicate(duplicateAccount);
      })
      .catch(() => {
        if (token !== duplicateToken) return;
        duplicateAccount = null;
        renderDuplicate(null);
      });
  }

  function readDraft() {
    return {
      iban: ibanInput.value,
      alias: sanitizeText(aliasInput.value, LIMITS.alias),
      titolare: sanitizeText(holderInput.value, LIMITS.titolare),
      banca: sanitizeText(bankInput.value, LIMITS.banca),
      bic: sanitizeText(bicInput.value, LIMITS.bic).toUpperCase(),
      note: sanitizeText(noteInput.value, LIMITS.note),
      groupId: groupSelect.value || null,
      isFavorite: favoriteInput.checked,
    };
  }

  function onSubmit(event) {
    event.preventDefault();
    const result = validateDraft(readDraft());
    if (!result.ok) {
      // Si porta il focus sul primo campo problematico.
      if (result.fieldErrors.iban) ibanInput.focus();
      else if (result.fieldErrors.bic) bicInput.focus();
      return;
    }
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    opts.onSave(readDraft());
  }

  // Stato iniziale: se si modifica un conto, l'IBAN e' gia' valido.
  scheduleValidate();

  function refreshLanguage() {
    pasteTitle.textContent = t("paste.title");
    pasteHint.textContent = pasteOverLimit ? t("paste.messageTooLong") : t("paste.hint");
    pasteLabelText.textContent = t("paste.messageLabel");
    pasteMessage.placeholder = t("paste.placeholder");
    pasteMessage.setAttribute("aria-label", t("paste.messageLabel"));
    pasteResults.setAttribute("aria-label", t("paste.resultsLabel"));
    renderPasteResults();
    renderStatus(ibanStatus, validateDraft(readDraft()).iban);
    renderDuplicate(duplicateAccount);
    clear(saveBtn);
    saveBtn.textContent = t("actions.save");
    clear(cancelBtn);
    cancelBtn.textContent = t("actions.cancel");
  }

  return { element, actionBar, refreshLanguage, focusIban: () => ibanInput.focus() };
}
