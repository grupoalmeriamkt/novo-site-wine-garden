/**
 * Converte as fontes oficiais do projeto (TTF em tipografias/) para WOFF2 em
 * src/fonts/, que é o formato que o next/font/local auto-hospeda.
 *
 * Preferimos next/font/local aos TTFs originais em vez de next/font/google
 * porque as fontes fornecidas pela marca são a fonte de verdade e porque o
 * build deixa de depender de rede.
 *
 * Uso: node scripts/build-fonts.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import wawoff from 'wawoff2'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'tipografias')
const OUT = path.join(ROOT, 'src', 'fonts')

const FONTS = [
  ['InstrumentSerif-Regular.ttf', 'InstrumentSerif-Regular.woff2'],
  ['InstrumentSerif-Italic.ttf', 'InstrumentSerif-Italic.woff2'],
  ['JetBrainsMono-VariableFont_wght.ttf', 'JetBrainsMono-Variable.woff2'],
  ['JetBrainsMono-Italic-VariableFont_wght.ttf', 'JetBrainsMono-Italic-Variable.woff2'],
]

await mkdir(OUT, { recursive: true })
for (const [from, to] of FONTS) {
  const ttf = await readFile(path.join(SRC, from))
  const woff2 = await wawoff.compress(ttf)
  await writeFile(path.join(OUT, to), Buffer.from(woff2))
  const pct = (100 - (woff2.length / ttf.length) * 100).toFixed(0)
  console.log(`✓ ${to}  ${(ttf.length / 1024).toFixed(0)} KB → ${(woff2.length / 1024).toFixed(0)} KB (-${pct}%)`)
}
