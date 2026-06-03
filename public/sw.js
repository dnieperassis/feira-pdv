// ── Feira PDV — Service Worker ──────────────────────────────────────────
const CACHE = 'feira-pdv-v1'

// Páginas e assets que ficam disponíveis offline
const PRE_CACHE = [
  '/',
  '/mesas',
  '/cardapio',
  '/estoque',
  '/relatorios',
  '/login',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
]

// ── Instalação: pré-cacheia o shell da aplicação ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(PRE_CACHE).catch(() => {
        // Ignora falhas individuais — offline funciona para o que foi cacheado
      })
    })
  )
  self.skipWaiting()
})

// ── Ativação: limpa caches antigas ───────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: estratégia por tipo de requisição ──────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Rotas de API: Network First → cache como fallback offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE).then(c => c.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Assets estáticos e páginas: Cache First → rede como fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
        }
        return response
      }).catch(() => caches.match('/mesas') ?? new Response('Offline', { status: 503 }))
    })
  )
})
