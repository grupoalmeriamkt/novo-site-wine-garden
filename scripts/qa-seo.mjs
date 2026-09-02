/**
 * Auditoria de SEO e GEO.
 *
 * Verifica no HTML SERVIDO — não no código — o que os buscadores e os motores
 * generativos realmente encontram: metadata, dado estruturado válido, imagem de
 * compartilhamento, canonical, e a coerência entre o que o JSON-LD afirma e o
 * que a página mostra.
 *
 * A verificação que mais importa aqui é a última: um `FAQPage` cuja resposta
 * não aparece na tela é conteúdo oculto pelas diretrizes do Google, e custa o
 * rich result inteiro.
 *
 * Uso: node scripts/qa-seo.mjs [baseURL]
 */

import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const ROTAS = ['/', '/cardapio', '/vinhos', '/wine-match']

const problemas = []
const ok = []

const reportar = (cond, msg) => (cond ? ok.push(msg) : problemas.push(msg))

const browser = await chromium.launch()
const page = await browser.newPage({ locale: 'pt-BR' })

/*
 * `domcontentloaded`, não `networkidle`.
 *
 * Tudo que esta auditoria lê — metadata, JSON-LD, texto do FAQ — está no HTML
 * servido, e portanto já existe no DOMContentLoaded. Esperar `networkidle`
 * numa página com prefetch do App Router e imagens lazy é esperar por algo que
 * não interessa aqui, e foi o que fez a auditoria estourar o timeout.
 */
async function abrir(rota) {
  await page.goto(BASE + rota, { waitUntil: 'domcontentloaded' })
  // Uma respiração para o React hidratar e as seções client renderizarem o
  // texto que a checagem do FAQ vai procurar.
  await page.waitForTimeout(1500)
}

/* ------------------------------------------------- metadata por rota */

for (const rota of ROTAS) {
  await abrir(rota)

  const meta = await page.evaluate(() => {
    const get = (sel, attr = 'content') => document.querySelector(sel)?.getAttribute(attr) ?? null
    return {
      title: document.title,
      description: get('meta[name="description"]'),
      canonical: get('link[rel="canonical"]', 'href'),
      ogTitle: get('meta[property="og:title"]'),
      ogImage: get('meta[property="og:image"]'),
      ogType: get('meta[property="og:type"]'),
      locale: get('meta[property="og:locale"]'),
      lang: document.documentElement.lang,
      robots: get('meta[name="robots"]'),
      h1: document.querySelectorAll('h1').length,
      textoVisivel: document.body.innerText.length,
    }
  })

  const r = rota === '/' ? 'home' : rota.slice(1)
  reportar(meta.title && meta.title.length >= 20 && meta.title.length <= 70, `${r}: título com ${meta.title?.length} caracteres`)
  reportar(
    meta.description && meta.description.length >= 70 && meta.description.length <= 200,
    `${r}: descrição com ${meta.description?.length} caracteres`,
  )
  reportar(Boolean(meta.canonical), `${r}: canonical`)
  reportar(Boolean(meta.ogImage), `${r}: og:image`)
  reportar(meta.lang === 'pt-BR', `${r}: lang=${meta.lang}`)
  reportar(meta.h1 === 1, `${r}: ${meta.h1} h1`)
  reportar(meta.textoVisivel > 1200, `${r}: ${meta.textoVisivel} caracteres de texto visível`)
}

/* --------------------------------------------- dado estruturado da home */

await abrir('/')

