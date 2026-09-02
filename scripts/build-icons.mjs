/**
 * Gera favicon, ícones de app e a imagem de compartilhamento estática.
 *
 * Tudo sai do logotipo oficial — nada é redesenhado. O ícone usa o lockup
 * EMPILHADO (proporção 1,04:1), que é o que a identidade prevê para assinaturas
 * compactas e selos; o horizontal viraria um risco ilegível em 32 px.
 *
 * Uso: node scripts/build-icons.mjs
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LOGO = path.join(ROOT, 'public', 'brand', 'logo', 'wordmark-empilhado.svg')
const APP = path.join(ROOT, 'src', 'app')
const PUB = path.join(ROOT, 'public')

/* Cores oficiais — repetidas aqui porque este script roda fora do bundle e
   não tem acesso aos tokens CSS. */
const UVA = '#3f0a25'
const OFFWHITE = '#f7f9ea'

const svg = await readFile(LOGO, 'utf8')

/** Compõe o logotipo centrado sobre um fundo, com respiro proporcional. */
async function marca({ tamanho, fundo, tinta, respiro = 0.22 }) {
  const interno = Math.round(tamanho * (1 - respiro * 2))
  const logo = await sharp(Buffer.from(svg.replaceAll('currentColor', tinta)), { density: 400 })
    .resize({ width: interno, height: interno, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  return sharp({
    create: { width: tamanho, height: tamanho, channels: 4, background: fundo },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer()
}

await mkdir(APP, { recursive: true })

/* --------------------------------------------------------------- favicon */

// 48 px cobre bem as escalas que o navegador reamostra (16, 32).
const favicon = await marca({ tamanho: 48, fundo: UVA, tinta: OFFWHITE, respiro: 0.16 })
await writeFile(path.join(APP, 'icon.png'), favicon)

/* Ícone de app / Android. */
await writeFile(
  path.join(PUB, 'icon-512.png'),
  await marca({ tamanho: 512, fundo: UVA, tinta: OFFWHITE, respiro: 0.2 }),
)
await writeFile(
  path.join(PUB, 'icon-192.png'),
  await marca({ tamanho: 192, fundo: UVA, tinta: OFFWHITE, respiro: 0.2 }),
)

/*
 * Ícone do iOS. Sem transparência e com respiro maior: o iOS aplica cantos
 * arredondados por conta própria e corta o que estiver perto da borda.
 */
await writeFile(
  path.join(APP, 'apple-icon.png'),
  await marca({ tamanho: 180, fundo: UVA, tinta: OFFWHITE, respiro: 0.24 }),
)

console.log('✓ icon.png · apple-icon.png · icon-192.png · icon-512.png')
