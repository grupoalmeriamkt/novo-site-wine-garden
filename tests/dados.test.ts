import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { WINES } from '../src/data/generated/wines.ts'
import { MENU_ITEMS } from '../src/data/generated/menu.ts'
import { COUNTRIES, countrySlugFor, OTHER_ORIGINS } from '../src/data/countries.ts'
import { cartSummary, filterWines, EMPTY_FILTERS, countryStats } from '../src/lib/wines.ts'
import { matchWines, dishesForMatch } from '../src/lib/wine-match.ts'
import { DISH_PHOTOS } from '../src/data/photos.ts'
import { PHOTO_BY_ID } from '../src/data/generated/photo-manifest.ts'

/**
 * Testes de integridade dos dados.
 *
 * O que estes testes protegem não é o código: é a promessa de que nada no site
 * foi inventado. Se alguém editar à mão um arquivo gerado, ou se o extrator
 * regredir, é aqui que aparece.
 *
 * Rodar: node --test --experimental-strip-types tests/
 */

const deaccent = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Índice nome+preço do cardápio oficial — a fonte de verdade. */
function sourceIndex(): Set<string> {
  const md = readFileSync(new URL('../Wine Garden  Cardapio Completo.md', import.meta.url), 'utf8')
  const set = new Set<string>()
  const toNumber = (raw: string) => Number(raw.replace(/\./g, '').replace(',', '.'))
  for (const line of md.split('\n')) {
    const bold = line.match(/^\*\*(.+?)\*\*\s+—\s+R\$\s*([\d.]+,\d{2})/)
    if (bold?.[1] && bold[2]) set.add(`${deaccent(bold[1])}|${toNumber(bold[2])}`)
    const row = line.match(/^\|\s*([^|]+?)\s*\|\s*R\$\s*([\d.]+,\d{2})\s*\|/)
    if (row?.[1] && row[2] && !/^item$/i.test(row[1].trim())) {
      set.add(`${deaccent(row[1])}|${toNumber(row[2])}`)
    }
  }
  return set
}

describe('procedência do conteúdo', () => {
  const source = sourceIndex()

  it('todo vinho existe no cardápio oficial com o mesmo preço', () => {
    const invented = WINES.filter((w) => !source.has(`${deaccent(w.name)}|${w.price}`))
    assert.deepEqual(
      invented.map((w) => `${w.name} (R$ ${w.price})`),
      [],
      'rótulo ou preço não confere com o documento',
    )
  })

  it('todo item do cardápio existe no documento com o mesmo preço', () => {
    const invented = MENU_ITEMS.filter((m) => !source.has(`${deaccent(m.name)}|${m.price}`))
    assert.deepEqual(invented.map((m) => `${m.name} (R$ ${m.price})`), [])
  })

  it('não há id duplicado', () => {
    for (const [label, list] of [
      ['vinhos', WINES],
      ['cardápio', MENU_ITEMS],
    ] as const) {
      const ids = list.map((i) => i.id)
      assert.equal(new Set(ids).size, ids.length, `id duplicado em ${label}`)
    }
  })

  it('preços são positivos e plausíveis', () => {
    for (const wine of WINES) {
      assert.ok(wine.price > 0, `${wine.name} com preço ${wine.price}`)
      assert.ok(wine.price < 5000, `${wine.name} com preço improvável`)
    }
  })

  it('campo desconhecido está vazio, nunca preenchido com placeholder', () => {
    const suspeitos = WINES.filter((w) =>
      [w.country, w.region, w.body].some((v) => /^(n\/a|na|desconhecid|indefinid|todo|tbd|-)$/i.test(v)),
    )
    assert.deepEqual(suspeitos.map((w) => w.name), [])
  })
})

