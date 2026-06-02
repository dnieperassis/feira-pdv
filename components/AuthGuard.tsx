'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getSessao } from '@/lib/auth'

// Rotas acessíveis sem login
const PUBLICAS = ['/login']

// Rotas restritas ao perfil admin
const SOMENTE_ADMIN = ['/relatorios', '/configuracoes']

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (PUBLICAS.includes(pathname)) { setOk(true); return }

    const sessao = getSessao()

    if (!sessao) {
      router.replace('/login')
      return
    }

    const restrita = SOMENTE_ADMIN.some(r => pathname === r || pathname.startsWith(r + '/'))
    if (restrita && sessao.perfil !== 'admin') {
      router.replace('/mesas')
      return
    }

    setOk(true)
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
