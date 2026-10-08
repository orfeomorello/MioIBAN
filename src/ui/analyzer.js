/**
 * MioIBAN — IBANAnalyzer e Modalita' Sportello (MioIBAN-SPEC.md §8)
 *
 * ============================================================================
 * QUESTA E' LA SCHERMATA PIU' IMPORTANTE DELL'APP.
 * Non e' un widget: e' una vista a tutto schermo. Se non e' perfetta, l'app
 * non ha motivo di esistere (§8).
 * ============================================================================
 *
 * Cosa deve garantire:
 *  - blocchi da 4, font monospace, grandi (>= 28px su mobile, §8.1);
 *  - zeri evidenziati, e zeri CONSECUTIVI evidenziati piu' marcatamente;
 *  - conteggio sequenziale 1-2-3-4 sotto ogni blocco;
 *  - lettura vocale a blocchi o carattere per carattere, con lo zero detto
 *    "zero" e mai "o" (§8.4);
 *  - "inverti colori" ad alto contrasto;
 *  - Modalita' Sportello: tutto schermo, usabile con una mano sola.
 *
 * ACCESSIBILITA' (scelta deliberata)
 * I blocchi visivi sono `aria-hidden`, e l'IBAN completo e' fornito una volta
 * sola come testo per i lettori di schermo. Un IBAN letto blocco per blocco da
 * uno screen reader sarebbe incomprensibile: meglio una stringa continua.
 */

import { el, render, clear, icon } from "./dom.js";
import { t, currentLanguage } from "../i18n/index.js";
import { splitForAnalyzer, speechChunks, extractComponents } from "../core/iban.js";

/* ------------------------------------------------------------------ *
 * Sintesi vocale
 * ------------------------------------------------------------------ */

/**
 * Controller della sintesi vocale.
 *
 * Le voci di `speechSynthesis` si popolano in modo ASINCRONO: al primo
 * caricamento `getVoices()` puo' restituire un array vuoto e riempirsi solo
 * dopo l'evento `voiceschanged`. Un pulsante valutato troppo presto
 * risulterebbe inutilmente disabilitato (§5.9).
 *
 * Regola adottata per abilitare o disabilitare il pulsante:
 *  - sintesi non supportata            -> disabilitato;
 *  - elenco voci NON vuoto e nessuna voce per la lingua -> disabilitato,
 *    con spiegazione (la voce non e' installata sul dispositivo);
 *  - elenco voci vuoto                 -> ABILITATO: non possiamo distinguere
 *    "non ancora caricate" da "nessuna installata", e il browser puo' comunque
 *    sintetizzare con la voce di default.
 */

/** Silenzio di riscaldamento prima della dettatura: due pause brevi (~mezzo
 *  secondo) che assorbono il taglio iniziale dei motori piu' lenti, senza
 *  aggiungere parole alla dettatura. */
