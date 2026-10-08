/**
 * MioIBAN — Catalogo stringhe: Italiano (it)
 *
 * Regole di manutenzione:
 * - Questo file contiene SOLO stringhe. Nessuna logica.
 * - Ogni chiave presente qui DEVE esistere in tutte le altre lingue.
 * - Le stringhe con segnaposto usano la sintassi {nome}.
 * - Le stringhe con plurali usano il suffisso _one / _other (Intl.PluralRules).
 * - Non usare MAI le parole "verificato", "esiste", "corretto al 100%",
 *   "sicuro" o "garantito" riferite a un IBAN (MioIBAN-SPEC.md §7.1).
 */
export default {
  app: {
    name: "MioIBAN",
    tagline: "I tuoi IBAN, chiari e pronti da copiare.",
    privacy: "Non escono mai dal tuo dispositivo.",
  },

  nav: {
    accounts: "Conti",
    settings: "Impostazioni",
    back: "Indietro",
    close: "Chiudi",
    done: "Fatto",
  },

  actions: {
    add: "Aggiungi",
    save: "Salva",
    cancel: "Annulla",
    delete: "Elimina",
    edit: "Modifica",
    confirm: "Conferma",
    copyCompact: "Copia",
    sportello: "Modalità sportello",
    copied: "Copiato!",
    print: "Stampa",
    printAll: "Stampa tutti",
    share: "Condividi",
    export: "Esporta",
    import: "Importa",
    read: "Leggi",
    stopReading: "Ferma",
    invertColors: "Inverti colori",
    search: "Cerca",
    clear: "Cancella",
    undo: "Annulla",
  },

  fields: {
    iban: "IBAN",
    holder: "Intestatario",
    bank: "Banca",
    bic: "BIC (opzionale)",
    alias: "Nome breve",
    note: "Note",
    group: "Gruppo",
    favorite: "Preferito",
    none: "Nessuno",
  },

  placeholders: {
    search: "Cerca per nome, banca o IBAN",
    alias: "Es. Affitto Milano",
    holder: "Es. Mario Rossi",
    bank: "Es. Banca Esempio",
    bic: "Es. BCITITMM",
    note: "Es. Contratto 2024",
    iban: "IT60 X054 2811 1010 0000 0123 456",
  },

  paste: {
    title: "Incolla un messaggio",
    hint: "Incolla qui il testo ricevuto: cercherò gli IBAN validi senza salvare nulla automaticamente.",
    messageTooLong: "Il testo supera il limite di sicurezza. Riducilo o incolla solo il messaggio che contiene l'IBAN.",
    messageLabel: "Testo del messaggio",
    resultsLabel: "Risultati dell'estrazione",
    placeholder: "Es. Ciao, il mio IBAN è IT60... fammi sapere",
    noneFound: "Non ho trovato IBAN validi nel testo. Puoi inserirne uno nel campo qui sotto.",
    singleFound: "Ho trovato un IBAN formalmente valido e l'ho inserito nel campo. Controllalo prima di salvare.",
    singleFoundExisting: "Ho trovato un altro IBAN valido: il valore che hai già inserito non verrà sostituito senza il tuo consenso.",
    multipleFound_one: "Ho trovato {count} IBAN formalmente valido. Scegli quello da archiviare:",
    multipleFound_other: "Ho trovato {count} IBAN formalmente validi. Scegli quelli da archiviare:",
    useCandidate: "Usa questo IBAN",
    chooseCandidate: "Scegli l'IBAN da usare",
    selected: "La scelta è nel campo IBAN: controllala prima di salvare.",
  },

  validation: {
    // I testi di questo blocco sono VINCOLANTI: vedi MioIBAN-SPEC.md §7.1.
    // Derivano dai limiti di ibantools (L2: il CIN italiano non è verificato).
    empty: "",
    valid: "IBAN formalmente valido.",
    // Usato SOLO per IT e SM, quando anche il CIN è stato verificato con
    // successo: descrive esattamente ciò che è stato controllato, niente di più.
    validWithCin:
      "IBAN valido: lunghezza, cifre di controllo internazionali e carattere di controllo italiano sono corretti.",
    unknownCountry: "Questo paese non aderisce al registro IBAN.",
    wrongLength: "Sembra che manchi o avanzi qualche carattere.",
    wrongFormat: "Controlla le lettere e i numeri: qualcosa non torna.",
    checksumNotNumber: "I due caratteri dopo la sigla del paese devono essere numeri.",
    checksum: "Questo IBAN non è valido. Controlla di non aver saltato o invertito un carattere.",
    cinMismatch:
      "Il carattere di controllo italiano non corrisponde: quasi certamente una cifra è stata copiata male.",
    bicEmpty: "",
    bicValid: "BIC formalmente valido.",
    bicUnknownCountry: "Il paese di questo BIC non è riconosciuto.",
    bicWrongFormat: "Il BIC non ha il formato corretto.",
  },

  accounts: {
    title: "I tuoi conti",
    empty: "Non hai ancora salvato nessun conto.",
    emptyHint: "Tocca «Aggiungi» per salvarne uno.",
    noResults: "Nessun conto trovato.",
    count_one: "{count} conto",
    count_other: "{count} conti",
    favoritesOnly: "Preferiti",
    allGroups: "Tutti i gruppi",
    showAsCards: "Schede",
    showAsRows: "Righe",
    duplicateWarning: "Hai già questo IBAN salvato come «{alias}».",
    duplicateWarningNoAlias: "Hai già questo IBAN salvato.",
    duplicateOpen: "Apri quello esistente",
    deleteConfirm: "Vuoi eliminare «{alias}»? L'operazione non si può annullare.",
    deleteConfirmNoAlias: "Vuoi eliminare questo conto? L'operazione non si può annullare.",
  },

  analyzer: {
    title: "Modalità sportello",
    zerosHighlighted: "Gli zeri sono evidenziati",
    listen: "Ascolta l'IBAN",
    voiceUnavailable: "La lettura ad alta voce non è disponibile su questo dispositivo.",
    chars_one: "{count} carattere",
    chars_other: "{count} caratteri",
  },

  print: {
    title: "DATI PER BONIFICO",
    holder: "Intestatario",
    bank: "Banca",
    bic: "BIC (opzionale)",
    iban: "IBAN",
    reason: "Causale",
    footer: "Documento generato localmente da MioIBAN il {date}. Verificare sempre i dati prima dell'uso.",
  },

  share: {
    title: "Condividi IBAN",
    text: "IBAN di {alias}: {iban}",
    textNoAlias: "IBAN: {iban}",
  },

  settings: {
    title: "Impostazioni",
    appearance: "Aspetto",
    text: "Testo",
    theme: "Tema",
    themeLight: "Chiaro",
    themeDark: "Scuro",
    themeAuto: "Automatico",
    textSize: "Grandezza testo",
    textSizeNormal: "Normale",
    textSizeLarge: "Grande",
    textSizeXLarge: "Molto grande",
    language: "Lingua",
    groups: "Gruppi",
    groupsHint: "I gruppi servono a filtrare i conti. Sono facoltativi.",
    groupNamePlaceholder: "Es. Famiglia",
    groupAdd: "Aggiungi gruppo",
    groupEmpty: "Nessun gruppo.",
    groupDeleteConfirm:
      "Eliminare il gruppo «{name}»? I conti resteranno, ma senza gruppo.",
    backup: "Backup",
    backupHint: "Il backup è l'unico modo per non perdere i dati. Nessuno può recuperarli al posto tuo.",
    exportNow: "Esporta backup",
    importNow: "Importa backup",
    reset: "Reimposta",
    resetHint:
      "Elimina conti, gruppi e impostazioni per ricominciare come fosse appena installata. L'operazione non si può annullare: esporta prima un backup se vuoi conservare i dati.",
    resetNow: "Reimposta l'app",
    resetTitle: "Reimposta l'app",
    resetBody:
      "Vuoi eliminare tutti i conti, i gruppi e le impostazioni? L'app tornerà come appena installata e l'operazione non si può annullare.",
    resetConfirm: "Elimina tutto",
    about: "Informazioni",
    version: "Versione {version}",
    aboutPrivacyHint:
      "MioIBAN non usa server né account: i tuoi IBAN restano solo su questo dispositivo.",
    showDisclaimer: "Dati personali e privacy",
  },

  onboarding: {
    welcome: "Benvenuto in MioIBAN",
    chooseLanguage: "Scegli la lingua",
    chooseTheme: "Scegli il tema",
    chooseTextSize: "Scegli la grandezza del testo",
    disclaimerTitle: "Prima di iniziare",
    disclaimerAccept: "Ho capito",
    // Testo VINCOLANTE: vedi MioIBAN-SPEC.md §12.2.
    disclaimer:
      "MioIBAN è un archivio locale fornito «così com'è», senza alcuna garanzia.\n\n" +
      "• Non invia pagamenti, non gestisce scadenze e non manda notifiche.\n" +
      "• Non sincronizza nulla e non ha server: i dati restano SOLO su questo dispositivo.\n" +
      "• Non è cifrato: chi usa questo dispositivo può vedere gli IBAN salvati.\n" +
      "• Il backup è responsabilità esclusiva dell'utente. Se perdi il dispositivo o cancelli i dati del browser senza aver esportato un backup, i dati sono persi e non sono recuperabili.\n" +
      "• Se usi la navigazione anonima (finestra privata o in incognito): i dati valgono solo per la sessione e vengono cancellati alla chiusura del browser. Esporta un backup prima di chiudere se vuoi conservarli.\n" +
      "• MioIBAN verifica la correttezza formale di un IBAN (lunghezza e cifre di controllo internazionali), ma non può garantire che corrisponda al conto reale. Verifica sempre con la tua banca prima di usare un IBAN per un pagamento.",
  },

  backup: {
    exportTitle: "Backup esportato",
    exportHint: "Questo file è il tuo unico backup. Conservalo in un luogo sicuro.",
    exportFileName: "MioIBAN-backup-{date}",
    importTitle: "Importa un backup",
    importSummary: "Stai per importare {incoming} al posto dei tuoi {current}.",
    importConfirm: "Sostituisci i dati attuali",
    importOk: "Backup importato correttamente.",
    importNewerSchema:
      "Questo backup è stato creato da una versione più recente di MioIBAN e non può essere importato.",
    importInvalid: "Questo file non è un backup di MioIBAN valido.",
    importIncomplete: "Il backup è incompleto o danneggiato.",
    nothingToImport: "Il backup non contiene nessun conto.",
  },

  errors: {
    storageUnavailable:
      "Questo browser non permette di salvare i dati in locale. MioIBAN non può funzionare.",
    storageQuota: "Lo spazio di archiviazione del browser è pieno.",
    clipboardDenied: "Non è stato possibile copiare. Seleziona l'IBAN e copialo a mano.",
    shareUnavailable: "La condivisione non è disponibile: l'IBAN è stato copiato negli appunti.",
    unexpected: "Si è verificato un errore imprevisto.",
  },

  a11y: {
    copyIban: "Copia l'IBAN di {alias}",
    openAccount: "Apri il conto {alias}",
    favoriteToggle: "Aggiungi o togli dai preferiti",
    groupFilter: "Filtra per gruppo",
    analyzerGroup: "Blocco {index} di {total}",
  },

  /**
   * Come si pronunciano i caratteri dell'IBAN ad alta voce (§8.4).
   * Lo zero va detto SEMPRE "zero", mai "o" / "oh": e' l'errore che
   * l'app esiste per evitare.
   */
  speech: {
    zero: "zero",
  },
};
