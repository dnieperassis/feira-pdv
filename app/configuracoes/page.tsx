'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface Config {
  nome_estabelecimento: string
  cidade:               string
  chave_pix:            string
  numero_mesas:         string
  telefone:             string
  impressora_modo:      string
  impressora_ip:        string
  impressora_porta:     string
}

interface Operador { id: number; nome: string; codigo: string; perfil: string; ativo: number }
type FormOp = { nome: string; codigo: string; pin: string; pin2: string }

const formOpVazio: FormOp = { nome: '', codigo: '', pin: '', pin2: '' }

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<Config>({
    nome_estabelecimento: '',
    cidade:               '',
    chave_pix:            '',
    numero_mesas:         '10',
    telefone:             '',
    impressora_modo:      'browser',
    impressora_ip:        '',
    impressora_porta:     '9100',
  })
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo]       = useState(false)
  const [aviso, setAviso]       = useState('')
  const [testandoImpressora, setTestandoImpressora] = useState(false)
  const [statusImpressora, setStatusImpressora]     = useState<'idle'|'ok'|'erro'>('idle')

  // Operadores
  const [operadores, setOperadores]     = useState<Operador[]>([])
  const [modalOp, setModalOp]           = useState(false)
  const [editandoOp, setEditandoOp]     = useState<Operador | null>(null)
  const [formOp, setFormOp]             = useState<FormOp>(formOpVazio)
  const [salvandoOp, setSalvandoOp]     = useState(false)
  const [erroOp, setErroOp]             = useState('')

  async function carregarOps() {
    fetch('/api/operadores').then(r => r.json()).then(setOperadores)
  }

  useEffect(() => {
    fetch('/api/configuracoes').then(r => r.json()).then(setConfig)
    carregarOps()
  }, [])

  function handleMesas(valor: string) {
    const n = parseInt(valor)
    setConfig(c => ({ ...c, numero_mesas: valor }))
    if (n < parseInt(config.numero_mesas)) {
      setAviso('Mesas ocupadas não serão removidas. Apenas mesas livres do final da lista serão excluídas.')
    } else {
      setAviso('')
    }
  }

  async function salvar() {
    setSalvando(true)
    await fetch('/api/configuracoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    // Re-lê o real (pode diferir se havia mesas ocupadas)
    const atualizado = await fetch('/api/configuracoes').then(r => r.json())
    setConfig(atualizado)
    setSalvando(false)
    setSalvo(true)
    setAviso('')
    setTimeout(() => setSalvo(false), 2500)
  }

  async function testarImpressora() {
    setTestandoImpressora(true)
    setStatusImpressora('idle')
    try {
      const r = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'teste' }),
      })
      const data = await r.json()
      setStatusImpressora(data.ok ? 'ok' : 'erro')
    } catch {
      setStatusImpressora('erro')
    } finally {
      setTestandoImpressora(false)
      setTimeout(() => setStatusImpressora('idle'), 5000)
    }
  }

  // Funções de operadores
  function abrirNovoOp() {
    setEditandoOp(null); setFormOp(formOpVazio); setErroOp(''); setModalOp(true)
  }
  function abrirEditarOp(op: Operador) {
    setEditandoOp(op)
    setFormOp({ nome: op.nome, codigo: op.codigo, pin: '', pin2: '' })
    setErroOp(''); setModalOp(true)
  }
  async function salvarOp() {
    if (!formOp.nome.trim()) { setErroOp('Nome obrigatório'); return }
    if (!formOp.codigo.trim()) { setErroOp('Código obrigatório'); return }
    if (!editandoOp) {
      if (!/^\d{4,6}$/.test(formOp.pin)) { setErroOp('PIN deve ter 4 a 6 dígitos'); return }
      if (formOp.pin !== formOp.pin2) { setErroOp('PINs não coincidem'); return }
    } else if (formOp.pin) {
      if (!/^\d{4,6}$/.test(formOp.pin)) { setErroOp('PIN deve ter 4 a 6 dígitos'); return }
      if (formOp.pin !== formOp.pin2) { setErroOp('PINs não coincidem'); return }
    }

    setSalvandoOp(true); setErroOp('')
    const body: Record<string, string> = { nome: formOp.nome, codigo: formOp.codigo }
    if (formOp.pin) body.pin = formOp.pin

    const res = editandoOp
      ? await fetch(`/api/operadores/${editandoOp.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/operadores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    setSalvandoOp(false)
    if (res.ok) { setModalOp(false); carregarOps() }
    else { const d = await res.json(); setErroOp(d.error ?? 'Erro ao salvar') }
  }
  async function toggleAtivoOp(op: Operador) {
    await fetch(`/api/operadores/${op.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: op.ativo ? 0 : 1 }),
    })
    carregarOps()
  }
  async function excluirOp(op: Operador) {
    if (!confirm(`Excluir operador "${op.nome}"?`)) return
    await fetch(`/api/operadores/${op.id}`, { method: 'DELETE' })
    carregarOps()
  }

  const nMesas = parseInt(config.numero_mesas) || 0

  return (
    <div className="max-w-lg mx-auto p-6 flex flex-col gap-6">
      <h1 className="text-white font-bold text-xl">Configurações</h1>

      {/* Estabelecimento */}
      <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col gap-5">
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Estabelecimento</h2>
        <Field
          label="Nome"
          value={config.nome_estabelecimento}
          onChange={v => setConfig(c => ({ ...c, nome_estabelecimento: v }))}
          placeholder="Ex: Barraca da Dona Maria"
        />
        <Field
          label="Cidade"
          value={config.cidade}
          onChange={v => setConfig(c => ({ ...c, cidade: v }))}
          placeholder="Ex: São Paulo"
        />
      </section>

      {/* Mesas */}
      <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Mesas</h2>
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5">
            Número de Mesas Disponíveis
          </label>
          <div className="flex items-center gap-4">
            {/* Botões rápidos − / + */}
            <button
              onClick={() => handleMesas(String(Math.max(1, nMesas - 1)))}
              className="w-12 h-12 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-2xl font-bold flex items-center justify-center transition-colors"
            >
              −
            </button>
            <input
              type="number"
              min="1"
              max="99"
              value={config.numero_mesas}
              onChange={e => handleMesas(e.target.value)}
              className="w-24 text-center bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-2xl font-bold focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={() => handleMesas(String(nMesas + 1))}
              className="w-12 h-12 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-2xl font-bold flex items-center justify-center transition-colors"
            >
              +
            </button>
          </div>
          {aviso && (
            <p className="text-amber-400 text-xs mt-2">⚠️ {aviso}</p>
          )}
          <p className="text-slate-500 text-xs mt-2">
            Ao salvar, mesas serão criadas ou removidas automaticamente conforme o número informado.
          </p>
        </div>
      </section>

      {/* Contato */}
      <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Contato</h2>
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5">
            📱 WhatsApp / Telefone
          </label>
          <input
            type="tel"
            value={config.telefone}
            onChange={e => setConfig(c => ({ ...c, telefone: e.target.value }))}
            placeholder="(11) 99999-9999"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg font-medium focus:outline-none focus:border-green-500 placeholder:text-slate-600 tracking-wide"
          />
          <p className="text-slate-500 text-xs mt-1.5">
            Aparece no rodapé do Cardápio PDF com ícone do WhatsApp.
          </p>
        </div>
      </section>

      {/* PIX */}
      <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Pagamento PIX</h2>
        <div>
          <Field
            label="Chave PIX"
            value={config.chave_pix}
            onChange={v => setConfig(c => ({ ...c, chave_pix: v }))}
            placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
          />
          <p className="text-slate-500 text-xs mt-1.5">
            Usada para gerar o QR Code na tela de fechamento de conta.
          </p>
        </div>
      </section>

      <Button size="lg" fullWidth onClick={salvar} disabled={salvando}>
        {salvo ? '✓ Salvo!' : salvando ? 'Salvando...' : 'Salvar Configurações'}
      </Button>

      {/* Impressora Térmica */}
      <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">🖨️ Impressora Térmica</h2>

        {/* Modo */}
        <div className="flex gap-3">
          {[
            { id: 'browser', label: '🖥️ Navegador', desc: 'Ctrl+P / diálogo do sistema' },
            { id: 'tcp',     label: '🌐 TCP/IP',    desc: 'Impressora em rede (80mm)' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setConfig(c => ({ ...c, impressora_modo: m.id }))}
              className={[
                'flex-1 p-3 rounded-xl border-2 text-left transition-all',
                config.impressora_modo === m.id
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-slate-600 bg-slate-800 hover:border-slate-400',
              ].join(' ')}
            >
              <p className="text-white font-semibold text-sm">{m.label}</p>
              <p className="text-slate-400 text-xs mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>

        {/* Configurações TCP */}
        {config.impressora_modo === 'tcp' && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-slate-400 text-xs block mb-1">IP da Impressora</label>
                <input
                  type="text"
                  value={config.impressora_ip}
                  onChange={e => setConfig(c => ({ ...c, impressora_ip: e.target.value }))}
                  placeholder="192.168.1.200"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">Porta</label>
                <input
                  type="text"
                  value={config.impressora_porta}
                  onChange={e => setConfig(c => ({ ...c, impressora_porta: e.target.value }))}
                  placeholder="9100"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={testarImpressora}
                disabled={testandoImpressora || !config.impressora_ip}
              >
                {testandoImpressora ? '⏳ Testando...' : '🖨️ Testar Impressão'}
              </Button>
              {statusImpressora === 'ok'   && <span className="text-green-400 text-sm font-semibold">✅ Impressora OK!</span>}
              {statusImpressora === 'erro' && <span className="text-red-400 text-sm font-semibold">❌ Falha — verifique IP e conexão</span>}
            </div>
            <div className="bg-slate-800 rounded-xl p-3 text-xs text-slate-400">
              <p className="font-semibold text-slate-300 mb-1">Como configurar a impressora em rede:</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Conecte a impressora USB ao PC</li>
                <li>Instale como impressora Windows normalmente</li>
                <li>Use o <span className="text-amber-400">IP do PC</span> (ex: 192.168.1.100) e porta <span className="text-amber-400">9100</span></li>
                <li>OU use impressora com porta de rede própria (Ethernet/WiFi)</li>
                <li>Clique em &quot;Testar Impressão&quot; para verificar</li>
              </ol>
            </div>
          </div>
        )}

        {config.impressora_modo === 'browser' && (
          <p className="text-slate-500 text-sm">
            A impressão será feita pelo navegador (Ctrl+P). Para impressão automática na impressora USB, configure o modo TCP/IP.
          </p>
        )}
      </section>

      {/* Operadores */}
      <section className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Operadores / Garçons</h2>
          <Button size="sm" onClick={abrirNovoOp}>+ Novo</Button>
        </div>

        {operadores.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">Nenhum operador cadastrado</p>
        ) : (
          <div className="flex flex-col gap-2">
            {operadores.map(op => (
              <div key={op.id} className="flex items-center justify-between gap-3 bg-slate-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0">
                    {op.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{op.nome}</p>
                    <p className="text-slate-400 text-xs">Código: {op.codigo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {op.perfil === 'admin' && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      ADM
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${op.ativo ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'}`}>
                    {op.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => abrirEditarOp(op)}>Editar</Button>
                  {op.codigo !== '0000' && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => toggleAtivoOp(op)}>
                        {op.ativo ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => excluirOp(op)}>✕</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal operador */}
      <Modal open={modalOp} onClose={() => setModalOp(false)} title={editandoOp ? `Editar: ${editandoOp.nome}` : 'Novo Operador'}>
        <div className="flex flex-col gap-4">
          <Field label="Nome completo *" value={formOp.nome} onChange={v => setFormOp(f => ({ ...f, nome: v }))} placeholder="Ex: João da Silva" />
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1.5">Código do operador * (4 dígitos)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={formOp.codigo}
              onChange={e => setFormOp(f => ({ ...f, codigo: e.target.value.replace(/\D/g, '') }))}
              placeholder="Ex: 0001"
              disabled={editandoOp?.codigo === '0000'}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-xl font-mono tracking-widest focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
            {editandoOp?.codigo === '0000' && (
              <p className="text-amber-500 text-xs mt-1">Código do ADM não pode ser alterado.</p>
            )}
          </div>
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1.5">
              {editandoOp ? 'Novo PIN (deixe em branco para manter)' : 'PIN numérico *'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={formOp.pin}
              onChange={e => setFormOp(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
              placeholder="4 a 6 dígitos"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 tracking-widest text-lg"
            />
          </div>
          {(formOp.pin || !editandoOp) && (
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1.5">Confirmar PIN *</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={formOp.pin2}
                onChange={e => setFormOp(f => ({ ...f, pin2: e.target.value.replace(/\D/g, '') }))}
                placeholder="Repita o PIN"
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 tracking-widest text-lg"
              />
            </div>
          )}
          {erroOp && <p className="text-red-400 text-sm">{erroOp}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" size="md" fullWidth onClick={() => setModalOp(false)}>Cancelar</Button>
            <Button size="md" fullWidth onClick={salvarOp} disabled={salvandoOp}>
              {salvandoOp ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="text-slate-300 text-sm font-medium block mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
      />
    </div>
  )
}
