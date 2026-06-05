import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { Escpos, printTCP, brlEsc, pad } from '@/lib/escpos'

export const runtime = 'nodejs'

const COLS = 48 // colunas para 80mm

// ── Buscar configurações da impressora ──────────────────────────────────────
function getConfig(db: ReturnType<typeof getDb>) {
  const rows = db.prepare('SELECT chave, valor FROM configuracoes').all() as { chave: string; valor: string }[]
  const cfg: Record<string, string> = {}
  for (const { chave, valor } of rows) cfg[chave] = valor
  return {
    nome:         cfg.nome_estabelecimento ?? 'FEIRA PDV',
    cidade:       cfg.cidade ?? '',
    impressora_ip:    cfg.impressora_ip ?? '',
    impressora_porta: parseInt(cfg.impressora_porta ?? '9100'),
    impressora_modo:  cfg.impressora_modo ?? 'browser', // tcp | browser
  }
}

// ── Enviar para impressora ───────────────────────────────────────────────────
async function imprimir(data: Buffer, ip: string, port: number): Promise<void> {
  await printTCP(ip, port, data)
}

// ── POST /api/print  { tipo: 'kot' | 'cupom' | 'teste', ...dados } ──────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tipo } = body
  const db = getDb()
  const cfg = getConfig(db)

  if (cfg.impressora_modo !== 'tcp' || !cfg.impressora_ip) {
    return NextResponse.json({ ok: false, modo: 'browser', msg: 'Impressora TCP não configurada — use impressão do navegador' })
  }

  try {
    let data: Buffer

    if (tipo === 'teste') {
      data = buildTeste(cfg.nome)
    } else if (tipo === 'kot') {
      data = buildKot(body, cfg.nome)
    } else if (tipo === 'cupom') {
      data = buildCupom(body, cfg.nome, cfg.cidade)
    } else {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    await imprimir(data, cfg.impressora_ip, cfg.impressora_porta)
    return NextResponse.json({ ok: true, modo: 'tcp' })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ ok: false, modo: 'tcp', error: msg }, { status: 500 })
  }
}

// ── GET /api/print/status — verifica se impressora está online ───────────────
export async function GET() {
  const db = getDb()
  const cfg = getConfig(db)

  if (cfg.impressora_modo !== 'tcp' || !cfg.impressora_ip) {
    return NextResponse.json({ online: false, modo: 'browser', msg: 'TCP não configurado' })
  }

  try {
    const { printTCP: _p } = await import('@/lib/escpos')
    // Testa conexão enviando 0 bytes
    await printTCP(cfg.impressora_ip, cfg.impressora_porta, Buffer.alloc(0), 3000)
    return NextResponse.json({ online: true, modo: 'tcp', ip: cfg.impressora_ip })
  } catch {
    return NextResponse.json({ online: false, modo: 'tcp', ip: cfg.impressora_ip, msg: 'Impressora offline ou IP incorreto' })
  }
}

// ── Builder: Página de Teste ─────────────────────────────────────────────────
function buildTeste(nome: string): Buffer {
  const now = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  return new Escpos()
    .init()
    .lf(1)
    .center().bold(true).size(2, 2).text('** TESTE **').lf()
    .size(1, 1).bold(false)
    .lf(1)
    .center().textLn(nome)
    .center().textLn('Impressora configurada com sucesso!')
    .lf(1)
    .center().textLn(now)
    .lf(1)
    .center().textLn('ESC/POS 80mm OK')
    .lf(1)
    .dashedLine(COLS)
    .center().textLn('Feira PDV v1.0')
    .cut()
    .build()
}

// ── Builder: KOT Cozinha ─────────────────────────────────────────────────────
interface KotBody {
  mesa:      string  // 'MESA 02' ou 'BALCAO'
  comanda_id: number
  enviado_em: string // HH:MM
  itens: { produto_nome: string; quantidade: number; observacao?: string }[]
}

