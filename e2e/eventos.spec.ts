import { expect, test } from '@playwright/test'

/**
 * O formulário de eventos.
 *
 * É o único formulário do site e o canal comercial da casa: o que ele monta vai
 * para o WhatsApp de eventos, com todos os campos na mensagem. Não há backend —
 * um formulário que responde "recebemos!" sem enviar nada seria pior que não
 * ter formulário.
 *
 * O que estes testes guardam é justamente o que quebraria em silêncio: o
 * NÚMERO de destino (trocá-lo desvia todos os leads) e a presença de cada
 * campo preenchido dentro da mensagem.
 */

/** O número comercial de eventos, informado pela casa. */
const NUMERO_EVENTOS = '5561993378338'

test.describe('Eventos', () => {
  test('o formulário abre o WhatsApp de eventos com todos os campos', async ({ page, context }) => {
    await page.goto('/')
    await page.locator('#eventos').scrollIntoViewIfNeeded()

    await page.getByLabel('Nome', { exact: true }).fill('Alex Rodrigues')
    await page.getByLabel(/telefone ou e-mail/i).fill('61999999999')
    await page.getByLabel(/tipo de evento/i).selectOption('Corporativo')
    await page.getByLabel('Pessoas', { exact: true }).fill('40')
    await page.getByLabel(/data pretendida/i).fill('2026-12-18')
    await page.getByLabel(/sobre o evento/i).fill('Confraternização de fim de ano.')

    // O envio abre uma aba nova: interceptamos para ler a URL sem sair do site.
    const abaNova = context.waitForEvent('page')
    await page.getByRole('button', { name: /enviar pelo whatsapp/i }).click()
    const destino = await abaNova
    const url = destino.url()

    /*
     * O `wa.me` redireciona para `api.whatsapp.com/send/?phone=…`, então a
     * asserção é sobre o NÚMERO, e não sobre o formato da URL — que é do
     * WhatsApp e pode mudar sem aviso.
     */
    expect(url, 'precisa apontar para o WhatsApp de eventos').toContain(NUMERO_EVENTOS)

    const mensagem = new URL(url).searchParams.get('text') ?? ''
    expect(mensagem).toContain('Alex Rodrigues')
    expect(mensagem).toContain('61999999999')
    expect(mensagem).toContain('Corporativo')
    expect(mensagem).toContain('40')
    // A data sai em DD/MM/AAAA: quem lê a mensagem não espera o formato ISO.
    expect(mensagem).toContain('18/12/2026')
    expect(mensagem).toContain('Confraternização de fim de ano.')

    await destino.close()
  })

  test('campos obrigatórios em branco não abrem conversa nenhuma', async ({ page }) => {
    await page.goto('/')
    await page.locator('#eventos').scrollIntoViewIfNeeded()

    let abriu = false
    page.context().on('page', () => {
      abriu = true
    })

    await page.getByRole('button', { name: /enviar pelo whatsapp/i }).click()
    await page.waitForTimeout(500)

    expect(abriu, 'não pode abrir o WhatsApp sem os dados').toBe(false)
    await expect(page.getByText(/diga como podemos te chamar/i)).toBeVisible()
  })

  test('o link direto de eventos usa o mesmo número', async ({ page }) => {
    await page.goto('/')
    await page.locator('#eventos').scrollIntoViewIfNeeded()

    const direto = page.getByRole('link', { name: /whatsapp/i }).first()
    await expect(direto).toHaveAttribute('href', `https://wa.me/${NUMERO_EVENTOS}`)
  })
})
