import { expect, test } from '@playwright/test'

/**
 * Home: abertura, integridade da narrativa e as garantias que valem para o site
 * inteiro (sem scroll horizontal, sem erro de console, marca acessível).
 */

test.describe('Home', () => {
  test('carrega com a marca, o título e sem erro de console', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

    await page.goto('/')

    await expect(page).toHaveTitle(/Wine Garden/)
    // O h1 traz a frase da marca, quebrada em duas linhas no markup.
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toContainText('Viaje o mundo')
    await expect(h1).toContainText('taça a taça')

    await expect(page.getByRole('link', { name: /Wine Garden — página inicial/i })).toBeVisible()

    await page.waitForLoadState('networkidle')
    expect(errors, `erros de console: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('não tem scroll horizontal em nenhuma altura da página', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Percorre a página inteira: um overflow costuma nascer de uma seção só.
    const height = await page.evaluate(() => document.body.scrollHeight)
    const step = 700
    for (let y = 0; y < height; y += step) {
      await page.evaluate((offset) => window.scrollTo(0, offset), y)
      await page.waitForTimeout(120)
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(
        overflow.scrollWidth,
        `overflow horizontal em y=${y}: ${overflow.scrollWidth} > ${overflow.clientWidth}`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1)
    }
  })

  test('a imagem do herói tem alt descritivo e prioridade de carregamento', async ({ page }) => {
    await page.goto('/')
    const heroImg = page.locator('section img').first()
    const alt = await heroImg.getAttribute('alt')
    expect(alt, 'a foto do herói precisa de alt descritivo').toBeTruthy()
    expect(alt!.length, 'alt genérico demais').toBeGreaterThan(20)
    await expect(heroImg).toHaveAttribute('fetchpriority', 'high')
  })

  test('todas as imagens têm atributo alt', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const semAlt = await page.evaluate(() =>
      [...document.querySelectorAll('img')]
        .filter((img) => img.getAttribute('alt') === null)
        .map((img) => img.getAttribute('src') ?? '(sem src)'),
    )
    expect(semAlt, `imagens sem alt: ${semAlt.join(', ')}`).toHaveLength(0)
  })

  test('o link de pular navegação aparece ao receber foco', async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), 'navegação por Tab não existe em dispositivo de toque')
    await page.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: /pular para o conteúdo/i })
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()
  })

  test('JSON-LD de restaurante é válido e não inventa avaliação', async ({ page }) => {
    await page.goto('/')

    /*
     * A home publica um GRAFO: um mesmo <script> pode trazer um array com
     * Restaurant, WebSite e FAQPage, e há outros blocos na página. Procurar o
     * Restaurant em vez de assumir que ele é o primeiro objeto do primeiro
     * bloco é o que impede este teste de quebrar toda vez que uma entidade
     * nova entra no grafo.
     */
    const blocos = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(blocos.length).toBeGreaterThan(0)

    const entidades = blocos.flatMap((bruto) => {
      const parsed = JSON.parse(bruto) as unknown
      return (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[]
    })

    const data = entidades.find((e) => e['@type'] === 'Restaurant')
    expect(data, 'a home precisa declarar o Restaurant').toBeTruthy()
    expect(data!['@type']).toBe('Restaurant')
    expect(data!.name).toBe('Wine Garden')
    expect(data!.address).toBeTruthy()
    expect(data!.geo).toBeTruthy()
    expect(Array.isArray(data!.openingHours)).toBe(true)

    // Regra de conteúdo: nada de nota que ninguém confirmou. O Google exibe
    // aggregateRating como fato, e não há avaliação para declarar.
    expect(data!.aggregateRating, 'não podemos declarar avaliação').toBeUndefined()

    /*
     * A faixa de preço PODE entrar, porque é calculada dos preços do cardápio
     * oficial — o que este teste guarda é o formato: uma faixa em reais, com
     * dois números. Um `$$` genérico ou um texto vago significaria que alguém
     * voltou a estimar. A prova de que os números batem com o cardápio está no
     * teste de unidade, que tem acesso aos dados.
     */
    if (data!.priceRange !== undefined) {
      expect(String(data!.priceRange), 'faixa de preço precisa ser calculada em reais').toMatch(
        /^R\$ \d+–\d+$/,
      )
    }
  })
})
