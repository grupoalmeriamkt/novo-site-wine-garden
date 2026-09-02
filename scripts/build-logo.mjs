/**
 * Prepara os dois lockups do logotipo para uso em tela.
 *
 * Dois problemas dos arquivos originais precisam ser resolvidos aqui:
 *
 * 1. VIEWBOX. Os SVGs vêm num canvas quadrado de 1000×1000 com o lockup
 *    horizontal (proporção real ~5:1) centralizado dentro. Usado assim, o logo
 *    carrega uma moldura vazia enorme e fica impossível alinhar no header.
 *    Calculamos a caixa real rasterizando com o sharp e lendo o alpha.
 *
 * 2. COR. O fill vive num `<style>` com `.cls-1`, que colide entre SVGs inline
 *    na mesma página. Trocamos por `currentColor`, e aí um único arquivo serve
 *    todas as atmosferas — que é o que o sistema de cor deste site precisa.
 *
 * Uso: node scripts/build-logo.mjs
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { optimize } from 'svgo'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(ROOT, 'Logos-wine-garden', 'SVG')
const OUT_DIR = path.join(ROOT, 'public', 'brand', 'logo')

const TARGETS = [
  {
    from: 'WineGarden-RGB-logotipo-horizontal-preta-fundotransp.svg',
    to: 'wordmark-horizontal.svg',
    key: 'horizontal',
  },
  {
    from: 'WineGarden-RGB-logotipo-quadrada-preta-fundotransp.svg',
    to: 'wordmark-empilhado.svg',
    key: 'empilhado',
  },
]

/** Rasteriza e devolve a caixa dos pixels realmente pintados. */
async function alphaBounds(svg, viewW, viewH, raster = 1400) {
  const scale = raster / Math.max(viewW, viewH)
  const w = Math.round(viewW * scale)
  const h = Math.round(viewH * scale)

  const { data, info } = await sharp(Buffer.from(svg), { density: 300 })
    .resize(w, h, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let minX = info.width
  let minY = info.height
  let maxX = -1
  let maxY = -1
  const stride = info.channels

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * stride + (stride - 1)]
      if (alpha > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) throw new Error('nenhum pixel opaco — SVG vazio?')

  // De volta para unidades do viewBox, com uma folga de meio pixel para o
  // antialias das hastes finíssimas do lettering não ser cortado.
  const pad = 0.5 / scale
  return {
    x: minX / scale - pad,
    y: minY / scale - pad,
    width: (maxX - minX + 1) / scale + pad * 2,
    height: (maxY - minY + 1) / scale + pad * 2,
  }
}

const round = (n) => Math.round(n * 100) / 100

const lockups = {}

for (const target of TARGETS) {
  const original = await readFile(path.join(SRC_DIR, target.from), 'utf8')

  // O lettering vem do Illustrator com as letras divididas entre <path>,
  // <polygon> e <rect> — o "I" e o "N", por exemplo, são retângulos. Extrair só
  // os `d` de <path> perderia essas letras (o header mostrava "W GARD").
  // convertShapeToPath normaliza tudo para <path> antes da extração.
  const normalized = optimize(original, {
    multipass: true,
    plugins: [
      { name: 'inlineStyles', params: { onlyMatchedOnce: false, removeMatchedSelectors: true } },
      'convertStyleToAttrs',
      { name: 'convertShapeToPath', params: { convertArcs: true } },
      {
        name: 'preset-default',
        params: {
          overrides: {
            convertShapeToPath: { convertArcs: true },
            // Sem isto o preset funde o lettering inteiro em dois paths, e a
            // abertura perde o escalonamento letra a letra.
            mergePaths: false,
          },
        },
      },
      'removeStyleElement',
      'removeDimensions',
    ],
  }).data

  const raw = normalized

  const viewMatch = raw.match(/viewBox="([\d.\s-]+)"/)
  if (!viewMatch) throw new Error(`sem viewBox: ${target.from}`)
  const [, , viewW = 0, viewH = 0] = viewMatch[1].trim().split(/\s+/).map(Number)

  const box = await alphaBounds(raw, viewW, viewH)

  // Remove o bloco <style>/<defs> e a referência de classe; o fill passa a vir
  // do elemento raiz, que herda a cor do contexto.
  const body = raw
    .replace(/<\?xml[^>]*\?>\s*/, '')
    .replace(/<defs>[\s\S]*?<\/defs>\s*/g, '')
    .replace(/\sclass="cls-\d+"/g, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()

  const viewBox = `${round(box.x)} ${round(box.y)} ${round(box.width)} ${round(box.height)}`
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="currentColor" role="img"><title>Wine Garden</title>${body}</svg>`

  await writeFile(path.join(OUT_DIR, target.to), out, 'utf8')

  // Os `d` de cada path viram um módulo TS para o componente React inlinar o
  // logo sem uma requisição extra — o wordmark aparece no primeiro paint do
  // header e do preloader, onde um <img> custaria um round-trip.
  lockups[target.key] = {
    viewBox,
    ratio: Number((box.width / box.height).toFixed(4)),
    paths: [...body.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]),
  }

  console.log(
    `✓ ${target.to} · viewBox ${viewBox} · proporção ${(box.width / box.height).toFixed(2)}:1 · ${(
      Buffer.byteLength(out) / 1024
    ).toFixed(1)} KB`,
  )
}

const module = `// GERADO POR scripts/build-logo.mjs — NÃO EDITAR À MÃO.
// Fonte: Logos-wine-garden/SVG/ · viewBox recortado à caixa real do desenho.

export type Lockup = {
  viewBox: string
  /** largura ÷ altura — o horizontal é ~4,91:1, como o manual mede. */
  ratio: number
  paths: readonly string[]
}

export const LOCKUPS = ${JSON.stringify(lockups, null, 2)} as const satisfies Record<string, Lockup>

export type LockupName = keyof typeof LOCKUPS
`

await writeFile(path.join(ROOT, 'src', 'data', 'generated', 'logo.ts'), module, 'utf8')
console.log('✓ src/data/generated/logo.ts')
