import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { codigo, pin } = await req.json()

  if (!codigo || !pin)
    return NextResponse.json({ error: 'Código e PIN obrigatórios' }, { status: 400 })

  const db = getDb()
  const op = db.prepare(
    "SELECT * FROM operadores WHERE codigo = ? COLLATE NOCASE AND ativo = 1"
  ).get(codigo) as { id: number; nome: string; codigo: string; senha_hash: string } | undefined

  if (!op)
    return NextResponse.json({ error: 'Operador não encontrado ou inativo' }, { status: 401 })

  const ok = await bcrypt.compare(String(pin), op.senha_hash)
  if (!ok)
    return NextResponse.json({ error: 'PIN incorreto' }, { status: 401 })

  return NextResponse.json({ id: op.id, nome: op.nome, codigo: op.codigo })
}
