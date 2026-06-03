'use client'

import { useEffect } from 'react'

export function ServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[PWA] Service Worker registrado:', reg.scope)
        // Verifica atualização a cada visita
        reg.update()
      })
      .catch(err => console.warn('[PWA] SW não registrado:', err))
  }, [])

  return null
}
