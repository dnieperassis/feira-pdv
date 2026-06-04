import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/relatorios?de=YYYY-MM-DD&ate=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const db  = getDb()
  const url = new URL(req.url)

  const hoje = new Date().toISOString().split('T')[0]
  const de   = url.searchParams.get('de')  ?? hoje
  const ate  = url.searchParams.get('ate') ?? hoje

  // ── 1. Resumo do período ─────────────────────────────────────────────
  const resumo = db.prepare(`
    SELECT
      COALESCE(SUM(p.valor), 0)                                              AS total_vendas,
      COUNT(DISTINCT co.id)                                                  AS total_comandas,
      COALESCE(SUM(CASE WHEN p.forma = 'dinheiro'      THEN p.valor END), 0) AS total_dinheiro,
      COALESCE(SUM(CASE WHEN p.forma = 'pix'           THEN p.valor END), 0) AS total_pix,
      COALESCE(SUM(CASE WHEN p.forma LIKE 'cartao%'    THEN p.valor END), 0) AS total_cartao,
      COALESCE(SUM(CASE WHEN p.forma = 'cartao_debito' THEN p.valor END), 0) AS total_debito,
      COALESCE(SUM(CASE WHEN p.forma = 'cartao_credito'THEN p.valor END), 0) AS total_credito,
      COALESCE(SUM(ci.quantidade), 0)                                        AS total_itens
    FROM pagamentos p
    JOIN comandas co ON co.id = p.comanda_id
    LEFT JOIN comanda_itens ci ON ci.comanda_id = co.id AND ci.status != 'cancelado'
    WHERE DATE(p.pago_em) BETWEEN ? AND ?
  `).get(de, ate) as Record<string, number>

  const ticket_medio = resumo.total_comandas > 0
    ? resumo.total_vendas / resumo.total_comandas
    : 0

  // ── 2. Evolução diária (série temporal) ─────────────────────────────
  const evolucao = db.prepare(`
    SELECT
      DATE(p.pago_em)                 AS dia,
      COALESCE(SUM(p.valor), 0)       AS total,
      COUNT(DISTINCT co.id)           AS comandas,
      COALESCE(SUM(ci.quantidade), 0) AS itens
    FROM pagamentos p
    JOIN comandas co ON co.id = p.comanda_id
    LEFT JOIN comanda_itens ci ON ci.comanda_id = co.id AND ci.status != 'cancelado'
    WHERE DATE(p.pago_em) BETWEEN ? AND ?
    GROUP BY DATE(p.pago_em)
    ORDER BY dia
  `).all(de, ate) as { dia: string; total: number; comandas: number; itens: number }[]

  // ── 3. Produtos mais vendidos (top 15) ───────────────────────────────
  const top_produtos = db.prepare(`
    SELECT
      pr.nome,
      cat.nome                         AS categoria,
      SUM(ci.quantidade)               AS qtd_vendida,
      SUM(ci.total)                    AS receita,
      COUNT(DISTINCT ci.comanda_id)    AS em_comandas,
      AVG(ci.preco_unitario)           AS preco_medio
    FROM comanda_itens ci
    JOIN comandas co ON co.id = ci.comanda_id
    JOIN produtos pr ON pr.id = ci.produto_id
    LEFT JOIN categorias cat ON cat.id = pr.categoria_id
    WHERE ci.status != 'cancelado'
      AND DATE(co.fechada_em) BETWEEN ? AND ?
      AND co.status = 'fechada'
    GROUP BY ci.produto_id
    ORDER BY qtd_vendida DESC
    LIMIT 15
  `).all(de, ate) as { nome: string; categoria: string; qtd_vendida: number; receita: number; em_comandas: number; preco_medio: number }[]

  // ── 4. Vendas por categoria ──────────────────────────────────────────
  const por_categoria = db.prepare(`
    SELECT
      COALESCE(cat.nome, 'Sem categoria') AS categoria,
      SUM(ci.quantidade)                  AS qtd_vendida,
      SUM(ci.total)                       AS receita
    FROM comanda_itens ci
    JOIN comandas co ON co.id = ci.comanda_id
    LEFT JOIN produtos pr ON pr.id = ci.produto_id
    LEFT JOIN categorias cat ON cat.id = pr.categoria_id
    WHERE ci.status != 'cancelado'
      AND DATE(co.fechada_em) BETWEEN ? AND ?
      AND co.status = 'fechada'
    GROUP BY cat.id
    ORDER BY receita DESC
  `).all(de, ate) as { categoria: string; qtd_vendida: number; receita: number }[]

  // ── 5. Pico por hora do dia ─────────────────────────────────────────
  const por_hora = db.prepare(`
    SELECT
      CAST(strftime('%H', p.pago_em) AS INTEGER) AS hora,
      COUNT(DISTINCT co.id)                      AS comandas,
      COALESCE(SUM(p.valor), 0)                  AS total
    FROM pagamentos p
    JOIN comandas co ON co.id = p.comanda_id
    WHERE DATE(p.pago_em) BETWEEN ? AND ?
    GROUP BY hora
    ORDER BY hora
  `).all(de, ate) as { hora: number; comandas: number; total: number }[]

  // ── 6. Ranking por garçom/operador ──────────────────────────────────
  const por_garcom = db.prepare(`
    SELECT
      COALESCE(op.nome, 'Sem operador')  AS operador,
      COUNT(DISTINCT co.id)              AS comandas,
      COALESCE(SUM(p.valor), 0)          AS total_vendido,
      COALESCE(SUM(ci.quantidade), 0)    AS itens_vendidos
    FROM comandas co
    LEFT JOIN operadores op ON op.id = co.operador_id
    LEFT JOIN pagamentos p ON p.comanda_id = co.id
    LEFT JOIN comanda_itens ci ON ci.comanda_id = co.id AND ci.status != 'cancelado'
    WHERE co.status = 'fechada'
      AND DATE(co.fechada_em) BETWEEN ? AND ?
    GROUP BY co.operador_id
    ORDER BY total_vendido DESC
  `).all(de, ate) as { operador: string; comandas: number; total_vendido: number; itens_vendidos: number }[]

  // ── 7. Mesa vs. Balcão ───────────────────────────────────────────────
  const por_tipo = db.prepare(`
    SELECT
      co.tipo,
      COUNT(DISTINCT co.id)         AS comandas,
      COALESCE(SUM(p.valor), 0)     AS total
    FROM comandas co
    LEFT JOIN pagamentos p ON p.comanda_id = co.id
    WHERE co.status = 'fechada'
      AND DATE(co.fechada_em) BETWEEN ? AND ?
    GROUP BY co.tipo
  `).all(de, ate) as { tipo: string; comandas: number; total: number }[]

  // ── 8. Itens cancelados (desperdício) ────────────────────────────────
  const cancelados = db.prepare(`
    SELECT
      pr.nome,
      SUM(ci.quantidade)  AS qtd,
      SUM(ci.total)       AS valor_perdido
    FROM comanda_itens ci
    JOIN produtos pr ON pr.id = ci.produto_id
    JOIN comandas co ON co.id = ci.comanda_id
    WHERE ci.status = 'cancelado'
      AND DATE(ci.lancado_em) BETWEEN ? AND ?
    GROUP BY ci.produto_id
    ORDER BY qtd DESC
    LIMIT 10
  `).all(de, ate) as { nome: string; qtd: number; valor_perdido: number }[]

  return NextResponse.json({
    periodo: { de, ate },
    resumo: { ...resumo, ticket_medio },
    evolucao,
    top_produtos,
    por_categoria,
    por_hora,
    por_garcom,
    por_tipo,
    cancelados,
  })
}
