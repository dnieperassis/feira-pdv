// ── Feira PDV — Service Worker v4 ───────────────────────────────────────
const CACHE = 'feira-pdv-v4'

// Só assets estáticos são pré-cacheados — NUNCA páginas HTML (causam loop)
const PRE_CACHE = [
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
]

// ── Instalação ────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRE_CACHE).catch(() => {}))
  )
  self.skipWaiting()
})

// ── Ativação: apaga todos os caches antigos ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Ignora requests de outros domínios (extensões, etc.)
  if (url.origin !== self.location.origin) return

  // ── Rotas de API: Network Only (nunca cachear) ──────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response('{"error":"offline"}', {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })))
    return
  }

  // ── Páginas HTML: Network First (NUNCA cachear) ─────────────────────
  // Páginas têm auth dinâmica — cachear causa redirect loop
  const isPage = !url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|webmanifest|json)$/)
  if (isPage) {
    event.respondWith(fetch(request).catch(() =>
      caches.match('/icon-192.png').then(() =>
        new Response('<h1>Offline</h1><p>Sem conexão. Reconecte e recarregue.</p>', {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        })
      )
    ))
    return
  }

  // ── Assets estáticos (JS, CSS, imagens): Cache First ─────────────────
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response.ok && response.type !== 'opaque') {
          const clone = response.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
        }
        return response
      })
    })
  )
})
