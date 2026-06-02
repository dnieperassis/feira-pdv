import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const db = getDb()

  const op = db.prepare('SELECT id FROM operadores WHERE id = ?').get(id)
  if (!op) return NextResponse.json({ error: 'Operador não encontrado' }, { status: 404 })

  const sets: string[] = []
  const values: unknown[] = []

  if (body.nome)   { sets.push('nome = ?');   values.push(body.nome.trim()) }
  if (body.codigo) { sets.push('codigo = ?'); values.push(body.codigo.trim().toUpperCase()) }
  if (body.ativo !== undefined) { sets.push('ativo = ?'); values.push(body.ativo ? 1 : 0) }
  if (body.pin) {
    if (!/^\d{4,6}$/.test(body.pin))
      return NextResponse.json({ error: 'PIN deve ter 4 a 6 dígitos' }, { status: 400 })
    const hash = await bcrypt.hash(body.pin, 10)
    sets.push('senha_hash = ?')
    values.push(hash)
  }

  if (sets.length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })

  values.push(id)
  db.prepare(`UPDATE operadores SET ${sets.join(', ')} WHERE id = ?`).run(...values)

  const row = db.prepare(
    'SELECT id, nome, codigo, ativo, criado_em FROM operadores WHERE id = ?'
  ).get(id)
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM operadores WHERE id = ?').run(id)
  return new NextResponse(null, { status: 204 })
}
