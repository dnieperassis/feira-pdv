// ── Impressão via Windows Print Spooler (USB/local) ─────────────────────────
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Lista impressoras instaladas via wmic
 */
export function listarImpressoras(): string[] {
  const metodos = [
    () => {
      const out = execSync('wmic printer get name /format:list', { encoding: 'utf8', timeout: 8000 })
      return out.split('\n').filter(l => l.trim().startsWith('Name=')).map(l => l.replace('Name=', '').trim()).filter(Boolean)
    },
    () => {
      const out = execSync('powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"', { encoding: 'utf8', timeout: 8000 })
      return out.split('\n').map(s => s.trim()).filter(Boolean)
    },
  ]
  for (const fn of metodos) {
    try { const r = fn(); if (r.length > 0) return r } catch { /* próximo */ }
  }
  return []
}

/**
 * Descobre a porta USB/COM da impressora via wmic
 */
function getPorta(printerName: string): string {
  try {
    const escaped = printerName.replace(/"/g, '\\"')
    const out = execSync(`wmic printer where "name='${escaped}'" get PortName /format:list`, { encoding: 'utf8', timeout: 5000 })
    const match = out.match(/PortName=(.+)/)
    if (match) return match[1].trim()
  } catch { /* ignora */ }
  return ''
}

/**
 * Imprime bytes ESC/POS na impressora Windows.
 * Escreve script .ps1 para evitar problemas de escaping em linha de comando.
 */
export async function printWindows(printerName: string, data: Buffer): Promise<void> {
  if (!printerName) throw new Error('Nome da impressora não configurado')

  const ts      = Date.now()
  const prnFile = join(tmpdir(), `fpdv_${ts}.prn`)
  const ps1File = join(tmpdir(), `fpdv_${ts}.ps1`)

  // Sempre usa barras normais no PS1 (PowerShell aceita)
  const prnForPS = prnFile.replace(/\\/g, '/')

  const psScript = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Printing
try {
  $server = New-Object System.Printing.LocalPrintServer
  $q      = $server.GetPrintQueue('${printerName.replace(/'/g, "''")}')
  $job    = $q.AddJob('FeiraPDV')
  $stream = $job.JobStream
  $bytes  = [System.IO.File]::ReadAllBytes('${prnForPS}')
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Close()
  exit 0
} catch {
  Write-Error $_
  exit 1
}
`.trim()

  try {
    writeFileSync(prnFile, data)
    writeFileSync(ps1File, psScript, 'utf8')

    // Método 1: System.Printing via arquivo .ps1
    try {
      execSync(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${ps1File}"`,
        { encoding: 'utf8', timeout: 15000 }
      )
      return
    } catch (e1) {
      console.warn('[print] System.Printing falhou, tentando porta USB:', e1 instanceof Error ? e1.message : e1)
    }

    // Método 2: copy /b direto na porta USB (ex: USB002)
    const porta = getPorta(printerName)
    if (porta && (porta.startsWith('USB') || porta.startsWith('COM'))) {
      try {
        // Sintaxe correta: sem aspas no device path \\.\USB002
        execSync(`cmd /c copy /b "${prnFile}" \\\\.\\${porta}`, { encoding: 'utf8', timeout: 10000 })
        return
      } catch (e2) {
        console.warn('[print] copy /b USB falhou:', e2 instanceof Error ? e2.message : e2)
      }
    }

    throw new Error(`Não foi possível imprimir em "${printerName}". Verifique se o nome está correto e a impressora está online.`)

  } finally {
    if (existsSync(prnFile)) try { unlinkSync(prnFile) } catch { /* ignora */ }
    if (existsSync(ps1File)) try { unlinkSync(ps1File) } catch { /* ignora */ }
  }
}
