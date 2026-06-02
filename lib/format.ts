// Formata valor monetário no padrão brasileiro: R$ 1.234,50
export function brl(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Converte string de input (aceita vírgula ou ponto) para número
export function parseBRL(str: string): number {
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0
}
