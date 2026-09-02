import { expect, test } from '@playwright/test'

/**
 * Disciplina de imagem.
 *
 * Substitui a regra `@next/next/no-img-element`, desligada no ESLint com esta
 * troca explícita: em vez de proibir `<img>` no código, verificamos no DOM
 * renderizado que todo `<img>` cru é SVG da marca e que toda FOTOGRAFIA passou
 * pelo `next/image`. Uma foto de 2400px servida por `<img>` cru é o defeito de
 * performance que a regra existe para evitar — e é isso que o teste procura.
 */

const ROTAS = ['/', '/cardapio', '/vinhos', '/wine-match']

test.describe('imagens', () => {
  for (const rota of ROTAS) {
    test(`${rota} — nenhuma fotografia escapa do next/image`, async ({ page }) => {
      await page.goto(rota)
      await page.waitForLoadState('networkidle')
      // Rola a página inteira para acordar o lazy loading.
      const altura = await page.evaluate(() => document.body.scrollHeight)
      for (let y = 0; y < altura; y += 800) {
        await page.evaluate((o) => window.scrollTo(0, o), y)
        await page.waitForTimeout(120)
      }

      const infratores = await page.evaluate(() =>
        [...document.querySelectorAll('img')]
          .map((img) => ({
            src: img.currentSrc || img.src || '',
            // O otimizador do Next serve por /_next/image?url=…
            otimizada: (img.currentSrc || img.src || '').includes('/_next/image'),
          }))
          .filter((i) => i.src && !i.otimizada)
          // SVG da marca é exceção legítima: o otimizador não processa SVG.
          .filter((i) => !/\/brand\/.+\.svg(\?|$)/.test(i.src))
          .filter((i) => !i.src.startsWith('data:'))
          .map((i) => i.src),
      )

      expect(
        infratores,
        `imagens fora do next/image e fora de /brand/: ${infratores.join(', ')}`,
      ).toHaveLength(0)
    })

    test(`${rota} — imagens declaram tamanho e não causam CLS`, async ({ page }) => {
      await page.goto(rota)

      const cls = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let total = 0
            try {
              const po = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                  const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
                  if (!shift.hadRecentInput) total += shift.value
                }
              })
              po.observe({ type: 'layout-shift', buffered: true })
              setTimeout(() => {
                po.disconnect()
                resolve(total)
              }, 2500)
            } catch {
              resolve(0)
            }
          }),
      )

      // Meta de Core Web Vitals: CLS abaixo de 0,1.
      expect(cls, `CLS de ${cls.toFixed(3)} em ${rota}`).toBeLessThan(0.1)
    })
  }

  test('só a imagem do herói tem priority', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // `priority` no next/image vira fetchpriority="high" + loading="eager".
    // Mais de uma imagem prioritária faz todas competirem e nenhuma ganhar.
    const prioritarias = await page.evaluate(() =>
      [...document.querySelectorAll('img')]
        .filter((img) => img.getAttribute('fetchpriority') === 'high')
        .map((img) => img.getAttribute('alt') ?? '(sem alt)'),
    )
    expect(prioritarias, `imagens prioritárias: ${prioritarias.join(' | ')}`).toHaveLength(1)
  })

  test('imagens abaixo da dobra carregam sob demanda', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const semLazy = await page.evaluate(() => {
      const dobra = window.innerHeight
      return [...document.querySelectorAll('img')]
        .filter((img) => {
          const r = img.getBoundingClientRect()
          const abaixo = r.top > dobra * 1.5
          return abaixo && img.getAttribute('loading') !== 'lazy'
        })
        .map((img) => img.getAttribute('alt') ?? '(sem alt)')
    })
    expect(semLazy, `sem lazy abaixo da dobra: ${semLazy.join(' | ')}`).toHaveLength(0)
  })
})
