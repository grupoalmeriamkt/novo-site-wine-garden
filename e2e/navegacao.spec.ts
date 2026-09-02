import { expect, test } from '@playwright/test'

/**
 * Navegação: o overlay fullscreen é um diálogo modal e precisa se comportar
 * como tal — foco preso, Escape fecha, foco volta para quem abriu.
 */

test.describe('Navegação', () => {
  test('abre o menu, prende o foco e fecha com Escape', async ({ page, isMobile }) => {
    // Foco preso e Escape são comportamentos de teclado. Um iPhone não tem Tab,
    // e o WebKit móvel do Playwright não emula navegação por teclado — testar
    // isso ali mediria o emulador, não o site.
    test.skip(Boolean(isMobile), 'comportamento de teclado — só no desktop')
    await page.goto('/')

    // O rótulo do botão troca de "Menu" para "Fechar" ao abrir, então o
    // locator precisa ser o aria-controls, que é estável.
    const toggle = page.locator('button[aria-controls="menu-principal"]')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()

    const dialog = page.getByRole('dialog', { name: /menu de navegação/i })
    await expect(dialog).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // O foco entra no overlay sozinho — senão o teclado fica preso atrás dele.
    await expect(dialog.getByRole('link').first()).toBeFocused()

    // Tab dá a volta dentro do diálogo em vez de escapar para a página.
    const focusables = await dialog.locator('a[href], button:not([disabled])').count()
    for (let i = 0; i < focusables + 2; i++) await page.keyboard.press('Tab')
    const focoDentro = await page.evaluate(() => {
      const overlay = document.querySelector('[role="dialog"]')
      return overlay?.contains(document.activeElement) ?? false
    })
    expect(focoDentro, 'o foco escapou do diálogo').toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    // E volta para o botão que abriu.
    await expect(toggle).toBeFocused()
  })

  test('o menu leva às rotas principais', async ({ page }) => {
    await page.goto('/')
    await page.locator('button[aria-controls="menu-principal"]').click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('link', { name: /cardápio/i }).click()

    await expect(page).toHaveURL(/\/cardapio/)
    // A navegação fecha o overlay — senão ele sobrevive à troca de rota.
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('a rolagem da página fica travada com o menu aberto', async ({ page }) => {
    await page.goto('/')
    await page.locator('button[aria-controls="menu-principal"]').click()

    /*
     * Esperar o overlay ANTES de ler o estilo. Ler `body.overflow` logo após o
     * clique é uma corrida contra a hidratação e contra o commit do React: o
     * trava-rolagem só existe depois que o diálogo entrou. Ancorar no diálogo
     * torna o teste determinístico em vez de dependente da máquina.
     */
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .toBe('hidden')
  })

  test('todo CTA de reserva aponta para o GetIn com rel seguro', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // O botão do header só existe a partir de 640px; no celular a conversão
    // mora na barra persistente e no rodapé. Em vez de escolher um, o teste
    // verifica TODOS os links de reserva presentes naquela viewport.
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('a')]
        .filter((a) => /reserv/i.test(a.textContent ?? ''))
        .map((a) => ({
          texto: (a.textContent ?? '').trim().slice(0, 30),
          href: a.getAttribute('href') ?? '',
          target: a.getAttribute('target') ?? '',
          rel: a.getAttribute('rel') ?? '',
        })),
    )

    expect(links.length, 'nenhum CTA de reserva encontrado').toBeGreaterThan(0)
    for (const link of links) {
      expect(link.href, `${link.texto} não aponta para o GetIn`).toMatch(/getin/)
      expect(link.target, `${link.texto} sem target=_blank`).toBe('_blank')
      // Sem noopener, a página de destino ganha acesso a window.opener.
      expect(link.rel, `${link.texto} sem rel=noopener`).toMatch(/noopener/)
    }
  })
})

test.describe('Reserva no mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'só existe em telas de toque')

  test('a barra de reserva aparece após rolar e some no rodapé', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Seletor estável: existem outros links "Reservar uma mesa" no DOM (rodapé
    // e overlay do menu), e um seletor por texto pega o errado.
    const bar = page.locator('[data-reserve-bar]')

    // No topo ela está fora do caminho — não cobre a composição de abertura.
    await expect(bar).not.toHaveAttribute('data-visible', 'true')

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2))
    await page.waitForTimeout(700)
    await expect(bar).toHaveAttribute('data-visible', 'true')

    // E some no rodapé, onde já existe um CTA maior.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(700)
    await expect(bar).not.toHaveAttribute('data-visible', 'true')
  })
})
