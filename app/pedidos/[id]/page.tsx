'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Comanda, ComandaItem, Produto, Categoria, Mesa } from '@/types'
import { brl } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

type ProdutoPorCat = { categoria: Categoria; produtos: Produto[] }
type KotItem = { produto_nome: string; quantidade: number; observacao: string | null }
type KotData  = { comanda: Comanda; itens: KotItem[]; enviado_em: string }

const STATUS_ICON: Record<string, string> = {
  pendente:   '⏳',
  produzindo: '🔥',
  pronto:     '✅',
  entregue:   '✔',
  cancelado:  '✖',
}

export default function PedidosPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const kotRef = useRef<HTMLDivElement>(null)

  const [comanda, setComanda]   = useState<Comanda | null>(null)
  const [itens, setItens]       = useState<ComandaItem[]>([])
  const [grupos, setGrupos]     = useState<ProdutoPorCat[]>([])
  const [catAtiva, setCatAtiva] = useState<number | null>(null)
  const [loading, setLoading]   = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [kotData, setKotData]   = useState<KotData | null>(null)

  // Trocar mesa
  const [modalTroca, setModalTroca]   = useState(false)
  const [mesasLivres, setMesasLivres] = useState<Mesa[]>([])
  const [trocando, setTrocando]       = useState(false)

  const carregarComanda = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      fetch(`/api/comandas/${id}`),
      fetch(`/api/comandas/${id}/itens`),
    ])
    if (!r1.ok) { router.push('/mesas'); return }
    setComanda(await r1.json())
    setItens(await r2.json())
  }, [id, router])

  useEffect(() => {
    async function init() {
      const [resProd, resCat] = await Promise.all([
        fetch('/api/produtos'),
        fetch('/api/categorias'),
      ])
      const produtos: Produto[]   = await resProd.json()
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

  async function liberarMesa() {
    const itenAtivos = itens.filter(i => i.status !== 'cancelado')
    const msg = itenAtivos.length > 0
      ? `Há ${itenAtivos.length} item(s) lançado(s). Cancelar tudo e liberar a mesa?`
      : 'Liberar a mesa sem nenhum pedido?'

    if (!confirm(msg)) return

    const res = await fetch(`/api/comandas/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/mesas')
    else alert('Erro ao liberar mesa')
  }

  async function cancelarItem(item: ComandaItem) {
    const naoCozinha = item.status === 'pendente'
    const msg = naoCozinha
      ? null
      : `"${item.produto_nome}" já foi enviado para a cozinha (${item.status}). Confirmar cancelamento?`

    if (msg && !confirm(msg)) return

    await fetch(`/api/comandas/${id}/itens/${item.id}`, { method: 'DELETE' })
    carregarComanda()
  }

  async function enviarCozinha() {
    setEnviando(true)
    const res = await fetch(`/api/comandas/${id}/cozinha`, { method: 'POST' })
    setEnviando(false)

    if (!res.ok) {
      const e = await res.json()
      alert(e.error ?? 'Erro ao enviar para cozinha')
      return
    }

    const data: KotData = await res.json()
    setKotData(data)
    await carregarComanda()
    // Pequeno delay para o KOT renderizar antes de imprimir
    setTimeout(() => window.print(), 150)
  }

  async function abrirTrocaMesa() {
    const res = await fetch('/api/mesas')
    const todas: Mesa[] = await res.json()
    setMesasLivres(todas.filter(m => m.status === 'livre'))
    setModalTroca(true)
  }

  async function confirmarTroca(mesa: Mesa) {
    setTrocando(true)
    const res = await fetch(`/api/comandas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesa_id: mesa.id }),
    })
    setTrocando(false)

    if (!res.ok) {
      const e = await res.json()
      alert(e.error ?? 'Erro ao trocar mesa')
      return
    }

    const novaComanda: Comanda = await res.json()
    setComanda(novaComanda)
    setModalTroca(false)
  }

  const pendentes = itens.filter(i => i.status === 'pendente')
  const total     = itens.reduce((s, i) => s + i.total, 0)
  const produtosAtivos = grupos.find(g => g.categoria.id === catAtiva)?.produtos ?? []

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-400">Carregando...</div>
  }

  const tituloMesa = comanda?.tipo === 'balcao'
    ? '🛒 Balcão'
    : `Mesa ${comanda?.mesa_numero}`

  return (
    <>
      {/* ── KOT de impressão (invisível na tela, visível ao imprimir) ── */}
      <div ref={kotRef} className="kot-print" aria-hidden>
        {kotData && (
          <>
            <div className="kot-header">
              <strong>⚡ COMANDA DE COZINHA</strong>
              <p>{comanda?.tipo === 'balcao' ? 'BALCÃO' : `MESA ${comanda?.mesa_numero}`} — #{id}</p>
              <p>{kotData.enviado_em}</p>
            </div>
            <hr />
            {kotData.itens.map((item, i) => (
              <div key={i} className="kot-item">
                <span className="kot-qty">{item.quantidade}x</span>
                <span className="kot-nome">{item.produto_nome}</span>
                {item.observacao && <p className="kot-obs">  ↳ {item.observacao}</p>}
              </div>
            ))}
            <hr />
            <p className="kot-total">{kotData.itens.length} item(s) enviado(s)</p>
          </>
        )}
      </div>

      {/* ── Layout principal ── */}
      <div className="flex flex-col h-full no-print">

        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-700 px-4 py-2 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold text-lg">{tituloMesa}</span>
              <span className="text-slate-400 text-sm">#{id}</span>
              {comanda?.tipo === 'mesa' && (
                <button
                  onClick={abrirTrocaMesa}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                >
                  ↔ Trocar Mesa
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="text-amber-400 font-bold text-xl">R$ {brl(total)}</span>
              <Button
                variant="secondary"
                size="md"
                onClick={enviarCozinha}
                disabled={pendentes.length === 0 || enviando}
              >
                {enviando ? 'Enviando...' : `🍳 Cozinha${pendentes.length > 0 ? ` (${pendentes.length})` : ''}`}
              </Button>
              <Button
                variant="success"
                size="md"
                onClick={() => router.push(`/caixa/${id}`)}
                disabled={itens.length === 0}
              >
                Fechar Conta
              </Button>
              <Button variant="danger" size="md" onClick={liberarMesa}>
                🚫 Liberar Mesa
              </Button>
              <Button variant="ghost" size="md" onClick={() => router.push('/mesas')}>
                ← Mesas
              </Button>
            </div>
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
                  <span className="text-amber-400 font-bold text-lg mt-2">R$ {brl(produto.preco)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Itens da comanda */}
          <div className="w-56 sm:w-64 bg-slate-900 border-l border-slate-700 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <span className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Pedidos</span>
              {pendentes.length > 0 && (
                <span className="text-xs bg-amber-500 text-gray-950 font-bold px-2 py-0.5 rounded-full">
                  {pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
              {itens.length === 0 ? (
                <p className="text-slate-500 text-sm text-center mt-8">Nenhum item adicionado</p>
              ) : itens.map(item => (
                <div
                  key={item.id}
                  className={[
                    'flex items-start justify-between gap-1 py-2 border-b border-slate-800',
                    item.status === 'cancelado' ? 'opacity-35 line-through' : '',
                  ].join(' ')}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm shrink-0" title={item.status}>{STATUS_ICON[item.status]}</span>
                      <p className="text-white text-sm font-medium truncate">{item.produto_nome}</p>
                    </div>
                    <p className="text-slate-400 text-xs ml-5">x{item.quantidade}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-amber-400 text-sm font-semibold">
                      R$ {brl(item.total)}
                    </span>
                    {item.status !== 'cancelado' && item.status !== 'entregue' && (
                      <button
                        onClick={() => cancelarItem(item)}
                        title="Cancelar item"
                        className={[
                          'ml-1 w-6 h-6 flex items-center justify-center rounded-lg text-xs font-bold transition-colors',
                          item.status === 'pendente'
                            ? 'text-slate-500 hover:text-red-400 hover:bg-red-900/30'
                            : 'text-amber-500 hover:text-red-400 hover:bg-red-900/30',
                        ].join(' ')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-700 bg-slate-800">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-semibold">Total</span>
                <span className="text-amber-400 font-bold text-lg">R$ {brl(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Trocar Mesa ── */}
      <Modal open={modalTroca} onClose={() => setModalTroca(false)} title="Trocar Mesa" maxWidth="max-w-xl">
        {mesasLivres.length === 0 ? (
          <p className="text-slate-400 text-center py-4">Nenhuma mesa disponível no momento.</p>
        ) : (
          <>
            <p className="text-slate-400 text-sm mb-4">Selecione a mesa de destino:</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {mesasLivres.map(mesa => (
                <button
                  key={mesa.id}
                  onClick={() => confirmarTroca(mesa)}
                  disabled={trocando}
                  className="flex flex-col items-center justify-center p-4 bg-slate-800 hover:bg-green-900/40 border-2 border-slate-600 hover:border-green-500 rounded-2xl transition-all active:scale-95 min-h-[80px] disabled:opacity-50"
                >
                  <span className="text-white font-bold text-2xl">{mesa.numero}</span>
                  <span className="text-green-400 text-xs mt-1">Livre</span>
                </button>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* ── Estilos de impressão do KOT ── */}
      <style jsx global>{`
        .kot-print { display: none; }

        @media print {
          .no-print { display: none !important; }
          .kot-print {
            display: block !important;
            font-family: 'Courier New', monospace;
            font-size: 16px;
            width: 80mm;
            margin: 0 auto;
            padding: 8px;
            color: #000;
            background: #fff;
          }
          .kot-header { text-align: center; margin-bottom: 8px; line-height: 1.6; }
          .kot-header strong { font-size: 18px; }
          .kot-item { display: flex; gap: 8px; margin: 6px 0; font-size: 15px; flex-wrap: wrap; }
          .kot-qty  { font-weight: bold; min-width: 28px; }
          .kot-nome { font-weight: bold; flex: 1; }
          .kot-obs  { margin: 0 0 4px 36px; font-size: 13px; color: #444; width: 100%; }
          .kot-total { text-align: center; margin-top: 8px; font-size: 13px; }
          hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        }
      `}</style>
    </>
  )
}
