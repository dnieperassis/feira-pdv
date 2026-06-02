'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Produto, Categoria } from '@/types'
import { brl } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

type Form = {
  nome: string; preco: string; categoria_id: string
  descricao: string; disponivel: boolean
}

const formVazio: Form = { nome: '', preco: '', categoria_id: '', descricao: '', disponivel: true }

export default function CardapioPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [catFiltro, setCatFiltro] = useState<number | 'todos'>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [form, setForm] = useState<Form>(formVazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const [rp, rc] = await Promise.all([fetch('/api/produtos'), fetch('/api/categorias')])
    setProdutos(await rp.json())
    setCategorias(await rc.json())
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setForm(formVazio)
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(p: Produto) {
    setEditando(p)
    setForm({
      nome: p.nome,
      preco: p.preco.toString(),
      categoria_id: p.categoria_id?.toString() ?? '',
      descricao: p.descricao ?? '',
      disponivel: !!p.disponivel,
    })
    setErro('')
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome obrigatório'); return }
    const preco = parseFloat(form.preco)
    if (isNaN(preco) || preco < 0) { setErro('Preço inválido'); return }

    setSalvando(true)
    setErro('')

    const body = {
      nome: form.nome.trim(),
      preco,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      descricao: form.descricao.trim() || null,
      disponivel: form.disponivel ? 1 : 0,
    }

    const res = editando
      ? await fetch(`/api/produtos/${editando.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/produtos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    setSalvando(false)
    if (res.ok) {
      setModalAberto(false)
      carregar()
    } else {
      const data = await res.json()
      setErro(data.error ?? 'Erro ao salvar')
    }
  }

  async function toggleDisponivel(p: Produto) {
    await fetch(`/api/produtos/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disponivel: p.disponivel ? 0 : 1 }),
    })
    carregar()
  }

  async function excluir(p: Produto) {
    if (!confirm(`Excluir "${p.nome}"?`)) return
    const res = await fetch(`/api/produtos/${p.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error)
    } else {
      carregar()
    }
  }

  const listados = catFiltro === 'todos'
    ? produtos
    : produtos.filter(p => p.categoria_id === catFiltro)

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Topo */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-white font-bold text-xl">Cardápio</h1>
        <Button onClick={abrirNovo} size="md">+ Novo Produto</Button>
      </div>

      {/* Filtro por categoria */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCatFiltro('todos')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${catFiltro === 'todos' ? 'bg-amber-500 text-gray-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Todos ({produtos.length})
        </button>
        {categorias.map(c => {
          const count = produtos.filter(p => p.categoria_id === c.id).length
          return (
            <button
              key={c.id}
              onClick={() => setCatFiltro(c.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${catFiltro === c.id ? 'bg-amber-500 text-gray-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              {c.nome} ({count})
            </button>
          )
        })}
      </div>

      {/* Lista de produtos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {listados.map(produto => (
          <div
            key={produto.id}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{produto.nome}</p>
                {produto.descricao && (
                  <p className="text-slate-400 text-xs mt-0.5 truncate">{produto.descricao}</p>
                )}
                <p className="text-slate-500 text-xs mt-1">{produto.categoria_nome ?? 'Sem categoria'}</p>
              </div>
              <Badge color={produto.disponivel ? 'green' : 'slate'}>
                {produto.disponivel ? 'Disponível' : 'Indisponível'}
              </Badge>
            </div>
            <p className="text-amber-400 font-bold text-xl">R$ {brl(produto.preco)}</p>
            <div className="flex gap-2 pt-1 border-t border-slate-700">
              <Button variant="ghost" size="sm" onClick={() => toggleDisponivel(produto)} className="flex-1">
                {produto.disponivel ? 'Pausar' : 'Ativar'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => abrirEditar(produto)} className="flex-1">
                Editar
              </Button>
              <Button variant="danger" size="sm" onClick={() => excluir(produto)}>✕</Button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal novo/editar */}
      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? `Editar: ${editando.nome}` : 'Novo Produto'}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1">Nome *</label>
            <input
              type="text"
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
              placeholder="Ex: Pastel de Queijo"
            />
          </div>
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1">Preço (R$) *</label>
            <input
              type="number"
              step="0.50"
              min="0"
              value={form.preco}
              onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1">Categoria</label>
            <select
              value={form.categoria_id}
              onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">Sem categoria</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1">Descrição</label>
            <input
              type="text"
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
              placeholder="Opcional"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.disponivel}
              onChange={e => setForm(f => ({ ...f, disponivel: e.target.checked }))}
              className="w-5 h-5 accent-amber-500"
            />
            <span className="text-slate-300 text-sm">Disponível para venda</span>
          </label>

          {erro && <p className="text-red-400 text-sm">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" size="md" fullWidth onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button size="md" fullWidth onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
