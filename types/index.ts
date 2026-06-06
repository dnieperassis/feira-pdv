export type MesaStatus = 'livre' | 'ocupada' | 'aguardando'
export type ComandaStatus = 'aberta' | 'fechada' | 'cancelada'
export type ItemStatus = 'pendente' | 'produzindo' | 'pronto' | 'entregue' | 'cancelado'
export type FormaPagamento = 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito'
export type MovCaixaTipo = 'abertura' | 'sangria' | 'reforco' | 'fechamento'
export type ComandaTipo = 'mesa' | 'balcao'

export interface Categoria {
  id: number
  nome: string
  ordem: number
  ativo: number
  is_adicional: number
  criado_em: string
}

export interface Produto {
  id: number
  categoria_id: number | null
  categoria_nome?: string
  nome: string
  preco: number
  descricao: string | null
  disponivel: number
  estoque_atual: number
  estoque_minimo: number
  controla_estoque: number
  criado_em: string
}

export interface Mesa {
  id: number
  numero: number
  nome: string | null
  status: MesaStatus
  capacidade: number
  posicao_x: number
  posicao_y: number
  comanda_id?: number | null
  total_comanda?: number
}

export interface Comanda {
  id: number
  mesa_id: number | null
  mesa_numero?: number | null
  tipo: ComandaTipo
  status: ComandaStatus
  observacao: string | null
  aberta_em: string
  fechada_em: string | null
  total: number
  itens?: ComandaItem[]
}

export interface ComandaItem {
  id: number
  comanda_id: number
  produto_id: number
  produto_nome?: string
  categoria_nome?: string | null
  quantidade: number
  preco_unitario: number
  total: number
  observacao: string | null
  status: ItemStatus
  lancado_em: string
  parent_item_id?: number | null
}

export interface Pagamento {
  id: number
  comanda_id: number
  forma: FormaPagamento
  valor: number
  troco: number
  pago_em: string
}

export interface MovimentacaoCaixa {
  id: number
  tipo: MovCaixaTipo
  valor: number
  observacao: string | null
  criado_em: string
}

export interface EstoqueMovimentacao {
  id: number
  produto_id: number
  produto_nome?: string
  tipo: 'entrada' | 'saida' | 'ajuste'
  quantidade: number
  motivo: string | null
  criado_em: string
}

export interface ResumoVendas {
  total_vendas: number
  total_comandas: number
  ticket_medio: number
  total_dinheiro: number
  total_pix: number
  total_cartao: number
}
