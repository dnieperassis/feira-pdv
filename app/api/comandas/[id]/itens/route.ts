import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = getDb()
  const itens = db.prepare(`
    SELECT ci.*, p.nome AS produto_nome
    FROM comanda_itens ci
    JOIN produtos p ON p.id = ci.produto_id
    WHERE ci.comanda_id = ? AND ci.status != 'cancelado'
    ORDER BY ci.lancado_em
  `).all(id)
  return NextResponse.json(itens)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { produto_id, quantidade = 1, observacao } = await req.json()
  const db = getDb()

  const comanda = db.prepare("SELECT id, status FROM comandas WHERE id = ?").get(id) as { id: number, status: string } | undefined
  if (!comanda) return NextResponse.json({ error: 'Comanda não encontrada' }, { status: 404 })
  if (comanda.status !== 'aberta') return NextResponse.json({ error: 'Comanda não está aberta' }, { status: 409 })

  const produto = db.prepare('SELECT id, preco, nome FROM produtos WHERE id = ? AND disponivel = 1').get(produto_id) as { id: number, preco: number, nome: string } | undefined
  if (!produto) return NextResponse.json({ error: 'Produto indisponível' }, { status: 404 })

  const total = produto.preco * quantidade
  const result = db.prepare(`
    INSERT INTO comanda_itens (comanda_id, produto_id, quantidade, preco_unitario, total, observacao)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, produto_id, quantidade, produto.preco, total, observacao ?? null)

  // Atualiza total da comanda
  db.prepare(`
    UPDATE comandas SET total = (
      SELECT COALESCE(SUM(total), 0) FROM comanda_itens
      WHERE comanda_id = ? AND status != 'cancelado'
    ) WHERE id = ?
  `).run(id, id)

  // Baixa estoque se produto controla
  const controla = db.prepare('SELECT controla_estoque FROM produtos WHERE id = ?').get(produto_id) as { controla_estoque: number }
  if (controla?.controla_estoque) {
    db.prepare('UPDATE produtos SET estoque_atual = estoque_atual - ? WHERE id = ?').run(quantidade, produto_id)
    db.prepare(`
      INSERT INTO estoque_movimentacoes (produto_id, tipo, quantidade, motivo)
      VALUES (?, 'saida', ?, 'Venda comanda #' || ?)
    `).run(produto_id, quantidade, id)
  }

  const row = db.prepare(`
    SELECT ci.*, p.nome AS produto_nome FROM comanda_itens ci
    JOIN produtos p ON p.id = ci.produto_id WHERE ci.id = ?
  `).get(result.lastInsertRowid)

  return NextResponse.json(row, { status: 201 })
}
