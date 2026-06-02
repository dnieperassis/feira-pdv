import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

function validarCodigo(codigo: string): string | null {
  if (!/^\d{4}$/.test(codigo)) return 'Código deve ter exatamente 4 dígitos numéricos'
  return null
}

export async function GET() {
  const db = getDb()
  const rows = db.prepare(
    'SELECT id, nome, codigo, perfil, ativo, criado_em FROM operadores ORDER BY codigo'
  ).all()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { nome, codigo, pin } = await req.json()

  if (!nome?.trim())   return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  const erCod = validarCodigo(codigo ?? '')
  if (erCod)           return NextResponse.json({ error: erCod }, { status: 400 })
  if (codigo === '0000') return NextResponse.json({ error: 'Código 0000 é reservado ao Administrador' }, { status: 400 })
  if (!pin || !/^\d{4,6}$/.test(pin))
    return NextResponse.json({ error: 'PIN deve ter 4 a 6 dígitos numéricos' }, { status: 400 })

  const senha_hash = await bcrypt.hash(pin, 10)
  const db = getDb()

  try {
    const result = db.prepare(
      "INSERT INTO operadores (nome, codigo, senha_hash, perfil) VALUES (?, ?, ?, 'operador')"
    ).run(nome.trim(), codigo, senha_hash)

    const row = db.prepare(
      'SELECT id, nome, codigo, perfil, ativo, criado_em FROM operadores WHERE id = ?'
    ).get(result.lastInsertRowid)

    return NextResponse.json(row, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Código já existe' }, { status: 409 })
  }
}
