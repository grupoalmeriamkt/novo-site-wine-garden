'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { COUNTRY_BY_SLUG, countrySlugFor } from '@/data/countries'
import { BRAND_COPY } from '@/data/site'
import {
  CATEGORY_ORDER,
  EMPTY_FILTERS,
  facetCounts,
  filterWines,
  type WineFilters as CartFilters,
} from '@/lib/wines'
import { track } from '@/lib/analytics'
import type { ServingType, Wine, WineBody, WineCategory } from '@/types/content'
import { WineCard } from './WineCard'
import { WineFilters, type FacetGroup, type FacetKey } from './WineFilters'
import styles from './WineExplorer.module.css'

/* =========================================================================
   CONTRATO DA URL
   O estado da exploração mora inteiro na barra de endereço, em português:
   /vinhos?pais=franca · /vinhos?categoria=tinto-encorpado · ?servico=taca
   Isso é o que torna cada recorte da carta um link que a casa pode divulgar,
   e é o que faz o botão VOLTAR do navegador desfazer uma escolha.
   ========================================================================= */

const PARAM = {
  serving: 'servico',
  categories: 'categoria',
  countries: 'pais',
  grapes: 'uva',
  bodies: 'corpo',
  price: 'preco',
  vegan: 'vegano',
  query: 'busca',
  view: 'ver',
} as const

/** A faceta livre não é uma faceta de lista, mas aparece nos chips e no track. */
type ChipKey = FacetKey | 'busca'

/** Quantos rótulos entram por lote. 159 de uma vez não é uma carta, é um dump. */
const PAGE_SIZE = 24

type SolidBody = Exclude<WineBody, ''>

const BODY_VALUES: readonly SolidBody[] = ['leve', 'medio', 'encorpado']

const BODY_LABEL: Readonly<Record<SolidBody, string>> = {
  leve: 'Leve',
  medio: 'Médio',
  encorpado: 'Encorpado',
}

const SERVING_LABEL: Readonly<Record<ServingType, string>> = {
  taca: 'Em taça',
  garrafa: 'Em garrafa',
}

/**
 * Faixas de preço.
 *
 * Os limites não se sobrepõem (61, 151, 351) porque `filterWines` usa intervalo
 * fechado nos dois lados: com [0,60] e [60,150] um rótulo de R$ 60 seria contado
 * duas vezes e as somas das facetas não bateriam. Como a carta só tem valores
 * inteiros, o corte é exato — e o rótulo da faixa continua legível em redondos.
 */
type PriceBand = { id: string; label: string; range: readonly [number, number] }

const PRICE_BANDS: readonly PriceBand[] = [
  { id: 'ate-60', label: 'Até R$ 60', range: [0, 60] },
  { id: '60-150', label: 'R$ 60 a R$ 150', range: [61, 150] },
  { id: '150-350', label: 'R$ 150 a R$ 350', range: [151, 350] },
  { id: 'acima-350', label: 'Acima de R$ 350', range: [351, Number.POSITIVE_INFINITY] },
]

function bandIdFor(price: number): string {
  return PRICE_BANDS.find((band) => price >= band.range[0] && price <= band.range[1])?.id ?? ''
}

/** Os dois modos de serviço como porta de entrada, com a copy oficial da marca. */
const SERVING_ENTRY = [
  {
    value: 'taca',
    title: 'Em taça',
    note: BRAND_COPY.travel.join(', '),
    art: '/brand/tacas/purpura.svg',
  },
  {
    value: 'garrafa',
    title: 'Em garrafa',
    note: BRAND_COPY.connections,
    art: '/brand/tacas/conjunto.svg',
  },
] as const

/* ------------------------------------------------------------------ slugs */

/** "Tinto Encorpado" → "tinto-encorpado"; "França" → "franca". */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Dicionário slug ↔ valor canônico.
 *
 * A URL fala slug ("tinto-encorpado"), os dados falam o rótulo exato do
 * cardápio ("Tinto Encorpado"). Traduzir num lugar só evita que um acento vire
 * um filtro que não casa com nada — e um slug desconhecido simplesmente some,
 * em vez de zerar a lista.
 */
