'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Produto } from '@/types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [ajustando, setAjustando] = useState<Produto | null>(null)
  const [quantidade, setQuantidade] = useState('')
  const [tipo, setTipo] = useState<'entrada' | 'ajuste'>('entrada')

  const carregar = useCallback(async () => {
    const res = await fetch('/api/produtos')
    const todos: Produto[] = await res.json()
    setProdutos(todos.filter(p => p.controla_estoque))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvarAjuste() {
    if (!ajustando || !quantidade) return
    const qtd = parseFloat(quantidade)
    if (isNaN(qtd) || qtd <= 0) return

    await fetch(`/api/produtos/${ajustando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estoque_atual: tipo === 'ajuste' ? qtd : ajustando.estoque_atual + qtd,
      }),
    })
    setAjustando(null)
    setQuantidade('')
    carregar()
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="text-white font-bold text-xl">Estoque</h1>

      {produtos.length === 0 ? (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
          <p className="text-slate-400 text-lg mb-2">Nenhum produto com controle de estoque</p>
          <p className="text-slate-500 text-sm">Ative o controle de estoque no Cardápio para monitorar produtos aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {produtos.map(p => {
            const baixo = p.estoque_atual <= p.estoque_minimo
            return (
              <div key={p.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <p className="text-white font-semibold">{p.nome}</p>
                  <Badge color={baixo ? 'red' : 'green'}>
                    {baixo ? 'Baixo' : 'OK'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Atual</span>
                  <span className="text-white font-bold text-2xl">{p.estoque_atual}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Mínimo: {p.estoque_minimo}</span>
                </div>

                {ajustando?.id === p.id ? (
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-700">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTipo('entrada')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tipo === 'entrada' ? 'bg-amber-500 text-gray-950' : 'bg-slate-800 text-slate-300'}`}
                      >
                        + Entrada
                      </button>
                      <button
                        onClick={() => setTipo('ajuste')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tipo === 'ajuste' ? 'bg-amber-500 text-gray-950' : 'bg-slate-800 text-slate-300'}`}
                      >
                        Ajustar para
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={quantidade}
                      onChange={e => setQuantidade(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-amber-500"
                      placeholder="Quantidade"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" fullWidth onClick={() => setAjustando(null)}>Cancelar</Button>
                      <Button size="sm" fullWidth onClick={salvarAjuste}>Salvar</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => { setAjustando(p); setQuantidade('') }}>
                    Ajustar Estoque
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
