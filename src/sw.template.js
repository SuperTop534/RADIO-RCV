/* Service worker da RCV Estúdio Rádio (gerado no build).
 * - Pré-carrega a interface para abrir rápido e funcionar offline.
 * - NUNCA intercepta o streaming de áudio, a API nem o YouTube:
 *   o rádio sempre toca direto do servidor de streaming.
 */
const VERSION = '__VERSION__';
const CACHE = `rcv-shell-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rcv-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // streaming, YouTube, fontes: rede direta
  if (url.pathname.includes('/api/')) return;             // dados sempre frescos
  if (url.pathname.endsWith('/youtube.json')) return;     // lista de vídeos/live: sempre da rede
  if (req.headers.get('range')) return;                   // mídia parcial

  // Navegação: rede primeiro (pega a versão nova), cache como reserva offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('index.html').then((r) => r || Response.error())),
    );
    return;
  }

  // Arquivos estáticos: cache primeiro, atualiza em segundo plano
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    }),
  );
});