type Catalog = {
  categories: ReadonlyMap<string, WineCategory>
  countries: ReadonlyMap<string, string>
  grapes: ReadonlyMap<string, string>
  slugOf: ReadonlyMap<string, string>
}

function buildCatalog(
  countries: readonly { name: string; count: number }[],
  grapes: readonly { name: string; count: number }[],
): Catalog {
  const categories = new Map<string, WineCategory>()
  const countryMap = new Map<string, string>()
  const grapeMap = new Map<string, string>()
  const slugOf = new Map<string, string>()

  for (const category of CATEGORY_ORDER) {
    const slug = slugify(category)
    categories.set(slug, category)
    slugOf.set(category, slug)
  }
  for (const { name } of countries) {
    const slug = slugify(name)
    countryMap.set(slug, name)
    slugOf.set(name, slug)
  }
  for (const { name } of grapes) {
    const slug = slugify(name)
    grapeMap.set(slug, name)
    slugOf.set(name, slug)
  }

  return { categories, countries: countryMap, grapes: grapeMap, slugOf }
}

/* --------------------------------------------------------- URL ↔ filtros */

type ParamsLike = { get(name: string): string | null }

function parseFilters(params: ParamsLike, catalog: Catalog): CartFilters {
  const list = (key: string) =>
    (params.get(key) ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)

  const serving = params.get(PARAM.serving)
  const band = PRICE_BANDS.find((item) => item.id === params.get(PARAM.price))

  return {
    serving: serving === 'taca' || serving === 'garrafa' ? serving : 'todos',
    categories: list(PARAM.categories)
      .map((slug) => catalog.categories.get(slug))
      .filter((value): value is WineCategory => value !== undefined),
    countries: list(PARAM.countries)
      .map((slug) => catalog.countries.get(slug))
      .filter((value): value is string => value !== undefined),
    grapes: list(PARAM.grapes)
      .map((slug) => catalog.grapes.get(slug))
      .filter((value): value is string => value !== undefined),
    bodies: list(PARAM.bodies).filter((value): value is SolidBody =>
      (BODY_VALUES as readonly string[]).includes(value),
    ),
    price: band ? band.range : null,
    query: params.get(PARAM.query) ?? '',
    veganOnly: params.get(PARAM.vegan) === '1',
  }
}

function serializeFilters(filters: CartFilters, showAll: boolean, catalog: Catalog): string {
  const params = new URLSearchParams()
  const slug = (value: string) => catalog.slugOf.get(value) ?? slugify(value)

  if (filters.serving !== 'todos') params.set(PARAM.serving, filters.serving)
  if (filters.categories.length > 0) params.set(PARAM.categories, filters.categories.map(slug).join(','))
  if (filters.countries.length > 0) params.set(PARAM.countries, filters.countries.map(slug).join(','))
  if (filters.grapes.length > 0) params.set(PARAM.grapes, filters.grapes.map(slug).join(','))
  if (filters.bodies.length > 0) params.set(PARAM.bodies, filters.bodies.filter(Boolean).join(','))

  const price = filters.price
  if (price) {
    const band = PRICE_BANDS.find((item) => item.range[0] === price[0] && item.range[1] === price[1])
    if (band) params.set(PARAM.price, band.id)
  }

  if (filters.veganOnly) params.set(PARAM.vegan, '1')
  if (filters.query.trim()) params.set(PARAM.query, filters.query.trim())
  // `ver=lista` só faz sentido enquanto nenhum filtro está ativo: com filtro, a
  // própria presença dele já significa "estou na lista".
  if (showAll && !hasActiveFilters(filters)) params.set(PARAM.view, 'lista')

  // URLSearchParams escapa a vírgula; devolvemos o caractere porque ele é
  // legal em query string e um link de divulgação precisa ser legível.
  return params.toString().replace(/%2C/g, ',')
}

function hasActiveFilters(filters: CartFilters): boolean {
  return (
    filters.serving !== 'todos' ||
    filters.categories.length > 0 ||
    filters.countries.length > 0 ||
    filters.grapes.length > 0 ||
    filters.bodies.length > 0 ||
    filters.price !== null ||
    filters.veganOnly ||
    filters.query.trim() !== ''
  )
}

