'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/mesas',          label: 'Mesas',         icon: '🪑' },
  { href: '/cardapio',       label: 'Cardápio',       icon: '📋' },
  { href: '/estoque',        label: 'Estoque',        icon: '📦' },
  { href: '/relatorios',     label: 'Relatórios',     icon: '📊' },
  { href: '/configuracoes',  label: 'Configurações',  icon: '⚙️' },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="bg-slate-900 border-b border-slate-700 px-4 flex items-center justify-between h-14 shrink-0 z-40">
      <span className="text-amber-400 font-bold text-lg tracking-tight">⚡ Feira PDV</span>
      <div className="flex items-center gap-1">
        {links.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800',
              ].join(' ')}
            >
              <span>{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
