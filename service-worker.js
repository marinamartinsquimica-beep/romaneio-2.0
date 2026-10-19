const CACHE_NAME = "romaneio-2-0-cache-v287-excedente-informativo";

const FILES_TO_CACHE = [
  "./inicio.html",
  "./export-utils.js",
  "./jsQR.js",
  "./vendor/zxing.min.js",
  "./vendor/jszip.min.js",
  "./integracao/excel-modelo-etapa4.mjs",
  "./integracao/baixa-modelo-aprovado.mjs",
  "./integracao/modelo-estoque-persistente.mjs",
  "./integracao/estoques-firebase-ui.mjs",
  "./integracao/baixa-transacional.mjs",
  "./integracao/filtro-expedicoes-baixadas.mjs",
  "./integracao/direcao-sincronizacao.mjs",
  "./integracao/reconciliar-pendencias-baixadas.mjs",
  "./integracao/substituicao-estoque-total.mjs",
  "./integracao/recuperar-paletes-remotos.mjs",
  "./integracao/marcos-romaneios-fechados.mjs",
  "./vendor/LICENSE-zxing.txt",
  "./qr-parser.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  if (url.pathname.endsWith("/version.json") || url.pathname.endsWith("/service-worker.js") || url.pathname.includes("/integracao/") || req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => caches.match(req).then(cached => cached || caches.match("./inicio.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      return resp;
    }).catch(() => caches.match("./inicio.html")))
  );
});
