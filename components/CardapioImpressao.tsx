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

  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      {/* ── CARDÁPIO DE IMPRESSÃO ── oculto na tela, visível ao imprimir */}
      <div id="cardapio-pdf" aria-hidden>

        {/* CABEÇALHO */}
        <div className="cp-header">
          <div className="cp-decoracao-topo">
            {'◆ ─── ◆ ─── ◆ ─── ◆ ─── ◆ ─── ◆ ─── ◆'}
          </div>
          <div className="cp-icone">⚡</div>
          <h1 className="cp-titulo">{nome || 'NOSSA BARRACA'}</h1>
          <div className="cp-subtitulo">C A R D Á P I O</div>
          <div className="cp-decoracao-baixo">
            {'◆ ─── ◆ ─── ◆ ─── ◆ ─── ◆ ─── ◆ ─── ◆'}
          </div>
        </div>

        {/* GRADE DE CATEGORIAS */}
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
          <div className="cp-footer-linha">
            {'✦ ────────────────────────────────────────── ✦'}
          </div>
          <p className="cp-footer-txt">Bom apetite! Qualidade e sabor em cada pedido. 😊</p>
          {cidade && <p className="cp-footer-local">📍 {cidade}</p>}
          <p className="cp-footer-data">{hoje}</p>
        </div>
      </div>

      {/* ── ESTILOS DE IMPRESSÃO ── */}
      <style jsx global>{`
        /* Oculto na tela */
        #cardapio-pdf { display: none; }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          /* Esconde tudo exceto o cardápio */
          body > * { display: none !important; }
          body { margin: 0; padding: 0; }

          #cardapio-pdf {
            display: block !important;
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            padding: 0;
            font-family: Georgia, 'Times New Roman', serif;

            /* Fundo quente inspirado em feira/comida de rua */
            background:
              url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23f59e0b' fill-opacity='0.06'%3E%3Cpolygon points='30,4 56,18 56,42 30,56 4,42 4,18'/%3E%3C/g%3E%3C/svg%3E"),
              linear-gradient(
                160deg,
                #3b0d00 0%,
                #6b2100 20%,
                #8b2f00 40%,
                #7c2d00 60%,
                #4a1500 80%,
                #2d0a00 100%
              );
            color: #fdf6ec;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* ── CABEÇALHO ── */
          .cp-header {
            text-align: center;
            padding: 14mm 18mm 10mm;
          }
          .cp-decoracao-topo,
          .cp-decoracao-baixo {
            color: #f59e0b;
            font-size: 9pt;
            letter-spacing: 2px;
            opacity: 0.7;
          }
          .cp-icone {
            font-size: 28pt;
            margin: 4mm 0 2mm;
            filter: drop-shadow(0 0 6px rgba(245,158,11,0.8));
          }
          .cp-titulo {
            font-size: 26pt;
            font-weight: bold;
            letter-spacing: 3px;
            text-transform: uppercase;
            color: #fef3c7;
            text-shadow: 2px 2px 8px rgba(0,0,0,0.6);
            margin: 0 0 3mm;
          }
          .cp-subtitulo {
            font-size: 16pt;
            letter-spacing: 12px;
            color: #f59e0b;
            font-style: italic;
            margin-bottom: 5mm;
          }

          /* ── GRADE DE CATEGORIAS ── */
          .cp-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6mm 10mm;
            padding: 0 16mm 10mm;
          }

          /* Categoria que tem muitos itens ocupa coluna inteira */
          .cp-secao {
            break-inside: avoid;
          }
          .cp-cat-titulo {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 13pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #fcd34d;
            margin: 0 0 2mm;
            text-shadow: 1px 1px 4px rgba(0,0,0,0.5);
          }
          .cp-cat-linha {
            height: 1px;
            background: linear-gradient(90deg, #f59e0b, transparent);
            margin-bottom: 3mm;
          }
          .cp-lista {
            list-style: none;
            margin: 0;
            padding: 0;
          }
          .cp-item {
            display: flex;
            align-items: baseline;
            gap: 2px;
            margin-bottom: 1.5mm;
            font-size: 10pt;
          }
          .cp-item-nome {
            white-space: nowrap;
            color: #fdf6ec;
            font-size: 10.5pt;
          }
          .cp-item-dots {
            flex: 1;
            border-bottom: 1px dotted rgba(245,158,11,0.4);
            margin: 0 3px 2px;
            min-width: 8px;
          }
          .cp-item-preco {
            white-space: nowrap;
            color: #fcd34d;
            font-weight: bold;
            font-size: 10.5pt;
          }

          /* ── RODAPÉ ── */
          .cp-footer {
            text-align: center;
            padding: 6mm 18mm 10mm;
            margin-top: auto;
          }
          .cp-footer-linha {
            color: #f59e0b;
            font-size: 9pt;
            opacity: 0.7;
            margin-bottom: 3mm;
          }
          .cp-footer-txt {
            font-size: 11pt;
            color: #fef3c7;
            font-style: italic;
            margin: 0 0 2mm;
          }
          .cp-footer-local {
            font-size: 9pt;
            color: #fcd34d;
            margin: 0 0 1mm;
          }
          .cp-footer-data {
            font-size: 8pt;
            color: rgba(253,246,236,0.5);
            margin: 0;
          }
        }
      `}</style>
    </>
  )
}
