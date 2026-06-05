// ── Impressão RAW via Win32 API (winspool.drv) ───────────────────────────────
// Único método correto para enviar bytes ESC/POS a impressora térmica Windows
// sem renderização GDI (que ignoraria os comandos da impressora)

import { execSync } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Lista impressoras via wmic (compatível W7/10/11)
 */
export function listarImpressoras(): string[] {
  const metodos = [
    () => {
      const out = execSync('wmic printer get name /format:list', { encoding: 'utf8', timeout: 8000 })
      return out.split('\n')
        .filter(l => l.trim().startsWith('Name='))
        .map(l => l.replace('Name=', '').trim())
        .filter(Boolean)
    },
    () => {
      const out = execSync(
        'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
        { encoding: 'utf8', timeout: 8000 }
      )
      return out.split('\n').map(s => s.trim()).filter(Boolean)
    },
  ]
  for (const fn of metodos) {
    try { const r = fn(); if (r.length > 0) return r } catch { /* próximo */ }
  }
  return []
}

// ── Script PowerShell com Win32 RAW printing ─────────────────────────────────
// Usa winspool.drv diretamente via P/Invoke para enviar bytes como datatype=RAW
// Isso é o mesmo que aplicações profissionais de PDV usam no Windows

const PS_RAW_PRINT_CODE = String.raw`
using System;
using System.Runtime.InteropServices;

public class Win32RawPrint {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Auto)]
    public struct DOCINFO {
        [MarshalAs(UnmanagedType.LPTStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPTStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPTStr)] public string pDataType;
    }

    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, ref DOCINFO pDocInfo);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, Int32 dwCount, out Int32 dwWritten);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    public static bool SendRaw(string printerName, byte[] bytes) {
        IntPtr hPrinter = IntPtr.Zero;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            throw new Exception("OpenPrinter falhou: " + Marshal.GetLastWin32Error());
        }
        try {
            var di = new DOCINFO { pDocName = "FeiraPDV", pDataType = "RAW" };
            if (!StartDocPrinter(hPrinter, 1, ref di))
                throw new Exception("StartDocPrinter falhou: " + Marshal.GetLastWin32Error());
            StartPagePrinter(hPrinter);
            Int32 written = 0;
            WritePrinter(hPrinter, bytes, bytes.Length, out written);
            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
            return written == bytes.Length;
        } finally {
            ClosePrinter(hPrinter);
        }
    }
}
`

/**
 * Envia bytes ESC/POS para impressora Windows via Win32 RAW (winspool.drv).
 * Escreve script .ps1 temporário para evitar problemas de escaping.
 */
export async function printWindows(printerName: string, data: Buffer): Promise<void> {
  if (!printerName) throw new Error('Nome da impressora não configurado')

  const ts      = Date.now()
  const prnFile = join(tmpdir(), `fpdv_${ts}.prn`)
  const ps1File = join(tmpdir(), `fpdv_${ts}.ps1`)

  // PowerShell usa / sem problemas
  const prnPS = prnFile.replace(/\\/g, '/')
  // Escapa aspas simples para PowerShell
  const printerPS = printerName.replace(/'/g, "''")

  // IMPORTANTE: usar apenas ASCII no script PS1 para evitar corrupcao de encoding
  const psScript = [
    '$ErrorActionPreference = \'Stop\'',
    'Add-Type -Language CSharp -TypeDefinition @\'',
    PS_RAW_PRINT_CODE,
    '\'@',
    '',
    `$bytes  = [System.IO.File]::ReadAllBytes('${prnPS}')`,
    `$result = [Win32RawPrint]::SendRaw('${printerPS}', $bytes)`,
    'if (-not $result) {',
    '    throw "SendRaw retornou false - impressora offline ou ocupada"',
    '}',
    'Write-Host "OK bytes enviados"',
    'exit 0',
  ].join('\r\n')

  try {
    writeFileSync(prnFile, data)
    // BOM UTF-8 (0xEF 0xBB 0xBF) faz PowerShell ler corretamente em qualquer locale
    const bom = Buffer.from([0xEF, 0xBB, 0xBF])
    writeFileSync(ps1File, Buffer.concat([bom, Buffer.from(psScript, 'utf8')]))

    execSync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${ps1File}"`,
      { encoding: 'utf8', timeout: 20000 }
    )

  } finally {
    if (existsSync(prnFile)) try { unlinkSync(prnFile) } catch { /* ok */ }
    if (existsSync(ps1File)) try { unlinkSync(ps1File) } catch { /* ok */ }
  }
}
