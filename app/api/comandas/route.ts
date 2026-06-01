import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  const db = getDb()
  const rows = db.prepare(`
    SELECT co.*, m.numero AS mesa_numero
    FROM comandas co
    LEFT JOIN mesas m ON m.id = co.mesa_id
    WHERE co.status = 'aberta'
    ORDER BY co.aberta_em DESC
  `).all()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { mesa_id, tipo = 'mesa', observacao } = await req.json()
  const db = getDb()

  if (tipo === 'mesa' && mesa_id) {
    const aberta = db.prepare(
      "SELECT id FROM comandas WHERE mesa_id = ? AND status = 'aberta'"
    ).get(mesa_id)
    if (aberta) return NextResponse.json({ error: 'Mesa já possui comanda aberta' }, { status: 409 })
  }

  const result = db.prepare(`
    INSERT INTO comandas (mesa_id, tipo, observacao) VALUES (?, ?, ?)
  `).run(mesa_id ?? null, tipo, observacao ?? null)

  if (tipo === 'mesa' && mesa_id) {
    db.prepare("UPDATE mesas SET status = 'ocupada' WHERE id = ?").run(mesa_id)
  }

  const row = db.prepare(`
    SELECT co.*, m.numero AS mesa_numero FROM comandas co
    LEFT JOIN mesas m ON m.id = co.mesa_id WHERE co.id = ?
  `).get(result.lastInsertRowid)

  return NextResponse.json(row, { status: 201 })
}
