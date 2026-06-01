'use client'

import { useEffect, useState } from 'react'

interface Resumo {
  totais: {
    total_vendas: number
    total_comandas: number
    total_dinheiro: number
    total_pix: number
    total_cartao: number
  }
  movimentacoes: { id: number; tipo: string; valor: number; observacao: string | null; criado_em: string }[]
}

export default function RelatoriosPage() {
  const [data, setData] = useState<Resumo | null>(null)

  useEffect(() => {
    fetch('/api/caixa').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <div className="flex items-center justify-center h-full text-slate-400">Carregando...</div>

  const { totais } = data
  const ticket = totais.total_comandas > 0 ? totais.total_vendas / totais.total_comandas : 0

  return (
    <div className="p-4 flex flex-col gap-6 max-w-3xl mx-auto">
      <h1 className="text-white font-bold text-xl">Relatório do Dia</h1>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card label="Total de Vendas" value={`R$ ${totais.total_vendas.toFixed(2)}`} color="amber" />
        <Card label="Comandas Fechadas" value={String(totais.total_comandas)} color="blue" />
        <Card label="Ticket Médio" value={`R$ ${ticket.toFixed(2)}`} color="slate" />
      </div>

      {/* Por forma de pagamento */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3">
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Por Forma de Pagamento</h2>
        <Row label="💵 Dinheiro"   value={totais.total_dinheiro} />
        <Row label="📲 PIX"         value={totais.total_pix} />
        <Row label="💳 Cartão"      value={totais.total_cartao} />
      </div>

      {/* Movimentações de caixa */}
      {data.movimentacoes.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3">
          <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Movimentações de Caixa</h2>
          {data.movimentacoes.map(m => (
            <div key={m.id} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
              <div>
                <span className="text-white text-sm font-medium capitalize">{m.tipo}</span>
                {m.observacao && <span className="text-slate-400 text-xs ml-2">{m.observacao}</span>}
              </div>
              <span className="text-amber-400 font-semibold">R$ {m.valor.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Card({ label, value, color }: { label: string; value: string; color: 'amber' | 'blue' | 'slate' }) {
  const colors = {
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    slate: 'text-slate-300',
  }
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
      <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">{label}</p>
      <p className={`font-bold text-2xl ${colors[color]}`}>{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-300 text-sm">{label}</span>
      <span className="text-white font-semibold">R$ {value.toFixed(2)}</span>
    </div>
  )
}
