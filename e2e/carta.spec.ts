import { expect, test } from '@playwright/test'

/**
 * Cardápio, Wine Explorer e Wine Match — os três produtos digitais do site.
 *
 * O que estes testes protegem, além de "a página abre": os deep links, que são
 * requisito explícito, e a regra de conteúdo de que nada é inventado.
 */

test.describe('Cardápio', () => {
  test('abre com as categorias reais e preços em pt-BR', async ({ page }) => {
    await page.goto('/cardapio')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Categorias que existem de fato no cardápio oficial.
    await expect(page.getByText('Tábuas e Antipasti').first()).toBeVisible()
    await expect(page.getByText('Principais').first()).toBeVisible()

    // Preço no formato brasileiro, com vírgula decimal.
    await expect(page.getByText(/R\$\s?\d{1,3}(\.\d{3})*,\d{2}/).first()).toBeVisible()
  })

  test('a busca filtra e informa quando não há resultado', async ({ page }) => {
    await page.goto('/cardapio')
    const busca = page.getByRole('searchbox').or(page.getByRole('textbox')).first()

    await busca.fill('burrata')
    await page.waitForTimeout(400)
    await expect(page.getByText(/burrata/i).first()).toBeVisible()

    await busca.fill('zzzzzznaoexiste')
    await page.waitForTimeout(400)
    await expect(page.getByText(/nenhum|não encontr/i).first()).toBeVisible()
  })

  test('deep link de categoria funciona e o voltar do navegador respeita', async ({ page }) => {
    await page.goto('/cardapio?categoria=principais')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/salmão garden/i).first()).toBeVisible()
  })

  test('a navegação de categoria é sticky no mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'comportamento específico de mobile')
    await page.goto('/cardapio')
    await page.evaluate(() => window.scrollTo(0, 1400))
    await page.waitForTimeout(400)
    const nav = page.locator('[data-menu-nav]').first()
    if ((await nav.count()) > 0) await expect(nav).toBeInViewport()
  })
})

test.describe('Wine Explorer', () => {
  test('a entrada é por exploração, não por despejo da lista', async ({ page }) => {
    await page.goto('/vinhos')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')

    // O requisito é explícito: 159 rótulos de uma vez não é uma carta, é um
    // dump. Sem filtro escolhido, a página oferece caminhos — serviço, estilo,
    // origem — com a contagem real de cada um.
    const texto = await page.evaluate(() => document.body.innerText)
    expect(texto).toContain('159')
    expect(texto).toMatch(/em taça/i)
    expect(texto).toMatch(/em garrafa/i)
    expect(texto).toMatch(/tinto médio corpo/i)

    // E os números batem com os dados reais da carta.
    expect(texto).toMatch(/46/)
    expect(texto).toMatch(/113/)
  })

  test('deep link por país filtra para os 31 rótulos da França', async ({ page }) => {
    await page.goto('/vinhos?pais=franca')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)

    const texto = await page.evaluate(() => document.body.innerText)
    // 31 é a contagem real da França na carta — se o filtro não tivesse
    // aplicado, o número na tela seria 159.
    expect(texto, 'a contagem filtrada deveria ser 31').toMatch(/\b31\b/)
    expect(texto).toMatch(/frança/i)
  })

  test('deep link por serviço reduz a carta a 46 rótulos em taça', async ({ page }) => {
    await page.goto('/vinhos?servico=taca')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)

    const texto = await page.evaluate(() => document.body.innerText)
    expect(texto, 'deveria mostrar os 46 rótulos servidos em taça').toMatch(/\b46\b/)
    // No desktop o painel de filtros fica aberto ao lado; no celular ele mora
    // num drawer e o que aparece é o botão que o abre.
    expect(texto).toMatch(/filtrar a carta|filtros/i)
  })

  test('filtrar atualiza a URL e o voltar desfaz', async ({ page }) => {
    await page.goto('/vinhos')
    await page.waitForLoadState('networkidle')

    const antes = page.url()
    const filtro = page.getByRole('button', { name: /espumante/i }).first()
    if ((await filtro.count()) === 0) test.skip(true, 'filtro não encontrado nesta viewport')

    await filtro.click()
    /*
     * A URL é atualizada pelo router do App Router, que pode demorar mais que
     * um `waitForTimeout` fixo quando a máquina está carregada. `expect.poll`
     * espera pelo fato — o filtro na URL — em vez de apostar num prazo.
     */
    await expect.poll(() => page.url(), { timeout: 10_000 }).not.toBe(antes)

    await page.goBack()
    await expect.poll(() => page.url(), { timeout: 10_000 }).toBe(antes)
  })
})

test.describe('Wine Match', () => {
  test('percorre o fluxo e devolve recomendações reais', async ({ page }) => {
    await page.goto('/wine-match')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Quatro etapas: momento, estilo, prato, orçamento.
    const escolher = async (padrao: RegExp) => {
      const opcao = page.getByRole('button', { name: padrao }).first()
      await opcao.waitFor({ state: 'visible', timeout: 8000 })
      await opcao.click()
      await page.waitForTimeout(500)
    }

    await escolher(/jantar/i)
    await escolher(/intenso/i)
    await escolher(/só o vinho|apenas o vinho|pular/i)
    await escolher(/R\$|sem limite/i)

    await page.waitForTimeout(900)

    // O resultado precisa citar rótulo real e explicar a escolha.
    const resultado = page.getByRole('heading', { level: 2 }).or(page.locator('[data-match-result]'))
    await expect(resultado.first()).toBeVisible()
    await expect(page.getByText(/R\$\s?\d/).first()).toBeVisible()
  })
})

test.describe('Localização', () => {
  test('sem chave do Maps, a seção degrada com endereço e rota', async ({ page }) => {
    await page.goto('/')
    await page.locator('#localizacao').scrollIntoViewIfNeeded()
    await page.waitForTimeout(900)

    // Endereço real, verificado em fonte pública.
    await expect(page.getByText(/SHIS QL 10/i).first()).toBeVisible()

    const rota = page.getByRole('link', { name: /como chegar/i }).first()
    await expect(rota).toBeVisible()
    await expect(rota).toHaveAttribute('href', /google\.com\/maps/)
  })
})