function buildKot(body: KotBody, nome: string): Buffer {
  const { mesa, comanda_id, enviado_em, itens } = body

  const esc = new Escpos()
    .init()
    .lf(1)
    .center().bold(true).size(1, 1).textLn('** COMANDA DE COZINHA **')
    .lf(1)
    .center().size(2, 2).bold(true).textLn(mesa)
    .size(1, 1).bold(false)
    .center().textLn(`#${comanda_id}  ${enviado_em}`)
    .lf(1)
    .left().dashedLine(COLS)

  for (const item of itens) {
    esc.left().bold(true).text(`${String(item.quantidade).padStart(2)}x `).bold(false).textLn(item.produto_nome)
    if (item.observacao) {
      esc.left().textLn(`   >> ${item.observacao}`)
    }
  }

  esc.dashedLine(COLS)
    .center().textLn(`${itens.length} item(s) enviado(s)`)
    .lf(1)
    .cut()

  return esc.build()
}

// ── Builder: Cupom Não Fiscal ────────────────────────────────────────────────
interface CupomItem {
  produto_nome: string
  produto_id:   number
  quantidade:   number
  total:        number
}

interface CupomBody {
  nome_estabelecimento: string
  mesa:       string   // 'Mesa 2' ou 'Balcão'
  comanda_id: number
  data_hora:  string
  itens:      CupomItem[]
  forma:      string
  total:      number
  troco?:     number
}

function buildCupom(body: CupomBody, nome: string, cidade: string): Buffer {
  const { mesa, comanda_id, data_hora, itens, forma, total, troco } = body

  // Agrupar itens por produto
  const agrupados = itens.reduce((acc, item) => {
    const ex = acc.find(x => x.produto_id === item.produto_id)
    if (ex) { ex.quantidade += item.quantidade; ex.total += item.total }
    else acc.push({ ...item })
    return acc
  }, [] as CupomItem[])

  const porPessoa = total / 2

  const formaLabel: Record<string, string> = {
    dinheiro:        'Dinheiro',
    pix:             'PIX',
    cartao_debito:   'Cartao Debito',
    cartao_credito:  'Cartao Credito',
  }

  const esc = new Escpos()
    .init()
    .lf(1)
    .center().bold(true).size(1, 2).textLn(nome.toUpperCase())
    .size(1, 1).bold(false)
    .center().textLn('CUPOM NAO FISCAL')
    .lf(1)
    .center().textLn(`${mesa}  #${comanda_id}`)
    .center().textLn(data_hora)
    .lf(1)
    .left().dashedLine(COLS)

  // Cabeçalho da tabela
  // ITEM DESCRICAO            QTD  V.UNT   V.TOT
  //  01  Pastel de Carne       02  R$8,00  R$16,00
  const hItem = pad('IT', 3)
  const hDesc = pad('DESCRICAO', 19)
  const hQtd  = pad('QT', 3)
  const hUni  = pad('V.UNT', 8, 'right')
  const hTot  = pad('V.TOT', 8, 'right')
  esc.bold(true).textLn(`${hItem} ${hDesc} ${hQtd} ${hUni} ${hTot}`).bold(false)
  esc.dashedLine(COLS)

  agrupados.forEach((item, idx) => {
    const unitario = item.total / item.quantidade
    const nItem = pad(String(idx + 1).padStart(2, '0'), 3)
    const nDesc = pad(item.produto_nome, 19)
    const nQtd  = pad(String(item.quantidade).padStart(2, '0'), 3)
    const nUni  = pad(brlEsc(unitario), 8, 'right')
    const nTot  = pad(brlEsc(item.total), 8, 'right')
    esc.textLn(`${nItem} ${nDesc} ${nQtd} ${nUni} ${nTot}`)
  })

  esc.dashedLine(COLS)
    .lf(1)
    // TOTAL
    .bold(true).size(1, 2)
    .row('TOTAL', brlEsc(total), COLS)
    .size(1, 1).bold(false)
    // Por Pessoa
    .row('Por Pessoa (div.2)', brlEsc(porPessoa), COLS)
    .lf(1)
    .dashedLine(COLS)
    // Forma de pagamento
    .center().textLn(`Pagamento: ${formaLabel[forma] ?? forma}`)

  if (forma === 'dinheiro' && troco && troco > 0) {
    esc.center().textLn(`Troco: ${brlEsc(troco)}`)
  }

  if (cidade) esc.lf(1).center().textLn(cidade)

  esc
    .lf(1)
    .dashedLine(COLS)
    .center().textLn('Obrigado! Volte sempre!')
    .lf(1)
    .center().textLn('Feira PDV')
    .cut()

  return esc.build()
}