describe('cartografia', () => {
  it('os 8 países da identidade têm selo e mapa declarados', () => {
    assert.equal(COUNTRIES.length, 8)
    for (const country of COUNTRIES) {
      assert.match(country.sealSrc, /^\/brand\/selos\//)
      assert.match(country.mapSrc, /^\/brand\/mapas\//)
      assert.ok(country.x >= 0 && country.x <= 1, `${country.name} com x fora de 0–1`)
      assert.ok(country.y >= 0 && country.y <= 1, `${country.name} com y fora de 0–1`)
      assert.ok(country.note.length > 20, `${country.name} sem nota editorial`)
    }
  })

  it('todo país da cartografia tem pelo menos um rótulo na carta', () => {
    for (const country of COUNTRIES) {
      const stats = countryStats(country.slug)
      assert.ok(stats.total > 0, `${country.name} não tem vinho na carta`)
    }
  })

  it('nenhuma origem da carta fica órfã: ou tem selo, ou está em OTHER_ORIGINS', () => {
    const conhecidas = new Set<string>(OTHER_ORIGINS)
    const orfas = new Set<string>()
    for (const wine of WINES) {
      if (!wine.country) continue
      if (countrySlugFor(wine.country)) continue
      if (conhecidas.has(wine.country)) continue
      orfas.add(wine.country)
    }
    assert.deepEqual([...orfas], [], 'origem sem selo e fora de OTHER_ORIGINS')
  })
})

describe('filtros', () => {
  it('sem filtro devolve a carta inteira', () => {
    assert.equal(filterWines(WINES, EMPTY_FILTERS).length, WINES.length)
  })

  it('filtrar por serviço e categoria compõe', () => {
    const tacas = filterWines(WINES, { ...EMPTY_FILTERS, serving: 'taca' })
    assert.ok(tacas.length > 0)
    assert.ok(tacas.every((w) => w.servingType === 'taca'))

    const tintos = filterWines(WINES, {
      ...EMPTY_FILTERS,
      serving: 'taca',
      categories: ['Tinto Médio Corpo'],
    })
    assert.ok(tintos.length > 0 && tintos.length < tacas.length)
    assert.ok(tintos.every((w) => w.servingType === 'taca' && w.category === 'Tinto Médio Corpo'))
  })

  it('a busca ignora acento e caixa', () => {
    const comAcento = filterWines(WINES, { ...EMPTY_FILTERS, query: 'França' })
    const semAcento = filterWines(WINES, { ...EMPTY_FILTERS, query: 'franca' })
    assert.equal(comAcento.length, semAcento.length)
    assert.ok(comAcento.length > 0)
  })

  it('faixa de preço respeita os dois extremos', () => {
    const faixa = filterWines(WINES, { ...EMPTY_FILTERS, price: [100, 200] })
    assert.ok(faixa.every((w) => w.price >= 100 && w.price <= 200))
  })
})

describe('wine match', () => {
  it('sempre devolve entre 2 e 4 recomendações reais', () => {
    const momentos = ['jantar', 'encontro', 'brinde', 'descobrir'] as const
    const estilos = ['leve-fresco', 'aromatico', 'estruturado', 'intenso'] as const
    const orcamentos = ['ate-60', '60-150', '150-350', 'sem-limite'] as const

    const idsValidos = new Set(WINES.map((w) => w.id))

    for (const moment of momentos) {
      for (const style of estilos) {
        for (const budget of orcamentos) {
          const { results } = matchWines({ moment, style, dish: null, budget })
          const rotulo = `${moment}/${style}/${budget}`
          assert.ok(results.length >= 2, `${rotulo} devolveu ${results.length}`)
          assert.ok(results.length <= 4, `${rotulo} devolveu ${results.length}`)
          for (const r of results) {
            assert.ok(idsValidos.has(r.wine.id), `${rotulo} devolveu rótulo inexistente`)
            assert.ok(r.reasons.length > 0, `${rotulo} devolveu recomendação sem justificativa`)
          }
        }
      }
    }
  })

  it('a harmonização do prato aparece na justificativa', () => {
    const { results } = matchWines({
      moment: 'jantar',
      style: 'intenso',
      dish: 'file-au-poivre',
      budget: '150-350',
    })
    const top = results[0]
    assert.ok(top)
    assert.ok(
      top.reasons.some((r) => r.includes('cardápio harmoniza')),
      'a recomendação principal deveria citar a harmonização oficial',
    )
  })

  it('só oferece pratos que a casa realmente harmonizou', () => {
    const pratos = dishesForMatch()
    assert.ok(pratos.length > 0)
    assert.ok(pratos.every((p) => p.pairings.length > 0))
  })

  it('resultado é determinístico: mesma entrada, mesma saída', () => {
    const entrada = { moment: 'encontro', style: 'aromatico', dish: null, budget: '60-150' } as const
    const a = matchWines(entrada).results.map((r) => r.wine.id)
    const b = matchWines(entrada).results.map((r) => r.wine.id)
    assert.deepEqual(a, b)
  })
})

describe('curadoria fotográfica', () => {
  it('toda foto referenciada existe no manifesto', () => {
    const faltando = Object.values(DISH_PHOTOS)
      .flat()
      .filter((id) => !PHOTO_BY_ID[id])
    assert.deepEqual(faltando, [])
  })

  it('todo prato com foto existe no cardápio', () => {
    const ids = new Set(MENU_ITEMS.map((m) => m.id))
    const orfaos = Object.keys(DISH_PHOTOS).filter((id) => !ids.has(id))
    assert.deepEqual(orfaos, [])
  })
})

describe('resumo da carta', () => {
  it('os números derivam dos dados, não são escritos à mão', () => {
    const resumo = cartSummary()
    assert.equal(resumo.total, WINES.length)
    assert.equal(resumo.byGlass + resumo.byBottle, WINES.length)
    assert.ok(resumo.countries > 10)
    assert.ok(resumo.minPrice > 0)
    assert.ok(resumo.maxPrice > resumo.minPrice)
  })
})

describe('sommelier', () => {
  it('sem provedor, resolve pelo algoritmo determinístico', async () => {
    const { askSommelier, hasSommelierProvider } = await import('../src/lib/sommelier.ts')
    assert.equal(hasSommelierProvider(), false)

    const resposta = await askSommelier(
      { answers: { moment: 'jantar', style: 'intenso', dish: null, budget: '150-350' } },
      { wines: WINES, limit: 3 },
    )
    assert.equal(resposta.source, 'deterministico')
    assert.ok(resposta.results.length >= 2)
    assert.ok(resposta.results.length <= 3)
  })

  it('descarta rótulo que o provedor inventar e cai no algoritmo local', async () => {
    const { askSommelier, registerSommelierProvider } = await import('../src/lib/sommelier.ts')

    // Provedor que alucina: devolve um id que não existe na carta.
    registerSommelierProvider({
      name: 'teste',
      recommend: async () => ({ wineIds: ['vinho-que-nao-existe'], reasons: {} }),
    })

    const resposta = await askSommelier(
      { answers: { moment: 'brinde', style: 'leve-fresco', dish: null, budget: 'sem-limite' } },
      { wines: WINES, limit: 3 },
    )

    // A barreira funcionou: nenhum rótulo inventado passou.
    assert.equal(resposta.source, 'deterministico')
    const idsValidos = new Set(WINES.map((w) => w.id))
    for (const r of resposta.results) assert.ok(idsValidos.has(r.wine.id))

    registerSommelierProvider(null)
  })

  it('aceita rótulo válido vindo do provedor', async () => {
    const { askSommelier, registerSommelierProvider } = await import('../src/lib/sommelier.ts')
    const alvo = WINES[10]
    assert.ok(alvo)

    registerSommelierProvider({
      name: 'teste',
      recommend: async () => ({
        wineIds: [alvo.id],
        reasons: { [alvo.id]: ['motivo de teste'] },
        preamble: 'olá',
      }),
    })

    const resposta = await askSommelier({ text: 'qualquer' }, { wines: WINES, limit: 3 })
    assert.equal(resposta.source, 'provedor')
    assert.equal(resposta.results[0]?.wine.id, alvo.id)
    assert.equal(resposta.preamble, 'olá')

    registerSommelierProvider(null)
  })
})

describe('vocabulário compartilhado', () => {
  it('toda harmonização do cardápio mapeia para uma categoria da carta', async () => {
    const { PAIRING_TO_CATEGORY } = await import('../src/lib/wine-vocab.ts')
    const categoriasReais = new Set(WINES.map((w) => w.category))

    const usadas = new Set<string>()
    for (const item of MENU_ITEMS) for (const p of item.pairings) usadas.add(p)

    const semMapa = [...usadas].filter((p) => !PAIRING_TO_CATEGORY[p])
    assert.deepEqual(semMapa, [], 'harmonização do cardápio sem categoria correspondente')

    for (const p of usadas) {
      const categoria = PAIRING_TO_CATEGORY[p]!
      assert.ok(categoriasReais.has(categoria), `${p} → ${categoria} não existe na carta`)
    }
  })

  it('os slugs de categoria fazem ida e volta', async () => {
    const { CATEGORY_SLUG, SLUG_TO_CATEGORY } = await import('../src/lib/wine-vocab.ts')
    for (const [categoria, slug] of Object.entries(CATEGORY_SLUG)) {
      assert.equal(SLUG_TO_CATEGORY[slug], categoria)
    }
  })
})
