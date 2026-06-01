import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

const DEFAULTS: Record<string, string> = {
  nome_estabelecimento: 'Feira PDV',
  cidade:               'São Paulo',
  chave_pix:            '',
}

export async function GET() {
  const db = getDb()
  const rows = db.prepare('SELECT chave, valor FROM configuracoes').all() as { chave: string; valor: string }[]
  const config: Record<string, string> = { ...DEFAULTS }
  for (const { chave, valor } of rows) config[chave] = valor
  return NextResponse.json(config)
}

export async function PATCH(req: NextRequest) {
  const body: Record<string, string> = await req.json()
  const db = getDb()

  const upsert = db.prepare(`
    INSERT INTO configuracoes (chave, valor) VALUES (?, ?)
    ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor
  `)

  const run = db.transaction(() => {
    for (const [chave, valor] of Object.entries(body)) {
      if (chave in DEFAULTS) upsert.run(chave, valor)
    }
  })
  run()

  return NextResponse.json({ ok: true })
}
