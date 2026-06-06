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

  const allowed = ['nome', 'preco', 'categoria_id', 'descricao', 'disponivel', 'controla_estoque', 'estoque_minimo', 'estoque_atual', 'composicao_qtd']
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

  // Verifica se está em comanda ABERTA (bloqueio operacional)
  const emUsoAberta = db.prepare(`
    SELECT COUNT(*) as c FROM comanda_itens ci
    JOIN comandas co ON co.id = ci.comanda_id
    WHERE ci.produto_id = ? AND co.status = 'aberta'
  `).get(id) as { c: number }

  if (emUsoAberta.c > 0) {
    return NextResponse.json({ error: 'Produto está em uso em comanda aberta' }, { status: 409 })
  }

  // Produto pode ter histórico em comandas fechadas (FK constraint)
  // Solução: marcar como indisponível em vez de excluir se tiver histórico
  const emUsoHistorico = db.prepare(
    'SELECT COUNT(*) as c FROM comanda_itens WHERE produto_id = ?'
  ).get(id) as { c: number }

  if (emUsoHistorico.c > 0) {
    // Tem histórico — desativa em vez de excluir (preserva relatórios)
    db.prepare('UPDATE produtos SET disponivel = 0 WHERE id = ?').run(id)
    return NextResponse.json({ ok: true, aviso: 'Produto desativado pois possui histórico de vendas. Para excluir definitivamente, limpe o histórico primeiro.' })
  }

  try {
    db.prepare('DELETE FROM produtos WHERE id = ?').run(id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao excluir'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
