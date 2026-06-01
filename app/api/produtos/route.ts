import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  const db = getDb()
  const rows = db.prepare(`
    SELECT p.*, c.nome AS categoria_nome
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    ORDER BY c.ordem, c.nome, p.nome
  `).all()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { nome, preco, categoria_id, descricao, disponivel = 1, controla_estoque = 0, estoque_minimo = 0 } = body

  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  if (typeof preco !== 'number' || preco < 0) return NextResponse.json({ error: 'Preço inválido' }, { status: 400 })

  const db = getDb()
  const result = db.prepare(`
    INSERT INTO produtos (nome, preco, categoria_id, descricao, disponivel, controla_estoque, estoque_minimo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(nome.trim(), preco, categoria_id ?? null, descricao ?? null, disponivel ? 1 : 0, controla_estoque ? 1 : 0, estoque_minimo)

  const row = db.prepare(`
    SELECT p.*, c.nome AS categoria_nome FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.id = ?
  `).get(result.lastInsertRowid)

  return NextResponse.json(row, { status: 201 })
}