/** O que zerar quando o visitante remove uma faceta inteira. */
const RESET_PATCH: Readonly<Record<ChipKey, Partial<CartFilters>>> = {
  servico: { serving: 'todos' },
  categoria: { categories: [] },
  pais: { countries: [] },
  uva: { grapes: [] },
  corpo: { bodies: [] },
  preco: { price: null },
  vegano: { veganOnly: false },
  busca: { query: '' },
}

function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

/* ========================================================================= */

type WineExplorerProps = {
  wines: readonly Wine[]
  /** Países presentes na carta, já ordenados por volume — vêm do servidor. */
  countries: readonly { name: string; count: number }[]
  /** Castas com dois rótulos ou mais; a cauda longa só poluiria o filtro. */
  grapes: readonly { name: string; count: number }[]
}

/**
 * O explorador da carta.
 *
 * A decisão estruturante: **ninguém entra numa lista de 159 rótulos**. A porta
 * é uma exploração em três perguntas grandes — taça ou garrafa, qual estilo,
 * qual origem — desenhadas como índice editorial, com a contagem real ao lado
 * de cada opção. A lista só nasce depois de uma escolha (ou de um pedido
 * explícito de ver a carta inteira), e aí os filtros passam a morar num rail.
 *
 * Fonte única de verdade: a URL. Não há um `useState` espelhando os filtros —
 * o componente lê `useSearchParams` e escreve com o router. Isso resolve de uma
 * vez deep link, botão voltar, compartilhamento e recarga da página, que numa
 * arquitetura de estado local seriam quatro problemas separados.
 */
