import { NextRequest, NextResponse } from 'next/server'
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

// PATCH /api/comandas/[id] — trocar mesa
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { mesa_id } = await req.json()
  const db = getDb()

  const comanda = db.prepare(
    "SELECT * FROM comandas WHERE id = ? AND status = 'aberta'"
  ).get(id) as { id: number; mesa_id: number | null } | undefined

  if (!comanda) return NextResponse.json({ error: 'Comanda não encontrada' }, { status: 404 })

  // Verifica se a nova mesa está disponível
  const novaMesa = db.prepare(
    "SELECT id, status FROM mesas WHERE id = ? AND status = 'livre'"
  ).get(mesa_id) as { id: number; status: string } | undefined

  if (!novaMesa) return NextResponse.json({ error: 'Mesa não disponível' }, { status: 409 })

  db.transaction(() => {
    // Libera mesa antiga
    if (comanda.mesa_id) {
      db.prepare("UPDATE mesas SET status = 'livre' WHERE id = ?").run(comanda.mesa_id)
    }
    // Ocupa nova mesa
    db.prepare("UPDATE mesas SET status = 'ocupada' WHERE id = ?").run(mesa_id)
    // Atualiza comanda
    db.prepare('UPDATE comandas SET mesa_id = ? WHERE id = ?').run(mesa_id, id)
  })()

  const row = db.prepare(`
    SELECT co.*, m.numero AS mesa_numero FROM comandas co
    LEFT JOIN mesas m ON m.id = co.mesa_id WHERE co.id = ?
  `).get(id)

  return NextResponse.json(row)
}
