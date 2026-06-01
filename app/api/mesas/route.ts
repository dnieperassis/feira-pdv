import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  const db = getDb()
  const rows = db.prepare(`
    SELECT m.*,
      co.id   AS comanda_id,
      co.total AS total_comanda
    FROM mesas m
    LEFT JOIN comandas co ON co.mesa_id = m.id AND co.status = 'aberta'
    ORDER BY m.numero
  `).all()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { numero, nome, capacidade = 4, posicao_x = 0, posicao_y = 0 } = await req.json()
  if (!numero) return NextResponse.json({ error: 'Número obrigatório' }, { status: 400 })

  const db = getDb()
  try {
    const result = db.prepare(
      'INSERT INTO mesas (numero, nome, capacidade, posicao_x, posicao_y) VALUES (?, ?, ?, ?, ?)'
    ).run(numero, nome ?? `Mesa ${numero}`, capacidade, posicao_x, posicao_y)
    const row = db.prepare('SELECT * FROM mesas WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json(row, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Número de mesa já existe' }, { status: 409 })
  }
}
