/**
 * MioIBAN — String catalogue: English (en)
 *
 * Maintenance rules: see src/i18n/it.js. Keys must match exactly across all
 * languages. Never use "verified", "exists", "100% correct", "safe" or
 * "guaranteed" about an IBAN (MioIBAN-SPEC.md §7.1).
 */
export default {
  app: {
    name: "MioIBAN",
    tagline: "Your IBANs, clear and ready to copy.",
    privacy: "They never leave your device.",
  },

  nav: {
    accounts: "Accounts",
    settings: "Settings",
    back: "Back",
    close: "Close",
    done: "Done",
  },

  actions: {
    add: "Add",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    confirm: "Confirm",
    copy: "Copy",
    copyCompact: "Copy compact",
    copied: "Copied!",
    print: "Print",
    printAll: "Print all",
    share: "Share",
    export: "Export",
    import: "Import",
    read: "Read aloud",
    stopReading: "Stop",
    invertColors: "Invert colours",
    openAnalyzer: "Counter Mode",
    search: "Search",
    clear: "Clear",
    undo: "Undo",
  },

  fields: {
    iban: "IBAN",
    holder: "Account holder",
    bank: "Bank",
    bic: "BIC (optional)",
    alias: "Short name",
    note: "Notes",
    group: "Group",
    favorite: "Favourite",
    none: "None",
  },

  placeholders: {
    search: "Search by name, bank or IBAN",
    alias: "e.g. Milan rent",
    holder: "e.g. Mario Rossi",
    bank: "e.g. Example Bank",
    bic: "e.g. BCITITMM",
    note: "e.g. 2024 contract",
    iban: "IT60 X054 2811 1010 0000 0123 456",
  },

  paste: {
    title: "Paste a message",
    hint: "Paste the text you received here. I will look for valid IBANs without saving anything automatically.",
    messageTooLong: "The text exceeds the safety limit. Shorten it or paste only the message containing the IBAN.",
    messageLabel: "Message text",
    resultsLabel: "Extraction results",
    placeholder: "e.g. Hi, my IBAN is GB29... please let me know",
    noneFound: "No valid IBANs found in the text. You can enter one in the field below.",
    singleFound: "I found a formally valid IBAN and filled in the field. Check it before saving.",
    singleFoundExisting: "I found another valid IBAN. Your existing entry will not be replaced without your consent.",
    multipleFound_one: "I found {count} formally valid IBAN. Choose the one to save:",
    multipleFound_other: "I found {count} formally valid IBANs. Choose which one to save:",
    useCandidate: "Use this IBAN",
    chooseCandidate: "Choose the IBAN to use",
    selected: "Your choice is in the IBAN field: check it before saving.",
  },

  validation: {
    // Binding texts: see MioIBAN-SPEC.md §7.1. The Italian national check
    // character (CIN) is NOT validated, so success must stay "formally valid".
    empty: "",
    valid: "IBAN is formally valid.",
    // Used ONLY for IT and SM, when the Italian check character (CIN) was also
    // verified: it states exactly what was checked, nothing more.
    validWithCin:
      "Valid IBAN: length, international check digits and the Italian check character are all correct.",
    unknownCountry: "This country does not take part in the IBAN registry.",
    wrongLength: "It looks like a character is missing or extra.",
    wrongFormat: "Check the letters and digits: something does not add up.",
    checksumNotNumber: "The two characters after the country code must be digits.",
    checksum: "This IBAN is not valid. Check that you did not skip or swap a character.",
    cinMismatch:
      "The Italian check character does not match: a digit was almost certainly copied incorrectly.",
    bicEmpty: "",
    bicValid: "BIC is formally valid.",
    bicUnknownCountry: "The country of this BIC is not recognised.",
    bicWrongFormat: "The BIC does not have the correct format.",
  },

  accounts: {
    title: "Your accounts",
    empty: "You have not saved any account yet.",
    emptyHint: "Tap “Add” to save one.",
    noResults: "No account found.",
    count_one: "{count} account",
    count_other: "{count} accounts",
    favoritesOnly: "Favourites only",
    allGroups: "All groups",
    showAsCards: "Cards",
    showAsRows: "Rows",
    duplicateWarning: "You already saved this IBAN as “{alias}”.",
    duplicateWarningNoAlias: "You already saved this IBAN.",
    duplicateOpen: "Open the existing one",
    deleteConfirm: "Delete “{alias}”? This cannot be undone.",
    deleteConfirmNoAlias: "Delete this account? This cannot be undone.",
  },

  analyzer: {
    title: "IBAN analysis",
    countLabel: "Count",
    zerosHighlighted: "Zeros are highlighted",
    readBlocks: "Read in blocks",
    readCharByChar: "Read character by character",
    voiceUnavailable: "Read aloud is not available on this device.",
    keepScreenOn: "The screen stays on",
    chars_one: "{count} character",
    chars_other: "{count} characters",
  },

  print: {
    title: "DETAILS FOR BANK TRANSFER",
    holder: "Account holder",
    bank: "Bank",
    bic: "BIC (optional)",
    iban: "IBAN",
    reason: "Payment reference",
    footer: "Document generated locally by MioIBAN on {date}. Always check the details before use.",
  },

  share: {
    title: "Share IBAN",
    text: "{alias} — IBAN: {iban}",
    textNoAlias: "IBAN: {iban}",
  },

  settings: {
    title: "Settings",
    appearance: "Appearance",
    text: "Text",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeAuto: "Automatic",
    textSize: "Text size",
    textSizeNormal: "Normal",
    textSizeLarge: "Large",
    textSizeXLarge: "Very large",
    language: "Language",
    copyFormat: "Default copy format",
    copyFormatSpaced: "With spaces (to read)",
    copyFormatCompact: "Compact (to paste)",
    groups: "Groups",
    groupsHint: "Groups are used to filter accounts. They are optional.",
    groupNamePlaceholder: "e.g. Family",
    groupAdd: "Add group",
    groupEmpty: "No groups.",
    groupDeleteConfirm: "Delete the group “{name}”? The accounts will stay, without a group.",
    backup: "Backup",
    backupHint: "A backup is the only way not to lose your data. Nobody can recover it for you.",
    exportNow: "Export backup",
    importNow: "Import backup",
    about: "About",
    version: "Version {version}",
    aboutPrivacyHint:
      "MioIBAN uses no server and no account: your IBANs stay only on this device.",
    showDisclaimer: "Personal data and privacy",
  },

  onboarding: {
    welcome: "Welcome to MioIBAN",
    chooseLanguage: "Choose your language",
    chooseTheme: "Choose a theme",
    chooseTextSize: "Choose the text size",
    disclaimerTitle: "Before you start",
    disclaimerAccept: "I have read and understood",
    start: "Get started",
    // Binding text: see MioIBAN-SPEC.md §12.2.
    disclaimer:
      "MioIBAN is a local archive provided “as is”, with no warranty whatsoever.\n\n" +
      "• It does not send payments, does not manage due dates and does not send notifications.\n" +
      "• It syncs nothing and has no server: your data stays ONLY on this device.\n" +
      "• It is not encrypted: anyone using this device can see the saved IBANs.\n" +
      "• Backup is the user's sole responsibility. If you lose the device or clear the browser data without exporting a backup, the data is lost and cannot be recovered.\n" +
      "• If you use private browsing (private or incognito window): your data lasts only for the session and is deleted when the browser closes. Export a backup before closing if you want to keep it.\n" +
      "• MioIBAN checks that an IBAN is formally correct (length and international check digits), but it cannot guarantee that it matches a real account. Always verify with your bank before using an IBAN for a payment.",
  },

  backup: {
    exportTitle: "Backup exported",
    exportHint: "This file is your only backup. Keep it somewhere safe.",
    exportFileName: "MioIBAN-backup-{date}",
    importTitle: "Import a backup",
    importSummary: "You are about to import {incoming} in place of your {current}.",
    importConfirm: "Replace the current data",
    importOk: "Backup imported successfully.",
    importNewerSchema:
      "This backup was created by a newer version of MioIBAN and cannot be imported.",
    importInvalid: "This file is not a valid MioIBAN backup.",
    importIncomplete: "The backup is incomplete or damaged.",
    nothingToImport: "The backup does not contain any account.",
  },

  errors: {
    storageUnavailable:
      "This browser does not allow saving data locally. MioIBAN cannot work.",
    storageQuota: "The browser's storage space is full.",
    clipboardDenied: "Copying failed. Select the IBAN and copy it by hand.",
    shareUnavailable: "Sharing is not available: the IBAN was copied to the clipboard.",
    unexpected: "Something unexpected went wrong.",
  },

  a11y: {
    copyIban: "Copy the IBAN of {alias}",
    openAccount: "Open account {alias}",
    favoriteToggle: "Add to or remove from favourites",
    groupFilter: "Filter by group",
    analyzerGroup: "Block {index} of {total}",
  },

  /**
   * How the characters of an IBAN are spoken aloud (§8.4).
   * The zero is ALWAYS "zero", never the letter "o": that is the very
   * confusion this app exists to prevent.
   */
  speech: {
    zero: "zero",
  },
};
