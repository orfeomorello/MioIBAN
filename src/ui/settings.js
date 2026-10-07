/**
 * MioIBAN — Impostazioni (MioIBAN-SPEC.md §7)
 *
 * Contiene anche il presidio piu' importante per l'utente: il BACKUP.
 * Il testo dell'interfaccia lo dice senza addolcire: il backup e' l'unico modo
 * di non perdere i dati, e nessuno puo' recuperarli al posto suo (§12.2).
 */

import { el, render, ICON } from "./dom.js";
import { t, LANGUAGES, setLanguage, currentLanguage } from "../i18n/index.js";
import { getPref, setPref } from "../core/prefs.js";
import { applyTheme, applyTextSize, setTheme, setTextSize } from "./theme.js";
import { showToast } from "./actions.js";
import { openSheet, confirmSheet } from "./sheet.js";
import { downloadBackup, readBackupFile, inspectBackup, applyBackup } from "../core/backup.js";

/** Gruppo di scelte esclusive. */
function optionGroup(labelText, options, current, onPick) {
  const container = el("div", { class: "option-group", role: "group", "aria-label": labelText });
  const buttons = [];

  function select(value) {
    for (const btn of buttons) {
      btn.setAttribute("aria-pressed", String(btn.dataset.value === value));
    }
    onPick(value);
  }

  for (const option of options) {
    const btn = el("button", {
      type: "button",
      class: "option",
      dataset: { value: option.value },
      "aria-pressed": String(option.value === current),
      text: option.label,
      onClick: () => select(option.value),
    });
    buttons.push(btn);
    container.appendChild(btn);
  }
  return container;
}

function section(titleKey) {
  return el("h2", { class: "section-title", text: t(titleKey) });
}

/**
 * @param {object} options
 * @param {string} options.appVersion
 * @param {number} options.accountCount
 * @param {Function} options.onReload       Ricarica i dati dopo un import.
 * @param {Function} options.onLanguageChange
 * @returns {{element: HTMLElement, actionBar: null}}
 */
