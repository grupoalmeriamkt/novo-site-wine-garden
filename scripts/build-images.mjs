/**
 * Pipeline de imagens do Wine Garden.
 *
 * Lê o acervo bruto (content-1/, content-2/ — ~1,8 GB de JPEG 3000×4500) e
 * gera em public/img/ derivados que o next/image consegue servir sem estourar
 * memória nem o repositório: um master de 2400 px de lado maior em JPEG
 * progressivo, mais os metadados (dimensões, LQIP em base64, tom dominante)
 * que evitam CLS e permitem placeholder="blur".
 *
 * O manifesto vai para src/data/generated/photo-manifest.ts e é a única ponte
 * entre o acervo bruto e o código da aplicação.
 *
 * Uso: npm run assets:images [-- --force]
 */

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = ['content-1', 'content-2']
const OUT_DIR = path.join(ROOT, 'public', 'img')
const MANIFEST = path.join(ROOT, 'src', 'data', 'generated', 'photo-manifest.ts')

const MASTER_MAX = 2400
const MASTER_QUALITY = 80
const LQIP_WIDTH = 20
const CONCURRENCY = 6

const force = process.argv.includes('--force')

/** `content-1/Cópia de MAR09236.jpg` → `mar09236` */
function slugFor(source, file) {
  const id = path
    .basename(file, path.extname(file))
    // O HFS devolve os nomes em NFD: "C" + "o" + acento combinante. Sem
    // normalizar para NFC antes, /^Cópia de/ nao casa e o prefixo vira slug.
    .normalize('NFC')
    .replace(/^Cópia de\s*/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '')
  return `${source.replace('content-', 'c')}-${id}`
}

async function listSources() {
  const out = []
  for (const source of SOURCES) {
    const dir = path.join(ROOT, source)
    if (!existsSync(dir)) continue
    const files = await readdir(dir)
    for (const file of files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort()) {
      out.push({ source, file, abs: path.join(dir, file), slug: slugFor(source, file) })
    }
  }
  return out
}

async function processOne(entry) {
  const outPath = path.join(OUT_DIR, `${entry.slug}.jpg`)
  const pipeline = sharp(entry.abs, { failOn: 'none' }).rotate()
  const meta = await pipeline.metadata()

  // .rotate() aplica a orientação EXIF; as dimensões reportadas ainda são as do
  // sensor, então trocamos manualmente quando a foto está deitada nos metadados.
  const swap = meta.orientation !== undefined && meta.orientation >= 5
  const srcW = swap ? (meta.height ?? 0) : (meta.width ?? 0)
  const srcH = swap ? (meta.width ?? 0) : (meta.height ?? 0)
  if (!srcW || !srcH) throw new Error(`sem dimensões: ${entry.abs}`)

  const scale = Math.min(1, MASTER_MAX / Math.max(srcW, srcH))
  const width = Math.round(srcW * scale)
  const height = Math.round(srcH * scale)

  if (force || !existsSync(outPath)) {
    await pipeline
      .clone()
      .resize({ width, height, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: MASTER_QUALITY, progressive: true, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toFile(outPath)
  }

  const lqip = await sharp(outPath)
    .resize({ width: LQIP_WIDTH })
    .webp({ quality: 28, alphaQuality: 60, effort: 6 })
    .toBuffer()

  const { dominant } = await sharp(outPath).stats()
  const tone =
    '#' +
    [dominant.r, dominant.g, dominant.b].map((c) => c.toString(16).padStart(2, '0')).join('')

  const { channels } = await sharp(outPath).stats()
  // Luminância relativa média — usada para decidir se a legenda entra clara ou escura.
  const luma =
    channels.length >= 3
      ? (0.2126 * channels[0].mean + 0.7152 * channels[1].mean + 0.0722 * channels[2].mean) / 255
      : 0.5

  return {
    id: entry.slug,
    src: `/img/${entry.slug}.jpg`,
    width,
    height,
    ratio: Number((width / height).toFixed(4)),
    orientation: width / height > 1.15 ? 'horizontal' : width / height < 0.87 ? 'vertical' : 'quadrada',
    blurDataURL: `data:image/webp;base64,${lqip.toString('base64')}`,
    tone,
    luma: Number(luma.toFixed(3)),
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  let done = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      try {
        results[index] = await fn(items[index], index)
      } catch (error) {
        console.error(`  ✕ ${items[index].slug}: ${error.message}`)
        results[index] = null
      }
      done++
      if (done % 20 === 0 || done === items.length) {
        process.stdout.write(`  ${done}/${items.length}\n`)
      }
    }
  })
  await Promise.all(workers)
  return results.filter(Boolean)
}

async function main() {
  const entries = await listSources()
  if (entries.length === 0) {
    console.warn('Nenhuma imagem encontrada em content-1/ ou content-2/.')
    console.warn('O site funciona sem elas: a UI cai para o placeholder da marca.')
    return
  }

  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(path.dirname(MANIFEST), { recursive: true })

  console.log(`Processando ${entries.length} imagens (master ${MASTER_MAX}px, q${MASTER_QUALITY})…`)
  const started = Date.now()
  const photos = await mapLimit(entries, CONCURRENCY, processOne)
  photos.sort((a, b) => a.id.localeCompare(b.id))

  const hash = createHash('sha1').update(photos.map((p) => p.id).join(',')).digest('hex').slice(0, 8)
  const body = `// GERADO POR scripts/build-images.mjs — NÃO EDITAR À MÃO.
// Fonte: content-1/, content-2/ · ${photos.length} imagens · assinatura ${hash}

export type PhotoAsset = {
  id: string
  src: string
  width: number
  height: number
  ratio: number
  orientation: 'horizontal' | 'vertical' | 'quadrada'
  blurDataURL: string
  tone: string
  luma: number
}

export const PHOTO_MANIFEST = ${JSON.stringify(photos, null, 2)} as const satisfies readonly PhotoAsset[]

export const PHOTO_BY_ID: Readonly<Record<string, PhotoAsset>> = Object.fromEntries(
  PHOTO_MANIFEST.map((photo) => [photo.id, photo]),
)
`
  await writeFile(MANIFEST, body, 'utf8')

  const bytes = await Promise.all(
    photos.map(async (p) => (await readFile(path.join(ROOT, 'public', p.src))).byteLength),
  )
  const totalMb = bytes.reduce((a, b) => a + b, 0) / 1024 / 1024
  console.log(
    `✓ ${photos.length} imagens · ${totalMb.toFixed(1)} MB · ${((Date.now() - started) / 1000).toFixed(1)}s`,
  )
  console.log(`✓ manifesto: ${path.relative(ROOT, MANIFEST)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