export function WineExplorer({ wines, countries, grapes }: WineExplorerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const baseId = useId().replace(/:/g, '')
  const panelId = `filtros-${baseId}`

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [visible, setVisible] = useState(PAGE_SIZE)

  const catalog = useMemo(() => buildCatalog(countries, grapes), [countries, grapes])
  const filters = useMemo(() => parseFilters(searchParams, catalog), [searchParams, catalog])
  const showAll = searchParams.get(PARAM.view) === 'lista'
  const active = hasActiveFilters(filters)
  const listMode = active || showAll

  const results = useMemo(() => filterWines(wines, filters), [wines, filters])

  /* ------------------------------------------------------------ navegação */

  const commit = useCallback(
    (
      next: CartFilters,
      nextShowAll: boolean,
      options: { facet?: string; value?: string; history?: 'push' | 'replace' } = {},
    ) => {
      const query = serializeFilters(next, nextShowAll, catalog)
      const url = query ? `${pathname}?${query}` : pathname

      /* `push` nas escolhas de faceta e `replace` na digitação. É o que faz o
         VOLTAR desfazer *uma escolha* em vez de saltar a página inteira — e ao
         mesmo tempo impede que cada tecla da busca vire uma entrada no
         histórico. `scroll: false` sempre: a lista muda embaixo do visitante,
         a página não pode pular para o topo. */
      if (options.history === 'replace') router.replace(url, { scroll: false })
      else router.push(url, { scroll: false })

      if (options.facet) {
        track('wine_filter', {
          facet: options.facet,
          value: options.value ?? '',
          results: filterWines(wines, next).length,
        })
      }
    },
    [catalog, pathname, router, wines],
  )

  const toggle = useCallback(
    (facet: FacetKey, value: string) => {
      let next: CartFilters = filters

      switch (facet) {
        case 'servico': {
          const chosen = value === 'taca' || value === 'garrafa' ? value : 'todos'
          next = { ...filters, serving: filters.serving === chosen ? 'todos' : chosen }
          break
        }
        case 'categoria': {
          const canonical = catalog.categories.get(value)
          if (canonical) next = { ...filters, categories: toggleIn(filters.categories, canonical) }
          break
        }
        case 'pais': {
          const canonical = catalog.countries.get(value)
          if (canonical) next = { ...filters, countries: toggleIn(filters.countries, canonical) }
          break
        }
        case 'uva': {
          const canonical = catalog.grapes.get(value)
          if (canonical) next = { ...filters, grapes: toggleIn(filters.grapes, canonical) }
          break
        }
        case 'corpo': {
          if ((BODY_VALUES as readonly string[]).includes(value)) {
            next = { ...filters, bodies: toggleIn(filters.bodies, value as SolidBody) }
          }
          break
        }
        case 'preco': {
          const band = PRICE_BANDS.find((item) => item.id === value)
          const isCurrent =
            band !== undefined &&
            filters.price !== null &&
            filters.price[0] === band.range[0] &&
            filters.price[1] === band.range[1]
          next = { ...filters, price: band && !isCurrent ? band.range : null }
          break
        }
        case 'vegano': {
          next = { ...filters, veganOnly: !filters.veganOnly }
          break
        }
      }

      if (next === filters) return
      commit(next, showAll, { facet, value })
    },
    [filters, catalog, commit, showAll],
  )

  /** Remove uma faceta inteira — o gesto do estado vazio e dos chips de busca. */
  const clearFacet = useCallback(
    (facet: ChipKey) => {
      commit({ ...filters, ...RESET_PATCH[facet] }, true, { facet, value: '' })
    },
    [commit, filters],
  )

  /** Limpa tudo, mas mantém a lista aberta: quem pediu a carta continua nela. */
  const clearAll = useCallback(() => {
    setDrawerOpen(false)
    commit(EMPTY_FILTERS, true, { facet: 'limpar', value: 'tudo', history: 'replace' })
  }, [commit])

  /** Volta à porta de entrada — a exploração recomeça do zero. */
  const restart = useCallback(() => {
    setDrawerOpen(false)
    commit(EMPTY_FILTERS, false, {})
  }, [commit])

  /* --------------------------------------------------------------- busca */

  const [draft, setDraft] = useState(filters.query)
  const committedQuery = useRef(filters.query)

  // A URL mudou por fora (voltar, deep link, limpar): o campo acompanha.
  useEffect(() => {
    if (filters.query === committedQuery.current) return
    committedQuery.current = filters.query
    setDraft(filters.query)
  }, [filters.query])

  // E a digitação sobe para a URL com folga, para não navegar a cada tecla.
  useEffect(() => {
    if (draft === committedQuery.current) return
    const timer = window.setTimeout(() => {
      committedQuery.current = draft
      commit({ ...filters, query: draft }, showAll, {
        facet: 'busca',
        value: draft,
        history: 'replace',
      })
    }, 260)
    return () => window.clearTimeout(timer)
  }, [draft, filters, showAll, commit])

  /* ----------------------------------------------------------- paginação */

  const filterKey = useMemo(() => serializeFilters(filters, showAll, catalog), [filters, showAll, catalog])

  /*
   * Recorte novo, lote do zero: manter 96 linhas abertas ao trocar de país faria
   * o visitante cair no meio de uma lista que ele nunca rolou.
   *
   * O ajuste acontece durante o render, comparando com a chave anterior, e não
   * num efeito — o efeito renderizaria uma vez a lista nova ainda com o
   * tamanho de lote antigo antes de corrigir.
   */
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey)
    setVisible(PAGE_SIZE)
  }

  /* --------------------------------------------------------- instrumentação */

  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    track('wine_explorer_open', { origin: listMode ? 'deep-link' : 'exploracao' })
    // Só na montagem: a origem é como o visitante CHEGOU, não como ele navega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onOpenWine = useCallback((wineId: string) => {
    track('wine_detail', { wineId })
  }, [])

  /* --------------------------------------------------------------- facetas */

  const { facetGroups, servingCount, categoryCount } = useMemo(() => {
    const servingCounts = facetCounts(wines, filters, 'serving', ['taca', 'garrafa'], (w) => w.servingType)
    const categoryCounts = facetCounts(wines, filters, 'categories', CATEGORY_ORDER, (w) => w.category)
    const countryCounts = facetCounts(
      wines,
      filters,
      'countries',
      countries.map((c) => c.name),
      (w) => w.country,
    )
    const grapeCounts = facetCounts(
      wines,
      filters,
      'grapes',
      grapes.map((g) => g.name),
      (w) => w.grapes,
    )
    const bodyCounts = facetCounts(wines, filters, 'bodies', BODY_VALUES, (w) => w.body)
    const priceCounts = facetCounts(
      wines,
      filters,
      'price',
      PRICE_BANDS.map((band) => band.id),
      (w) => bandIdFor(w.price),
    )
    const veganCount = facetCounts(wines, filters, 'veganOnly', ['sim'], (w) => (w.vegan ? 'sim' : 'nao'))

    // "Todos" vale o total da faceta zerada — é a contagem de voltar atrás.
    const servingBase = filterWines(wines, { ...filters, serving: 'todos' }).length
    const priceBase = filterWines(wines, { ...filters, price: null }).length

    const currentBand = filters.price
      ? PRICE_BANDS.find(
          (band) => band.range[0] === filters.price?.[0] && band.range[1] === filters.price?.[1],
        )
      : undefined

    const groups: FacetGroup[] = [
      {
        facet: 'servico',
        legend: 'Serviço',
        type: 'single',
        options: [
          { value: 'todos', label: 'Taça e garrafa', count: servingBase, selected: filters.serving === 'todos' },
          {
            value: 'taca',
            label: SERVING_LABEL.taca,
            count: servingCounts['taca'] ?? 0,
            selected: filters.serving === 'taca',
          },
          {
            value: 'garrafa',
            label: SERVING_LABEL.garrafa,
            count: servingCounts['garrafa'] ?? 0,
            selected: filters.serving === 'garrafa',
          },
        ],
      },
      {
        facet: 'categoria',
        legend: 'Categoria',
        type: 'multiple',
        options: CATEGORY_ORDER.map((category) => ({
          value: catalog.slugOf.get(category) ?? slugify(category),
          label: category,
          count: categoryCounts[category] ?? 0,
          selected: filters.categories.includes(category),
        })),
      },
      {
        facet: 'pais',
        legend: 'Origem',
        type: 'multiple',
        options: countries.map(({ name }) => ({
          value: catalog.slugOf.get(name) ?? slugify(name),
          label: name,
          count: countryCounts[name] ?? 0,
          selected: filters.countries.includes(name),
        })),
      },
      {
        facet: 'uva',
        legend: 'Uva',
        type: 'multiple',
        options: grapes.map(({ name }) => ({
          value: catalog.slugOf.get(name) ?? slugify(name),
          label: name,
          count: grapeCounts[name] ?? 0,
          selected: filters.grapes.includes(name),
        })),
      },
      {
        facet: 'corpo',
        legend: 'Corpo',
        type: 'multiple',
        options: BODY_VALUES.map((body) => ({
          value: body,
          label: BODY_LABEL[body],
          count: bodyCounts[body] ?? 0,
          selected: filters.bodies.includes(body),
        })),
      },
      {
        facet: 'preco',
        legend: 'Faixa de preço',
        type: 'single',
        options: [
          { value: 'todos', label: 'Qualquer preço', count: priceBase, selected: filters.price === null },
          ...PRICE_BANDS.map((band) => ({
            value: band.id,
            label: band.label,
            count: priceCounts[band.id] ?? 0,
            selected: currentBand?.id === band.id,
          })),
        ],
      },
      {
        facet: 'vegano',
        legend: 'Certificação',
        type: 'multiple',
        options: [
          {
            value: '1',
            label: 'Vegano',
            count: veganCount['sim'] ?? 0,
            selected: filters.veganOnly,
          },
        ],
      },
    ]

    return { facetGroups: groups, servingCount: servingCounts, categoryCount: categoryCounts }
  }, [wines, filters, countries, grapes, catalog])

  /* ----------------------------------------------------------------- chips */

  const chips = useMemo(() => {
    const out: { facet: ChipKey; value: string; label: string }[] = []
    const slug = (value: string) => catalog.slugOf.get(value) ?? slugify(value)

    if (filters.serving !== 'todos') {
      out.push({ facet: 'servico', value: filters.serving, label: SERVING_LABEL[filters.serving] })
    }
    for (const category of filters.categories) out.push({ facet: 'categoria', value: slug(category), label: category })
    for (const country of filters.countries) out.push({ facet: 'pais', value: slug(country), label: country })
    for (const grape of filters.grapes) out.push({ facet: 'uva', value: slug(grape), label: grape })
    for (const body of filters.bodies) {
      if (body) out.push({ facet: 'corpo', value: body, label: BODY_LABEL[body] })
    }
    if (filters.price) {
      const band = PRICE_BANDS.find(
        (item) => item.range[0] === filters.price?.[0] && item.range[1] === filters.price?.[1],
      )
      if (band) out.push({ facet: 'preco', value: band.id, label: band.label })
    }
    if (filters.veganOnly) out.push({ facet: 'vegano', value: '1', label: 'Vegano' })
    if (filters.query.trim()) {
      out.push({ facet: 'busca', value: filters.query.trim(), label: `“${filters.query.trim()}”` })
    }
    return out
  }, [filters, catalog])

  const removeChip = useCallback(
    (chip: { facet: ChipKey; value: string }) => {
      if (chip.facet === 'busca') {
        setDraft('')
        committedQuery.current = ''
        clearFacet('busca')
        return
      }
      toggle(chip.facet, chip.value)
    },
    [clearFacet, toggle],
  )

  /* ---------------------------------------------------------- estado vazio */

  /**
   * O que soltar para voltar a ter carta.
   *
   * Em vez de "nenhum resultado", medimos quanto cada faceta ativa está
   * custando e oferecemos as que, sozinhas, devolvem mais rótulos. É a
   * diferença entre um beco sem saída e uma instrução.
   */
  const relief = useMemo(() => {
    if (results.length > 0) return []

    const candidates: { facet: ChipKey; label: string; results: number }[] = []
    const count = (patch: Partial<CartFilters>) => filterWines(wines, { ...filters, ...patch }).length

    if (filters.query.trim()) {
      candidates.push({ facet: 'busca', label: `a busca “${filters.query.trim()}”`, results: count(RESET_PATCH.busca) })
    }
    if (filters.grapes.length > 0) {
      candidates.push({ facet: 'uva', label: filters.grapes.length === 1 ? 'a uva' : 'as uvas', results: count(RESET_PATCH.uva) })
    }
    if (filters.countries.length > 0) {
      candidates.push({ facet: 'pais', label: filters.countries.length === 1 ? 'a origem' : 'as origens', results: count(RESET_PATCH.pais) })
    }
    if (filters.categories.length > 0) {
      candidates.push({ facet: 'categoria', label: filters.categories.length === 1 ? 'a categoria' : 'as categorias', results: count(RESET_PATCH.categoria) })
    }
    if (filters.price !== null) {
      candidates.push({ facet: 'preco', label: 'a faixa de preço', results: count(RESET_PATCH.preco) })
    }
    if (filters.bodies.length > 0) {
      candidates.push({ facet: 'corpo', label: 'o corpo', results: count(RESET_PATCH.corpo) })
    }
    if (filters.serving !== 'todos') {
      candidates.push({ facet: 'servico', label: 'o serviço', results: count(RESET_PATCH.servico) })
    }
    if (filters.veganOnly) {
      candidates.push({ facet: 'vegano', label: 'a certificação vegana', results: count(RESET_PATCH.vegano) })
    }

    return candidates.filter((item) => item.results > 0).sort((a, b) => b.results - a.results)
  }, [results.length, filters, wines])

  /* ---------------------------------------------------------------- lista */

  // Ordem da carta impressa: as categorias na sequência do cardápio e, dentro
  // de cada uma, a ordem original do documento (o sort é estável).
  const ordered = useMemo(() => {
    const rank = new Map(CATEGORY_ORDER.map((category, index) => [category, index] as const))
    return [...results].sort((a, b) => (rank.get(a.category) ?? 99) - (rank.get(b.category) ?? 99))
  }, [results])

  const rendered = useMemo(() => {
    const blocks: { category: WineCategory; items: { wine: Wine; position: number }[] }[] = []
    ordered.slice(0, visible).forEach((wine, index) => {
      const last = blocks[blocks.length - 1]
      // A numeração segue o resultado inteiro, não o lote: 025 continua 025
      // depois de "carregar mais".
      const entry = { wine, position: index + 1 }
      if (last && last.category === wine.category) last.items.push(entry)
      else blocks.push({ category: wine.category, items: [entry] })
    })
    return blocks
  }, [ordered, visible])

  const remaining = Math.max(0, results.length - visible)

  /* -------------------------------------------------------------- origens */

  const origins = useMemo(() => {
    const withSeal: { name: string; count: number; sealSrc: string; label: string }[] = []
    const plain: { name: string; count: number }[] = []
    for (const country of countries) {
      const slug = countrySlugFor(country.name)
      const entry = slug ? COUNTRY_BY_SLUG[slug] : undefined
      // Selo só onde a identidade desenhou um: nada de carimbo inventado.
      if (entry) withSeal.push({ ...country, sealSrc: entry.sealSrc, label: entry.name })
      else plain.push(country)
    }
    return { withSeal, plain }
  }, [countries])

  /* ------------------------------------------------------------------ JSX */

  return (
    <div className={styles.explorer}>
      {/* -------------------------------------------------------- barra fixa */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarInner}>
          <label className={styles.search}>
            <span className="u-visually-hidden">Buscar na carta por nome, região ou uva</span>
            <svg className={styles.searchIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
              <path d="M12.8 12.8 17 17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              className={styles.searchInput}
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Malbec, Douro, Toscana…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            {draft ? (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => {
                  setDraft('')
                  committedQuery.current = ''
                  clearFacet('busca')
                }}
              >
                <span className="u-visually-hidden">Limpar a busca</span>
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
          </label>

          <p className={styles.tally} role="status">
            {listMode
              ? `${results.length} ${results.length === 1 ? 'rótulo' : 'rótulos'}`
              : `${wines.length} rótulos · ${countries.length} origens`}
          </p>

          <button
            type="button"
            className={styles.drawerTrigger}
            aria-expanded={drawerOpen}
            aria-controls={panelId}
            onClick={() => setDrawerOpen(true)}
          >
            Filtros
            {chips.length > 0 ? <span className={styles.drawerBadge}>{chips.length}</span> : null}
          </button>
        </div>
      </div>

      {!listMode ? (
        /* ------------------------------------------------------- a porta */
        <div className={styles.portal}>
          <section className={styles.band} aria-labelledby={`${baseId}-servico`}>
            <header className={styles.bandHead}>
              <span className={styles.bandNumber} aria-hidden="true">
                01
              </span>
              <h2 id={`${baseId}-servico`} className={styles.bandTitle}>
                Uma taça ou a garrafa
              </h2>
            </header>

            <div className={styles.serving}>
              {SERVING_ENTRY.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  className={styles.servingOption}
                  onClick={() => toggle('servico', entry.value)}
                >
                  <img
                    src={entry.art}
                    alt=""
                    aria-hidden="true"
                    className={`${styles.servingArt} ${entry.value === 'taca' ? styles.artGlass : styles.artFrieze}`}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className={styles.servingTitle}>{entry.title}</span>
                  <span className={styles.servingTally}>
                    {servingCount[entry.value] ?? 0}
                    <span className={styles.servingUnit}> rótulos</span>
                  </span>
                  <span className={styles.servingNote}>{entry.note}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.band} aria-labelledby={`${baseId}-categoria`}>
            <header className={styles.bandHead}>
              <span className={styles.bandNumber} aria-hidden="true">
                02
              </span>
              <h2 id={`${baseId}-categoria`} className={styles.bandTitle}>
                Por estilo
              </h2>
            </header>

            <ol className={styles.index}>
              {CATEGORY_ORDER.map((category, position) => {
                const count = categoryCount[category] ?? 0
                return (
                  <li key={category}>
                    <button
                      type="button"
                      className={styles.indexRow}
                      disabled={count === 0}
                      onClick={() => toggle('categoria', catalog.slugOf.get(category) ?? slugify(category))}
                    >
                      <span className={styles.indexNumber} aria-hidden="true">
                        {String(position + 1).padStart(2, '0')}
                      </span>
                      <span className={styles.indexLabel}>{category}</span>
                      <span className={styles.indexLeader} aria-hidden="true" />
                      <span className={styles.indexCount}>
                        {count}
                        <span className="u-visually-hidden"> rótulos</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className={styles.band} aria-labelledby={`${baseId}-origem`}>
            <header className={styles.bandHead}>
              <span className={styles.bandNumber} aria-hidden="true">
                03
              </span>
              <h2 id={`${baseId}-origem`} className={styles.bandTitle}>
                Por origem
              </h2>
            </header>

            <ul className={styles.origins}>
              {origins.withSeal.map((origin) => (
                <li key={origin.name}>
                  <button
                    type="button"
                    className={styles.origin}
                    onClick={() => toggle('pais', catalog.slugOf.get(origin.name) ?? slugify(origin.name))}
                  >
                    <img
                      src={origin.sealSrc}
                      alt=""
                      aria-hidden="true"
                      className={styles.originSeal}
                      width={110}
                      height={110}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className={styles.originName}>{origin.label}</span>
                    <span className={styles.originCount}>
                      {origin.count}
                      <span className="u-visually-hidden"> rótulos</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {origins.plain.length > 0 ? (
              <div className={styles.otherOrigins}>
                <span className={styles.otherLabel}>Também na carta</span>
                <ul className={styles.otherList}>
                  {origins.plain.map((origin) => (
                    <li key={origin.name}>
                      <button
                        type="button"
                        className={styles.otherPill}
                        onClick={() => toggle('pais', catalog.slugOf.get(origin.name) ?? slugify(origin.name))}
                      >
                        {origin.name}
                        <span className={styles.otherCount}>{origin.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <div className={styles.escape}>
            <button type="button" className={styles.seeAll} onClick={() => commit(EMPTY_FILTERS, true, {})}>
              Ver a carta inteira
              <span className={styles.seeAllCount}>{wines.length}</span>
            </button>
            <p className={styles.escapeNote}>{BRAND_COPY.bestGlass}</p>
          </div>
        </div>
      ) : (
        /* ---------------------------------------------------------- a lista */
        <section className={styles.results} aria-label="Rótulos da carta">
          <div className={styles.layout}>
            <WineFilters
              id={panelId}
              groups={facetGroups}
              activeCount={chips.length}
              resultCount={results.length}
              onToggle={toggle}
              onClear={clearAll}
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
            />

            <div className={styles.column}>
              <div className={styles.columnHead}>
                {chips.length > 0 ? (
                  <ul className={styles.chips}>
                    {chips.map((chip) => (
                      <li key={`${chip.facet}-${chip.value}`}>
                        <button type="button" className={styles.chip} onClick={() => removeChip(chip)}>
                          {chip.label}
                          <span className={styles.chipX} aria-hidden="true">
                            ×
                          </span>
                          <span className="u-visually-hidden">— remover filtro</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.allNote}>A carta inteira, na ordem do cardápio.</p>
                )}

                <button type="button" className={styles.restart} onClick={restart}>
                  Recomeçar
                </button>
              </div>

              {results.length === 0 ? (
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>Nenhum rótulo com essa combinação.</p>
                  {relief.length > 0 ? (
                    <>
                      <p className={styles.emptyHelp}>Solte um filtro e a carta volta:</p>
                      <ul className={styles.emptyActions}>
                        {relief.slice(0, 3).map((item) => (
                          <li key={item.facet}>
                            <button type="button" className={styles.emptyAction} onClick={() => clearFacet(item.facet)}>
                              Remover {item.label}
                              <span className={styles.emptyActionCount}>{item.results} rótulos</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  <button type="button" className={styles.emptyClear} onClick={clearAll}>
                    Limpar tudo ({wines.length} rótulos)
                  </button>
                </div>
              ) : (
                <>
                  {rendered.map((block) => (
                    <section key={block.category} className={styles.block}>
                      <h3 className={styles.blockTitle}>{block.category}</h3>
                      <ol className={styles.list}>
                        {block.items.map(({ wine, position }) => (
                          <WineCard key={wine.id} wine={wine} position={position} onOpen={onOpenWine} />
                        ))}
                      </ol>
                    </section>
                  ))}

                  {remaining > 0 ? (
                    <div className={styles.moreRow}>
                      <button
                        type="button"
                        className={styles.more}
                        onClick={() => setVisible((was) => was + PAGE_SIZE)}
                      >
                        Carregar mais
                        <span className={styles.moreCount}>
                          {Math.min(PAGE_SIZE, remaining)} de {remaining}
                        </span>
                      </button>
                      <p className={styles.moreProgress}>
                        {Math.min(visible, results.length)} de {results.length} rótulos
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
