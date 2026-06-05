// ── Biblioteca ESC/POS para impressora térmica 80mm ─────────────────────────
// Implementação sem dependências externas — usa comandos padrão ESC/POS

// Constantes ESC/POS
const ESC = 0x1b
const GS  = 0x1d
const LF  = 0x0a
const CR  = 0x0d

export class Escpos {
  private buf: number[] = []

  // ── Inicialização ──────────────────────────────────────────────────────────
  init(): this {
    this.buf.push(ESC, 0x40) // ESC @ — reset printer
    return this
  }

  // ── Alimentação de linha ───────────────────────────────────────────────────
  lf(n = 1): this {
    for (let i = 0; i < n; i++) this.buf.push(LF)
    return this
  }

  // ── Alinhamento ───────────────────────────────────────────────────────────
  center(): this  { this.buf.push(ESC, 0x61, 0x01); return this }
  left(): this    { this.buf.push(ESC, 0x61, 0x00); return this }
  right(): this   { this.buf.push(ESC, 0x61, 0x02); return this }

  // ── Negrito ───────────────────────────────────────────────────────────────
  bold(on = true): this {
    this.buf.push(ESC, 0x45, on ? 0x01 : 0x00)
    return this
  }

  // ── Tamanho do texto ──────────────────────────────────────────────────────
  // width: 1-8, height: 1-8
  size(width: 1 | 2 | 3 = 1, height: 1 | 2 | 3 = 1): this {
    const w = Math.min(7, width  - 1)
    const h = Math.min(7, height - 1)
    this.buf.push(GS, 0x21, (w << 4) | h)
    return this
  }

  normal(): this { return this.size(1, 1).bold(false) }

  // ── Texto ─────────────────────────────────────────────────────────────────
  text(str: string): this {
    // Codifica em latin-1 (CP850/CP1252) — suporta ã, ç, é, etc.
    for (let i = 0; i < str.length; i++) {
      const code = this.latinCode(str.charCodeAt(i))
      this.buf.push(code)
    }
    return this
  }

  textLn(str: string): this { return this.text(str).lf() }

  // ── Linha separadora ──────────────────────────────────────────────────────
  line(char = '-', cols = 48): this {
    return this.textLn(char.repeat(cols))
  }

  dashedLine(cols = 48): this {
    return this.textLn('-'.repeat(cols))
  }

  // ── Linha com dois campos (esquerda e direita) ────────────────────────────
  row(left: string, right: string, cols = 48): this {
    const spaces = cols - left.length - right.length
    const pad = Math.max(1, spaces)
    return this.textLn(left + ' '.repeat(pad) + right)
  }

  // ── Cortar papel ──────────────────────────────────────────────────────────
  // mode: 0 = corte completo, 1 = corte parcial
  cut(mode: 0 | 1 = 0): this {
    this.lf(3)
    this.buf.push(GS, 0x56, mode === 0 ? 0x41 : 0x42, 0x00)
    return this
  }

  // ── Gerar Buffer ──────────────────────────────────────────────────────────
  build(): Buffer {
    return Buffer.from(this.buf)
  }

  // ── Normalização: remove acentos → ASCII puro ────────────────────────────
  // Mais confiável que code pages — funciona em qualquer impressora
  private latinCode(code: number): number {
    if (code < 128) return code

    // Mapeia caracteres acentuados → equivalente ASCII sem acento
    const map: Record<number, number> = {
      // minúsculas
      0xe1: 0x61, // á → a
      0xe0: 0x61, // à → a
      0xe2: 0x61, // â → a
      0xe3: 0x61, // ã → a
      0xe4: 0x61, // ä → a
      0xe9: 0x65, // é → e
      0xea: 0x65, // ê → e
      0xeb: 0x65, // ë → e
      0xed: 0x69, // í → i
      0xec: 0x69, // ì → i
      0xee: 0x69, // î → i
      0xf3: 0x6f, // ó → o
      0xf4: 0x6f, // ô → o
      0xf5: 0x6f, // õ → o
      0xf2: 0x6f, // ò → o
      0xfa: 0x75, // ú → u
      0xfb: 0x75, // û → u
      0xfc: 0x75, // ü → u
      0xf9: 0x75, // ù → u
      0xe7: 0x63, // ç → c
      0xf1: 0x6e, // ñ → n
      // maiúsculas
      0xc1: 0x41, // Á → A
      0xc0: 0x41, // À → A
      0xc2: 0x41, // Â → A
      0xc3: 0x41, // Ã → A
      0xc9: 0x45, // É → E
      0xca: 0x45, // Ê → E
      0xcd: 0x49, // Í → I
      0xcc: 0x49, // Ì → I
      0xd3: 0x4f, // Ó → O
      0xd4: 0x4f, // Ô → O
      0xd5: 0x4f, // Õ → O
      0xda: 0x55, // Ú → U
      0xdb: 0x55, // Û → U
      0xc7: 0x43, // Ç → C
    }
    return map[code] ?? 0x3f // '?' para outros
  }
}

// ── Enviar para impressora via TCP (porta 9100) ───────────────────────────────
import net from 'net'

export async function printTCP(
  ip: string,
  port: number,
  data: Buffer,
  timeoutMs = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error(`Timeout: impressora ${ip}:${port} não respondeu em ${timeoutMs}ms`))
    }, timeoutMs)

    socket.connect(port, ip, () => {
      socket.write(data, (err) => {
        clearTimeout(timer)
        socket.end()
        if (err) reject(err)
        else resolve()
      })
    })

    socket.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

// ── Formatar moeda ─────────────────────────────────────────────────────────
export function brlEsc(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

// ── Truncar string com padding ─────────────────────────────────────────────
export function pad(str: string, len: number, align: 'left' | 'right' = 'left'): string {
  const s = str.slice(0, len)
  if (align === 'right') return s.padStart(len)
  return s.padEnd(len)
}
