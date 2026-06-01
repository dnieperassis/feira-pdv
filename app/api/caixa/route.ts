import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/caixa — resumo do dia
export async function GET() {
  const db = getDb()
  const hoje = new Date().toISOString().split('T')[0]

  const totais = db.prepare(`
    SELECT
      COALESCE(SUM(p.valor), 0)                                              AS total_vendas,
      COUNT(DISTINCT co.id)                                                  AS total_comandas,
      COALESCE(SUM(CASE WHEN p.forma = 'dinheiro'      THEN p.valor END), 0) AS total_dinheiro,
      COALESCE(SUM(CASE WHEN p.forma = 'pix'           THEN p.valor END), 0) AS total_pix,
      COALESCE(SUM(CASE WHEN p.forma LIKE 'cartao%'    THEN p.valor END), 0) AS total_cartao
    FROM pagamentos p
    JOIN comandas co ON co.id = p.comanda_id
    WHERE DATE(p.pago_em) = ?
  `).get(hoje)

  const movs = db.prepare(`
    SELECT * FROM movimentacoes_caixa WHERE DATE(criado_em) = ? ORDER BY criado_em
  `).all(hoje)

  return NextResponse.json({ totais, movimentacoes: movs })
}

// POST /api/caixa — fechar comanda + registrar pagamento
export async function POST(req: NextRequest) {
  const { comanda_id, pagamentos: pags } = await req.json()
  const db = getDb()

  const comanda = db.prepare('SELECT * FROM comandas WHERE id = ? AND status = ?').get(comanda_id, 'aberta') as { id: number, mesa_id: number | null, total: number } | undefined
  if (!comanda) return NextResponse.json({ error: 'Comanda não encontrada ou já fechada' }, { status: 404 })

  const inserirPag = db.prepare(`
    INSERT INTO pagamentos (comanda_id, forma, valor, troco) VALUES (?, ?, ?, ?)
  `)

  const fechar = db.transaction(() => {
    for (const p of pags) {
      inserirPag.run(comanda_id, p.forma, p.valor, p.troco ?? 0)
    }
    db.prepare("UPDATE comandas SET status = 'fechada', fechada_em = datetime('now','localtime') WHERE id = ?").run(comanda_id)
    if (comanda.mesa_id) {
      db.prepare("UPDATE mesas SET status = 'livre' WHERE id = ?").run(comanda.mesa_id)
    }
  })

  fechar()
  return NextResponse.json({ ok: true })
}
