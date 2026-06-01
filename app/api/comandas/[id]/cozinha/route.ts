import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

// POST /api/comandas/[id]/cozinha — envia itens pendentes para a cozinha
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  const db = getDb()

  const comanda = db.prepare(`
    SELECT co.*, m.numero AS mesa_numero FROM comandas co
    LEFT JOIN mesas m ON m.id = co.mesa_id
    WHERE co.id = ? AND co.status = 'aberta'
  `).get(id) as { id: number; mesa_numero: number | null; tipo: string; aberta_em: string } | undefined

  if (!comanda) return NextResponse.json({ error: 'Comanda não encontrada' }, { status: 404 })

  const pendentes = db.prepare(`
    SELECT ci.*, p.nome AS produto_nome
    FROM comanda_itens ci
    JOIN produtos p ON p.id = ci.produto_id
    WHERE ci.comanda_id = ? AND ci.status = 'pendente'
    ORDER BY ci.lancado_em
  `).all(id) as Array<{ id: number; produto_nome: string; quantidade: number; observacao: string | null }>

  if (pendentes.length === 0) {
    return NextResponse.json({ error: 'Nenhum item pendente para enviar' }, { status: 400 })
  }

  // Marca todos os pendentes como "produzindo"
  db.prepare(`
    UPDATE comanda_itens SET status = 'produzindo'
    WHERE comanda_id = ? AND status = 'pendente'
  `).run(id)

  return NextResponse.json({
    comanda,
    itens: pendentes,
    enviado_em: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  })
}
