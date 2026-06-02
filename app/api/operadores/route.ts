import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  const db = getDb()
  const rows = db.prepare(
    'SELECT id, nome, codigo, ativo, criado_em FROM operadores ORDER BY nome'
  ).all()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { nome, codigo, pin } = await req.json()

  if (!nome?.trim())   return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  if (!codigo?.trim()) return NextResponse.json({ error: 'Código obrigatório' }, { status: 400 })
  if (!pin || !/^\d{4,6}$/.test(pin))
    return NextResponse.json({ error: 'PIN deve ter 4 a 6 dígitos numéricos' }, { status: 400 })

  const senha_hash = await bcrypt.hash(pin, 10)
  const db = getDb()

  try {
    const result = db.prepare(
      'INSERT INTO operadores (nome, codigo, senha_hash) VALUES (?, ?, ?)'
    ).run(nome.trim(), codigo.trim().toUpperCase(), senha_hash)

    const row = db.prepare(
      'SELECT id, nome, codigo, ativo, criado_em FROM operadores WHERE id = ?'
    ).get(result.lastInsertRowid)

    return NextResponse.json(row, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Código já existe' }, { status: 409 })
  }
}
