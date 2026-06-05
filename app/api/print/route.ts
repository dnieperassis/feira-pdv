import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { Escpos, printTCP, brlEsc, pad } from '@/lib/escpos'

export const runtime = 'nodejs'

const COLS = 48

// ── Configurações da impressora ─────────────────────────────────────────────
function getConfig(db: ReturnType<typeof getDb>) {
  const rows = db.prepare('SELECT chave, valor FROM configuracoes').all() as { chave: string; valor: string }[]
  const cfg: Record<string, string> = {}
  for (const { chave, valor } of rows) cfg[chave] = valor
  return {
    nome:              cfg.nome_estabelecimento ?? 'FEIRA PDV',
    cidade:            cfg.cidade ?? '',
    impressora_modo:   cfg.impressora_modo ?? 'browser',
    impressora_ip:     cfg.impressora_ip ?? '',
    impressora_porta:  parseInt(cfg.impressora_porta ?? '9100'),
    impressora_nome:   cfg.impressora_nome ?? '',
  }
}

// ── POST /api/print ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tipo } = body
  const db  = getDb()
  const cfg = getConfig(db)

  if (cfg.impressora_modo === 'browser') {
    return NextResponse.json({ ok: false, modo: 'browser' })
  }

  try {
    let data: Buffer
    if      (tipo === 'teste') data = buildTeste(cfg.nome)
    else if (tipo === 'kot')   data = buildKot(body, cfg.nome)
    else if (tipo === 'cupom') data = buildCupom(body, cfg.nome, cfg.cidade)
    else return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

    if (cfg.impressora_modo === 'tcp') {
      await printTCP(cfg.impressora_ip, cfg.impressora_porta, data)
      return NextResponse.json({ ok: true, modo: 'tcp' })
    }

    if (cfg.impressora_modo === 'windows') {
      const { printWindows } = await import('@/lib/print-windows')
      await printWindows(cfg.impressora_nome, data)
      return NextResponse.json({ ok: true, modo: 'windows' })
    }

    return NextResponse.json({ error: 'Modo desconhecido' }, { status: 400 })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[print]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// ── GET /api/print — lista impressoras (modo windows) ou status TCP ──────────
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const db  = getDb()
  const cfg = getConfig(db)

  // ?listar=1 — retorna impressoras instaladas no Windows
  if (url.searchParams.get('listar') === '1') {
    try {
      const { listarImpressoras } = await import('@/lib/print-windows')
      const lista = listarImpressoras()
      return NextResponse.json({ lista })
    } catch {
      return NextResponse.json({ lista: [] })
    }
  }

  // Verifica status TCP
  if (cfg.impressora_modo === 'tcp' && cfg.impressora_ip) {
    try {
      await printTCP(cfg.impressora_ip, cfg.impressora_porta, Buffer.alloc(0), 3000)
      return NextResponse.json({ online: true, modo: 'tcp' })
    } catch {
      return NextResponse.json({ online: false, modo: 'tcp', msg: 'Impressora offline ou IP incorreto' })
    }
  }

  if (cfg.impressora_modo === 'windows') {
    const { listarImpressoras } = await import('@/lib/print-windows')
    const lista = listarImpressoras()
    const existe = lista.some(n => n.toLowerCase() === cfg.impressora_nome.toLowerCase())
    return NextResponse.json({ online: existe, modo: 'windows', impressora: cfg.impressora_nome })
  }

  return NextResponse.json({ online: false, modo: 'browser' })
}

// ── Builder: Teste ──────────────────────────────────────────────────────────
function buildTeste(nome: string): Buffer {
  const now = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  return new Escpos()
    .init().lf()
    .center().bold(true).size(2, 2).textLn('** TESTE **')
    .size(1, 1).bold(false).lf()
    .center().textLn(nome)
    .center().textLn('Impressora OK!')
    .lf().center().textLn(now)
    .lf().dashedLine(COLS)
    .center().textLn('Feira PDV - ESC/POS 80mm')
    .cut().build()
}

