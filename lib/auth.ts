export type Perfil = 'admin' | 'operador'

export interface Sessao {
  operadorId: number
  nome: string
  codigo: string
  perfil: Perfil
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

export function isAdmin(): boolean {
  return getSessao()?.perfil === 'admin'
}
