'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import type { Comanda, ComandaItem, FormaPagamento } from '@/types'
import { gerarPixPayload } from '@/lib/pix'
import { brl, parseBRL } from '@/lib/format'
import { Button } from '@/components/ui/Button'

type Config = { nome_estabelecimento: string; cidade: string; chave_pix: string }

const FORMAS: { id: FormaPagamento; label: string; icon: string }[] = [
  { id: 'dinheiro',       label: 'Dinheiro',  icon: '💵' },
  { id: 'pix',            label: 'PIX',        icon: '📲' },
  { id: 'cartao_debito',  label: 'Débito',     icon: '💳' },
  { id: 'cartao_credito', label: 'Crédito',    icon: '💳' },
]

export default function CaixaPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [comanda, setComanda]       = useState<Comanda | null>(null)
  const [itens, setItens]           = useState<ComandaItem[]>([])
  const [config, setConfig]         = useState<Config | null>(null)
  const [forma, setForma]           = useState<FormaPagamento>('dinheiro')
  const [valorRecebido, setValorRecebido] = useState('')
  const [fechando, setFechando]     = useState(false)
  const [qrCodeUrl, setQrCodeUrl]   = useState<string | null>(null)
  const [pixCopiaeCola, setPixCopiaeCola] = useState<string | null>(null)
  const [copiado, setCopiado]       = useState(false)

  const carregar = useCallback(async () => {
    const [r1, r2, r3] = await Promise.all([
      fetch(`/api/comandas/${id}`),
      fetch(`/api/comandas/${id}/itens`),
      fetch('/api/configuracoes'),
    ])
    if (!r1.ok) { router.push('/mesas'); return }
    const c: Comanda     = await r1.json()
    const i: ComandaItem[] = await r2.json()
    const cfg: Config    = await r3.json()
    setComanda(c)
    setItens(i)
    setConfig(cfg)
    setValorRecebido(brl(c.total))
  }, [id, router])

  useEffect(() => { carregar() }, [carregar])

  // Gera QR Code PIX sempre que forma ou total mudar
  useEffect(() => {
    if (forma !== 'pix' || !config?.chave_pix || !comanda) {
      setQrCodeUrl(null)
      setPixCopiaeCola(null)
      return
    }

    const total = itens.reduce((s, i) => s + i.total, 0)
    const payload = gerarPixPayload({
      chave: config.chave_pix,
      valor: total,
      nome:  config.nome_estabelecimento,
      cidade: config.cidade,
    })
    setPixCopiaeCola(payload)

    QRCode.toDataURL(payload, {
      width:         300,
      margin:        2,
      color:         { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setQrCodeUrl)
  }, [forma, config, comanda, itens])

  const total    = itens.reduce((s, i) => s + i.total, 0)
  const recebido = parseBRL(valorRecebido)
  const troco    = forma === 'dinheiro' ? Math.max(0, recebido - total) : 0

  const agora = new Date()
  const dataHora = agora.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  // Agrupar itens por produto para cupom consolidado
  const itensPorProduto = itens.reduce((acc, item) => {
    const existing = acc.find(x => x.produto_id === item.produto_id)
    if (existing) {
      existing.quantidade += item.quantidade
      existing.total += item.total
    } else {
      acc.push({ ...item })
    }
    return acc
  }, [] as ComandaItem[])

  const valorPorPessoa = total / 2

  async function imprimir() {
    window.print()
  }

  async function copiarPix() {
    if (!pixCopiaeCola) return
    await navigator.clipboard.writeText(pixCopiaeCola)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function fechar() {
    if (forma === 'dinheiro' && recebido < total) {
      alert('Valor recebido menor que o total')
      return
    }
    setFechando(true)
    const res = await fetch('/api/caixa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comanda_id: Number(id),
        pagamentos: [{ forma, valor: total, troco }],
      }),
    })
    setFechando(false)
    if (res.ok) router.push('/mesas')
    else alert('Erro ao fechar conta')
  }

  if (!comanda || !config) {
    return <div className="flex items-center justify-center h-full text-slate-400">Carregando...</div>
  }

  const tituloMesa = comanda.tipo === 'balcao' ? 'Balcão' : `Mesa ${comanda.mesa_numero}`

  return (
    <>
      {/* ── Cupom de impressão (só visível ao imprimir) ── */}
      <div className="cupom-print">
        <div className="cupom-center">
          <strong>{config.nome_estabelecimento || 'FEIRA PDV'}</strong>
        </div>
        <div className="cupom-center" style={{ fontSize: 11 }}>
          CUPOM NÃO FISCAL
        </div>
        <div className="cupom-center" style={{ fontSize: 10 }}>
          {tituloMesa} · {dataHora}
        </div>
        <div className="cupom-divider" />

        {/* ── Tabela Fiscal (headers + itens) ── */}
        <table className="cupom-tabela-fiscal">
          <thead>
            <tr>
              <th className="cupom-col-item">Item</th>
              <th className="cupom-col-desc">Descrição</th>
              <th className="cupom-col-qtd">Qtd</th>
              <th className="cupom-col-unitario">Vl.Unit</th>
              <th className="cupom-col-total">Vl.Tot</th>
            </tr>
          </thead>
          <tbody>
            {itensPorProduto.map((item, idx) => (
              <tr key={item.id}>
                <td className="cupom-col-item">{String(idx + 1).padStart(2, '0')}</td>
                <td className="cupom-col-desc">{item.produto_nome}</td>
                <td className="cupom-col-qtd">{String(item.quantidade).padStart(2, '0')}</td>
                <td className="cupom-col-unitario">R$ {brl(item.total / item.quantidade)}</td>
                <td className="cupom-col-total">R$ {brl(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="cupom-divider" />

        {/* ── Totalizações (sem SUBTOTAL) ── */}
        <div className="cupom-total-linha cupom-destaque">
          <span className="cupom-label">TOTAL</span>
          <span className="cupom-valor">R$ {brl(total)}</span>
        </div>
        <div className="cupom-total-linha cupom-por-pessoa">
          <span className="cupom-label">Por Pessoa (÷2)</span>
          <span className="cupom-valor">R$ {brl(valorPorPessoa)}</span>
        </div>

        <div className="cupom-divider" />
        <div className="cupom-center" style={{ fontSize: 10 }}>
          Pagamento: {FORMAS.find(f => f.id === forma)?.label ?? forma}
        </div>
        {forma === 'dinheiro' && troco > 0 && (
          <div className="cupom-center" style={{ fontSize: 10 }}>
            Troco: R$ {brl(troco)}
          </div>
        )}
        <div className="cupom-divider" />
        <div className="cupom-center">Obrigado! Volte sempre! 😊</div>
      </div>

      {/* ── Layout da tela ── */}
      <div className="no-print max-w-2xl mx-auto p-4 flex flex-col gap-5">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-2xl">Fechar Conta</h1>
            <p className="text-slate-400 text-sm">{tituloMesa} · #{id}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={imprimir}>🖨️ Imprimir</Button>
            <Button variant="ghost" size="md" onClick={() => router.back()}>← Voltar</Button>
          </div>
        </div>

        {/* Itens */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <span className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Resumo do pedido</span>
          </div>
          <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
            {itens.map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-white font-medium">{item.produto_nome}</span>
                  <span className="text-slate-400 text-sm ml-2">× {item.quantidade}</span>
                </div>
                <span className="text-amber-400 font-semibold">R$ {brl(item.total)}</span>
              </div>
            ))}
          </div>
          <div className="px-4 py-4 bg-slate-800 flex justify-between items-center border-t border-slate-600">
            <span className="text-white font-bold text-lg">Total</span>
            <span className="text-amber-400 font-bold text-3xl">R$ {brl(total)}</span>
          </div>
        </div>

        {/* Formas de pagamento */}
        <div>
          <p className="text-slate-300 font-semibold mb-3">Forma de Pagamento</p>
          <div className="grid grid-cols-4 gap-3">
            {FORMAS.map(f => (
              <button
                key={f.id}
                onClick={() => setForma(f.id)}
                className={[
                  'flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all min-h-[80px]',
                  forma === f.id
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400',
                ].join(' ')}
              >
                <span className="text-2xl">{f.icon}</span>
                <span className="font-semibold text-sm">{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dinheiro: troco */}
        {forma === 'dinheiro' && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-4">
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-2">Valor Recebido (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={valorRecebido}
                onChange={e => setValorRecebido(e.target.value)}
                onFocus={e => e.target.select()}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-2xl font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
            {troco > 0 && (
              <div className="flex justify-between items-center bg-green-950/50 border border-green-700 rounded-xl px-4 py-3">
                <span className="text-green-300 font-semibold text-lg">Troco</span>
                <span className="text-green-400 font-bold text-2xl">R$ {brl(troco)}</span>
              </div>
            )}
          </div>
        )}

        {/* PIX: QR Code */}
        {forma === 'pix' && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 flex flex-col items-center gap-4">
            {!config.chave_pix ? (
              <div className="text-center py-4">
                <p className="text-amber-400 font-semibold mb-1">Chave PIX não configurada</p>
                <p className="text-slate-400 text-sm">
                  Acesse <strong className="text-white">Configurações</strong> para cadastrar sua chave PIX.
                </p>
              </div>
            ) : !qrCodeUrl ? (
              <p className="text-slate-400 py-8">Gerando QR Code...</p>
            ) : (
              <>
                <p className="text-slate-300 font-semibold">Mostre o QR Code para o cliente escanear</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCodeUrl}
                  alt="QR Code PIX"
                  className="rounded-2xl border-4 border-white"
                  style={{ width: 260, height: 260 }}
                />
                <div className="text-center">
                  <p className="text-amber-400 font-bold text-2xl mb-1">R$ {brl(total)}</p>
                  <p className="text-slate-400 text-xs">{config.nome_estabelecimento}</p>
                </div>
                <button
                  onClick={copiarPix}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-slate-300 text-sm transition-colors"
                >
                  {copiado ? '✓ Copiado!' : '📋 Copiar Pix Copia e Cola'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Botão confirmar */}
        <Button
          variant="success"
          size="xl"
          fullWidth
          onClick={fechar}
          disabled={fechando || (forma === 'pix' && !config.chave_pix)}
        >
          {fechando ? 'Processando...' : `✓ Confirmar Pagamento · R$ ${brl(total)}`}
        </Button>
      </div>

      {/* Estilos de impressão centralizados em globals.css */}
    </>
  )
}
