'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Mesa } from '@/types'
import { brl } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

const STATUS_LABEL: Record<string, string> = {
  livre:     'Livre',
  ocupada:   'Ocupada',
  aguardando: 'Aguardando',
}

const STATUS_COLOR: Record<string, 'green' | 'red' | 'amber'> = {
  livre:     'green',
  ocupada:   'red',
  aguardando: 'amber',
}

const STATUS_BG: Record<string, string> = {
  livre:     'bg-slate-800 border-slate-600 hover:border-green-500',
  ocupada:   'bg-red-950/40 border-red-700 hover:border-red-400',
  aguardando: 'bg-amber-950/40 border-amber-600 hover:border-amber-400',
}

export default function MesasPage() {
  const router = useRouter()
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const [abrindoBalcao, setAbrindoBalcao] = useState(false)

  const carregar = useCallback(async () => {
    const res = await fetch('/api/mesas')
    setMesas(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar()
    const interval = setInterval(carregar, 15000)
    return () => clearInterval(interval)
  }, [carregar])

  async function abrirMesa(mesa: Mesa) {
    if (mesa.status === 'livre') {
      const res = await fetch('/api/comandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesa_id: mesa.id, tipo: 'mesa' }),
      })
      if (res.ok) {
        const comanda = await res.json()
        router.push(`/pedidos/${comanda.id}`)
      } else {
        alert('Erro ao abrir comanda')
      }
    } else if (mesa.comanda_id) {
      // Mesa ocupada sem nenhum item: oferece liberação direta
      if (!mesa.total_comanda) {
        const liberar = confirm(`Mesa ${mesa.numero} está ocupada mas sem pedidos.\n\nLiberar mesa agora?`)
        if (liberar) {
          await fetch(`/api/comandas/${mesa.comanda_id}`, { method: 'DELETE' })
          carregar()
        }
        return
      }
      router.push(`/pedidos/${mesa.comanda_id}`)
    }
  }

  async function abrirBalcao() {
    setAbrindoBalcao(true)
    const res = await fetch('/api/comandas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'balcao' }),
    })
    setAbrindoBalcao(false)
    if (res.ok) {
      const comanda = await res.json()
      router.push(`/pedidos/${comanda.id}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Carregando mesas...
      </div>
    )
  }

  const livres = mesas.filter(m => m.status === 'livre').length
  const ocupadas = mesas.filter(m => m.status === 'ocupada').length

  return (
    <div className="p-4 h-full flex flex-col gap-4">
      {/* Resumo + Balcão */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Badge color="green">{livres} livres</Badge>
          <Badge color="red">{ocupadas} ocupadas</Badge>
        </div>
        <Button onClick={abrirBalcao} disabled={abrindoBalcao} size="lg">
          🛒 Venda no Balcão
        </Button>
      </div>

      {/* Grid de mesas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 flex-1 content-start">
        {mesas.map(mesa => (
          <button
            key={mesa.id}
            onClick={() => abrirMesa(mesa)}
            className={[
              'flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-150',
              'min-h-[120px] gap-2 active:scale-95',
              STATUS_BG[mesa.status],
            ].join(' ')}
          >
            <span className="text-3xl font-bold text-white">{mesa.numero}</span>
            <Badge color={STATUS_COLOR[mesa.status]}>
              {STATUS_LABEL[mesa.status]}
            </Badge>
            {mesa.total_comanda ? (
              <span className="text-sm text-slate-300 font-medium">
                R$ {brl(mesa.total_comanda)}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}
