/**
 * Pipeline de SVG da marca Wine Garden.
 *
 * Os arquivos originais vêm do Illustrator: cores presas em <style> com classes
 * `.cls-1`, o que colide quando dois SVGs viram inline na mesma página, e mapas
 * pontilhados de ~1,3 MB com milhares de <path> minúsculos. Este script roda o
 * SVGO com prefixIds (isola as classes), remove filtros de sombra que não
 * sobrevivem bem a escala, e grava tudo em public/brand/ com um manifesto de
 * viewBox para o componente React saber a proporção sem carregar o arquivo.
 *
 * Uso: npm run assets:svg
 */

import { mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { optimize } from 'svgo'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'brand')
const MANIFEST = path.join(ROOT, 'src', 'data', 'generated', 'svg-manifest.ts')

/** Cada grupo diz de onde vem, para onde vai e como o nome vira slug. */
const GROUPS = [
  {
    key: 'logo',
    dir: path.join(ROOT, 'Logos-wine-garden', 'SVG'),
    out: path.join(OUT, 'logo'),
    match: /\.svg$/i,
    slug: (f) =>
      f
        .replace(/^WineGarden-RGB-logotipo-/, '')
        .replace(/\.svg$/i, '')
        .toLowerCase(),
  },
  {
    key: 'selo',
    dir: path.join(ROOT, 'elementos-wine', 'SVG'),
    out: path.join(OUT, 'selos'),
    match: /selo-.*\.svg$/i,
    slug: (f) => f.replace(/^ElementosAuxiliares-WineGarden-selo-/, '').replace(/\.svg$/i, '').toLowerCase(),
  },
  {
    key: 'mapa',
    dir: path.join(ROOT, 'elementos-wine', 'SVG'),
    out: path.join(OUT, 'mapas'),
    match: /mapa-(?!pontilhado).*\.svg$/i,
    slug: (f) => f.replace(/^ElementosAuxiliares-WineGarden-mapa-/, '').replace(/\.svg$/i, '').toLowerCase(),
  },
  {
    key: 'mapa-pontilhado',
    dir: path.join(ROOT, 'elementos-wine', 'SVG'),
    out: path.join(OUT, 'mapas'),
    match: /mapa-pontilhado-.*\.svg$/i,
    slug: (f) =>
      'pontilhado-' +
      f.replace(/^ElementosAuxiliares-WineGarden-mapa-pontilhado-/, '').replace(/\.svg$/i, '').toLowerCase(),
    aggressive: true,
  },
  {
    key: 'taca',
    dir: path.join(ROOT, 'elementos-wine', 'SVG'),
    out: path.join(OUT, 'tacas'),
    match: /ta[çc]a-.*\.svg$/i,
    slug: (f) =>
      f
        .replace(/^ElementosAuxiliares-WineGarden-ta[çc]a-/, '')
        .replace(/\.svg$/i, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase(),
  },
]

/** Acentos e cedilha nos nomes de arquivo viram URLs frágeis. */
function asciiSlug(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function configFor(id, aggressive) {
  return {
    multipass: true,
    floatPrecision: aggressive ? 1 : 2,
    plugins: [
      // PRIMEIRO, e antes do preset: converte <style>.cls-1{fill:#891a3d}</style>
      // em fill="#891a3d" no próprio nó. Sem isso, dois SVGs inline na mesma
      // página sobrescrevem as classes um do outro.
      //
      // `onlyMatchedOnce: false` é essencial: por padrão o plugin só inline um
      // seletor que casa com UM elemento, e nestes arquivos do Illustrator a
      // mesma `.cls-2` pinta dezenas de paths. Com o padrão, o <style> era
      // removido depois e os SVGs saíam pretos.
      { name: 'inlineStyles', params: { onlyMatchedOnce: false, removeMatchedSelectors: true } },
      'convertStyleToAttrs',
      {
        name: 'preset-default',
        params: {
          overrides: {
            // IDs de gradiente/filtro colidem entre SVGs inline na mesma página.
            cleanupIds: { minify: false },
            convertPathData: {
              floatPrecision: aggressive ? 1 : 2,
              transformPrecision: aggressive ? 2 : 4,
            },
          },
        },
      },
      'removeStyleElement',
      'removeDimensions',
      'sortAttrs',
      { name: 'prefixIds', params: { prefix: id, delim: '-' } },
      ...(aggressive ? ['mergePaths', 'removeUselessStrokeAndFill'] : []),
    ],
  }
}

function viewBoxOf(svg) {
  const match = svg.match(/viewBox="([\d.\-\s]+)"/)
  if (!match) return null
  const [, box] = match
  const [minX, minY, w, h] = box.trim().split(/\s+/).map(Number)
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null
  return { viewBox: `${minX} ${minY} ${w} ${h}`, width: w, height: h }
}

async function main() {
  const manifest = {}
  let savedBytes = 0

  for (const group of GROUPS) {
    if (!existsSync(group.dir)) {
      console.warn(`· grupo "${group.key}" ignorado: ${path.relative(ROOT, group.dir)} não existe`)
      continue
    }
    await mkdir(group.out, { recursive: true })
    // O HFS devolve os nomes em NFD ("ta" + c + cedilha combinante); sem
    // normalizar para NFC, /taça/ não casa com o arquivo que aparece como "taça".
    const files = (await readdir(group.dir))
      .filter((f) => group.match.test(f.normalize('NFC')))
      .sort()

    for (const file of files) {
      const abs = path.join(group.dir, file)
      const raw = await readFile(abs, 'utf8')
      const before = (await stat(abs)).size
      const id = asciiSlug(group.slug(file.normalize('NFC')))

      let result
      try {
        result = optimize(raw, configFor(id, group.aggressive))
      } catch (error) {
        console.error(`  ✕ ${file}: ${error.message}`)
        continue
      }

      const outFile = path.join(group.out, `${id}.svg`)
      await writeFile(outFile, result.data, 'utf8')
      savedBytes += before - Buffer.byteLength(result.data)

      const box = viewBoxOf(result.data)
      const publicPath = '/' + path.relative(path.join(ROOT, 'public'), outFile).split(path.sep).join('/')
      manifest[`${group.key}:${id}`] = {
        id,
        group: group.key,
        src: publicPath,
        bytes: Buffer.byteLength(result.data),
        ...(box ?? {}),
      }

      const kb = (n) => (n / 1024).toFixed(1)
      if (before > 100_000) {
        console.log(`  ${id}: ${kb(before)} KB → ${kb(Buffer.byteLength(result.data))} KB`)
      }
    }
    console.log(`✓ ${group.key}: ${files.length} arquivos`)
  }

  await mkdir(path.dirname(MANIFEST), { recursive: true })
  const keys = Object.keys(manifest).sort()
  const ordered = Object.fromEntries(keys.map((k) => [k, manifest[k]]))
  await writeFile(
    MANIFEST,
    `// GERADO POR scripts/build-svg.mjs — NÃO EDITAR À MÃO.
// Fonte: Logos-wine-garden/SVG/, elementos-wine/SVG/ · ${keys.length} arquivos

export type SvgAsset = {
  id: string
  group: string
  src: string
  bytes: number
  viewBox?: string
  width?: number
  height?: number
}

export const SVG_MANIFEST = ${JSON.stringify(ordered, null, 2)} as const

export function svgAsset(key: string): SvgAsset | undefined {
  return (SVG_MANIFEST as Record<string, SvgAsset>)[key]
}
`,
    'utf8',
  )

  console.log(`✓ ${keys.length} SVGs · ${(savedBytes / 1024 / 1024).toFixed(2)} MB economizados`)
  console.log(`✓ manifesto: ${path.relative(ROOT, MANIFEST)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
