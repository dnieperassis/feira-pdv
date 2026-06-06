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

  // fechamentoz precisa de impressora física configurada
  if (cfg.impressora_modo === 'browser') {
    return NextResponse.json({ ok: false, modo: 'browser', msg: 'Impressora térmica não configurada' })
  }

  try {
    let data: Buffer
    if      (tipo === 'teste')       data = buildTeste(cfg.nome)
    else if (tipo === 'kot')         data = buildKot(body, cfg.nome)
    else if (tipo === 'cupom')       data = buildCupom(body, cfg.nome, cfg.cidade)
    else if (tipo === 'fechamentoz') data = buildFechamentoZ(body, cfg.nome, cfg.cidade)
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
  itens: { produto_nome: string; quantidade: number; observacao?: string; parent_item_id?: number | null }[]
}

function buildKot(body: KotBody, _nome: string): Buffer {
  const { mesa, comanda_id, enviado_em, itens } = body

  // Separa itens principais dos adicionais para agrupar na impressão
  const principais = itens.filter(i => !i.parent_item_id)
  const adicionaisPorPai: Record<number, typeof itens> = {}
  itens.forEach((item, idx) => {
    if (item.parent_item_id) {
      // O parent_item_id aqui é o índice na lista de itens
      // Na prática, agrupamos adicionais ao final do item pai
      if (!adicionaisPorPai[item.parent_item_id]) adicionaisPorPai[item.parent_item_id] = []
      adicionaisPorPai[item.parent_item_id].push(item)
    }
  })

  const esc = new Escpos()
    .init().lf()
    .center().bold(true).textLn('** COMANDA DE COZINHA **')
    .lf()
    .center().size(2, 2).bold(true).textLn(mesa)
    .size(1, 1).bold(false)
    .center().textLn(`#${comanda_id}  ${enviado_em}`)
    .lf().left().dashedLine(COLS)

  for (const item of itens) {
    const ehAdicional = !!item.parent_item_id

    if (ehAdicional) {
      // Adicional: recuado ~4 espaços (≈ 0,5cm) + símbolo de vínculo
      esc.text('    ').bold(false).text(`+ ${String(item.quantidade).padStart(2)}x `).textLn(item.produto_nome)
    } else {
      // Item principal: negrito + quantidade
      esc.bold(true).text(`${String(item.quantidade).padStart(2)}x `).bold(false).textLn(item.produto_nome)
    }
    if (item.observacao) esc.textLn(`       >> ${item.observacao}`)
  }

  const totalItens = itens.filter(i => !i.parent_item_id).length
  return esc
    .dashedLine(COLS)
    .center().textLn(`${totalItens} item(s) + adicionais`)
    .lf().cut().build()
}

// ── Builder: Cupom ──────────────────────────────────────────────────────────
interface CupomItem { produto_nome: string; produto_id: number; quantidade: number; total: number }
interface CupomBody {
  mesa: string; comanda_id: number; data_hora: string
  itens: CupomItem[]; forma: string; total: number; troco?: number
}

// ── Builder: Fechamento Z ────────────────────────────────────────────────────
interface Resumo {
  total_vendas: number; total_comandas: number; ticket_medio: number
  total_dinheiro: number; total_pix: number; total_debito: number; total_credito: number
  total_itens: number
}
interface TopProduto { nome: string; qtd_vendida: number; receita: number }
interface PorHora    { hora: number; comandas: number; total: number }

interface FechamentoZBody {
  data_hora: string
  resumo: Resumo
  top_produtos: TopProduto[]
  por_hora: PorHora[]
}

