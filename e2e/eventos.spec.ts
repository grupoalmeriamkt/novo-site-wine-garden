import { expect, test, type Page } from '@playwright/test'

/**
 * O formulário de eventos.
 *
 * É o único formulário do site e o canal comercial da casa: o que ele monta vai
 * para o WhatsApp de eventos, com todos os campos na mensagem. Não há backend —
 * um formulário que responde "recebemos!" sem enviar nada seria pior que não
 * ter formulário.
 *
 * O que estes testes guardam é justamente o que quebraria em silêncio: o
 * NÚMERO de destino (trocá-lo desvia todos os leads), o formato do link e a
 * presença de cada campo dentro da mensagem.
 *
 * `window.open` é interceptado: o teste lê a URL que o site mandaria abrir sem
 * depender do api.whatsapp.com estar no ar nem de redirecionamentos dele.
 */

/** O WhatsApp comercial de eventos, com DDI 55 — (61) 99811-7063. */
const NUMERO_EVENTOS = '5561998117063'

async function capturarWindowOpen(page: Page) {
  await page.evaluate(() => {
    const w = window as Window & { __abertos?: string[] }
    w.__abertos = []
    window.open = (url?: string | URL) => {
      w.__abertos?.push(String(url))
      return null
    }
  })
}

const abertos = (page: Page) =>
  page.evaluate(() => (window as Window & { __abertos?: string[] }).__abertos ?? [])

async function irParaEventos(page: Page) {
  await page.goto('/')
  await page.locator('#eventos').scrollIntoViewIfNeeded()
  await capturarWindowOpen(page)
}

test.describe('Eventos', () => {
  test('abre o WhatsApp de eventos com todos os campos na mensagem', async ({ page }) => {
    await irParaEventos(page)

    await page.getByLabel('Nome', { exact: true }).fill('Alex Rodrigues')
    await page.getByLabel(/telefone ou e-mail/i).fill('61999999999')
    await page.getByLabel(/tipo de evento/i).selectOption('Corporativo')
    await page.getByLabel('Pessoas', { exact: true }).fill('40')
    await page.getByLabel(/data pretendida/i).fill('2026-12-18')
    await page.getByLabel(/sobre o evento/i).fill('Confraternização de fim de ano.')

    await page.getByRole('button', { name: /enviar pelo whatsapp/i }).click()

    const [url] = await abertos(page)
    expect(url, 'o envio precisa abrir o WhatsApp').toBeTruthy()

    const link = new URL(url!)
    expect(link.origin + link.pathname).toBe('https://api.whatsapp.com/send/')
    expect(link.searchParams.get('phone')).toBe(NUMERO_EVENTOS)
    expect(link.searchParams.get('type')).toBe('phone_number')
    expect(link.searchParams.get('app_absent')).toBe('0')

    const mensagem = link.searchParams.get('text') ?? ''
    expect(mensagem).toContain('*Nome:* Alex Rodrigues')
    expect(mensagem).toContain('*Telefone ou e-mail:* 61999999999')
    expect(mensagem).toContain('*Tipo de evento:* Corporativo')
    expect(mensagem).toContain('*Pessoas:* 40')
    // DD/MM/AAAA: quem lê a mensagem não espera o formato ISO do input.
    expect(mensagem).toContain('*Data pretendida:* 18/12/2026')
    expect(mensagem).toContain('*Sobre o evento:* Confraternização de fim de ano.')
  })

  test('opcionais em branco também vão na mensagem, como "Não informado"', async ({ page }) => {
    await irParaEventos(page)

    await page.getByLabel('Nome', { exact: true }).fill('Alex Rodrigues')
    await page.getByLabel(/telefone ou e-mail/i).fill('61999999999')
    await page.getByLabel(/tipo de evento/i).selectOption('Aniversário')
    await page.getByLabel('Pessoas', { exact: true }).fill('12')

    await page.getByRole('button', { name: /enviar pelo whatsapp/i }).click()

    const [url] = await abertos(page)
    const mensagem = new URL(url!).searchParams.get('text') ?? ''
    expect(mensagem).toContain('*Data pretendida:* Não informada')
    expect(mensagem).toContain('*Sobre o evento:* Não informado')
  })

  test('campos obrigatórios em branco não abrem conversa nenhuma', async ({ page }) => {
    await irParaEventos(page)

    await page.getByRole('button', { name: /enviar pelo whatsapp/i }).click()
    await page.waitForTimeout(300)

    expect(await abertos(page), 'não pode abrir o WhatsApp sem os dados').toHaveLength(0)
    await expect(page.getByText(/diga como podemos te chamar/i)).toBeVisible()
  })

  test('o link direto de eventos usa o mesmo número e formato', async ({ page }) => {
    await irParaEventos(page)

    const direto = page.locator('#eventos').getByRole('link', { name: /whatsapp/i }).first()
    const href = (await direto.getAttribute('href')) ?? ''
    const link = new URL(href)
    expect(link.origin + link.pathname).toBe('https://api.whatsapp.com/send/')
    expect(link.searchParams.get('phone')).toBe(NUMERO_EVENTOS)
  })
})
