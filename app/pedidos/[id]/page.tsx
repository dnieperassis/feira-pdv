'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Comanda, ComandaItem, Produto, Categoria, Mesa } from '@/types'
import { brl } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

type ProdutoPorCat = { categoria: Categoria; produtos: Produto[] }
type KotItem = { produto_nome: string; quantidade: number; observacao: string | null; parent_item_id?: number | null }
type KotData  = { comanda: Comanda; itens: KotItem[]; enviado_em: string }

// Detecta se uma categoria é de "adicionais"
function isAdicional(categoriaNome?: string | null): boolean {
  if (!categoriaNome) return false
  return categoriaNome.toLowerCase().includes('adicional')
}

const STATUS_ICON: Record<string, string> = {
  pendente:   '⏳',
  produzindo: '🔥',
  pronto:     '✅',
  entregue:   '✔',
  cancelado:  '✖',
}

// Painel lateral/drawer dos pedidos — reutilizado em desktop e mobile
function PainelPedidos({
  itens, pendentes, total, onCancelar, semHeader,
}: {
  itens: ComandaItem[]
  pendentes: ComandaItem[]
  total: number
  onCancelar: (item: ComandaItem) => void
  semHeader?: boolean
}) {
  return (
    <>
      {!semHeader && (
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <span className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Pedidos</span>
          {pendentes.length > 0 && (
            <span className="text-xs bg-amber-500 text-gray-950 font-bold px-2 py-0.5 rounded-full">
              {pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1 min-h-[200px]">
        {itens.length === 0 ? (
          <p className="text-slate-500 text-sm text-center mt-8">Nenhum item adicionado</p>
        ) : itens.map(item => {
          const ehAdicional = !!item.parent_item_id
          return (
            <div
              key={item.id}
              className={[
                'flex items-start justify-between gap-1 py-1.5 border-b border-slate-800',
                ehAdicional ? 'ml-4 border-l-2 border-l-amber-500/40 pl-2' : '',
                item.status === 'cancelado' ? 'opacity-35 line-through' : '',
              ].join(' ')}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {ehAdicional && <span className="text-amber-500/70 text-xs shrink-0">↳</span>}
                  <span className="text-sm shrink-0" title={item.status}>{STATUS_ICON[item.status]}</span>
                  <p className={`text-sm font-medium truncate ${ehAdicional ? 'text-amber-300' : 'text-white'}`}>
                    {item.produto_nome}
                  </p>
                </div>
                <p className={`text-xs ${ehAdicional ? 'ml-8' : 'ml-5'} text-slate-400`}>x{item.quantidade}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-amber-400 text-sm font-semibold">R$ {brl(item.total)}</span>
                {item.status !== 'cancelado' && item.status !== 'entregue' && (
                  <button
                    onClick={() => onCancelar(item)}
                    title="Cancelar item"
                    className={[
                      'ml-1 w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold transition-colors',
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
          )
        })}
      </div>
      <div className="px-4 py-3 border-t border-slate-700 bg-slate-800">
        <div className="flex justify-between items-center">
          <span className="text-slate-300 font-semibold">Total</span>
          <span className="text-amber-400 font-bold text-lg">R$ {brl(total)}</span>
        </div>
      </div>
    </>
  )
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

  // Drawer mobile do painel de pedidos
  const [drawerAberto, setDrawerAberto] = useState(false)

  // Modal seleção de pai (adicionais)
  const [modalAdicional, setModalAdicional]     = useState(false)
  const [produtoAdicional, setProdutoAdicional] = useState<Produto | null>(null)

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
    // Descobre a categoria do produto
    const grupo = grupos.find(g => g.produtos.some(p => p.id === produto.id))
    const catNome = grupo?.categoria.nome ?? null

    // Se for adicional E existir algum item na comanda → pede seleção do pai
    const itensPais = itens.filter(i => !i.parent_item_id && i.status !== 'cancelado')
    if (isAdicional(catNome) && itensPais.length > 0) {
      setProdutoAdicional(produto)
      setModalAdicional(true)
      return
    }

    // Caso contrário, adiciona normalmente (sem pai)
    await fetch(`/api/comandas/${id}/itens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produto_id: produto.id, quantidade: 1 }),
    })
    carregarComanda()
  }

  async function confirmarAdicional(parentItemId: number | null) {
    if (!produtoAdicional) return
    setModalAdicional(false)
    await fetch(`/api/comandas/${id}/itens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produto_id: produtoAdicional.id,
        quantidade: 1,
        parent_item_id: parentItemId,
      }),
    })
    setProdutoAdicional(null)
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

    // Tenta impressão via TCP; se não configurado, usa browser
    const printRes = await fetch('/api/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'kot',
        mesa: comanda?.tipo === 'balcao' ? 'BALCAO' : `MESA ${String(comanda?.mesa_numero).padStart(2, '0')}`,
        comanda_id: Number(id),
        enviado_em: data.enviado_em,
        itens: data.itens,
      }),
    })
    const printData = await printRes.json()
    if (printData.modo === 'browser') {
      // Fallback: impressão pelo navegador
      setTimeout(() => window.print(), 150)
    }
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
              <p className="kot-mesa">
                {comanda?.tipo === 'balcao' ? 'BALCÃO' : `MESA ${String(comanda?.mesa_numero).padStart(2, '0')}`}
                {' '}—{' '}#{id}
              </p>
              <p className="kot-hora">{kotData.enviado_em}</p>
            </div>
            <hr />
            {kotData.itens.map((item, i) => (
              <div key={i} className={item.parent_item_id ? 'kot-adicional' : 'kot-item'}>
                {item.parent_item_id
                  ? <><span className="kot-adicional-seta">    +</span><span className="kot-qty">{item.quantidade}x</span><span className="kot-nome">{item.produto_nome}</span></>
                  : <><span className="kot-qty">{item.quantidade}x</span><span className="kot-nome">{item.produto_nome}</span></>
                }
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

        {/* Header — compacto no mobile, ações principais visíveis */}
        <div className="bg-slate-900 border-b border-slate-700 px-3 py-2 shrink-0">
          {/* Linha 1: identificação + voltar */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => router.push('/mesas')}
                className="text-slate-400 hover:text-white text-lg shrink-0 px-1"
                title="Voltar para mesas"
              >
                ←
              </button>
              <span className="text-white font-bold text-base sm:text-lg truncate">{tituloMesa}</span>
              <span className="text-slate-500 text-xs shrink-0">#{id}</span>
            </div>
            <span className="text-amber-400 font-bold text-lg sm:text-xl shrink-0">R$ {brl(total)}</span>
          </div>

          {/* Linha 2: botões de ação — scroll horizontal no mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {comanda?.tipo === 'mesa' && (
              <button
                onClick={abrirTrocaMesa}
                className="shrink-0 px-3 py-2 text-xs sm:text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium"
              >
                ↔ Trocar
              </button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={enviarCozinha}
              disabled={pendentes.length === 0 || enviando}
              className="shrink-0"
            >
              {enviando ? '...' : `🍳 Cozinha${pendentes.length > 0 ? ` (${pendentes.length})` : ''}`}
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={() => router.push(`/caixa/${id}`)}
              disabled={itens.length === 0}
              className="shrink-0"
            >
              Fechar Conta
            </Button>
            <Button variant="danger" size="sm" onClick={liberarMesa} className="shrink-0">
              🚫 Liberar
            </Button>
          </div>
        </div>

        {/* Categorias — barra horizontal no mobile / coluna lateral no desktop */}
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

          {/* MOBILE: tabs horizontais */}
          <div className="md:hidden flex gap-1 px-2 py-2 bg-slate-900 border-b border-slate-700 overflow-x-auto shrink-0">
            {grupos.map(({ categoria }) => (
              <button
                key={categoria.id}
                onClick={() => setCatAtiva(categoria.id)}
                className={[
                  'shrink-0 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
                  catAtiva === categoria.id
                    ? 'bg-amber-500 text-gray-950'
                    : 'bg-slate-800 text-slate-300',
                ].join(' ')}
              >
                {categoria.nome}
              </button>
            ))}
          </div>

          {/* DESKTOP: coluna lateral de categorias */}
          <div className="hidden md:flex w-40 bg-slate-900 border-r border-slate-700 flex-col gap-1 p-2 overflow-y-auto shrink-0">
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
          <div className="flex-1 p-3 overflow-y-auto pb-24 md:pb-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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

          {/* Painel de pedidos — fixo no desktop, drawer no mobile */}
          <div
            className={[
              // Desktop: coluna lateral fixa
              'hidden md:flex md:relative md:w-64 md:translate-y-0',
              'bg-slate-900 border-l border-slate-700 flex-col shrink-0',
            ].join(' ')}
          >
            <PainelPedidos
              itens={itens}
              pendentes={pendentes}
              total={total}
              onCancelar={cancelarItem}
            />
          </div>
        </div>

        {/* Botão flutuante MOBILE — abre o drawer */}
        <button
          onClick={() => setDrawerAberto(true)}
          className="md:hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-gray-950 font-bold px-5 py-3 rounded-full shadow-2xl shadow-amber-500/30 transition-transform active:scale-95"
        >
          🛒 {itens.length > 0 ? `${itens.length} item${itens.length > 1 ? 's' : ''} · R$ ${brl(total)}` : 'Pedidos'}
        </button>

        {/* Drawer MOBILE de pedidos */}
        {drawerAberto && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setDrawerAberto(false)}
          >
            <div
              className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 rounded-t-3xl flex flex-col max-h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-semibold uppercase tracking-wide text-sm">Pedidos</span>
                  {pendentes.length > 0 && (
                    <span className="text-xs bg-amber-500 text-gray-950 font-bold px-2 py-0.5 rounded-full">
                      {pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setDrawerAberto(false)}
                  className="text-slate-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800"
                >×</button>
              </div>
              <PainelPedidos
                itens={itens}
                pendentes={pendentes}
                total={total}
                onCancelar={cancelarItem}
                semHeader
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Adicional: selecionar item pai ── */}
      <Modal
        open={modalAdicional}
        onClose={() => { setModalAdicional(false); setProdutoAdicional(null) }}
        title={`Adicional: ${produtoAdicional?.nome ?? ''}`}
      >
        <div className="flex flex-col gap-3">
          <p className="text-slate-300 text-sm">
            Em qual item este adicional será inserido?
          </p>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {itens
              .filter(i => !i.parent_item_id && i.status !== 'cancelado')
              .map(item => (
                <button
                  key={item.id}
                  onClick={() => confirmarAdicional(item.id)}
                  className="flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-amber-500/20 border border-slate-600 hover:border-amber-500 rounded-xl transition-all text-left"
                >
                  <div>
                    <p className="text-white font-semibold">{item.produto_nome}</p>
                    <p className="text-slate-400 text-xs">x{item.quantidade} · R$ {brl(item.total)}</p>
                  </div>
                  <span className="text-amber-400 text-lg">→</span>
                </button>
              ))
            }
          </div>
          <button
            onClick={() => confirmarAdicional(null)}
            className="w-full px-4 py-2 text-slate-400 hover:text-slate-200 text-sm border border-dashed border-slate-600 rounded-xl transition-colors"
          >
            Adicionar sem vincular a um item específico
          </button>
        </div>
      </Modal>

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

      {/* Estilos de impressão centralizados em globals.css */}
    </>
  )
}
