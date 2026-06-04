'use client'

import { useEffect, useState, useCallback } from 'react'
import { brl } from '@/lib/format'

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Resumo {
  total_vendas: number; total_comandas: number; ticket_medio: number
  total_dinheiro: number; total_pix: number; total_cartao: number
  total_debito: number; total_credito: number; total_itens: number
}
interface DiaSerie { dia: string; total: number; comandas: number; itens: number }
interface TopProduto { nome: string; categoria: string; qtd_vendida: number; receita: number; em_comandas: number }
interface PorCategoria { categoria: string; qtd_vendida: number; receita: number }
interface PorHora { hora: number; comandas: number; total: number }
interface PorGarcom { operador: string; comandas: number; total_vendido: number; itens_vendidos: number }
interface PorTipo { tipo: string; comandas: number; total: number }
interface Cancelado { nome: string; qtd: number; valor_perdido: number }

interface DadosRelatorio {
  periodo: { de: string; ate: string }
  resumo: Resumo
  evolucao: DiaSerie[]
  top_produtos: TopProduto[]
  por_categoria: PorCategoria[]
  por_hora: PorHora[]
  por_garcom: PorGarcom[]
  por_tipo: PorTipo[]
  cancelados: Cancelado[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function hoje() { return new Date().toISOString().split('T')[0] }
function diasAtras(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]
}
function fmtDia(iso: string) {
  const [, m, d] = iso.split('-'); return `${d}/${m}`
}
function fmtDiaCompleto(iso: string) {
  const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`
}

const ATALHOS = [
  { label: 'Hoje',        de: () => hoje(),        ate: () => hoje() },
  { label: 'Ontem',       de: () => diasAtras(1),  ate: () => diasAtras(1) },
  { label: 'Últimos 7d',  de: () => diasAtras(6),  ate: () => hoje() },
  { label: 'Últimos 30d', de: () => diasAtras(29), ate: () => hoje() },
]

type Aba = 'resumo' | 'evolucao' | 'produtos' | 'horarios' | 'garcons' | 'cancelados'

// ── Componentes auxiliares ────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = 'amber' }: {
  label: string; value: string; sub?: string; color?: 'amber' | 'blue' | 'green' | 'slate' | 'purple'
}) {
  const clr = { amber: 'text-amber-400', blue: 'text-blue-400', green: 'text-green-400', slate: 'text-slate-300', purple: 'text-purple-400' }[color]
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
      <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`font-bold text-2xl ${clr}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function BarraHorizontal({ label, valor, max, pct, cor = 'bg-amber-500' }: {
  label: string; valor: string; max: number; pct: number; cor?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300 truncate max-w-[60%]">{label}</span>
        <span className="text-white font-semibold">{valor}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${cor} rounded-full transition-all`} style={{ width: `${Math.min(100, (pct / (max || 1)) * 100)}%` }} />
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function RelatoriosPage() {
  const [de,  setDe]  = useState(hoje())
  const [ate, setAte] = useState(hoje())
  const [aba, setAba] = useState<Aba>('resumo')
  const [dados, setDados] = useState<DadosRelatorio | null>(null)
  const [loading, setLoading] = useState(false)

  const buscar = useCallback(async (d: string, a: string) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/relatorios?de=${d}&ate=${a}`)
      if (r.ok) setDados(await r.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { buscar(de, ate) }, [buscar, de, ate])

  function aplicarAtalho(idx: number) {
    const at = ATALHOS[idx]
    const nd = at.de(); const na = at.ate()
    setDe(nd); setAte(na)
  }

  const ABAS: { id: Aba; label: string; icon: string }[] = [
    { id: 'resumo',     label: 'Resumo',      icon: '📊' },
    { id: 'evolucao',   label: 'Evolução',    icon: '📈' },
    { id: 'produtos',   label: 'Produtos',    icon: '🏆' },
    { id: 'horarios',   label: 'Horários',    icon: '⏰' },
    { id: 'garcons',    label: 'Garçons',     icon: '👤' },
    { id: 'cancelados', label: 'Cancelados',  icon: '❌' },
  ]

  return (
    <div className="p-4 flex flex-col gap-4 max-w-4xl mx-auto">

      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-white font-bold text-xl">📊 Relatórios Gerenciais</h1>
        {loading && <span className="text-amber-400 text-sm animate-pulse">Carregando...</span>}
      </div>

      {/* ── Seletor de período ── */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap">
          {ATALHOS.map((at, i) => (
            <button
              key={at.label}
              onClick={() => aplicarAtalho(i)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                de === at.de() && ate === at.ate()
                  ? 'bg-amber-500 text-gray-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {at.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">De:</label>
            <input
              type="date" value={de} max={ate}
              onChange={e => setDe(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Até:</label>
            <input
              type="date" value={ate} min={de} max={hoje()}
              onChange={e => setAte(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          {dados && (
            <span className="text-slate-500 text-xs">
              {de === ate ? fmtDiaCompleto(de) : `${fmtDiaCompleto(de)} → ${fmtDiaCompleto(ate)}`}
            </span>
          )}
        </div>
      </div>

      {!dados ? (
        <div className="flex items-center justify-center h-40 text-slate-400">Carregando dados...</div>
      ) : (
        <>
          {/* ── KPIs sempre visíveis ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="Total Vendas"    value={`R$ ${brl(dados.resumo.total_vendas)}`}    color="amber" />
            <KpiCard label="Comandas"        value={String(dados.resumo.total_comandas)}        color="blue" />
            <KpiCard label="Ticket Médio"    value={`R$ ${brl(dados.resumo.ticket_medio)}`}    color="green" />
            <KpiCard label="Itens Vendidos"  value={String(dados.resumo.total_itens)}           color="purple" />
            <KpiCard label="Itens p/ Comanda"
              value={dados.resumo.total_comandas > 0
                ? (dados.resumo.total_itens / dados.resumo.total_comandas).toFixed(1)
                : '0'}
              color="slate"
              sub="média de itens"
            />
          </div>

          {/* ── Abas ── */}
          <div className="flex gap-1 flex-wrap border-b border-slate-700 pb-0">
            {ABAS.map(a => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-colors ${
                  aba === a.id
                    ? 'bg-slate-900 text-amber-400 border border-b-0 border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>

          {/* ── Conteúdo das abas ── */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">

            {/* RESUMO */}
            {aba === 'resumo' && (
              <div className="flex flex-col gap-5">
                <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Formas de Pagamento</h2>
                <div className="flex flex-col gap-3">
                  {[
                    { label: '💵 Dinheiro',      val: dados.resumo.total_dinheiro },
                    { label: '📲 PIX',            val: dados.resumo.total_pix },
                    { label: '💳 Cartão Débito',  val: dados.resumo.total_debito },
                    { label: '💳 Cartão Crédito', val: dados.resumo.total_credito },
                  ].map(row => (
                    <BarraHorizontal
                      key={row.label}
                      label={row.label}
                      valor={`R$ ${brl(row.val)}`}
                      max={dados.resumo.total_vendas}
                      pct={row.val}
                    />
                  ))}
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide mb-3">Mesa vs. Balcão</h2>
                  <div className="flex gap-3 flex-wrap">
                    {dados.por_tipo.map(t => (
                      <div key={t.tipo} className="flex-1 min-w-[140px] bg-slate-800 rounded-xl p-3 text-center">
                        <p className="text-slate-400 text-xs capitalize mb-1">{t.tipo}</p>
                        <p className="text-white font-bold text-lg">{t.comandas} comanda{t.comandas !== 1 ? 's' : ''}</p>
                        <p className="text-amber-400 font-semibold text-sm">R$ {brl(t.total)}</p>
                      </div>
                    ))}
                    {dados.por_tipo.length === 0 && (
                      <p className="text-slate-500 text-sm">Nenhuma venda no período</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* EVOLUÇÃO DIÁRIA */}
            {aba === 'evolucao' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Vendas por Dia</h2>
                {dados.evolucao.length === 0 ? (
                  <p className="text-slate-500 text-sm">Nenhuma venda no período selecionado.</p>
                ) : (
                  <>
                    {/* Mini gráfico de barras */}
                    <div className="flex items-end gap-1 h-28 overflow-x-auto pb-1">
                      {dados.evolucao.map(dia => {
                        const maxVal = Math.max(...dados.evolucao.map(d => d.total), 1)
                        const h = Math.max(4, (dia.total / maxVal) * 100)
                        return (
                          <div key={dia.dia} className="flex flex-col items-center gap-0.5 min-w-[28px] flex-1">
                            <span className="text-amber-400 text-[9px] font-bold">{dia.total > 0 ? `${brl(dia.total)}` : ''}</span>
                            <div
                              className="w-full bg-amber-500 rounded-t opacity-80 hover:opacity-100 transition-opacity cursor-default"
                              style={{ height: `${h}%` }}
                              title={`${fmtDiaCompleto(dia.dia)}: R$ ${brl(dia.total)}`}
                            />
                            <span className="text-slate-500 text-[9px]">{fmtDia(dia.dia)}</span>
                          </div>
                        )
                      })}
                    </div>
                    {/* Tabela detalhada */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                          <th className="text-left pb-2">Data</th>
                          <th className="text-right pb-2">Vendas</th>
                          <th className="text-right pb-2">Comandas</th>
                          <th className="text-right pb-2">Ticket Médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.evolucao.map(dia => (
                          <tr key={dia.dia} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="py-2 text-slate-300">{fmtDiaCompleto(dia.dia)}</td>
                            <td className="py-2 text-right text-amber-400 font-semibold">R$ {brl(dia.total)}</td>
                            <td className="py-2 text-right text-white">{dia.comandas}</td>
                            <td className="py-2 text-right text-slate-300">
                              R$ {brl(dia.comandas > 0 ? dia.total / dia.comandas : 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-600 font-bold">
                          <td className="pt-2 text-white">TOTAL</td>
                          <td className="pt-2 text-right text-amber-400">R$ {brl(dados.resumo.total_vendas)}</td>
                          <td className="pt-2 text-right text-white">{dados.resumo.total_comandas}</td>
                          <td className="pt-2 text-right text-slate-300">R$ {brl(dados.resumo.ticket_medio)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </>
                )}
              </div>
            )}

            {/* PRODUTOS MAIS VENDIDOS */}
            {aba === 'produtos' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">🏆 Ranking de Produtos</h2>
                {dados.top_produtos.length === 0 ? (
                  <p className="text-slate-500 text-sm">Nenhuma venda no período selecionado.</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      {dados.top_produtos.map((p, i) => (
                        <BarraHorizontal
                          key={p.nome}
                          label={`${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`} ${p.nome}`}
                          valor={`${p.qtd_vendida}x · R$ ${brl(p.receita)}`}
                          max={dados.top_produtos[0]?.qtd_vendida ?? 1}
                          pct={p.qtd_vendida}
                          cor={i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-600' : 'bg-slate-600'}
                        />
                      ))}
                    </div>
                    <div className="border-t border-slate-700 pt-3">
                      <h3 className="text-slate-400 text-xs uppercase tracking-wide mb-2">Por Categoria</h3>
                      <div className="flex flex-col gap-2">
                        {dados.por_categoria.map(c => (
                          <BarraHorizontal
                            key={c.categoria}
                            label={c.categoria}
                            valor={`${c.qtd_vendida}x · R$ ${brl(c.receita)}`}
                            max={dados.por_categoria[0]?.receita ?? 1}
                            pct={c.receita}
                            cor="bg-blue-500"
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* HORÁRIOS DE PICO */}
            {aba === 'horarios' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Movimento por Horário</h2>
                {dados.por_hora.length === 0 ? (
                  <p className="text-slate-500 text-sm">Nenhuma venda no período selecionado.</p>
                ) : (
                  <>
                    <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
                      {Array.from({ length: 24 }, (_, h) => {
                        const hora = dados.por_hora.find(x => x.hora === h)
                        const maxCom = Math.max(...dados.por_hora.map(x => x.comandas), 1)
                        const hPct  = hora ? Math.max(4, (hora.comandas / maxCom) * 100) : 0
                        return (
                          <div key={h} className="flex flex-col items-center min-w-[22px] flex-1">
                            {hora && <span className="text-green-400 text-[8px] font-bold">{hora.comandas}</span>}
                            <div
                              className="w-full rounded-t transition-all"
                              style={{
                                height: `${hPct}%`,
                                backgroundColor: hora ? (hora.comandas === Math.max(...dados.por_hora.map(x => x.comandas)) ? '#f59e0b' : '#22c55e') : 'transparent',
                                minHeight: hora ? '4px' : '0',
                              }}
                              title={hora ? `${h}h: ${hora.comandas} comanda(s) · R$ ${brl(hora.total)}` : `${h}h: sem movimento`}
                            />
                            <span className="text-slate-600 text-[8px]">{h}h</span>
                          </div>
                        )
                      })}
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                          <th className="text-left pb-2">Hora</th>
                          <th className="text-right pb-2">Comandas</th>
                          <th className="text-right pb-2">Total</th>
                          <th className="text-right pb-2">Ticket</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.por_hora.map(h => (
                          <tr key={h.hora} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="py-1.5 text-slate-300 font-mono">{String(h.hora).padStart(2, '0')}:00</td>
                            <td className="py-1.5 text-right text-white">{h.comandas}</td>
                            <td className="py-1.5 text-right text-amber-400 font-semibold">R$ {brl(h.total)}</td>
                            <td className="py-1.5 text-right text-slate-300">R$ {brl(h.total / h.comandas)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}

            {/* GARÇONS */}
            {aba === 'garcons' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Desempenho por Garçom</h2>
                {dados.por_garcom.length === 0 ? (
                  <p className="text-slate-500 text-sm">Nenhuma venda no período selecionado.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                        <th className="text-left pb-2">Operador</th>
                        <th className="text-right pb-2">Comandas</th>
                        <th className="text-right pb-2">Itens</th>
                        <th className="text-right pb-2">Total Vendido</th>
                        <th className="text-right pb-2">Ticket Médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.por_garcom.map((g, i) => (
                        <tr key={g.operador} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="py-2 text-white font-medium">
                            {i === 0 ? '🏆 ' : ''}{g.operador}
                          </td>
                          <td className="py-2 text-right text-slate-300">{g.comandas}</td>
                          <td className="py-2 text-right text-slate-300">{g.itens_vendidos}</td>
                          <td className="py-2 text-right text-amber-400 font-semibold">R$ {brl(g.total_vendido)}</td>
                          <td className="py-2 text-right text-slate-300">
                            R$ {brl(g.comandas > 0 ? g.total_vendido / g.comandas : 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="text-slate-600 text-xs">* O garçom é registrado no momento de abertura da comanda. Comandas abertas antes desta atualização aparecem como "Sem operador".</p>
              </div>
            )}

            {/* CANCELADOS */}
            {aba === 'cancelados' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Itens Cancelados / Desperdício</h2>
                {dados.cancelados.length === 0 ? (
                  <p className="text-green-400 text-sm font-medium">✅ Nenhum item cancelado no período. Ótimo!</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div className="bg-red-950/40 border border-red-800 rounded-xl p-3 text-center">
                        <p className="text-red-300 text-xs uppercase mb-1">Total Cancelado</p>
                        <p className="text-red-400 font-bold text-xl">
                          {dados.cancelados.reduce((s, c) => s + c.qtd, 0)} itens
                        </p>
                      </div>
                      <div className="bg-red-950/40 border border-red-800 rounded-xl p-3 text-center">
                        <p className="text-red-300 text-xs uppercase mb-1">Receita Perdida</p>
                        <p className="text-red-400 font-bold text-xl">
                          R$ {brl(dados.cancelados.reduce((s, c) => s + c.valor_perdido, 0))}
                        </p>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                          <th className="text-left pb-2">Produto</th>
                          <th className="text-right pb-2">Qtd</th>
                          <th className="text-right pb-2">Valor Perdido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.cancelados.map(c => (
                          <tr key={c.nome} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="py-2 text-slate-300">{c.nome}</td>
                            <td className="py-2 text-right text-white">{c.qtd}x</td>
                            <td className="py-2 text-right text-red-400 font-semibold">R$ {brl(c.valor_perdido)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}

          </div>
        </>
      )}
    </div>
  )
}
