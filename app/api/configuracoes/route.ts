import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

const DEFAULTS: Record<string, string> = {
  nome_estabelecimento: 'Feira PDV',
  cidade:               'São Paulo',
  chave_pix:            '',
  numero_mesas:         '10',
}

export async function GET() {
  const db = getDb()
  const rows = db.prepare('SELECT chave, valor FROM configuracoes').all() as { chave: string; valor: string }[]

  // Sincroniza numero_mesas com a quantidade real de mesas cadastradas
  const totalMesas = (db.prepare('SELECT COUNT(*) AS c FROM mesas').get() as { c: number }).c

  const config: Record<string, string> = { ...DEFAULTS, numero_mesas: String(totalMesas) }
  for (const { chave, valor } of rows) config[chave] = valor
  config.numero_mesas = String(totalMesas) // sempre reflete o real

  return NextResponse.json(config)
}

export async function PATCH(req: NextRequest) {
  const body: Record<string, string> = await req.json()
  const db = getDb()

  const upsert = db.prepare(`
    INSERT INTO configuracoes (chave, valor) VALUES (?, ?)
    ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor
  `)

  db.transaction(() => {
    for (const [chave, valor] of Object.entries(body)) {
      if (chave in DEFAULTS && chave !== 'numero_mesas') upsert.run(chave, valor)
    }
  })()

  // Ajusta o número de mesas se informado
  if (body.numero_mesas !== undefined) {
    const novoTotal = Math.max(1, Math.min(99, parseInt(body.numero_mesas) || 0))
    ajustarMesas(db, novoTotal)
  }

  return NextResponse.json({ ok: true })
}

function ajustarMesas(db: ReturnType<typeof import('@/lib/db').getDb>, novoTotal: number) {
  const atual = (db.prepare('SELECT COUNT(*) AS c FROM mesas').get() as { c: number }).c

  if (novoTotal > atual) {
    // Adiciona mesas faltantes
    const insert = db.prepare(`
      INSERT OR IGNORE INTO mesas (numero, nome, capacidade, posicao_x, posicao_y)
      VALUES (?, ?, 4, ?, ?)
    `)
    db.transaction(() => {
      for (let i = atual + 1; i <= novoTotal; i++) {
        const col = ((i - 1) % 5) * 160
        const row = Math.floor((i - 1) / 5) * 140
        insert.run(i, `Mesa ${i}`, col, row)
      }
    })()
  } else if (novoTotal < atual) {
    // Remove mesas livres dos maiores números para os menores
    const livres = db.prepare(
      "SELECT id FROM mesas WHERE status = 'livre' ORDER BY numero DESC"
    ).all() as { id: number }[]

    let remover = atual - novoTotal
    db.transaction(() => {
      for (const { id } of livres) {
        if (remover <= 0) break
        db.prepare('DELETE FROM mesas WHERE id = ?').run(id)
        remover--
      }
    })()
  }
}
