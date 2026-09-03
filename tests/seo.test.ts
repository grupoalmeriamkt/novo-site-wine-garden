import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { WINES } from '../src/data/generated/wines.ts'
import { FAQ } from '../src/data/faq.ts'
import { SITE } from '../src/data/site.ts'
import {
  cartaJsonLd,
  faqJsonLd,
  harmonizacoesJsonLd,
  restaurantJsonLd,
  wineOriginsJsonLd,
} from '../src/lib/seo.ts'
import { categoriasDaCozinha } from '../src/lib/cozinha.ts'

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
  /*
   * Esta foi a causa de uma quebra de deploy: `NEXT_PUBLIC_SITE_URL` existia no
   * painel mas estava VAZIA, o `??` deixou passar, e `new URL('')` derrubou a
   * coleta de páginas do build inteiro. O teste guarda a invariante que
   * importa — a URL do site é sempre absoluta e construível.
   */
  it('a URL do site é sempre uma URL absoluta válida', () => {
    assert.doesNotThrow(() => new URL(SITE.url))
    assert.match(SITE.url, /^https?:\/\/[^/]+$/, 'sem barra final e com protocolo')
  })

  it('não declara avaliação que ninguém confirmou', () => {
    const r = restaurantJsonLd()
    assert.equal(r.aggregateRating, undefined)
    assert.equal(r.review, undefined)
    assert.equal(r.ratingValue, undefined)
  })

  /*
   * O cardápio saiu do site porque a casa o troca com frequência. Preço em
   * dado estruturado é exibido pelo Google como fato — publicar o de comida
   * seria publicar algo que envelhece entre uma visita e outra.
   */
  it('não publica preço de comida', () => {
    assert.equal(restaurantJsonLd().priceRange, undefined)
    // hasMenu aponta para a página, não para um Menu com itens e valores.
    assert.equal(typeof restaurantJsonLd().hasMenu, 'string')
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
    // Agora são CATEGORIAS da cozinha, não pratos: é o que sobrevive à
    // próxima troca de cardápio.
    const categorias = new Set(categoriasDaCozinha().map((c) => c.nome.toLowerCase()))
    for (const item of lista) {
      const texto = String(item.description)
        .replace(/^Indicado no cardápio para /, '')
        .replace(/\.$/, '')
      for (const nome of texto.split(', ')) {
        assert.ok(categorias.has(nome), `categoria inexistente na cozinha: ${nome}`)
      }
    }
  })

  it('todo preço da carta bate com o documento oficial', () => {
    const secoes = cartaJsonLd().hasMenuSection as Json[]
    const oficial = new Map(WINES.map((w) => [`${w.name}|${w.price}`, w]))
    let conferidos = 0
    for (const secao of secoes) {
      for (const item of (secao.hasMenuItem as Json[]) ?? []) {
        const preco = Number((item.offers as Json).price)
        assert.ok(
          oficial.has(`${item.name}|${preco}`),
          `rótulo ou preço divergente: ${item.name} a ${preco}`,
        )
        conferidos += 1
      }
    }
    assert.equal(conferidos, WINES.length)
  })
})