export function createSettingsView(options) {
  const opts = options || {};

  /* --- Aspetto --- */

  const themeGroup = optionGroup(
    t("settings.theme"),
    [
      { value: "light", label: t("settings.themeLight") },
      { value: "dark", label: t("settings.themeDark") },
      { value: "auto", label: t("settings.themeAuto") },
    ],
    getPref("tema"),
    (value) => setTheme(value),
  );

  const sizeGroup = optionGroup(
    t("settings.textSize"),
    [
      { value: "normal", label: t("settings.textSizeNormal") },
      { value: "large", label: t("settings.textSizeLarge") },
      { value: "xlarge", label: t("settings.textSizeXLarge") },
    ],
    getPref("fontSize"),
    (value) => setTextSize(value),
  );

  /* --- Lingua --- */

  const languageGroup = optionGroup(
    t("settings.language"),
    LANGUAGES.map((lang) => ({ value: lang.code, label: lang.name })),
    currentLanguage(),
    (code) => {
      if (setLanguage(code) && typeof opts.onLanguageChange === "function") {
        opts.onLanguageChange();
      }
    },
  );

  /* --- Formato di copia predefinito --- */

  const copyGroup = optionGroup(
    t("settings.copyFormat"),
    [
      { value: "spaced", label: t("settings.copyFormatSpaced") },
      { value: "compact", label: t("settings.copyFormatCompact") },
    ],
    getPref("copyFormat"),
    (value) => setPref("copyFormat", value),
  );

  /* --- Gruppi ---
     I gruppi sono previsti dal modello dati (§6) e dai filtri (§7, F-05):
     senza un modo per crearli, quelle funzioni resterebbero irraggiungibili. */

  const groupNameInput = el("input", {
    type: "text",
    class: "field__input",
    id: "new-group-name",
    maxlength: "40",
    autocomplete: "off",
    placeholder: t("settings.groupNamePlaceholder"),
    "aria-label": t("settings.groupAdd"),
  });

  const addGroupBtn = el("button", {
    type: "button",
    class: "btn",
    text: t("settings.groupAdd"),
    onClick: () => {
      const name = groupNameInput.value;
      if (!name || !name.trim()) {
        groupNameInput.focus();
        return;
      }
      // Si svuota subito: se il salvataggio fallisce, un messaggio lo dira'.
      groupNameInput.value = "";
      if (typeof opts.onCreateGroup === "function") opts.onCreateGroup(name);
    },
  });

  const groups = opts.groups || [];
  const counts = opts.groupCounts instanceof Map ? opts.groupCounts : new Map();

  const groupsList = el(
    "div",
    { class: "kv-list" },
    groups.length
      ? groups.map((group) => {
          const count = counts.get(group.id) || 0;
          return el(
            "div",
            { class: "kv" },
            el("span", { class: "kv__value", text: group.name }),
            count
              ? el("span", { class: "kv__key", text: t("accounts.count", { count }) })
              : null,
            el("button", {
              type: "button",
              class: "btn btn--ghost btn--icon",
              "aria-label": `${t("actions.delete")} — ${group.name}`,
              text: ICON.trash,
              onClick: () =>
                confirmSheet({
                  title: t("actions.delete"),
                  body: t("settings.groupDeleteConfirm", { name: group.name }),
                  confirmLabel: t("actions.delete"),
                  cancelLabel: t("actions.cancel"),
                  destructive: true,
                  onConfirm: () => opts.onDeleteGroup(group),
                }),
            }),
          );
        })
      : el("p", { class: "hint", text: t("settings.groupEmpty") }),
  );

  const groupsSection = el(
    "div",
    {},
    el("p", { class: "hint", text: t("settings.groupsHint") }),
    el("div", { class: "settings__actions" }, groupNameInput, addGroupBtn),
    groupsList,
  );

  /* --- Backup --- */

  const exportStatus = el("p", { class: "status status--ok", hidden: true });

  const exportBtn = el("button", {
    type: "button",
    class: "btn btn--big",
    onClick: async () => {
      exportBtn.disabled = true;
      try {
        const result = await downloadBackup(opts.appVersion);
        exportStatus.hidden = false;
        exportStatus.textContent = `${t("backup.exportTitle")}: ${result.fileName} — ${t("backup.exportHint")}`;
      } catch {
        showToast(t("errors.unexpected"), { duration: 4000 });
      } finally {
        exportBtn.disabled = false;
      }
    },
  });

  const importInput = el("input", {
    type: "file",
    accept: "application/json,.json",
    id: "backup-file",
    class: "visually-hidden",
    onChange: onImportFileChosen,
  });

  const importBtn = el("button", {
    type: "button",
    class: "btn btn--big",
    onClick: () => importInput.click(),
  });

  render(
    exportBtn,
    el("span", { "aria-hidden": "true", text: "\u2913" }),
    el("span", { text: t("settings.exportNow") }),
  );
  render(
    importBtn,
    el("span", { "aria-hidden": "true", text: "\u2912" }),
    el("span", { text: t("settings.importNow") }),
  );

  async function onImportFileChosen(event) {
    const file = event.target.files && event.target.files[0];
    // Si azzera subito: se l'utente sceglie due volte lo stesso file,
    // l'evento `change` deve scattare comunque.
    event.target.value = "";
    if (!file) return;

    let payload;
    try {
      payload = await readBackupFile(file);
    } catch {
      showToast(t("backup.importInvalid"), { duration: 4500 });
      return;
    }

    const inspected = inspectBackup(payload);
    if (!inspected.ok) {
      showToast(t(inspected.errorKey), { duration: 4500 });
      return;
    }

    if (!inspected.accounts.length) {
      showToast(t("backup.nothingToImport"), { duration: 4000 });
      return;
    }

    // Regola 4 (§3): nessuna sovrascrittura senza conferma ESPLICITA.
    confirmSheet({
      title: t("backup.importTitle"),
      body: t("backup.importSummary", {
        incoming: t("accounts.count", { count: inspected.accounts.length }),
        current: t("accounts.count", { count: opts.accountCount || 0 }),
      }),
      confirmLabel: t("backup.importConfirm"),
      cancelLabel: t("actions.cancel"),
      destructive: true,
      onConfirm: async () => {
        try {
          await applyBackup(inspected);
          // Le preferenze possono essere cambiate dal backup: si riapplicano.
          applyTheme();
          applyTextSize();
          showToast(t("backup.importOk"), { duration: 3500 });
          if (typeof opts.onReload === "function") opts.onReload();
        } catch {
          showToast(t("errors.unexpected"), { duration: 4000 });
        }
      },
    });
  }

  /* --- Informazioni --- */

  const disclaimerBtn = el("button", {
    type: "button",
    class: "btn",
    text: t("settings.showDisclaimer"),
    onClick: () =>
      openSheet({
        title: t("settings.showDisclaimer"),
        body: el("div", { class: "disclaimer", text: t("onboarding.disclaimer") }),
        actions: [{ label: t("nav.close"), variant: "primary" }],
      }),
  });

  const element = el(
    "div",
    { class: "settings" },
    el("h1", { class: "view-title", text: t("settings.title") }),

    section("settings.appearance"),
    themeGroup,

    section("settings.text"),
    sizeGroup,

    section("settings.language"),
    languageGroup,

    section("settings.copyFormat"),
    copyGroup,

    section("settings.groups"),
    groupsSection,

    section("settings.backup"),
    el("p", { class: "hint", text: t("settings.backupHint") }),
    el("div", { class: "settings__actions" }, exportBtn, importBtn, importInput),
    exportStatus,

    section("settings.about"),
    el("p", { class: "kv" },
      el("span", { class: "kv__key", text: t("app.name") }),
      el("span", { class: "kv__value", text: t("settings.version", { version: opts.appVersion || "" }) }),
    ),
    el("p", { class: "hint", text: t("settings.aboutPrivacyHint") }),
    disclaimerBtn,
  );

  return { element, actionBar: null };
}
