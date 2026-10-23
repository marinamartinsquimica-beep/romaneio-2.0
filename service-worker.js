const CACHE_NAME = "romaneio-2-0-cache-v2120-leitor-paripassu-recuperavel";

const FILES_TO_CACHE = [
  "./integracao/selecao-romaneios.mjs?v=2.0.118",
  "./integracao/leitor-paripassu.mjs",
  "./integracao/leitor-paripassu.mjs?v=2.0.120",
  "./integracao/erro-publicacao-estoque.mjs?v=2.0.120",
  "./integracao/bases-compartilhadas.mjs?v=2.0.118",
  "./integracao/controle-tentativas.mjs?v=2.0.118",
  "./integracao/envio-movimentos250.js?v=2.0.118",
  "./integracao/publicador-firestore.js?v=2.0.118",
  "./integracao/correcoes-lancamentos.mjs?v=2.0.118",
  "./integracao/comprovante-baixa-agrupada.mjs?v=2.0.106",
  "./integracao/status-baixa-romaneio.mjs?v=2.0.118",
  "./integracao/comprovante-baixa-agrupada.mjs?v=2.0.105",
  "./integracao/comprovante-baixa-agrupada.mjs?v=2.0.118",
  "./integracao/filtro-expedicoes-baixadas.mjs?v=2.0.118",
  "./integracao/reconciliar-pendencias-baixadas.mjs?v=2.0.118",
  "./integracao/colecao-incremental.mjs?v=2.0.118",
  "./integracao/retencao-historicos.mjs?v=2.0.118",
  "./inicio.html",
  "./export-utils.js",
  "./jsQR.js",
  "./vendor/zxing.min.js",
  "./vendor/jszip.min.js",
  "./integracao/excel-modelo-etapa4.mjs",
  "./integracao/baixa-modelo-aprovado.mjs",
  "./integracao/modelo-estoque-persistente.mjs",
  "./integracao/modelo-estoque-persistente.mjs?v=2.0.118",
  "./integracao/controle-leituras-automaticas.mjs?v=2.0.99",
  "./integracao/erro-publicacao-estoque.mjs?v=2.0.99",
  "./integracao/estoques-firebase-ui.mjs?v=2.0.120",
  "./integracao/baixa-transacional.mjs",
  "./integracao/baixa-transacional.mjs?v=2.0.118",
  "./integracao/filtro-expedicoes-baixadas.mjs",
  "./integracao/direcao-sincronizacao.mjs",
  "./integracao/regularizar-identificacao-fila.mjs?v=2.0.97",
  "./integracao/reconciliar-pendencias-baixadas.mjs",
  "./integracao/substituicao-estoque-total.mjs",
  "./integracao/recuperar-paletes-remotos.mjs",
  "./integracao/marcos-romaneios-fechados.mjs",
  "./integracao/painel-paletes-outros-usuarios.mjs",
  "./integracao/recepcao-romaneios-ativos.mjs?v=2.0.118",
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

// HTML de entrada serve apenas para navegação; nunca como módulo JavaScript.
async function recuperarRespostaLocal(req) {
  const cached = await caches.match(req);
  const modulo = /\.(mjs|js)$/.test(new URL(req.url).pathname);
  if (cached && (!modulo || /(java|ecma)script/i.test(cached.headers.get("content-type") || ""))) return cached;
  if (req.mode === "navigate") return (await caches.match("./inicio.html")) || Response.error();
  return Response.error();
}
self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  if (url.pathname.endsWith("/version.json") || url.pathname.endsWith("/service-worker.js") || url.pathname.includes("/integracao/") || req.mode === "navigate") {
    event.respondWith(
      fetch(req, {cache:"no-cache"}).then(resp => {
        const modulo = /\.(mjs|js)$/.test(url.pathname);
        if (modulo && (!resp.ok || !/(java|ecma)script/i.test(resp.headers.get("content-type") || "")))
          return recuperarRespostaLocal(req);
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => recuperarRespostaLocal(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      return resp;
    }).catch(() => recuperarRespostaLocal(req)))
  );
});

