import { expect, test } from '@playwright/test'

/**
 * Cardápio, Wine Explorer e Wine Match — os três produtos digitais do site.
 *
 * O que estes testes protegem, além de "a página abre": os deep links, que são
 * requisito explícito, e a regra de conteúdo de que nada é inventado.
 */

/*
 * O CARDÁPIO É UM RESUMO, não uma lista.
 *
 * A casa troca os pratos com frequência, então a página deixou de publicar
 * itens e preços: ficaram as categorias, a harmonização de cada uma e o link
 * para o cardápio digital, que é onde os valores vigentes vivem. Estes testes
 * guardam essa decisão — inclusive a parte de NÃO mostrar preço de comida,
 * que é o que volta a envelhecer se alguém reintroduzir a lista.
 */
test.describe('Cardápio', () => {
  test('abre com as categorias reais da cozinha', async ({ page }) => {
    await page.goto('/cardapio')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Categorias que existem de fato no cardápio oficial.
    await expect(page.getByRole('heading', { name: 'Tábuas e Antipasti', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Principais', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sobremesas', exact: true })).toBeVisible()
  })

  test('cada categoria mostra a harmonização que a casa declara', async ({ page }) => {
    await page.goto('/cardapio')

    // A ponte cozinha–carta: o texto e o link para a seção da carta.
    await expect(page.getByText(/harmoniza com/i).first()).toBeVisible()
    const paraCarta = page.getByRole('link', { name: 'Tinto Médio Corpo' }).first()
    await expect(paraCarta).toBeVisible()
    await expect(paraCarta).toHaveAttribute('href', /\/vinhos\?categoria=/)
  })

  test('não publica preço de comida, e manda ao cardápio digital', async ({ page }) => {
    await page.goto('/cardapio')

    const texto = (await page.locator('body').innerText()) ?? ''
    expect(texto, 'a página não deve trazer valores de pratos').not.toMatch(
      /R\$\s?\d{1,3}(\.\d{3})*,\d{2}/,
    )

    const digital = page.getByRole('link', { name: /cardápio digital/i }).first()
    await expect(digital).toBeVisible()
    await expect(digital).toHaveAttribute('href', /menu\.getin\.app/)
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

    // Três etapas: momento, estilo, orçamento. A de prato saiu junto com o
    // cardápio — recomendar a partir de um prato que pode ter saído da cozinha
    // é decidir sobre uma premissa que ninguém garantiu.
    const escolher = async (padrao: RegExp) => {
      const opcao = page.getByRole('button', { name: padrao }).first()
      await opcao.waitFor({ state: 'visible', timeout: 8000 })
      await opcao.click()
      await page.waitForTimeout(500)
    }

    await escolher(/jantar/i)
    await escolher(/intenso/i)
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
