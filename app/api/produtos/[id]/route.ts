import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const db = getDb()

  const produto = db.prepare('SELECT id FROM produtos WHERE id = ?').get(id)
  if (!produto) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  const allowed = ['nome', 'preco', 'categoria_id', 'descricao', 'disponivel', 'controla_estoque', 'estoque_minimo', 'estoque_atual']
  const sets: string[] = []
  const values: unknown[] = []

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = ?`)
      values.push(body[key])
    }
  }

  if (sets.length === 0) return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })

  values.push(id)
  db.prepare(`UPDATE produtos SET ${sets.join(', ')} WHERE id = ?`).run(...values)

  const row = db.prepare(`
    SELECT p.*, c.nome AS categoria_nome FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id WHERE p.id = ?
  `).get(id)

  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = getDb()

  const emUso = db.prepare(`
    SELECT COUNT(*) as c FROM comanda_itens ci
    JOIN comandas co ON co.id = ci.comanda_id
    WHERE ci.produto_id = ? AND co.status = 'aberta'
  `).get(id) as { c: number }

  if (emUso.c > 0) {
    return NextResponse.json({ error: 'Produto está em uso em comanda aberta' }, { status: 409 })
  }

  db.prepare('DELETE FROM produtos WHERE id = ?').run(id)
  return new NextResponse(null, { status: 204 })
}
