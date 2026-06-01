'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

interface Config {
  nome_estabelecimento: string
  cidade: string
  chave_pix: string
}

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<Config>({ nome_estabelecimento: '', cidade: '', chave_pix: '' })
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    fetch('/api/configuracoes').then(r => r.json()).then(setConfig)
  }, [])

  async function salvar() {
    setSalvando(true)
    await fetch('/api/configuracoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSalvando(false)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  return (
    <div className="max-w-lg mx-auto p-6 flex flex-col gap-6">
      <h1 className="text-white font-bold text-xl">Configurações</h1>

      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col gap-5">
        <Field
          label="Nome do Estabelecimento"
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
        <div>
          <Field
            label="Chave PIX"
            value={config.chave_pix}
            onChange={v => setConfig(c => ({ ...c, chave_pix: v }))}
            placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
          />
          <p className="text-slate-500 text-xs mt-1.5">
            Usada para gerar o QR Code PIX na tela de pagamento.
          </p>
        </div>
      </div>

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
