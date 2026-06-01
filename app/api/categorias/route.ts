import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM categorias ORDER BY ordem, nome').all()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { nome, ordem = 0 } = await req.json()
  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const db = getDb()
  const result = db.prepare('INSERT INTO categorias (nome, ordem) VALUES (?, ?)').run(nome.trim(), ordem)
  const row = db.prepare('SELECT * FROM categorias WHERE id = ?').get(result.lastInsertRowid)
  return NextResponse.json(row, { status: 201 })
}
