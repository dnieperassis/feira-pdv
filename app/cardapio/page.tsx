'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Produto, Categoria } from '@/types'
import { brl } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { CardapioImpressao } from '@/components/CardapioImpressao'

// ── Tipos ──────────────────────────────────────────────────────────────────
type FormProd = { nome: string; preco: string; categoria_id: string; descricao: string; disponivel: boolean }
type FormCat  = { nome: string; ordem: string; is_adicional: boolean }

const formProdVazio: FormProd = { nome: '', preco: '', categoria_id: '', descricao: '', disponivel: true }
const formCatVazio:  FormCat  = { nome: '', ordem: '0', is_adicional: false }

// ── Componente principal ───────────────────────────────────────────────────
export default function CardapioPage() {
  const [produtos,   setProdutos]   = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [catFiltro,  setCatFiltro]  = useState<number | 'todos'>('todos')
  const [config, setConfig]         = useState({ nome_estabelecimento: '', cidade: '', telefone: '' })

  // Modal produto
  const [modalProd,    setModalProd]    = useState(false)
  const [editandoProd, setEditandoProd] = useState<Produto | null>(null)
  const [formProd,     setFormProd]     = useState<FormProd>(formProdVazio)
  const [salvandoProd, setSalvandoProd] = useState(false)
  const [erroProd,     setErroProd]     = useState('')

  // Modal categoria
  const [modalCat,    setModalCat]    = useState(false)
  const [editandoCat, setEditandoCat] = useState<Categoria | null>(null)
  const [formCat,     setFormCat]     = useState<FormCat>(formCatVazio)
  const [salvandoCat, setSalvandoCat] = useState(false)
  const [erroCat,     setErroCat]     = useState('')

  // Aba ativa: 'produtos' | 'categorias'
  const [aba, setAba] = useState<'produtos' | 'categorias'>('produtos')

  // ── Carregamento ─────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    const [rp, rc, rcfg] = await Promise.all([
      fetch('/api/produtos'),
      fetch('/api/categorias'),
      fetch('/api/configuracoes'),
    ])
    setProdutos(await rp.json())
    setCategorias(await rc.json())
    const cfg = await rcfg.json()
    setConfig({ nome_estabelecimento: cfg.nome_estabelecimento, cidade: cfg.cidade, telefone: cfg.telefone ?? '' })
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ── Ações de PRODUTO ──────────────────────────────────────────────────────
  function abrirNovoProd() {
    setEditandoProd(null); setFormProd(formProdVazio); setErroProd(''); setModalProd(true)
  }
  function abrirEditarProd(p: Produto) {
    setEditandoProd(p)
    setFormProd({ nome: p.nome, preco: String(p.preco), categoria_id: p.categoria_id?.toString() ?? '', descricao: p.descricao ?? '', disponivel: !!p.disponivel })
    setErroProd(''); setModalProd(true)
  }

  async function salvarProd() {
    if (!formProd.nome.trim()) { setErroProd('Nome obrigatório'); return }
    const preco = parseFloat(formProd.preco)
    if (isNaN(preco) || preco < 0) { setErroProd('Preço inválido'); return }
    setSalvandoProd(true); setErroProd('')
    const body = {
      nome: formProd.nome.trim(), preco,
      categoria_id: formProd.categoria_id ? parseInt(formProd.categoria_id) : null,
      descricao: formProd.descricao.trim() || null,
      disponivel: formProd.disponivel ? 1 : 0,
    }
    const res = editandoProd
      ? await fetch(`/api/produtos/${editandoProd.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/produtos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSalvandoProd(false)
    if (res.ok) { setModalProd(false); carregar() }
    else { const d = await res.json(); setErroProd(d.error ?? 'Erro ao salvar') }
  }

  async function toggleDisponivel(p: Produto) {
    await fetch(`/api/produtos/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disponivel: p.disponivel ? 0 : 1 }) })
    carregar()
  }

  async function excluirProd(p: Produto) {
    if (!confirm(`Excluir "${p.nome}"?`)) return
    const res = await fetch(`/api/produtos/${p.id}`, { method: 'DELETE' })
    const d = await res.json()
    if (!res.ok) alert(d.error)
    else { if (d.aviso) alert(`⚠️ ${d.aviso}`); carregar() }
  }

  // ── Ações de CATEGORIA ────────────────────────────────────────────────────
  function abrirNovaCat() {
    setEditandoCat(null)
    const proximaOrdem = categorias.length > 0 ? Math.max(...categorias.map(c => c.ordem ?? 0)) + 1 : 1
    setFormCat({ nome: '', ordem: String(proximaOrdem), is_adicional: false })
    setErroCat(''); setModalCat(true)
  }
  function abrirEditarCat(c: Categoria) {
    setEditandoCat(c)
    setFormCat({ nome: c.nome, ordem: String(c.ordem ?? 0), is_adicional: !!c.is_adicional })
    setErroCat(''); setModalCat(true)
  }

  async function salvarCat() {
    if (!formCat.nome.trim()) { setErroCat('Nome obrigatório'); return }
    setSalvandoCat(true); setErroCat('')
    const body = { nome: formCat.nome.trim(), ordem: parseInt(formCat.ordem) || 0, is_adicional: formCat.is_adicional ? 1 : 0 }
    const res = editandoCat
      ? await fetch(`/api/categorias/${editandoCat.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/categorias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSalvandoCat(false)
    if (res.ok) { setModalCat(false); carregar() }
    else { const d = await res.json(); setErroCat(d.error ?? 'Erro ao salvar') }
  }

  async function excluirCat(c: Categoria) {
    const qtdProd = produtos.filter(p => p.categoria_id === c.id).length
    const msg = qtdProd > 0
      ? `A categoria "${c.nome}" possui ${qtdProd} produto(s). Remova ou mova os produtos antes de excluir.`
      : `Excluir a categoria "${c.nome}"?`
    if (!confirm(msg)) return
    const res = await fetch(`/api/categorias/${c.id}`, { method: 'DELETE' })
    const d = await res.json()
    if (!res.ok) alert(d.error)
    else carregar()
  }

  async function toggleAtivoCat(c: Categoria) {
    await fetch(`/api/categorias/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: c.ativo ? 0 : 1 }) })
    carregar()
  }

  const listados = catFiltro === 'todos' ? produtos : produtos.filter(p => p.categoria_id === catFiltro)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 flex flex-col gap-4">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-white font-bold text-xl">Cardápio</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={() => window.print()}>🖨️ Imprimir PDF</Button>
          {aba === 'produtos'   && <Button size="md" onClick={abrirNovoProd}>+ Novo Produto</Button>}
          {aba === 'categorias' && <Button size="md" onClick={abrirNovaCat}>+ Nova Categoria</Button>}
        </div>
      </div>

      {/* Abas Produtos / Categorias */}
      <div className="flex gap-1 border-b border-slate-700">
        {(['produtos', 'categorias'] as const).map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-colors ${
              aba === a
                ? 'bg-slate-900 text-amber-400 border border-b-0 border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {a === 'produtos' ? `🍽️ Produtos (${produtos.length})` : `🏷️ Categorias (${categorias.length})`}
          </button>
        ))}
      </div>

      {/* ── ABA PRODUTOS ── */}
      {aba === 'produtos' && (
        <>
          {/* Filtro por categoria */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setCatFiltro('todos')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${catFiltro === 'todos' ? 'bg-amber-500 text-gray-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              Todos ({produtos.length})
            </button>
            {categorias.map(c => (
              <button
                key={c.id}
                onClick={() => setCatFiltro(c.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${catFiltro === c.id ? 'bg-amber-500 text-gray-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                {c.nome} ({produtos.filter(p => p.categoria_id === c.id).length})
              </button>
            ))}
          </div>

          {/* Grid de produtos */}
          {listados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <span className="text-4xl">🍽️</span>
              <p className="text-sm">Nenhum produto cadastrado ainda.</p>
              <Button size="sm" onClick={abrirNovoProd}>+ Cadastrar primeiro produto</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {listados.map(produto => (
                <div key={produto.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{produto.nome}</p>
                      {produto.descricao && <p className="text-slate-400 text-xs mt-0.5 truncate">{produto.descricao}</p>}
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
                    <Button variant="secondary" size="sm" onClick={() => abrirEditarProd(produto)} className="flex-1">
                      Editar
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => excluirProd(produto)}>✕</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── ABA CATEGORIAS ── */}
      {aba === 'categorias' && (
        <>
          {categorias.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <span className="text-4xl">🏷️</span>
              <p className="text-sm">Nenhuma categoria cadastrada ainda.</p>
              <Button size="sm" onClick={abrirNovaCat}>+ Cadastrar primeira categoria</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {categorias.map(cat => {
                const qtd = produtos.filter(p => p.categoria_id === cat.id).length
                return (
                  <div key={cat.id} className="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 flex items-center gap-3">
                    {/* Ordem */}
                    <span className="text-slate-500 text-sm font-mono w-6 text-center">{cat.ordem ?? 0}</span>

                    {/* Nome + contagem */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold">{cat.nome}</p>
                      <p className="text-slate-500 text-xs">{qtd} produto{qtd !== 1 ? 's' : ''}</p>
                    </div>

                    {/* Badges */}
                    <div className="flex gap-2">
                      {!!cat.is_adicional && (
                        <Badge color="amber">Adicional</Badge>
                      )}
                      <Badge color={cat.ativo ? 'green' : 'slate'}>
                        {cat.ativo ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => toggleAtivoCat(cat)}>
                        {cat.ativo ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => abrirEditarCat(cat)}>
                        Editar
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => excluirCat(cat)}>✕</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Modal Produto ── */}
      <Modal open={modalProd} onClose={() => setModalProd(false)} title={editandoProd ? `Editar: ${editandoProd.nome}` : 'Novo Produto'}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1">Nome *</label>
            <input type="text" value={formProd.nome} onChange={e => setFormProd(f => ({ ...f, nome: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
              placeholder="Ex: Pastel de Queijo" autoFocus />
          </div>
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1">Preço (R$) *</label>
            <input type="number" step="0.50" min="0" value={formProd.preco} onChange={e => setFormProd(f => ({ ...f, preco: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
              placeholder="0,00" />
          </div>
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1">Categoria</label>
            <select value={formProd.categoria_id} onChange={e => setFormProd(f => ({ ...f, categoria_id: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500">
              <option value="">Sem categoria</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1">Descrição</label>
            <input type="text" value={formProd.descricao} onChange={e => setFormProd(f => ({ ...f, descricao: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
              placeholder="Opcional" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={formProd.disponivel} onChange={e => setFormProd(f => ({ ...f, disponivel: e.target.checked }))}
              className="w-5 h-5 accent-amber-500" />
            <span className="text-slate-300 text-sm">Disponível para venda</span>
          </label>
          {erroProd && <p className="text-red-400 text-sm">{erroProd}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" size="md" fullWidth onClick={() => setModalProd(false)}>Cancelar</Button>
            <Button size="md" fullWidth onClick={salvarProd} disabled={salvandoProd}>
              {salvandoProd ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Categoria ── */}
      <Modal open={modalCat} onClose={() => setModalCat(false)} title={editandoCat ? `Editar: ${editandoCat.nome}` : 'Nova Categoria'}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1">Nome da Categoria *</label>
            <input type="text" value={formCat.nome} onChange={e => setFormCat(f => ({ ...f, nome: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
              placeholder="Ex: Pastéis Simples, Bebidas, Sucos..." autoFocus />
          </div>
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1">Ordem de exibição</label>
            <input type="number" min="0" value={formCat.ordem} onChange={e => setFormCat(f => ({ ...f, ordem: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
              placeholder="0" />
            <p className="text-slate-500 text-xs mt-1">Número menor aparece primeiro no cardápio</p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer bg-slate-800 rounded-xl p-3 border border-slate-600 hover:border-amber-500 transition-colors">
            <input type="checkbox" checked={formCat.is_adicional} onChange={e => setFormCat(f => ({ ...f, is_adicional: e.target.checked }))}
              className="w-5 h-5 accent-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-white text-sm font-semibold">Categoria de Adicionais</p>
              <p className="text-slate-400 text-xs mt-0.5">
                Ao selecionar um produto desta categoria, o garçom será perguntado em qual item do pedido o adicional será inserido (ex: Catupiry no Pastel de Carne).
              </p>
            </div>
          </label>
          {erroCat && <p className="text-red-400 text-sm">{erroCat}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" size="md" fullWidth onClick={() => setModalCat(false)}>Cancelar</Button>
            <Button size="md" fullWidth onClick={salvarCat} disabled={salvandoCat}>
              {salvandoCat ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cardápio para impressão */}
      <CardapioImpressao produtos={produtos} categorias={categorias}
        nome={config.nome_estabelecimento} cidade={config.cidade} telefone={config.telefone} />
    </div>
  )
}
