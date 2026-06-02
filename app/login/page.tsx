'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { setSessao, type Perfil } from '@/lib/auth'

interface Operador { id: number; nome: string; codigo: string }

const PAD = ['1','2','3','4','5','6','7','8','9','←','0','✓']

export default function LoginPage() {
  const router = useRouter()
  const [operadores, setOperadores] = useState<Operador[]>([])
  const [selecionado, setSelecionado] = useState<Operador | null>(null)
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [shake, setShake] = useState(false)

  // Modo setup: sem operadores cadastrados
  const [setupNome, setSetupNome] = useState('')
  const [setupCodigo, setSetupCodigo] = useState('')
  const [setupPin, setSetupPin] = useState('')
  const [criando, setCriando] = useState(false)
  const [erroSetup, setErroSetup] = useState('')

  useEffect(() => {
    fetch('/api/operadores').then(r => r.json()).then(setOperadores)
  }, [])

  function teclarPin(tecla: string) {
    if (tecla === '←') {
      setPin(p => p.slice(0, -1))
      setErro('')
      return
    }
    if (tecla === '✓') {
      confirmar()
      return
    }
    if (pin.length >= 6) return
    const novo = pin + tecla
    setPin(novo)
    if (novo.length === 4 || novo.length === 6) {
      confirmarComPin(novo)
    }
  }

  async function confirmarComPin(p: string) {
    if (!selecionado) return
    setEntrando(true)
    setErro('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: selecionado.codigo, pin: p }),
    })
    setEntrando(false)

    if (res.ok) {
      const op = await res.json()
      setSessao({ operadorId: op.id, nome: op.nome, codigo: op.codigo, perfil: op.perfil as Perfil })
      router.replace('/mesas')
    } else {
      setErro('PIN incorreto')
      setShake(true)
      setTimeout(() => { setShake(false); setPin('') }, 600)
    }
  }

  async function confirmar() {
    if (pin.length < 4) { setErro('PIN incompleto'); return }
    await confirmarComPin(pin)
  }

  async function criarPrimeiroOperador() {
    if (!setupNome.trim() || !setupCodigo.trim()) { setErroSetup('Preencha nome e código'); return }
    if (!/^\d{4,6}$/.test(setupPin)) { setErroSetup('PIN deve ter 4 a 6 dígitos'); return }
    setCriando(true)
    const res = await fetch('/api/operadores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: setupNome, codigo: setupCodigo, pin: setupPin }),
    })
    setCriando(false)
    if (res.ok) {
      const ops = await fetch('/api/operadores').then(r => r.json())
      setOperadores(ops)
      setErroSetup('')
    } else {
      const d = await res.json()
      setErroSetup(d.error ?? 'Erro ao criar operador')
    }
  }

  // ── SETUP INICIAL ─────────────────────────────────
  if (operadores.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <span className="text-amber-400 font-bold text-3xl mb-2">⚡ Feira PDV</span>
        <p className="text-slate-400 mb-8">Crie o primeiro operador para começar</p>

        <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
          <h2 className="text-white font-semibold text-lg">Configuração Inicial</h2>
          <input
            type="text"
            placeholder="Nome completo"
            value={setupNome}
            onChange={e => setSetupNome(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
          />
          <input
            type="text"
            placeholder="Código do operador (ex: 01, ADMIN)"
            value={setupCodigo}
            onChange={e => setSetupCodigo(e.target.value.toUpperCase())}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
          />
          <input
            type="password"
            inputMode="numeric"
            placeholder="PIN (4 a 6 dígitos)"
            maxLength={6}
            value={setupPin}
            onChange={e => setSetupPin(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
          />
          {erroSetup && <p className="text-red-400 text-sm">{erroSetup}</p>}
          <button
            onClick={criarPrimeiroOperador}
            disabled={criando}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-lg transition-colors disabled:opacity-50"
          >
            {criando ? 'Criando...' : 'Criar e Entrar'}
          </button>
        </div>
      </div>
    )
  }

  // ── SELEÇÃO DE OPERADOR ────────────────────────────
  if (!selecionado) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 gap-8">
        <div className="text-center">
          <span className="text-amber-400 font-bold text-4xl">⚡ Feira PDV</span>
          <p className="text-slate-400 mt-2">Selecione seu operador</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full max-w-2xl">
          {operadores.map(op => (
            <button
              key={op.id}
              onClick={() => { setSelecionado(op); setPin(''); setErro('') }}
              className="flex flex-col items-center justify-center gap-2 p-5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border-2 border-slate-600 hover:border-amber-500 rounded-2xl transition-all min-h-[110px] active:scale-95"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-400 font-bold text-xl">
                {op.nome.charAt(0).toUpperCase()}
              </div>
              <span className="text-white font-semibold text-sm text-center leading-tight">{op.nome}</span>
              <span className="text-slate-400 text-xs">#{op.codigo}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── TECLADO PIN ────────────────────────────────────
  const dots = Array.from({ length: 6 }, (_, i) => i < pin.length ? '●' : '○')

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-400 font-bold text-2xl mx-auto mb-3">
          {selecionado.nome.charAt(0).toUpperCase()}
        </div>
        <p className="text-white font-semibold text-lg">{selecionado.nome}</p>
        <p className="text-slate-400 text-sm">#{selecionado.codigo}</p>
      </div>

      {/* Dots PIN */}
      <div className={`flex gap-3 transition-all ${shake ? 'animate-bounce' : ''}`}>
        {dots.map((d, i) => (
          <span
            key={i}
            className={`text-3xl transition-colors ${i < pin.length ? 'text-amber-400' : 'text-slate-600'}`}
          >
            {d}
          </span>
        ))}
      </div>

      {erro && <p className="text-red-400 font-semibold">{erro}</p>}

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {PAD.map(tecla => {
          const isConfirm   = tecla === '✓'
          const isBackspace = tecla === '←'
          return (
            <button
              key={tecla}
              onClick={() => teclarPin(tecla)}
              disabled={entrando || (isConfirm && pin.length < 4)}
              className={[
                'h-16 rounded-2xl text-2xl font-bold transition-all active:scale-90 disabled:opacity-40',
                isConfirm
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : isBackspace
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white border border-slate-600',
              ].join(' ')}
            >
              {entrando && isConfirm ? '...' : tecla}
            </button>
          )
        })}
      </div>

      <button
        onClick={() => { setSelecionado(null); setPin(''); setErro('') }}
        className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
      >
        ← Trocar operador
      </button>
    </div>
  )
}
