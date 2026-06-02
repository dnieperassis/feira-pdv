'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

interface Config {
  nome_estabelecimento: string
  cidade:               string
  chave_pix:            string
  numero_mesas:         string
}

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<Config>({
    nome_estabelecimento: '',
    cidade:               '',
    chave_pix:            '',
    numero_mesas:         '10',
  })
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo]       = useState(false)
  const [aviso, setAviso]       = useState('')

  useEffect(() => {
    fetch('/api/configuracoes').then(r => r.json()).then(setConfig)
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