// ── Builder: KOT ────────────────────────────────────────────────────────────
interface KotBody {
  mesa: string; comanda_id: number; enviado_em: string
  itens: { produto_nome: string; quantidade: number; observacao?: string }[]
}

function buildKot(body: KotBody, _nome: string): Buffer {
  const { mesa, comanda_id, enviado_em, itens } = body
  const esc = new Escpos()
    .init().lf()
    .center().bold(true).textLn('** COMANDA DE COZINHA **')
    .lf()
    .center().size(2, 2).bold(true).textLn(mesa)
    .size(1, 1).bold(false)
    .center().textLn(`#${comanda_id}  ${enviado_em}`)
    .lf().left().dashedLine(COLS)

  for (const item of itens) {
    esc.bold(true).text(`${String(item.quantidade).padStart(2)}x `).bold(false).textLn(item.produto_nome)
    if (item.observacao) esc.textLn(`   >> ${item.observacao}`)
  }

  return esc
    .dashedLine(COLS)
    .center().textLn(`${itens.length} item(s) enviado(s)`)
    .lf().cut().build()
}

// ── Builder: Cupom ──────────────────────────────────────────────────────────
interface CupomItem { produto_nome: string; produto_id: number; quantidade: number; total: number }
interface CupomBody {
  mesa: string; comanda_id: number; data_hora: string
  itens: CupomItem[]; forma: string; total: number; troco?: number
}

function buildCupom(body: CupomBody, nome: string, cidade: string): Buffer {
  const { mesa, comanda_id, data_hora, itens, forma, total, troco } = body

  const agrupados = itens.reduce((acc, item) => {
    const ex = acc.find(x => x.produto_id === item.produto_id)
    if (ex) { ex.quantidade += item.quantidade; ex.total += item.total }
    else acc.push({ ...item })
    return acc
  }, [] as CupomItem[])

  const formas: Record<string, string> = {
    dinheiro: 'Dinheiro', pix: 'PIX',
    cartao_debito: 'Cartao Debito', cartao_credito: 'Cartao Credito',
  }

  const esc = new Escpos()
    .init().lf()
    .center().bold(true).size(1, 2).textLn(nome.toUpperCase())
    .size(1, 1).bold(false)
    .center().textLn('CUPOM NAO FISCAL').lf()
    .center().textLn(`${mesa}  #${comanda_id}`)
    .center().textLn(data_hora).lf()
    .left().dashedLine(COLS)
    // Cabeçalho tabela
    .bold(true)
    .textLn(`${pad('IT', 3)} ${pad('DESCRICAO', 20)} ${pad('QT', 3)} ${pad('V.UNT', 8, 'right')} ${pad('V.TOT', 7, 'right')}`)
    .bold(false)
    .dashedLine(COLS)

  agrupados.forEach((item, idx) => {
    const uni = item.total / item.quantidade
    esc.textLn(
      `${pad(String(idx + 1).padStart(2, '0'), 3)} ` +
      `${pad(item.produto_nome, 20)} ` +
      `${pad(String(item.quantidade).padStart(2, '0'), 3)} ` +
      `${pad(brlEsc(uni), 8, 'right')} ` +
      `${pad(brlEsc(item.total), 7, 'right')}`
    )
  })

  esc.dashedLine(COLS).lf()
    .bold(true).size(1, 2).row('TOTAL', brlEsc(total), COLS)
    .size(1, 1).bold(false)
    .row('Por Pessoa (div.2)', brlEsc(total / 2), COLS)
    .lf().dashedLine(COLS)
    .center().textLn(`Pagamento: ${formas[forma] ?? forma}`)

  if (forma === 'dinheiro' && troco && troco > 0) {
    esc.center().textLn(`Troco: ${brlEsc(troco)}`)
  }
  if (cidade) esc.lf().center().textLn(cidade)

  return esc.lf().dashedLine(COLS)
    .center().textLn('Obrigado! Volte sempre!')
    .cut().build()
}
