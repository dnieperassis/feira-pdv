'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Comanda, ComandaItem, FormaPagamento } from '@/types'
import { Button } from '@/components/ui/Button'

const FORMAS: { id: FormaPagamento; label: string; icon: string }[] = [
  { id: 'dinheiro',       label: 'Dinheiro',      icon: '💵' },
  { id: 'pix',            label: 'PIX',            icon: '📲' },
  { id: 'cartao_debito',  label: 'Débito',         icon: '💳' },
  { id: 'cartao_credito', label: 'Crédito',        icon: '💳' },
]

export default function CaixaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [comanda, setComanda] = useState<Comanda | null>(null)
  const [itens, setItens] = useState<ComandaItem[]>([])
  const [forma, setForma] = useState<FormaPagamento>('dinheiro')
  const [valorRecebido, setValorRecebido] = useState('')
  const [fechando, setFechando] = useState(false)

  const carregar = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      fetch(`/api/comandas/${id}`),
      fetch(`/api/comandas/${id}/itens`),
    ])
    if (!r1.ok) { router.push('/mesas'); return }
    const c: Comanda = await r1.json()
    const i: ComandaItem[] = await r2.json()
    setComanda(c)
    setItens(i)
    setValorRecebido(c.total.toFixed(2))
  }, [id, router])

  useEffect(() => { carregar() }, [carregar])

  const total = itens.reduce((s, i) => s + i.total, 0)
  const recebido = parseFloat(valorRecebido) || 0
  const troco = forma === 'dinheiro' ? Math.max(0, recebido - total) : 0

  async function fechar() {
    if (recebido < total && forma === 'dinheiro') {
      alert('Valor recebido menor que o total')
      return
    }
    setFechando(true)
    const res = await fetch('/api/caixa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comanda_id: Number(id),
        pagamentos: [{ forma, valor: total, troco }],
      }),
    })
    setFechando(false)
    if (res.ok) router.push('/mesas')
    else alert('Erro ao fechar conta')
  }

  if (!comanda) return <div className="flex items-center justify-center h-full text-slate-400">Carregando...</div>

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-2xl">Fechar Conta</h1>
          <p className="text-slate-400 text-sm">
            {comanda.tipo === 'balcao' ? 'Balcão' : `Mesa ${comanda.mesa_numero}`} · #{id}
          </p>
        </div>
        <Button variant="ghost" size="md" onClick={() => router.back()}>← Voltar</Button>
      </div>

      {/* Itens */}
      <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <span className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Resumo do pedido</span>
        </div>
        <div className="divide-y divide-slate-800">
          {itens.map(item => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="text-white font-medium">{item.produto_nome}</span>
                <span className="text-slate-400 text-sm ml-2">× {item.quantidade}</span>
              </div>
              <span className="text-amber-400 font-semibold">R$ {item.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-4 bg-slate-800 flex justify-between items-center border-t border-slate-600">
          <span className="text-white font-bold text-lg">Total</span>
          <span className="text-amber-400 font-bold text-2xl">R$ {total.toFixed(2)}</span>
        </div>
      </div>

      {/* Forma de pagamento */}
      <div>
        <p className="text-slate-300 font-semibold mb-3">Forma de Pagamento</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {FORMAS.map(f => (
            <button
              key={f.id}
              onClick={() => setForma(f.id)}
              className={[
                'flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all min-h-[80px]',
                forma === f.id
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                  : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400',
              ].join(' ')}
            >
              <span className="text-2xl">{f.icon}</span>
              <span className="font-semibold text-sm">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Valor recebido (dinheiro) */}
      {forma === 'dinheiro' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-4 flex flex-col gap-4">
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-2">Valor Recebido (R$)</label>
            <input
              type="number"
              step="0.01"
              min={total}
              value={valorRecebido}
              onChange={e => setValorRecebido(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-xl font-bold focus:outline-none focus:border-amber-500"
            />
          </div>
          {troco > 0 && (
            <div className="flex justify-between items-center bg-green-950/40 border border-green-700 rounded-xl px-4 py-3">
              <span className="text-green-400 font-semibold">Troco</span>
              <span className="text-green-400 font-bold text-xl">R$ {troco.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Botão confirmar */}
      <Button
        variant="success"
        size="xl"
        fullWidth
        onClick={fechar}
        disabled={fechando}
      >
        {fechando ? 'Processando...' : `✓ Confirmar Pagamento · R$ ${total.toFixed(2)}`}
      </Button>
    </div>
  )
}
