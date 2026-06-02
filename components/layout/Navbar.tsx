'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSessao, clearSessao } from '@/lib/auth'
import { useEffect, useState } from 'react'
import type { Sessao } from '@/lib/auth'

const LINKS_COMUNS = [
  { href: '/mesas',     label: 'Mesas',     icon: '🪑' },
  { href: '/cardapio',  label: 'Cardápio',  icon: '📋' },
  { href: '/estoque',   label: 'Estoque',   icon: '📦' },
]

const LINKS_ADMIN = [
  { href: '/relatorios',    label: 'Relatórios',    icon: '📊' },
  { href: '/configuracoes', label: 'Configurações', icon: '⚙️' },
]

export function Navbar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [sessao, setSessao] = useState<Sessao | null>(null)

  useEffect(() => {
    setSessao(getSessao())
  }, [pathname])

  function logout() {
    clearSessao()
    router.replace('/login')
  }

  if (pathname === '/login') return null

  const links = sessao?.perfil === 'admin'
    ? [...LINKS_COMUNS, ...LINKS_ADMIN]
    : LINKS_COMUNS

  return (
    <nav className="bg-slate-900 border-b border-slate-700 px-4 flex items-center justify-between h-14 shrink-0 z-40">
      <span className="text-amber-400 font-bold text-lg tracking-tight shrink-0">⚡ Feira PDV</span>

      <div className="flex items-center gap-1 overflow-x-auto">
        {links.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0',
                active
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800',
              ].join(' ')}
            >
              <span>{icon}</span>
              <span className="hidden md:inline">{label}</span>
            </Link>
          )
        })}
      </div>

      {sessao && (
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-1.5">
            <div className={[
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border',
              sessao.perfil === 'admin'
                ? 'bg-amber-500/30 border-amber-500 text-amber-400'
                : 'bg-slate-600/30 border-slate-500 text-slate-300',
            ].join(' ')}>
              {sessao.nome.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-slate-300 text-sm font-medium">{sessao.nome}</span>
              <span className={`text-xs font-semibold ${sessao.perfil === 'admin' ? 'text-amber-500' : 'text-slate-500'}`}>
                #{sessao.codigo} {sessao.perfil === 'admin' ? '· ADM' : ''}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sair"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-900/40 hover:text-red-400 text-slate-400 text-sm transition-colors"
          >
            Sair
          </button>
        </div>
      )}
    </nav>
  )
}
