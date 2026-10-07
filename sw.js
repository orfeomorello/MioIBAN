/* ==========================================================================
   MioIBAN — Service Worker
   --------------------------------------------------------------------------
   Fa UNA sola cosa: rendere l'app disponibile offline dopo il primo
   caricamento (MioIBAN-SPEC.md §3 regola 5, §5).

   Cosa NON fa, per scelta esplicita:
   - nessuna notifica push (regola 8: l'app non manda notifiche);
   - nessuna sincronizzazione in background (regola 1: zero server);
   - nessun analytics o log remoto.

   Dettaglio importante (D-26): la lingua viaggia in `?lang=xx`. Se la cache
   usasse l'URL completo come chiave, ogni variante sarebbe una chiave diversa
   e l'app smetterebbe di funzionare offline. Per questo le navigazioni si
   cercano con `ignoreSearch: true`.
   ========================================================================== */

const CACHE_NAME = "mioiban-v3";

/**
 * File da tenere in cache. Elenco esplicito: niente glob, niente magia.
 * `./` e `./index.html` ci sono entrambi perche' il browser puo' richiedere
 * l'uno o l'altro a seconda di come e' stato aperto il sito.
 */
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",

  "./src/app.js",
  "./src/ui/dom.js",
  "./src/ui/actions.js",
  "./src/ui/print.js",
  "./src/ui/theme.js",
  "./src/ui/sheet.js",
  "./src/ui/analyzer.js",
  "./src/ui/list.js",
  "./src/ui/detail.js",
  "./src/ui/form.js",
  "./src/ui/settings.js",
  "./src/ui/onboarding.js",
  "./src/core/iban.js",
  "./src/core/errors.js",
  "./src/core/storage.js",
  "./src/core/prefs.js",
  "./src/core/model.js",
  "./src/core/backup.js",
  "./src/i18n/index.js",
  "./src/i18n/it.js",
  "./src/i18n/en.js",

  "./src/styles/main.css",
  "./src/styles/print.css",

  "./vendor/ibantools.js",

  "./icons/icon.svg",
  "./icons/icon-maskable.svg",
];

/* --------------------------------------------------------------------------
   Installazione: precarica l'app-shell
   -------------------------------------------------------------------------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Si aggiungono i file UNO PER UNO, non con `addAll`.
      // `addAll` e' atomico: se un solo file manca, fallisce tutto e il Service
      // Worker non si installa. Con `vendor/ibantools.js` non ancora copato
      // (vedi README), l'app resterebbe senza Service Worker per un motivo
      // secondario. Cosi' invece si installa comunque e si segnala il mancante.
      const results = await Promise.allSettled(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      );

      const failed = results
        .map((r, i) => (r.status === "rejected" ? PRECACHE[i] : null))
        .filter(Boolean);

      if (failed.length) {
        console.warn("[MioIBAN] file non precaricati:", failed.join(", "));
      }

      await self.skipWaiting();
    })(),
  );
});

/* --------------------------------------------------------------------------
   Attivazione: rimuove le cache delle versioni precedenti
   -------------------------------------------------------------------------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/* --------------------------------------------------------------------------
   Richieste
   -------------------------------------------------------------------------- */

/** True se la richiesta e' verso il nostro dominio e non e' una scrittura. */
function isOwnGet(request) {
  if (request.method !== "GET") return false;
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isOwnGet(request)) return; // tutto il resto va in rete, senza toccarlo

  // --- Navigazioni: la pagina ---
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        // ignoreSearch: `?lang=it` e `?lang=en` devono trovare la stessa
        // app-shell, altrimenti offline l'app non si apre (D-26).
        const cached =
          (await cache.match(request, { ignoreSearch: true })) ||
          (await cache.match("./index.html", { ignoreSearch: true }));

        if (cached) {
          // Si aggiorna in sottofondo, senza far aspettare l'utente.
          event.waitUntil(
            fetch(request)
              .then((response) => {
                if (response && response.ok) cache.put("./index.html", response.clone());
              })
              .catch(() => {}),
          );
          return cached;
        }

        try {
          return await fetch(request);
        } catch {
          // Offline e nulla in cache: non c'e' un fallback sensato.
          return new Response("", { status: 504, statusText: "Offline" });
        }
      })(),
    );
    return;
  }

  // --- Risorse: prima la cache, poi la rete ---
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;

      try {
        const response = await fetch(request);
        // Non si mettono in cache le risposte parziali o di errore.
        if (response && response.ok && response.type === "basic") {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        throw err;
      }
    })(),
  );
});
