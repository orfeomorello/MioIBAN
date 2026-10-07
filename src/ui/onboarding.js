/**
 * MioIBAN — Onboarding (primo avvio)
 *
 * MioIBAN-SPEC.md §12.2: al primo avvio si mostra il disclaimer "as-is" e si
 * chiedono tema, grandezza testo e lingua. I pulsanti Esporta/Importa devono
 * restare ben visibili (non nascosti in un menu).
 *
 * Il disclaimer non e' un ostacolo da superare: e' l'informativa che rende
 * onesto il prodotto. Un solo bottone ("Ho capito") fa entrare nell'app.
 */

import { el } from "./dom.js";
import { t, LANGUAGES, setLanguage, currentLanguage } from "../i18n/index.js";
import { getPref, setPref } from "../core/prefs.js";
import { applyTheme, applyTextSize } from "./theme.js";

/** Gruppo di scelte esclusive (usato per tema e grandezza testo). */
function optionGroup(name, options, current, onPick) {
  const container = el("div", { class: "option-group", role: "group", "aria-label": name });
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

/**
 * Crea la vista di onboarding.
 * @param {{onComplete: Function}} options
 * @returns {{element: HTMLElement, actionBar: null}}
 */
export function createOnboarding(options) {
  const opts = options || {};

  /* --- Lingua --- */
  const languageGroup = optionGroup(
    t("onboarding.chooseLanguage"),
    LANGUAGES.map((lang) => ({ value: lang.code, label: lang.name })),
    currentLanguage(),
    (code) => {
      setLanguage(code);
      // I testi di questa pagina cambiano lingua: si ridisegna da capo,
      // mantenendo lo stato di accettazione.
      if (typeof opts.onLanguageChange === "function") opts.onLanguageChange();
    },
  );

  /* --- Tema --- */
  const themeGroup = optionGroup(
    t("onboarding.chooseTheme"),
    [
      { value: "light", label: t("settings.themeLight") },
      { value: "dark", label: t("settings.themeDark") },
      { value: "auto", label: t("settings.themeAuto") },
    ],
    getPref("tema"),
    (value) => applyTheme(value),
  );

  /* --- Grandezza testo --- */
  const sizeGroup = optionGroup(
    t("onboarding.chooseTextSize"),
    [
      { value: "normal", label: t("settings.textSizeNormal") },
      { value: "large", label: t("settings.textSizeLarge") },
      { value: "xlarge", label: t("settings.textSizeXLarge") },
    ],
    getPref("fontSize"),
    (value) => applyTextSize(value),
  );

  /* --- Disclaimer: un solo bottone, "Ho capito".
     Due bottoni (accetta + inizia) disorientano: non e' chiaro cosa fare.
     Toccare "Ho capito" dichiara di aver letto e fa entrare nell'app. */
  const startBtn = el("button", {
    type: "button",
    class: "btn btn--primary btn--big",
    text: t("onboarding.disclaimerAccept"),
    onClick: () => {
      setPref("onboardingCompleted", true);
      if (typeof opts.onComplete === "function") opts.onComplete();
    },
  });

  const element = el(
    "div",
    { class: "onboarding" },
    el("h1", { class: "onboarding__title", text: t("onboarding.welcome") }),
    el("p", { class: "onboarding__lead", text: t("app.tagline") }),
    el("p", { class: "hint", text: t("app.privacy") }),

    el("h2", { class: "section-title", text: t("onboarding.chooseLanguage") }),
    languageGroup,

    el("h2", { class: "section-title", text: t("onboarding.chooseTheme") }),
    themeGroup,

    el("h2", { class: "section-title", text: t("onboarding.chooseTextSize") }),
    sizeGroup,

    el("h2", { class: "section-title", text: t("onboarding.disclaimerTitle") }),
    el("div", { class: "disclaimer", text: t("onboarding.disclaimer") }),

    el("div", { class: "onboarding__actions" }, startBtn),
  );

  // Nota: al cambio lingua app.js ricostruisce questa vista da capo
  // (i testi sono valutati alla creazione). Non serve un ridisegno interno.
  return { element, actionBar: null };
}
