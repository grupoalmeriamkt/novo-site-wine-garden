import { WINES } from '@/data/generated/wines'
import { COUNTRIES, countrySlugFor } from '@/data/countries'
import type { CountrySlug, ServingType, Wine, WineBody, WineCategory } from '@/types/content'

/**
 * Consultas sobre a carta.
 *
 * Tudo aqui é função pura sobre o array gerado — nada de estado, nada de I/O.
 * Isso deixa a página de vinhos ser um Server Component que só passa dados
 * prontos para o cliente filtrar, e permite testar a lógica sem montar React.
 */

export type WineFilters = {
  serving: ServingType | 'todos'
  categories: readonly WineCategory[]
  countries: readonly string[]
  grapes: readonly string[]
  bodies: readonly WineBody[]
  /** Faixa [min, max] em reais. */
  price: readonly [number, number] | null
  /** Busca livre em nome, região, uva e descrição. */
  query: string
  veganOnly: boolean
}

export const EMPTY_FILTERS: WineFilters = {
  serving: 'todos',
  categories: [],
  countries: [],
  grapes: [],
  bodies: [],
  price: null,
  query: '',
  veganOnly: false,
}

const deaccent = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Ordem de exibição das categorias — a mesma do cardápio impresso. */
export const CATEGORY_ORDER: readonly WineCategory[] = [
  'Espumante',
  'Branco Leve Fresco',
  'Brancos Aromáticos',
  'Branco Amadeirado',
  'Rosé e Laranja',
  'Tinto Leve',
  'Tinto Médio Corpo',
  'Tinto Encorpado',
  'Vinho Sobremesa',
]

export function filterWines(wines: readonly Wine[], filters: WineFilters): Wine[] {
  const query = deaccent(filters.query.trim())

  return wines.filter((wine) => {
    if (filters.serving !== 'todos' && wine.servingType !== filters.serving) return false
    if (filters.categories.length > 0 && !filters.categories.includes(wine.category)) return false
    if (filters.countries.length > 0 && !filters.countries.includes(wine.country)) return false
    if (filters.bodies.length > 0 && !filters.bodies.includes(wine.body)) return false
    if (filters.veganOnly && !wine.vegan) return false

    if (filters.grapes.length > 0) {
      const grapes = wine.grapes.map(deaccent)
      if (!filters.grapes.some((g) => grapes.includes(deaccent(g)))) return false
    }

    if (filters.price) {
      const [min, max] = filters.price
      if (wine.price < min || wine.price > max) return false
    }

    if (query) {
      // Busca no que o visitante realmente digitaria: nome, país, região, uva.
      // A descrição entra por último para não inflar demais o índice.
      const haystack = deaccent(
        [wine.name, wine.country, wine.region, wine.grapes.join(' '), wine.category, wine.description].join(' '),
      )
      if (!haystack.includes(query)) return false
    }

    return true
  })
}

/** Conta quantos resultados cada valor de uma faceta traria, dados os demais
 *  filtros ativos. É o que permite desabilitar opções que levariam a zero. */
export function facetCounts<K extends keyof WineFilters>(
  wines: readonly Wine[],
  filters: WineFilters,
  facet: K,
  values: readonly string[],
  pick: (wine: Wine) => string | readonly string[],
): Record<string, number> {
  const withoutFacet = { ...filters, [facet]: EMPTY_FILTERS[facet] } as WineFilters
  const base = filterWines(wines, withoutFacet)
  const counts: Record<string, number> = {}
  for (const value of values) counts[value] = 0
  for (const wine of base) {
    const picked = pick(wine)
    const list = typeof picked === 'string' ? [picked] : picked
    for (const item of list) {
      if (item in counts) counts[item] = (counts[item] ?? 0) + 1
    }
  }
  return counts
}

/** Países presentes na carta, ordenados por número de rótulos. */
export function countriesInList(wines: readonly Wine[] = WINES): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const wine of wines) {
    if (!wine.country) continue
    counts.set(wine.country, (counts.get(wine.country) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))
}

/** Uvas mais frequentes. O corte existe porque a cauda longa tem dezenas de
 *  castas com um único rótulo, que só poluiriam o filtro. */
export function topGrapes(wines: readonly Wine[] = WINES, minCount = 2): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const wine of wines) {
    for (const grape of wine.grapes) {
      const key = grape.trim()
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))
}

/** Rótulos de um país da cartografia. */
export function winesByCountry(slug: CountrySlug, wines: readonly Wine[] = WINES): Wine[] {
  return wines.filter((wine) => countrySlugFor(wine.country) === slug)
}

/** Agregado por país para a experiência "Viaje o mundo". */
export type CountryStats = {
  slug: CountrySlug
  total: number
  byGlass: number
  byBottle: number
  regions: string[]
  grapes: string[]
  minPrice: number
  maxPrice: number
}

export function countryStats(slug: CountrySlug, wines: readonly Wine[] = WINES): CountryStats {
  const list = winesByCountry(slug, wines)
  const regions = new Set<string>()
  const grapes = new Set<string>()
  for (const wine of list) {
    // A carta escreve "Valdeorras, Galícia, Espanha" — a primeira parte é a
    // denominação, que é o que interessa mostrar.
    if (wine.region) regions.add(wine.region.split(',')[0]!.trim())
    for (const grape of wine.grapes) grapes.add(grape)
  }
  const prices = list.map((w) => w.price)
  return {
    slug,
    total: list.length,
    byGlass: list.filter((w) => w.servingType === 'taca').length,
    byBottle: list.filter((w) => w.servingType === 'garrafa').length,
    regions: [...regions].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    grapes: [...grapes].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    minPrice: prices.length > 0 ? Math.min(...prices) : 0,
    maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
  }
}

export function allCountryStats(wines: readonly Wine[] = WINES): CountryStats[] {
  return COUNTRIES.map((country) => countryStats(country.slug, wines))
}

/** Números da carta, para as seções editoriais. Derivados, nunca escritos à mão. */
export function cartSummary(wines: readonly Wine[] = WINES) {
  const countries = new Set(wines.map((w) => w.country).filter(Boolean))
  const prices = wines.map((w) => w.price)
  return {
    total: wines.length,
    countries: countries.size,
    byGlass: wines.filter((w) => w.servingType === 'taca').length,
    byBottle: wines.filter((w) => w.servingType === 'garrafa').length,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
  }
}

export { WINES }