const WARM_UP = "… …";
export function createSpeaker() {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const supported =
    !!synth && typeof window !== "undefined" && typeof window.SpeechSynthesisUtterance === "function";

  let voices = [];
  let speaking = false;
  let currentLang = currentLanguage();
  const listeners = new Set();

  function notify() {
    for (const fn of listeners) {
      try {
        fn({ supported, speaking, hasVoice: hasVoiceFor(currentLang), lang: currentLang });
      } catch {
        /* un listener rotto non deve bloccare gli altri */
      }
    }
  }

  function refreshVoices() {
    if (!supported) return;
    try {
      voices = synth.getVoices() || [];
    } catch {
      voices = [];
    }
    notify();
  }

  if (supported) {
    refreshVoices();
    if (typeof synth.addEventListener === "function") {
      synth.addEventListener("voiceschanged", refreshVoices);
    } else {
      // Fallback per browser vecchi.
      synth.onvoiceschanged = refreshVoices;
    }
  }

  /** Cerca la voce migliore per una lingua BCP 47. */
  function pickVoice(lang) {
    if (!voices.length) return null;
    const target = String(lang || "").toLowerCase();
    const primary = target.split("-")[0];

    return (
      voices.find((v) => String(v.lang || "").toLowerCase() === target) ||
      voices.find((v) => String(v.lang || "").toLowerCase().startsWith(primary + "-")) ||
      voices.find((v) => String(v.lang || "").toLowerCase() === primary) ||
      voices.find((v) => v.default) ||
      null
    );
  }

  function hasVoiceFor(lang) {
    if (!voices.length) return true; // vedi nota sopra
    return !!pickVoice(lang);
  }

  /** Imposta la lingua parlata (segue la lingua dell'interfaccia). */
  function setLanguage(lang) {
    currentLang = lang || currentLanguage();
    notify();
  }

  /**
   * Legge una sequenza di frammenti.
   *
   * Due accorgimenti contro l'inizio "mangiato" (su mobile i primi ~200 ms
   * spesso non si sentono: la pipeline audio si sta svegliando, e su Chrome
   * un cancel() seguito subito da speak() taglia il primo enunciato):
   *  1. se c'era una lettura in corso, si aspetta un attimo dopo cancel();
   *  2. si mette in coda per primo un breve silenzio (WARM_UP), cosi' se
   *     l'inizio viene tagliato a perdersi e' la pausa, non la "I" di "IT".
   *
   * @param {string[]} chunks Un frammento per blocco, gia' pronto.
   * @param {string} [lang]
   */
  function speak(chunks, lang, onChunkStart) {
    if (!supported) return false;
    const wasSpeaking = speaking;
    stop();

    const useLang = lang || currentLang;
    const voice = pickVoice(useLang);
    speaking = true;
    notify();

    const real = (chunks || []).filter((c) => c && String(c).trim().length);

    // Se la coda era vuota non arrivera' mai `onend`.
    if (!real.length) {
      speaking = false;
      notify();
      return true;
    }

    const enqueue = () => {
      // Se nel frattempo l'utente ha premuto "Ferma", non partire.
      if (!speaking) return;
      const queue = [WARM_UP, ...real];
      queue.forEach((chunk, index) => {
        const utterance = new window.SpeechSynthesisUtterance(String(chunk));
        // Sempre entrambi: il browser potrebbe ignorare la voce scelta.
        utterance.lang = useLang;
        if (voice) utterance.voice = voice;
        // Lento: si sta dettando un codice, e chi ascolta deve avere tempo di trascrivere.
        utterance.rate = 0.6;
        utterance.pitch = 1;
        utterance.volume = 1;

        // Il primo elemento e' il silenzio di riscaldamento: il gruppo 0 e' index 1.
        if (typeof onChunkStart === "function" && index > 0) {
          utterance.onstart = () => onChunkStart(index - 1);
        }

        if (index === queue.length - 1) {
          utterance.onend = () => {
            speaking = false;
            notify();
          };
          utterance.onerror = () => {
            speaking = false;
            notify();
          };
        }
        synth.speak(utterance);
      });
    };

    // Dopo un cancel() Chrome ha bisogno di un attimo prima di accettare la
    // nuova coda, altrimenti mangia il primo enunciato.
    if (wasSpeaking) {
      setTimeout(enqueue, 150);
    } else {
      enqueue();
    }
    return true;
  }

  function stop() {
    if (!supported) return;
    try {
      synth.cancel();
    } catch {
      /* ignorato */
    }
    if (speaking) {
      speaking = false;
      notify();
    }
  }

  function onStateChange(fn) {
    listeners.add(fn);
    fn({ supported, speaking, hasVoice: hasVoiceFor(currentLang), lang: currentLang });
    return () => listeners.delete(fn);
  }

  return { supported, speak, stop, setLanguage, onStateChange, hasVoiceFor, pickVoice };
}

/* ------------------------------------------------------------------ *
 * Blocchi dell'IBAN
 * ------------------------------------------------------------------ */

function charClass(c) {
  const classes = [];
  if (c.isZero) classes.push("iban-zero");
  if (c.isZero && c.inZeroRun) classes.push("iban-zero--run");
  if (c.isAmbiguous) classes.push("iban-ambiguous");
  return classes.join(" ") || null;
}

/**
 * Rende l'IBAN diviso in blocchi da 4, con il conteggio sequenziale.
 *
 * @param {string} electronic IBAN in formato elettronico.
 * @returns {HTMLElement}
 */
export function renderIbanBlocks(electronic) {
  const { blocks, formatted } = splitForAnalyzer(electronic);

  const visual = el(
    "div",
    { class: "iban-blocks", "aria-hidden": "true" },
    blocks.map((block) =>
      el(
        "div",
        { class: "iban-group" },
        el(
          "div",
          { class: "iban-group__chars" },
          block.chars.map((c) => el("span", { class: charClass(c), text: c.ch })),
        ),
      ),
    ),
  );

  // Versione accessibile: l'IBAN una volta sola, continuo.
  const accessible = el("p", { class: "visually-hidden", text: formatted });

  return el("div", {}, accessible, visual);
}

/* ------------------------------------------------------------------ *
 * Vista dell'analizzatore
 * ------------------------------------------------------------------ */

/**
 * Crea la vista dell'IBANAnalyzer.
 *
 * @param {object} options
 * @param {object}   options.account
 * @returns {{element: HTMLElement, destroy: Function, refreshLanguage: Function}}
 */
