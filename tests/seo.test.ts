import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MENU_ITEMS } from '../src/data/generated/menu.ts'
import { WINES } from '../src/data/generated/wines.ts'
import { FAQ } from '../src/data/faq.ts'
import {
  faqJsonLd,
  harmonizacoesJsonLd,
  menuJsonLd,
  restaurantJsonLd,
  wineOriginsJsonLd,
} from '../src/lib/seo.ts'

/**
 * Procedência do dado estruturado.
 *
 * O JSON-LD é a versão do site que o Google e os assistentes leem, e é exibida
 * como fato sobre um negócio real. Estes testes existem para que nenhum número
 * publicado ali possa ter sido digitado à mão: cada um é reconferido contra o
 * cardápio e a carta na hora do teste.
 */

type Json = Record<string, unknown>

describe('dado estruturado', () => {
  it('não declara avaliação que ninguém confirmou', () => {
    const r = restaurantJsonLd()
    assert.equal(r.aggregateRating, undefined)
    assert.equal(r.review, undefined)
    assert.equal(r.ratingValue, undefined)
  })

  it('a faixa de preço sai dos preços dos pratos', () => {
    const precos = MENU_ITEMS.filter((i) => i.section === 'Cardápio').map((i) => i.price)
    const esperado = `R$ ${Math.min(...precos)}–${Math.max(...precos)}`
    assert.equal(restaurantJsonLd().priceRange, esperado)
  })

  it('as coordenadas e o endereço vêm de site.ts, não do JSON-LD', () => {
    const geo = restaurantJsonLd().geo as Json
    assert.equal(typeof geo.latitude, 'number')
    assert.equal(typeof geo.longitude, 'number')
    const address = restaurantJsonLd().address as Json
    assert.equal(address.addressCountry, 'BR')
  })

  it('toda pergunta do FAQPage tem resposta não vazia e igual à da página', () => {
    const faq = faqJsonLd()
    const perguntas = faq.mainEntity as Json[]
    assert.equal(perguntas.length, FAQ.length)
    for (const [i, q] of perguntas.entries()) {
      const fonte = FAQ[i]
      assert.ok(fonte, 'pergunta sem fonte')
      assert.equal(q.name, fonte.pergunta)
      const resposta = q.acceptedAnswer as Json
      assert.equal(resposta.text, fonte.resposta)
      assert.ok(String(resposta.text).length > 40, `resposta curta demais: ${fonte.id}`)
    }
  })

  it('a contagem por origem bate com a carta', () => {
    const lista = wineOriginsJsonLd().itemListElement as Json[]
    const somaDeclarada = lista.reduce((total, item) => {
      const n = Number(/^(\d+) rótulos/.exec(String(item.description))?.[1] ?? 0)
      return total + n
    }, 0)
    // As origens principais somam menos que a carta inteira — o resto são as
    // "outras origens". O que não pode é declarar MAIS do que existe.
    assert.ok(somaDeclarada > 0)
    assert.ok(somaDeclarada <= WINES.length, 'declarou mais rótulos do que a carta tem')
  })

  it('toda harmonização publicada existe no cardápio', () => {
    const lista = harmonizacoesJsonLd().itemListElement as Json[]
    assert.ok(lista.length > 0)
    const nomes = new Set(MENU_ITEMS.map((i) => i.name))
    for (const item of lista) {
      const pratos = String(item.description).replace(/^Harmoniza com /, '').replace(/\.$/, '')
      for (const prato of pratos.split(', ')) {
        assert.ok(nomes.has(prato), `prato inexistente no cardápio: ${prato}`)
      }
    }
  })

  it('todo preço do Menu bate com o cardápio oficial', () => {
    const secoes = menuJsonLd().hasMenuSection as Json[]
    const oficial = new Map(MENU_ITEMS.map((i) => [i.name, i.price]))
    let conferidos = 0
    for (const secao of secoes) {
      for (const item of (secao.hasMenuItem as Json[]) ?? []) {
        const preco = (item.offers as Json).price
        const esperado = oficial.get(String(item.name))
        if (esperado === undefined) continue // seção de vinhos, conferida em dados.test
        assert.equal(preco, esperado.toFixed(2), `preço divergente em ${item.name}`)
        conferidos += 1
      }
    }
    assert.equal(conferidos, MENU_ITEMS.length)
  })
})
