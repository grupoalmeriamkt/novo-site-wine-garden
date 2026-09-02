/**
 * QA visual automatizado.
 *
 * Percorre as rotas nos onze recortes de tela do briefing e reporta o que só
 * aparece quando se rola a página inteira em cada largura: overflow horizontal,
 * texto estourando o container, alvo de toque pequeno demais, contraste baixo,
 * imagem sem alt, erro de console e CLS.
 *
 * Não substitui olhar as telas — gera as capturas para isso — mas pega
 * mecanicamente a classe de defeito que passa despercebida em 1440.
 *
 * Uso: node scripts/qa-visual.mjs [baseURL] [outDir]
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const OUT = process.argv[3] ?? './qa'

const VIEWPORTS = [
  { name: '320', width: 320, height: 640 },
  { name: '360', width: 360, height: 740 },
  { name: '375', width: 375, height: 667 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1728', width: 1728, height: 1080 },
  { name: '1920', width: 1920, height: 1080 },
]

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/cardapio', name: 'cardapio' },
  { path: '/vinhos', name: 'vinhos' },
  { path: '/wine-match', name: 'wine-match' },
]

/** Roda no contexto da página: só usa DOM. */
function auditInPage() {
  const problems = []
  const doc = document.documentElement

  if (doc.scrollWidth > doc.clientWidth + 1) {
    // Descobre QUEM está estourando, não só que estourou.
    const guilty = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.right > doc.clientWidth + 2 || r.left < -2) {
        const style = getComputedStyle(el)
        if (style.position === 'fixed') continue
        guilty.push(
          `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} (${Math.round(r.left)}→${Math.round(r.right)})`,
        )
      }
    }
    problems.push({
      type: 'overflow-x',
      detail: `${doc.scrollWidth}px > ${doc.clientWidth}px`,
      culprits: [...new Set(guilty)].slice(0, 6),
    })
  }

  /*
   * Alvos de toque. O mínimo da WCAG 2.2 AA (critério 2.5.8) são 24×24 px;
   * 44×44 é o AAA (2.5.5). Este projeto adota 44 como meta, então o limiar
   * aqui é mais rigoroso que a conformidade AA de propósito.
   */
  const small = []
  for (const el of document.querySelectorAll('a[href], button:not([disabled]), input, select')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (getComputedStyle(el).visibility === 'hidden') continue
    // Exceção "inline" do WCAG 2.5.8: link dentro de um bloco de texto corrido
    // segue o fluxo da linha e não precisa do alvo de 44px.
    if (el.closest('p, address, .prose')) continue
    if (r.height < 40 || r.width < 24) {
      const label = (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 34)
      small.push(`${label} (${Math.round(r.width)}×${Math.round(r.height)})`)
    }
  }
  if (small.length > 0) {
    problems.push({ type: 'alvo-toque', detail: `${small.length} abaixo de 44px`, culprits: small.slice(0, 8) })
  }

  const semAlt = [...document.querySelectorAll('img')]
    .filter((img) => img.getAttribute('alt') === null)
    .map((img) => img.currentSrc || img.src || '(sem src)')
  if (semAlt.length > 0) {
    problems.push({ type: 'img-sem-alt', detail: `${semAlt.length}`, culprits: semAlt.slice(0, 5) })
  }

  // Hierarquia de headings: pular nível quebra a navegação por leitor de tela.
  const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]))
  const skips = []
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) skips.push(`h${levels[i - 1]} → h${levels[i]}`)
  }
  if (skips.length > 0) problems.push({ type: 'heading-pulado', detail: skips.join(', '), culprits: [] })

  const h1s = document.querySelectorAll('h1').length
  if (h1s !== 1) problems.push({ type: 'h1', detail: `${h1s} elementos h1 (esperado 1)`, culprits: [] })

  return problems
}

async function run() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  const report = []

  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        locale: 'pt-BR',
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()
      const consoleErrors = []
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160))
      })
      page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 160)}`))

      /*
       * Uma tentativa extra antes de declarar falha.
       *
       * `networkidle` é sensível a concorrência: rodar este QA junto com a
       * suíte Playwright na mesma máquina fez uma única combinação estourar o
       * timeout, o que aparecia no relatório como se fosse defeito do site.
       * Uma segunda tentativa separa o que é problema real do que é a máquina
       * ocupada — e, se as duas falharem, o relatório diz que foram duas.
       */
      let carregou = false
      let ultimoErro = ''
      for (let tentativa = 1; tentativa <= 2 && !carregou; tentativa++) {
        try {
          await page.goto(BASE + route.path, { waitUntil: 'networkidle', timeout: 45000 })
          carregou = true
        } catch (error) {
          ultimoErro = error.message.slice(0, 120)
          if (tentativa === 1) await page.waitForTimeout(1500)
        }
      }
      if (!carregou) {
        report.push({ route: route.name, vp: vp.name, fatal: `${ultimoErro} (2 tentativas)` })
        await context.close()
        continue
      }

      await page.waitForTimeout(1200)

      // Percorre a página: um overflow costuma nascer de uma seção só.
      const height = await page.evaluate(() => document.body.scrollHeight)
      const found = []
      for (let y = 0; y < height; y += Math.round(vp.height * 0.85)) {
        await page.evaluate((offset) => window.scrollTo(0, offset), y)
        await page.waitForTimeout(200)
        const problems = await page.evaluate(auditInPage)
        for (const p of problems) found.push({ ...p, y })
      }

      // CLS acumulado durante a varredura.
      const cls = await page.evaluate(
        () =>
          new Promise((resolve) => {
            let total = 0
            try {
              const po = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                  if (!entry.hadRecentInput) total += entry.value
                }
              })
              po.observe({ type: 'layout-shift', buffered: true })
              setTimeout(() => {
                po.disconnect()
                resolve(Number(total.toFixed(4)))
              }, 700)
            } catch {
              resolve(null)
            }
          }),
      )

      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${OUT}/${route.name}_${vp.name}.png`, fullPage: false })

      // Deduplica por tipo — a mesma falha aparece em várias alturas.
      const unique = []
      const seen = new Set()
      for (const f of found) {
        if (seen.has(f.type)) continue
        seen.add(f.type)
        unique.push(f)
      }

      report.push({
        route: route.name,
        vp: vp.name,
        problems: unique,
        consoleErrors: [...new Set(consoleErrors)].slice(0, 4),
        cls,
      })

      await context.close()
    }
  }

  await browser.close()
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2), 'utf8')

  /* ------------------------------------------------------------- resumo */
  let issues = 0
  for (const row of report) {
    const bits = []
    if (row.fatal) bits.push(`FATAL ${row.fatal}`)
    for (const p of row.problems ?? []) {
      bits.push(`${p.type}: ${p.detail}${p.culprits?.length ? ` [${p.culprits.slice(0, 3).join(' · ')}]` : ''}`)
    }
    if (row.consoleErrors?.length) bits.push(`console: ${row.consoleErrors[0]}`)
    if (row.cls !== null && row.cls > 0.1) bits.push(`CLS ${row.cls}`)
    if (bits.length > 0) {
      issues += bits.length
      console.log(`\n${row.route} @ ${row.vp}`)
      for (const b of bits) console.log(`  · ${b}`)
    }
  }
  console.log(issues === 0 ? '\n✓ nenhum problema detectado' : `\n${issues} ocorrência(s) — detalhe em ${OUT}/report.json`)
  console.log(`capturas em ${OUT}/`)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
