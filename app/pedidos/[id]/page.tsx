'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Comanda, ComandaItem, Produto, Categoria } from '@/types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

type ProdutoPorCat = { categoria: Categoria; produtos: Produto[] }

export default function PedidosPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [comanda, setComanda] = useState<Comanda | null>(null)
  const [itens, setItens] = useState<ComandaItem[]>([])
  const [grupos, setGrupos] = useState<ProdutoPorCat[]>([])
  const [catAtiva, setCatAtiva] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const carregarComanda = useCallback(async () => {
    const [resComanda, resItens] = await Promise.all([
      fetch(`/api/comandas/${id}`),
      fetch(`/api/comandas/${id}/itens`),
    ])
    if (!resComanda.ok) { router.push('/mesas'); return }
    setComanda(await resComanda.json())
    setItens(await resItens.json())
  }, [id, router])

  useEffect(() => {
    async function init() {
      const [resProd, resCat] = await Promise.all([
        fetch('/api/produtos'),
        fetch('/api/categorias'),
      ])
      const produtos: Produto[] = await resProd.json()
      const categorias: Categoria[] = await resCat.json()

      const disponíveis = produtos.filter(p => p.disponivel)
      const gs: ProdutoPorCat[] = categorias
        .map(c => ({ categoria: c, produtos: disponíveis.filter(p => p.categoria_id === c.id) }))
        .filter(g => g.produtos.length > 0)

      setGrupos(gs)
      if (gs.length > 0) setCatAtiva(gs[0].categoria.id)
      await carregarComanda()
      setLoading(false)
    }
    init()
  }, [carregarComanda])

  async function adicionarItem(produto: Produto) {
    await fetch(`/api/comandas/${id}/itens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produto_id: produto.id, quantidade: 1 }),
    })
    carregarComanda()
  }

  const total = itens.reduce((s, i) => s + i.total, 0)
  const produtosAtivos = grupos.find(g => g.categoria.id === catAtiva)?.produtos ?? []

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-400">Carregando...</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header da comanda */}
      <div className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <span className="text-white font-bold text-lg">
            {comanda?.tipo === 'balcao' ? '🛒 Balcão' : `Mesa ${comanda?.mesa_numero}`}
          </span>
          <span className="text-slate-400 text-sm ml-2">#{id}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-bold text-xl">R$ {total.toFixed(2)}</span>
          <Button
            variant="success"
            size="md"
            onClick={() => router.push(`/caixa/${id}`)}
            disabled={itens.length === 0}
          >
            Fechar Conta
          </Button>
          <Button variant="ghost" size="md" onClick={() => router.push('/mesas')}>
            ← Mesas
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Categorias */}
        <div className="w-32 sm:w-40 bg-slate-900 border-r border-slate-700 flex flex-col gap-1 p-2 overflow-y-auto shrink-0">
          {grupos.map(({ categoria }) => (
            <button
              key={categoria.id}
              onClick={() => setCatAtiva(categoria.id)}
              className={[
                'w-full text-left px-3 py-3 rounded-xl text-sm font-medium transition-colors',
                catAtiva === categoria.id
                  ? 'bg-amber-500 text-gray-950'
                  : 'text-slate-300 hover:bg-slate-800',
              ].join(' ')}
            >
              {categoria.nome}
            </button>
          ))}
        </div>

        {/* Produtos */}
        <div className="flex-1 p-3 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {produtosAtivos.map(produto => (
              <button
                key={produto.id}
                onClick={() => adicionarItem(produto)}
                className="flex flex-col items-start p-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-600 hover:border-amber-500 rounded-2xl transition-all duration-100 active:scale-95 text-left"
              >
                <span className="text-white font-semibold text-base leading-snug">{produto.nome}</span>
                <span className="text-amber-400 font-bold text-lg mt-2">R$ {produto.preco.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Itens da comanda */}
        <div className="w-56 sm:w-64 bg-slate-900 border-l border-slate-700 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-slate-700">
            <span className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Pedidos</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
            {itens.length === 0 ? (
              <p className="text-slate-500 text-sm text-center mt-8">Nenhum item adicionado</p>
            ) : itens.map(item => (
              <div key={item.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-800">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{item.produto_nome}</p>
                  <p className="text-slate-400 text-xs">x{item.quantidade}</p>
                </div>
                <span className="text-amber-400 text-sm font-semibold shrink-0">
                  R$ {item.total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-700 bg-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 font-semibold">Total</span>
              <span className="text-amber-400 font-bold text-lg">R$ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
