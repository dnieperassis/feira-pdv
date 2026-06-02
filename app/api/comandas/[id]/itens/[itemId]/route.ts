import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string; itemId: string }> }

// DELETE /api/comandas/[id]/itens/[itemId] — cancela o item e recalcula total
export async function DELETE(_req: Request, { params }: Params) {
  const { id, itemId } = await params
  const db = getDb()

  const item = db.prepare(`
    SELECT ci.id, ci.status FROM comanda_itens ci
    JOIN comandas co ON co.id = ci.comanda_id
    WHERE ci.id = ? AND ci.comanda_id = ? AND co.status = 'aberta'
  `).get(itemId, id) as { id: number; status: string } | undefined

  if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
  if (item.status === 'cancelado') return NextResponse.json({ error: 'Item já cancelado' }, { status: 409 })

  db.transaction(() => {
    db.prepare("UPDATE comanda_itens SET status = 'cancelado' WHERE id = ?").run(itemId)

    // Recalcula total da comanda (exclui cancelados)
    db.prepare(`
      UPDATE comandas SET total = (
        SELECT COALESCE(SUM(total), 0) FROM comanda_itens
        WHERE comanda_id = ? AND status != 'cancelado'
      ) WHERE id = ?
    `).run(id, id)
  })()

  return NextResponse.json({ ok: true })
}
