import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { nome, ordem, ativo } = await req.json()
  const db = getDb()

  const cat = db.prepare('SELECT id FROM categorias WHERE id = ?').get(id)
  if (!cat) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })

  const sets: string[] = []
  const values: unknown[] = []

  if (nome  !== undefined) { sets.push('nome  = ?'); values.push(nome.trim()) }
  if (ordem !== undefined) { sets.push('ordem = ?'); values.push(ordem) }
  if (ativo !== undefined) { sets.push('ativo = ?'); values.push(ativo) }

  if (sets.length === 0) return NextResponse.json({ error: 'Nada a atualizar' }, { status: 400 })

  values.push(id)
  db.prepare(`UPDATE categorias SET ${sets.join(', ')} WHERE id = ?`).run(...values)

  const row = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id)
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = getDb()

  // Verifica se tem produtos nessa categoria
  const comProdutos = db.prepare(
    'SELECT COUNT(*) as c FROM produtos WHERE categoria_id = ?'
  ).get(id) as { c: number }

  if (comProdutos.c > 0) {
    return NextResponse.json(
      { error: `Não é possível excluir: esta categoria possui ${comProdutos.c} produto(s). Remova ou mova os produtos primeiro.` },
      { status: 409 }
    )
  }

  db.prepare('DELETE FROM categorias WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