export function createAnalyzer(options) {
  const opts = options || {};
  const account = opts.account;
  const speaker = createSpeaker();

  let inverted = false;

  /* --- Controllo di lettura (segmentato) --- */

  const readBtn = el("button", {
    type: "button",
    class: "btn btn--big analyzer__listen",
    onClick: toggleRead,
  });

  /** Gruppi illuminati durante la lettura, per indice di blocco. */
  let groupEls = [];

  function toggleRead() {
    if (!speaker.supported) return;
    if (readBtn.dataset.speaking === "true") {
      speaker.stop();
      return;
    }
    // Un blocco per volta, con lo zero detto "zero" (§8.4).
    speaker.speak(speechChunks(account.iban, t), speechLang(), highlightGroup);
  }

  /** Illumina il gruppo in lettura; gli zeri restano riconoscibili. */
  function highlightGroup(index) {
    groupEls.forEach((g, i) => g.classList.toggle("is-reading", i === index));
  }

  /**
   * Lingua con cui leggere l'IBAN.
   * Si preferisce la lingua dell'interfaccia; se per quella lingua non c'e'
   * una voce installata, si prova la lingua del paese dell'IBAN (un IBAN
   * italiano si legge meglio con una voce italiana).
   */
  function speechLang() {
    const ui = currentLanguage();
    if (speaker.hasVoiceFor(ui)) return ui;
    const components = extractComponents(account.iban);
    const country = components && components.countryCode;
    if (country === "IT") return "it-IT";
    if (country === "SM") return "it-IT";
    return ui;
  }

  const invertBtn = el("button", {
    type: "button",
    class: "btn",
    "aria-pressed": "false",
    onClick: () => setInverted(!inverted),
  });

  const hint = el("p", { class: "hint analyzer__hint", text: t("analyzer.zerosHighlighted") });
  const voiceNotice = el("p", { class: "status status--warn", hidden: true });

  function setInverted(value) {
    inverted = value;
    document.documentElement.dataset.invert = value ? "true" : "false";
    invertBtn.setAttribute("aria-pressed", String(value));
  }

  /* --- Contenuto --- */

  const blocks = renderIbanBlocks(account.iban);
  groupEls = Array.from(blocks.querySelectorAll(".iban-group"));

  const element = el(
    "section",
    { class: "analyzer" },
    el("div", { class: "analyzer__controls" }, readBtn),
    hint,
    blocks,
    el("div", { class: "analyzer__controls" }, invertBtn),
    voiceNotice,
  );

  /* --- Stato del pulsante di lettura --- */

  const unsubscribe = speaker.onStateChange((state) => {
    const speaking = state.speaking;
    readBtn.dataset.speaking = speaking ? "true" : "false";
    render(
      readBtn,
      icon(speaking ? "stop" : "play"),
      el("span", { text: speaking ? t("actions.stopReading") : t("analyzer.listen") }),
    );
    // A fine lettura (o allo stop) si spegne l'illuminazione del gruppo.
    if (!speaking) highlightGroup(-1);

    // Il pulsante si disabilita solo quando sappiamo per certo che la voce
    // non c'e' (elenco voci caricato e nessuna corrispondenza).
    const usable = state.supported && state.hasVoice;
    readBtn.disabled = !usable;

    if (!state.supported) {
      voiceNotice.hidden = false;
      voiceNotice.textContent = t("analyzer.voiceUnavailable");
    } else if (!state.hasVoice) {
      voiceNotice.hidden = false;
      voiceNotice.textContent = t("analyzer.voiceUnavailable");
    } else {
      voiceNotice.hidden = true;
      voiceNotice.textContent = "";
    }
  });

  render(invertBtn, icon("invert"), el("span", { text: t("actions.invertColors") }));

  function destroy() {
    unsubscribe();
    speaker.stop();
    // L'inversione colori e' una scelta di sessione: si ripristina.
    document.documentElement.dataset.invert = "false";
  }

  /** Da chiamare quando cambia la lingua: ridisegna i testi interni. */
  function refreshLanguage() {
    speaker.setLanguage(currentLanguage());
    hint.textContent = t("analyzer.zerosHighlighted");
    voiceNotice.textContent = voiceNotice.hidden ? "" : t("analyzer.voiceUnavailable");
    clear(readBtn);
    render(readBtn, icon("play"), el("span", { text: t("analyzer.listen") }));
    readBtn.dataset.speaking = "false";
    render(
      invertBtn,
      icon("invert"),
      el("span", { text: t("actions.invertColors") }),
    );
  }

  return { element, destroy, refreshLanguage };
}
