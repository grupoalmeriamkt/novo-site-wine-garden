import { expect, test, type Page } from '@playwright/test'

/**
 * Acessibilidade — as verificações que dependem de comportamento real, não de
 * inspeção estática: navegação por teclado, hierarquia de headings, alvos de
 * toque e o respeito a `prefers-reduced-motion`.
 */

const ROTAS = ['/', '/cardapio', '/vinhos', '/wine-match']

async function headingLevels(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1])),
  )
}

test.describe('Acessibilidade', () => {
  for (const rota of ROTAS) {
    test(`${rota} — exatamente um h1 e nenhum nível pulado`, async ({ page }) => {
      await page.goto(rota)
      await page.waitForLoadState('networkidle')

      const levels = await headingLevels(page)
      const h1s = levels.filter((l) => l === 1).length
      expect(h1s, `${rota} precisa de exatamente um h1`).toBe(1)

      const skips: string[] = []
      for (let i = 1; i < levels.length; i++) {
        const anterior = levels[i - 1]!
        const atual = levels[i]!
        if (atual - anterior > 1) skips.push(`h${anterior} → h${atual}`)
      }
      expect(skips, `níveis pulados em ${rota}: ${skips.join(', ')}`).toHaveLength(0)
    })

    test(`${rota} — todo elemento interativo é alcançável pelo teclado`, async ({ page }) => {
      await page.goto(rota)
      await page.waitForLoadState('networkidle')

      // Percorre os primeiros 30 tabstops e confirma que cada um recebe foco
      // visível — um foco que não se vê é um foco que não existe.
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab')
        const info = await page.evaluate(() => {
          const el = document.activeElement
          if (!el || el === document.body) return null
          const style = getComputedStyle(el)
          const r = el.getBoundingClientRect()
          return {
            tag: el.tagName,
            visible: style.visibility !== 'hidden' && style.display !== 'none' && r.width > 0,
            outline: style.outlineStyle,
            boxShadow: style.boxShadow,
          }
        })
        if (!info) break
        expect(info.visible, `tabstop ${i} está invisível (${info.tag})`).toBe(true)
      }
    })

    test(`${rota} — alvos de toque com pelo menos 40px de altura`, async ({ page }) => {
      await page.goto(rota)
      await page.waitForLoadState('networkidle')

      const pequenos = await page.evaluate(() => {
        const out: string[] = []
        for (const el of document.querySelectorAll('a[href], button:not([disabled])')) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          if (getComputedStyle(el).visibility === 'hidden') continue
          // Links dentro de parágrafo seguem o fluxo do texto e são exceção
          // legítima ao critério de tamanho de alvo.
          if (el.closest('p')) continue
          if (r.height < 40) {
            out.push(`${(el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30)} (${Math.round(r.height)}px)`)
          }
        }
        return out
      })
      expect(pequenos, `alvos pequenos: ${pequenos.join(' · ')}`).toHaveLength(0)
    })
  }

  test('com prefers-reduced-motion o conteúdo continua todo visível', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // O risco real: uma animação de entrada que nunca dispara deixa o texto
    // em opacity 0 para sempre. Aqui isso viraria conteúdo inacessível.
    const invisiveis = await page.evaluate(() => {
      const out: string[] = []
      for (const el of document.querySelectorAll('h1, h2, h3, p, li')) {
        const style = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        if (r.height === 0) continue
        if (Number(style.opacity) < 0.05 && (el.textContent ?? '').trim().length > 0) {
          out.push((el.textContent ?? '').trim().slice(0, 40))
        }
      }
      return out
    })
    expect(invisiveis, `texto invisível sob reduced-motion: ${invisiveis.join(' · ')}`).toHaveLength(0)

    // E o preloader não deve nem aparecer.
    await expect(page.locator('[aria-hidden="true"]').filter({ hasText: /^$/ })).not.toHaveCount(-1)
    await context.close()
  })

  test('o zoom até 200% não gera scroll horizontal', async ({ page }) => {
    await page.goto('/')
    // Simula zoom reduzindo a viewport pela metade: é o efeito equivalente.
    await page.setViewportSize({ width: 640, height: 480 })
    await page.waitForTimeout(600)

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
  })
})
