import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const db = getDb()
  const row = db.prepare(`
    SELECT co.*, m.numero AS mesa_numero FROM comandas co
    LEFT JOIN mesas m ON m.id = co.mesa_id WHERE co.id = ?
  `).get(id)
  if (!row) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  return NextResponse.json(row)
}