function buildFechamentoZ(body: FechamentoZBody, nome: string, cidade: string): Buffer {
  const { data_hora, resumo, top_produtos, por_hora } = body

  const esc = new Escpos()
    .init().lf()
    .center().bold(true).size(1, 2).textLn(nome.toUpperCase())
    .size(1, 1).bold(false)
    .center().textLn('FECHAMENTO DO DIA').lf()
    .center().textLn(data_hora).lf()
    .left().dashedLine(COLS)

  // ── Resumo Geral ─────────────────────────────────────
  esc.bold(true).textLn('RESUMO GERAL').bold(false)
    .row('Comandas:', String(resumo.total_comandas), COLS)
    .row('Itens vendidos:', String(resumo.total_itens), COLS)
    .row('Ticket medio:', `R$ ${brlEsc(resumo.ticket_medio)}`, COLS)
    .dashedLine(COLS)
    .bold(true).size(1, 2).row('TOTAL DO DIA:', `R$ ${brlEsc(resumo.total_vendas)}`, COLS)
    .size(1, 1).bold(false)

  // ── Formas de Pagamento ───────────────────────────────
  esc.dashedLine(COLS)
    .bold(true).textLn('FORMAS DE PAGAMENTO').bold(false)

  const formas = [
    { label: 'Dinheiro:', val: resumo.total_dinheiro },
    { label: 'PIX:', val: resumo.total_pix },
    { label: 'Debito:', val: resumo.total_debito },
    { label: 'Credito:', val: resumo.total_credito },
  ]
  for (const f of formas) {
    if (f.val > 0) {
      esc.row(f.label, `R$ ${brlEsc(f.val)}`, COLS)
    }
  }
  // Formas com zero também listadas para conferência
  for (const f of formas) {
    if (f.val === 0) {
      esc.row(f.label, `R$ ${brlEsc(0)}`, COLS)
    }
  }

  // ── Top 10 Produtos ───────────────────────────────────
  if (top_produtos?.length > 0) {
    esc.dashedLine(COLS)
      .bold(true).textLn('PRODUTOS MAIS VENDIDOS').bold(false)

    top_produtos.slice(0, 10).forEach((p, i) => {
      // Formato: "01 NomeProduto...........  3x R$36,00"
      const num    = String(i + 1).padStart(2, '0')
      const preco  = `R$ ${brlEsc(p.receita)}`
      const qtd    = `${String(p.qtd_vendida).padStart(3)}x`
      const sufixo = ` ${qtd} ${preco}`         // " 003x R$ 36,00" = ~15 chars
      const nomeMax = COLS - 3 - sufixo.length   // 3 = "01 "
      const nomeCrop = pad(p.nome, nomeMax)
      esc.textLn(`${num} ${nomeCrop}${sufixo}`)
    })
  }

  // ── Horário de Pico ───────────────────────────────────
  if (por_hora?.length > 0) {
    const picoPorCom = por_hora.reduce((max, h) => h.comandas > max.comandas ? h : max, por_hora[0])
    esc.dashedLine(COLS)
      .bold(true).textLn('HORARIO DE PICO').bold(false)
      .row('Hora mais movimentada:', `${String(picoPorCom.hora).padStart(2, '0')}h`, COLS)
      .row('Comandas nessa hora:', String(picoPorCom.comandas), COLS)
      .row('Vendas nessa hora:', `R$ ${brlEsc(picoPorCom.total)}`, COLS)
  }

  // ── Rodapé ────────────────────────────────────────────
  if (cidade) esc.dashedLine(COLS).center().textLn(cidade)

  return esc
    .lf().dashedLine(COLS)
    .center().textLn('Emitido em: ' + data_hora)
    .center().textLn('*** FIM DO FECHAMENTO ***')
    .cut().build()
}

// ── Builder: Cupom ──────────────────────────────────────────────────────────
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
    // Layout: IT(2) sp DESC(18) sp QT(2) sp V.UNT(10) sp V.TOT(10) = 45 < 48
    .bold(true)
    .textLn(`${pad('IT', 2)} ${pad('DESCRICAO', 18)} ${pad('QT', 2)} ${pad('V.UNT', 10, 'right')} ${pad('V.TOT', 10, 'right')}`)
    .bold(false)
    .dashedLine(COLS)

  agrupados.forEach((item, idx) => {
    const uni = item.total / item.quantidade
    // brlEsc sempre retorna 2 casas decimais — nunca truncar precos
    const uniStr  = brlEsc(uni)
    const totStr  = brlEsc(item.total)
    esc.textLn(
      `${pad(String(idx + 1).padStart(2, '0'), 2)} ` +
      `${pad(item.produto_nome, 18)} ` +
      `${pad(String(item.quantidade).padStart(2, '0'), 2)} ` +
      `${pad(uniStr, 10, 'right')} ` +
      `${pad(totStr, 10, 'right')}`
    )
  })

  esc.dashedLine(COLS).lf()
    .bold(true).row('TOTAL', brlEsc(total), COLS)
    .bold(false)
    .dashedLine(COLS)
    .row('Por Pessoa (div.2)', brlEsc(total / 2), COLS)
    .lf().dashedLine(COLS)
    .center().textLn('Aceitamos Pix, Cartao de Credito e Debito.')

  if (forma === 'dinheiro' && troco && troco > 0) {
    esc.center().textLn(`Troco: ${brlEsc(troco)}`)
  }
  if (cidade) esc.lf().center().textLn(cidade)

  return esc.lf().dashedLine(COLS)
    .center().textLn('Obrigado! Volte sempre!')
    .cut().build()
}