const blocos = await page.evaluate(() =>
  [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
)

const tipos = new Set()
let jsonValido = true
const entidades = []

for (const bruto of blocos) {
  try {
    const dados = JSON.parse(bruto)
    for (const item of Array.isArray(dados) ? dados : [dados]) {
      tipos.add(item['@type'])
      entidades.push(item)
    }
  } catch {
    jsonValido = false
  }
}

reportar(jsonValido, 'JSON-LD: todos os blocos são JSON válido')
for (const esperado of ['Restaurant', 'WebSite', 'FAQPage', 'ItemList']) {
  reportar(tipos.has(esperado), `JSON-LD: ${esperado}`)
}

/* Nada de nota ou avaliação inventada. */
const restaurante = entidades.find((e) => e['@type'] === 'Restaurant')
reportar(!restaurante?.aggregateRating, 'JSON-LD: sem aggregateRating inventado')
reportar(Boolean(restaurante?.geo?.latitude), 'JSON-LD: coordenadas declaradas')
reportar(Boolean(restaurante?.openingHoursSpecification), 'JSON-LD: horário estruturado')

/*
 * A verificação decisiva: toda resposta do FAQPage precisa estar VISÍVEL na
 * página. Dado estruturado sem conteúdo correspondente é conteúdo oculto.
 */
const faq = entidades.find((e) => e['@type'] === 'FAQPage')
if (faq) {
  /*
   * Uma <details> de cada vez.
   *
   * `innerText` ignora o conteúdo de um <details> fechado — é o que o torna a
   * medida certa de "visível". Mas resposta dentro de acordeão fechado NÃO é
   * conteúdo oculto para o Google: está no HTML servido e o visitante a alcança
   * com um clique. Oculto é o que não aparece nem quando aberto.
   *
   * Abrir todas de uma vez não serve: o acordeão da seção mantém só uma aberta,
   * então o React fecharia as demais. Abrimos e lemos uma por vez, dentro do
   * mesmo tick — antes de o React reagir ao toggle.
   */
  const textoDaPagina = await page.evaluate(() => {
    const partes = [document.body.innerText]
    for (const d of document.querySelectorAll('details')) {
      const estava = d.open
      d.open = true
      partes.push(d.innerText)
      d.open = estava
    }
    return partes.join('\n')
  })

  const ausentes = []
  for (const q of faq.mainEntity ?? []) {
    const pergunta = q.name ?? ''
    // Compara o começo da resposta: o texto na tela pode ter quebras de linha.
    const trecho = (q.acceptedAnswer?.text ?? '').slice(0, 40)
    if (!textoDaPagina.includes(pergunta)) ausentes.push(`pergunta "${pergunta}"`)
    else if (trecho && !textoDaPagina.includes(trecho)) ausentes.push(`resposta de "${pergunta}"`)
  }
  reportar(
    ausentes.length === 0,
    ausentes.length === 0
      ? `FAQPage: as ${faq.mainEntity?.length} perguntas e respostas estão visíveis na página`
      : `FAQPage: ${ausentes.length} sem texto visível — ${ausentes.slice(0, 2).join(', ')}`,
  )
}

/* --------------------------------------------------- arquivos de máquina */

for (const [caminho, esperado] of [
  ['/robots.txt', 'Sitemap:'],
  ['/sitemap.xml', '<urlset'],
  ['/llms.txt', '# Wine Garden'],
  ['/opengraph-image', null],
]) {
  const resposta = await page.request.get(BASE + caminho)
  const status = resposta.status()
  if (esperado === null) {
    const tipo = resposta.headers()['content-type'] ?? ''
    reportar(status === 200 && tipo.includes('image'), `${caminho}: ${status} ${tipo}`)
  } else {
    const corpo = await resposta.text()
    reportar(status === 200 && corpo.includes(esperado), `${caminho}: ${status}`)
  }
}

/* robots.txt precisa permitir os agentes de IA nominalmente. */
const robots = await (await page.request.get(BASE + '/robots.txt')).text()
for (const agente of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
  reportar(robots.includes(agente), `robots.txt: ${agente} declarado`)
}

await browser.close()

/* ---------------------------------------------------------------- saída */

console.log(`\n✓ ${ok.length} verificações passaram`)
for (const item of ok) console.log(`   ${item}`)

if (problemas.length > 0) {
  console.log(`\n✕ ${problemas.length} problema(s):`)
  for (const item of problemas) console.log(`   ${item}`)
  process.exitCode = 1
} else {
  console.log('\nNenhum problema de SEO/GEO detectado.')
}
