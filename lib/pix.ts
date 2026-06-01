// Gerador de payload PIX EMV (BACEN/BCB — Pix Copia e Cola)

function field(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`
}

function crc16ccitt(str: string): string {
  let crc = 0xffff
  for (const char of str) {
    crc ^= char.charCodeAt(0) << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0')
}

export interface PixParams {
  chave: string
  valor: number
  nome?: string
  cidade?: string
  txid?: string
}

export function gerarPixPayload({ chave, valor, nome = 'FEIRA PDV', cidade = 'SAO PAULO', txid }: PixParams): string {
  const nomeClean   = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').substring(0, 25).toUpperCase()
  const cidadeClean = cidade.normalize('NFD').replace(/[̀-ͯ]/g, '').substring(0, 15).toUpperCase()
  const txidClean   = (txid ?? `FPV${Date.now()}`).replace(/[^A-Za-z0-9]/g, '').substring(0, 25)

  const merchantInfo   = field('00', 'BR.GOV.BCB.PIX') + field('01', chave)
  const additionalData = field('05', txidClean)

  const payload =
    field('00', '01') +
    field('26', merchantInfo) +
    field('52', '0000') +
    field('53', '986') +
    (valor > 0 ? field('54', valor.toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', nomeClean) +
    field('60', cidadeClean) +
    field('62', additionalData) +
    '6304'

  return payload + crc16ccitt(payload)
}
