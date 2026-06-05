// ── Impressão via Windows Print Spooler (USB/local) ─────────────────────────
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Lista as impressoras instaladas no Windows via PowerShell
 */
export function listarImpressoras(): string[] {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
      { encoding: 'utf8', timeout: 5000 }
    )
    return out.split('\n').map(s => s.trim()).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Imprime bytes ESC/POS na impressora Windows especificada.
 * Salva arquivo .prn temporário e usa "copy /b" para envio raw.
 */
export async function printWindows(printerName: string, data: Buffer): Promise<void> {
  if (!printerName) throw new Error('Nome da impressora não configurado')

  const tmpFile = join(tmpdir(), 'fpdv_' + Date.now() + '.prn')

  try {
    writeFileSync(tmpFile, data)

    // Método 1: copy /b para share local da impressora
    // Funciona quando a impressora está compartilhada ou instalada como impressora local
    const cmd1 = 'cmd /c copy /b "' + tmpFile + '" "\\\\localhost\\' + printerName + '"'
    try {
      execSync(cmd1, { encoding: 'utf8', timeout: 10000 })
      return
    } catch { /* tenta método 2 */ }

    // Método 2: PowerShell com System.Printing (RAW job)
    const psCmd = [
      'Add-Type -AssemblyName System.Printing',
      '$server = New-Object System.Printing.LocalPrintServer',
      '$queue = $server.GetPrintQueue("' + printerName.replace(/"/g, '') + '")',
      '$job = $queue.AddJob("FeiraPDV")',
      '$stream = $job.JobStream',
      '$bytes = [System.IO.File]::ReadAllBytes("' + tmpFile.replace(/\\/g, '/') + '")',
      '$stream.Write($bytes, 0, $bytes.Length)',
      '$stream.Close()',
    ].join('; ')

    execSync('powershell -NoProfile -Command "' + psCmd + '"', {
      encoding: 'utf8',
      timeout: 15000,
    })

  } finally {
    if (existsSync(tmpFile)) {
      try { unlinkSync(tmpFile) } catch { /* ignora */ }
    }
  }
}
