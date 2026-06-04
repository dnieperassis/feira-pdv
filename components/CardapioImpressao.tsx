'use client'

import { Produto, Categoria } from '@/types'
import { brl } from '@/lib/format'

interface Props {
  produtos:   Produto[]
  categorias: Categoria[]
  nome:       string
  cidade:     string
  telefone:   string
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

// Formata (11)99999-9999 ou (11)9999-9999
function formatTel(tel: string): string {
  const n = tel.replace(/\D/g, '')
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`
  if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`
  return tel
}

// Ícone WhatsApp como SVG inline — imprime corretamente em @media print
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="cp-wa-svg" aria-hidden="true">
      <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

export function CardapioImpressao({ produtos, categorias, nome, cidade, telefone }: Props) {
  const disponiveis = produtos.filter(p => p.disponivel)
  const grupos = categorias
    .filter(c => c.ativo)
    .map(c => ({ ...c, itens: disponiveis.filter(p => p.categoria_id === c.id) }))
    .filter(g => g.itens.length > 0)

  return (
    <div id="cardapio-pdf" aria-hidden="true" className="cardapio-container">

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

      {/* RODAPÉ + IMAGEM LADO A LADO */}
      <div className="cp-rodape-row">
        {/* Texto do rodapé à esquerda */}
        <div className="cp-footer">
          <div className="cp-footer-linha">✦ ──────────────────── ✦</div>
          <p className="cp-footer-txt">Bom apetite! Qualidade e sabor em cada pedido.</p>
          <div className="cp-footer-contato">
            {telefone && (
              <div className="cp-wa-row">
                <WhatsAppIcon />
                <span className="cp-wa-num">{formatTel(telefone)}</span>
              </div>
            )}
            {cidade && <p className="cp-footer-local">📍 {cidade}</p>}
          </div>
        </div>
        {/* Imagem decorativa à direita */}
        <div className="cp-decoracao-imagem" />
      </div>

    </div>
  )
}
