'use client'

import { Produto, Categoria } from '@/types'
import { brl } from '@/lib/format'

interface Props {
  produtos:   Produto[]
  categorias: Categoria[]
  nome:       string
  cidade:     string
}

const CAT_EMOJI: Record<string, string> = {
  'Salgados':   '🥘',
  'Pastéis':    '🥟',
  'Bebidas':    '🥤',
  'Caldos':     '🍲',
  'Sobremesas': '🍰',
  'Lanches':    '🍔',
  'Doces':      '🍭',
  'Sucos':      '🍊',
}

export function CardapioImpressao({ produtos, categorias, nome, cidade }: Props) {
  const disponiveis = produtos.filter(p => p.disponivel)
  const grupos = categorias
    .filter(c => c.ativo)
    .map(c => ({ ...c, itens: disponiveis.filter(p => p.categoria_id === c.id) }))
    .filter(g => g.itens.length > 0)

  const hoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    /* Div oculta na tela — visível apenas ao imprimir via globals.css @media print */
    <div id="cardapio-pdf" aria-hidden="true">

      {/* CABEÇALHO */}
      <div className="cp-header">
        <div className="cp-decoracao-topo">◆ ─── ◆ ─── ◆ ─── ◆ ─── ◆ ─── ◆ ─── ◆</div>
        <div className="cp-icone">⚡</div>
        <h1 className="cp-titulo">{nome || 'NOSSA BARRACA'}</h1>
        <div className="cp-subtitulo">C A R D Á P I O</div>
        <div className="cp-decoracao-baixo">◆ ─── ◆ ─── ◆ ─── ◆ ─── ◆ ─── ◆ ─── ◆</div>
      </div>

      {/* GRADE DUAS COLUNAS */}
      <div className="cp-grid">
        {grupos.map(grupo => (
          <section key={grupo.id} className="cp-secao">
            <h2 className="cp-cat-titulo">
              <span>{CAT_EMOJI[grupo.nome] ?? '•'}</span>
              <span>{grupo.nome}</span>
            </h2>
            <div className="cp-cat-linha" />
            <ul className="cp-lista">
              {grupo.itens.map(p => (
                <li key={p.id} className="cp-item">
                  <span className="cp-item-nome">{p.nome}</span>
                  <span className="cp-item-dots" />
                  <span className="cp-item-preco">R$ {brl(p.preco)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* RODAPÉ */}
      <div className="cp-footer">
        <div className="cp-footer-linha">✦ ────────────────────────────────────────── ✦</div>
        <p className="cp-footer-txt">Bom apetite! Qualidade e sabor em cada pedido. 😊</p>
        {cidade && <p className="cp-footer-local">📍 {cidade}</p>}
        <p className="cp-footer-data">{hoje}</p>
      </div>

    </div>
  )
}
