/**
 * Auditoria de contraste.
 *
 * Percorre todo texto renderizado e calcula a razão de contraste real contra a
 * cor de fundo efetiva — subindo a árvore até achar um ancestral opaco, porque
 * quase tudo aqui é `transparent` por herança de atmosfera.
 *
 * Limiares da WCAG 2.2 AA (critério 1.4.3):
 *   · texto normal ............ 4,5:1
 *   · texto grande (≥24px, ou ≥18,66px em peso ≥700) ... 3:1
 *
 * Texto sobre fotografia é reportado à parte: ali o fundo é uma imagem, não uma
 * cor, e a conferência tem de ser visual — o cálculo diria qualquer coisa.
 *
 * Uso: node scripts/qa-contrast.mjs [baseURL]
 */

import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const ROUTES = ['/', '/cardapio', '/vinhos', '/wine-match']
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]

function auditContrast() {
  /** sRGB → luminância relativa (fórmula da WCAG). */
  const luminance = ([r, g, b]) => {
    const [R, G, B] = [r, g, b].map((c) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * R + 0.7152 * G + 0.0722 * B
  }

  const ratio = (fg, bg) => {
    const a = luminance(fg)
    const b = luminance(bg)
    const [hi, lo] = a > b ? [a, b] : [b, a]
    return (hi + 0.05) / (lo + 0.05)
  }

  const parse = (color) => {
    const m = color.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return { rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3] : 1 }
  }

  /** Compõe uma cor semitransparente sobre o que estiver atrás. */
  const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha))

  /** Sobe a árvore até achar fundo opaco; devolve também se cruzou uma imagem. */
  const effectiveBackground = (el) => {
    let node = el
    let acc = null
    let sobreImagem = false

    /*
     * A detecção de "texto sobre fotografia" precisa ser ESTREITA. A primeira
     * versão marcava como fotográfico qualquer ancestral posicionado que
     * contivesse um <img> em qualquer lugar — o que, num site onde quase toda
     * seção tem foto, silenciava metade das medições. O Lighthouse pegou três
     * falhas reais que este script tinha deixado passar por isso.
     *
     * Agora só conta como fotográfico o que de fato fica ATRÁS do texto: uma
     * imagem de fundo CSS real, ou um <img>/<video> cuja caixa se sobrepõe à
     * caixa do texto.
     */
    while (node && node !== document.documentElement.parentElement) {
      const cs = getComputedStyle(node)
      const bgImg = cs.backgroundImage
      if (bgImg && bgImg !== 'none' && /url\(/.test(bgImg)) sobreImagem = true

      if (!sobreImagem && node !== el && node.querySelectorAll) {
        const caixaTexto = el.getBoundingClientRect()
        for (const midia of node.querySelectorAll(':scope img, :scope video')) {
          const m = midia.getBoundingClientRect()
          const sobrepoe =
            m.left < caixaTexto.right &&
            m.right > caixaTexto.left &&
            m.top < caixaTexto.bottom &&
            m.bottom > caixaTexto.top
          if (sobrepoe) {
            sobreImagem = true
            break
          }
        }
      }
      const parsed = parse(cs.backgroundColor)
      if (parsed && parsed.alpha > 0) {
        acc = acc === null ? { rgb: parsed.rgb, alpha: parsed.alpha } : acc
        if (parsed.alpha >= 0.999) {
          return { rgb: acc.alpha >= 0.999 ? acc.rgb : over(acc.rgb, parsed.rgb, acc.alpha), sobreImagem }
        }
      }
      node = node.parentElement
    }
    return { rgb: [255, 255, 255], sobreImagem }
  }

  const problemas = []
  const sobreFoto = []

  for (const el of document.querySelectorAll('body *')) {
    // Só elementos com texto próprio.
    const texto = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim()
    if (!texto) continue

    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const opacity = Number(cs.opacity)
    if (opacity < 0.1) continue

    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue

    const fgParsed = parse(cs.color)
    if (!fgParsed) continue

    const bg = effectiveBackground(el)
    const fg = fgParsed.alpha >= 0.999 ? fgParsed.rgb : over(fgParsed.rgb, bg.rgb, fgParsed.alpha)

    const size = parseFloat(cs.fontSize)
    const weight = Number(cs.fontWeight) || 400
    const grande = size >= 24 || (size >= 18.66 && weight >= 700)
    const minimo = grande ? 3 : 4.5

    const valor = ratio(fg, bg.rgb)
    const registro = {
      texto: texto.slice(0, 44),
      ratio: Number(valor.toFixed(2)),
      minimo,
      size: Math.round(size),
      cor: cs.color,
      fundo: `rgb(${bg.rgb.map(Math.round).join(', ')})`,
    }

    if (bg.sobreImagem) {
      if (valor < minimo) sobreFoto.push(registro)
      continue
    }
    if (valor < minimo) problemas.push(registro)
  }

  return { problemas, sobreFoto }
}

const browser = await chromium.launch()
let total = 0

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp, locale: 'pt-BR' })
    const page = await ctx.newPage()
    await page.goto(BASE + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    // Rola tudo para revelar o conteúdo que entra por animação.
    const h = await page.evaluate(() => document.body.scrollHeight)
    for (let y = 0; y <= h; y += Math.round(vp.height * 0.9)) {
      await page.evaluate((o) => window.scrollTo(0, o), y)
      await page.waitForTimeout(120)
    }
    await page.waitForTimeout(500)

    const { problemas, sobreFoto } = await page.evaluate(auditContrast)

    // Deduplica por texto+ratio: a mesma classe aparece dezenas de vezes.
    const chave = (p) => `${p.texto}|${p.ratio}`
    const unicos = [...new Map(problemas.map((p) => [chave(p), p])).values()]
    const unicosFoto = [...new Map(sobreFoto.map((p) => [chave(p), p])).values()]

    if (unicos.length > 0) {
      console.log(`\n${route} @ ${vp.name} — ${unicos.length} abaixo do mínimo AA`)
      for (const p of unicos.slice(0, 10)) {
        console.log(`  ${p.ratio}:1 (min ${p.minimo}) ${p.size}px · "${p.texto}" · ${p.cor} sobre ${p.fundo}`)
      }
      total += unicos.length
    }
    if (unicosFoto.length > 0) {
      console.log(`\n${route} @ ${vp.name} — ${unicosFoto.length} sobre fotografia (conferir a olho)`)
      for (const p of unicosFoto.slice(0, 5)) {
        console.log(`  ~${p.ratio}:1 ${p.size}px · "${p.texto}"`)
      }
    }

    await ctx.close()
  }
}

await browser.close()
console.log(total === 0 ? '\n✓ nenhum texto abaixo do mínimo AA sobre fundo sólido' : `\n${total} ocorrência(s)`)
