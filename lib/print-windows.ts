// ── Impressão via Windows Print Spooler (USB/local) ─────────────────────────
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Lista impressoras instaladas via wmic (mais compatível que Get-Printer)
 */
export function listarImpressoras(): string[] {
  const metodos = [
    // Método 1: wmic (funciona em Windows 7/8/10/11 sem necessidade de admin)
    () => {
      const out = execSync('wmic printer get name /format:list', {
        encoding: 'utf8', timeout: 8000,
      })
      return out
        .split('\n')
        .filter(l => l.startsWith('Name='))
        .map(l => l.replace('Name=', '').trim())
        .filter(Boolean)
    },
    // Método 2: PowerShell Get-Printer
    () => {
      const out = execSync(
        'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
        { encoding: 'utf8', timeout: 8000 }
      )
      return out.split('\n').map(s => s.trim()).filter(Boolean)
    },
  ]

  for (const fn of metodos) {
    try {
      const lista = fn()
      if (lista.length > 0) return lista
    } catch { /* tenta próximo */ }
  }
  return []
}

/**
 * Imprime bytes ESC/POS na impressora Windows via System.Printing (RAW job).
 * Funciona sem precisar compartilhar a impressora.
 */
export async function printWindows(printerName: string, data: Buffer): Promise<void> {
  if (!printerName) throw new Error('Nome da impressora não configurado')

  const tmpFile = join(tmpdir(), 'fpdv_' + Date.now() + '.prn')

  try {
    writeFileSync(tmpFile, data)

    // Método principal: System.Printing RAW job (não precisa de share)
    const tmpSlash = tmpFile.replace(/\\/g, '\\\\')
    const printer  = printerName.replace(/"/g, '').replace(/'/g, '')

    const psLines = [
      'Add-Type -AssemblyName System.Printing',
      '$flags  = [System.Printing.PrintSystemDesiredAccess]::AdministratePrinter',
      '$server = New-Object System.Printing.LocalPrintServer',
      '$q = $server.GetPrintQueue("' + printer + '")',
      '$job = $q.AddJob("FeiraPDV")',
      '$stream = $job.JobStream',
      '$bytes  = [System.IO.File]::ReadAllBytes("' + tmpSlash + '")',
      '$stream.Write($bytes, 0, $bytes.Length)',
      '$stream.Close()',
      'exit 0',
    ]

    try {
      execSync(
        'powershell -NoProfile -NonInteractive -Command "' + psLines.join('; ') + '"',
        { encoding: 'utf8', timeout: 15000 }
      )
      return
    } catch { /* tenta método 2 */ }

    // Método 2: copy /b para porta USB direta
    // Descobre a porta da impressora via wmic
    let porta = ''
    try {
      const portaOut = execSync(
        'wmic printer where name="' + printer + '" get PortName /format:list',
        { encoding: 'utf8', timeout: 5000 }
      )
      const match = portaOut.match(/PortName=(.+)/)
      if (match) porta = match[1].trim()
    } catch { /* ignora */ }

    if (porta && (porta.startsWith('USB') || porta.startsWith('COM'))) {
      execSync('cmd /c copy /b "' + tmpFile + '" "\\\\.\\"' + porta + '"',
        { encoding: 'utf8', timeout: 10000 })
      return
    }

    // Método 3: copy /b para share local (requer impressora compartilhada)
    execSync('cmd /c copy /b "' + tmpFile + '" "\\\\localhost\\' + printer + '"',
      { encoding: 'utf8', timeout: 10000 })

  } finally {
    if (existsSync(tmpFile)) {
      try { unlinkSync(tmpFile) } catch { /* ignora */ }
    }
  }
}
