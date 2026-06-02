import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { AuthGuard } from '@/components/AuthGuard'

export const metadata: Metadata = {
  title: 'Feira PDV',
  description: 'Controle de vendas, mesas e pedidos',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Feira PDV' },
}

export const viewport: Viewport = {
  themeColor: '#f59e0b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full flex flex-col bg-slate-950 text-slate-100 antialiased">
        <AuthGuard>
          <Navbar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </AuthGuard>
      </body>
    </html>
  )
}
