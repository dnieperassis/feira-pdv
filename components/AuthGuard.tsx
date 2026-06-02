'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getSessao } from '@/lib/auth'

const PUBLICAS = ['/login']

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (PUBLICAS.includes(pathname)) { setOk(true); return }

    const sessao = getSessao()
    if (sessao) { setOk(true); return }

    // Verifica se há operadores cadastrados
    fetch('/api/operadores').then(r => r.json()).then((ops: unknown[]) => {
      if (ops.length === 0) {
        // Sem operadores: vai para login (que mostra setup)
        router.replace('/login')
      } else {
        router.replace('/login')
      }
    })
  }, [pathname, router])

  if (!ok) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <span className="text-amber-400 text-2xl font-bold animate-pulse">⚡ Feira PDV</span>
      </div>
    )
  }

  return <>{children}</>
}
