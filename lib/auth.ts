// Sessão do operador — armazenada no localStorage do browser

export interface Sessao {
  operadorId: number
  nome: string
  codigo: string
}

const KEY = 'fpv_sessao'

export function getSessao(): Sessao | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Sessao) : null
  } catch {
    return null
  }
}

export function setSessao(s: Sessao) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function clearSessao() {
  localStorage.removeItem(KEY)
}
