'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MENU_ITEMS } from '@/data/generated/menu'
import { GASTRONOMY, dishPhoto } from '@/data/photos'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { Reveal } from '@/components/primitives/Reveal'
import { MenuSectionNav, type MenuNavCategory } from './MenuSectionNav'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { track } from '@/lib/analytics'
import { CATEGORY_SLUG, PAIRING_TO_CATEGORY } from '@/lib/wine-vocab'
import type { MenuItem, MenuSection } from '@/types/content'
import styles from './MenuBrowser.module.css'

/* =========================================================================
   FORMATO
   ========================================================================= */

/** Preço de item. Sempre pt-BR: "R$ 112,00" — nunca concatenação à mão. */
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Faixas de preço são rótulos de intervalo: centavos ali só fazem ruído. */
const BRL_ROUND = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

/* =========================================================================
   BUSCA
   ========================================================================= */

/**
 * Normalização de busca.
 *
 * Além de tirar acentos e caixa, colapsa letras repetidas: "Risotto" e
 * "risoto", "Cappuccino" e "capuccino", "mozzarella" e "mozarela" passam a ser
 * a mesma coisa. Metade da cozinha tem nome italiano e quase ninguém digita a
 * consoante dobrada — sem isso a busca devolve vazio para quem escreveu certo
 * em português. O preço é um punhado de falsos positivos ("carro"/"caro") que
 * um cardápio de 86 itens simplesmente não tem.
 */
function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(.)\1+/g, '$1')
}

/** Slug de URL — aqui a letra dobrada É preservada, senão o link muda. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/* =========================================================================
   ÍNDICE
   ========================================================================= */

type MenuGroup = {
  slug: string
  anchorId: string
  name: string
  section: MenuSection
  items: readonly MenuItem[]
}

/**
 * Ordem das seções do cardápio impresso: come-se antes de beber, e bebida sem
 * álcool fecha a lista. Dentro de cada seção, a ordem das categorias é a do
 * documento oficial — por isso ela é derivada da ordem de MENU_ITEMS e não
 * escrita à mão: se o cardápio mudar, o índice muda junto.
 */
const SECTION_ORDER: readonly MenuSection[] = ['Cardápio', 'Drinks e Doses', 'Cervejas', 'Bebidas']

function buildGroups(items: readonly MenuItem[]): readonly MenuGroup[] {
  const byCategory = new Map<string, MenuItem[]>()
  const appearance: string[] = []

  for (const item of items) {
    const bucket = byCategory.get(item.category)
    if (bucket) {
      bucket.push(item)
    } else {
      byCategory.set(item.category, [item])
      appearance.push(item.category)
    }
  }

  return appearance
    .map((name, index) => {
      const list = byCategory.get(name) ?? []
      const section = list[0]?.section ?? 'Cardápio'
      const rank = SECTION_ORDER.indexOf(section)
      return {
        name,
        list,
        section,
        index,
        // Categoria de uma seção não prevista vai para o fim em vez de sumir.
        rank: rank === -1 ? SECTION_ORDER.length : rank,
      }
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ name, list, section }) => {
      const slug = slugify(name)
      return { slug, anchorId: `menu-${slug}`, name, section, items: list }
    })
}

const GROUPS = buildGroups(MENU_ITEMS)
const GROUP_BY_SLUG = new Map(GROUPS.map((group) => [group.slug, group]))

/* =========================================================================
   FILTROS
   ========================================================================= */

type DietKey = 'vegan' | 'glutenFree' | 'lactoseFree' | 'kids'

const DIET_LABELS: readonly { key: DietKey; label: string }[] = [
  { key: 'vegan', label: 'Vegano' },
  { key: 'glutenFree', label: 'Sem glúten' },
  { key: 'lactoseFree', label: 'Sem lactose' },
  { key: 'kids', label: 'Kids' },
]

/**
 * Filtro só existe se a marcação existir no cardápio. Oferecer "sem glúten"
 * num cardápio onde nenhum prato foi marcado assim é prometer uma triagem que
 * o dado não sustenta — e é o tipo de promessa que faz alguém pedir errado.
 */
const DIETS = DIET_LABELS.map((diet) => ({
  ...diet,
  total: MENU_ITEMS.filter((item) => item[diet.key]).length,
})).filter((diet) => diet.total > 0)

type PriceBand = { id: string; label: string; min: number; max: number }

/**
 * As bordas separam o que a carta realmente separa: bebida de balcão, entrada,
 * prato principal e as tábuas grandes de compartilhar.
 */
const PRICE_BANDS: readonly PriceBand[] = [
  { id: 'ate-40', label: `Até ${BRL_ROUND.format(40)}`, min: 0, max: 40 },
  { id: '40-80', label: `${BRL_ROUND.format(40)} a ${BRL_ROUND.format(80)}`, min: 40, max: 80 },
  { id: '80-130', label: `${BRL_ROUND.format(80)} a ${BRL_ROUND.format(130)}`, min: 80, max: 130 },
  { id: 'acima-130', label: `Acima de ${BRL_ROUND.format(130)}`, min: 130, max: Number.POSITIVE_INFINITY },
].filter((band) => MENU_ITEMS.some((item) => item.price >= band.min && item.price < band.max))

function inBand(item: MenuItem, band: PriceBand | null): boolean {
  if (!band) return true
  return item.price >= band.min && item.price < band.max
}

/* =========================================================================
   PONTES COM A CARTA
   ========================================================================= */

/**
 * O cardápio e a carta nomeiam as mesmas famílias com palavras ligeiramente
 * diferentes ("Vinho Rosé" x "Rosé e Laranja"). A tradução vive em
 * `lib/wine-vocab` — o mesmo mapa que o Wine Match e a seção de Gastronomia
 * usam, para que os três nunca discordem sobre onde um link deve cair.
 *
 * Se a harmonização não estiver no mapa, o rótulo continua visível como texto
 * sem link: exibir o que a casa declarou é obrigação, adivinhar o destino não.
 */
function pairingHref(pairing: string): string | null {
  const category = PAIRING_TO_CATEGORY[pairing]
  if (!category) return null
  return `/vinhos?categoria=${CATEGORY_SLUG[category]}`
}

/* =========================================================================
   FOTOGRAFIA
   ========================================================================= */

/** Legendas curadas do acervo viram `alt` quando a foto do prato é uma delas. */
const CURATED_ALT = new Map(GASTRONOMY.map((photo) => [photo.id, photo.alt]))

function photoAlt(item: MenuItem, photoId: string): string {
  return CURATED_ALT.get(photoId) ?? `${item.name}, servido no Wine Garden.`
}

/**
 * Doze pratos de 86 têm foto identificada, e é assim que fica: o índice é
 * tipográfico, a fotografia é exceção. Enquanto a foto entra embaixo do texto
 * (celular e tablet), ela alterna de margem — sempre no mesmo lado, as doze
 * formariam uma coluna e a página viraria grade de cards. Em tela larga ela vai
 * para a margem externa e a alternância deixa de valer (ver o CSS).
 */
const PHOTO_SIDE: ReadonlyMap<string, 'start' | 'end'> = (() => {
  const sides = new Map<string, 'start' | 'end'>()
  let seen = 0
  for (const item of MENU_ITEMS) {
    if (!dishPhoto(item.id)) continue
    sides.set(item.id, seen % 2 === 0 ? 'end' : 'start')
    seen += 1
  }
  return sides
})()

/* =========================================================================
   COMPONENTE
   ========================================================================= */

/** Enquanto a rolagem provocada por um clique não assenta, a régua não muda. */
const CLICK_LOCK_MS = 900

type MenuBrowserProps = {
  /** Vem do `searchParams` lido no servidor — o deep link já chega renderizado. */
  initialQuery?: string
  initialCategory?: string
}

export function MenuBrowser({ initialQuery = '', initialCategory = '' }: MenuBrowserProps) {
  const searchParams = useSearchParams()
  const reduced = usePrefersReducedMotion()

  const [query, setQuery] = useState(initialQuery)
  const [diets, setDiets] = useState<readonly DietKey[]>([])
  const [bandId, setBandId] = useState<string | null>(null)
  const [activeSlug, setActiveSlug] = useState<string | null>(initialCategory || null)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const controlsRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  /* ------------------------------------------------------------ resultado */

  const band = useMemo(() => PRICE_BANDS.find((option) => option.id === bandId) ?? null, [bandId])

  const searched = useMemo(() => {
    const terms = normalizeSearch(query.trim()).split(/\s+/).filter(Boolean)
    if (terms.length === 0) return MENU_ITEMS
    return MENU_ITEMS.filter((item) => {
      // A categoria entra no índice de propósito: quem digita "sobremesa"
      // quer a seção inteira, não só o prato que tem a palavra no nome.
      const haystack = normalizeSearch(`${item.name} ${item.description} ${item.category}`)
      return terms.every((term) => haystack.includes(term))
    })
  }, [query])

  const results = useMemo(
    () => searched.filter((item) => diets.every((key) => item[key]) && inBand(item, band)),
    [searched, diets, band],
  )

  const groups = useMemo(() => {
    const kept = new Set(results.map((item) => item.id))
    return GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => kept.has(item.id)) })).filter(
      (group) => group.items.length > 0,
    )
  }, [results])

  /* Contagem por faceta: mostra o que cada opção traria SEM ela mesma no
     cálculo. É o que permite desabilitar o que levaria a zero em vez de deixar
     o visitante descobrir isso clicando. */
  const dietCounts = useMemo(() => {
    const base = searched.filter((item) => inBand(item, band))
    const counts: Record<string, number> = {}
    for (const diet of DIETS) {
      counts[diet.key] = base.filter(
        (item) => item[diet.key] && diets.every((key) => key === diet.key || item[key]),
      ).length
    }
    return counts
  }, [searched, band, diets])

  const bandCounts = useMemo(() => {
    const base = searched.filter((item) => diets.every((key) => item[key]))
    const counts: Record<string, number> = {}
    for (const option of PRICE_BANDS) {
      counts[option.id] = base.filter((item) => inBand(item, option)).length
    }
    return counts
  }, [searched, diets])

  const navCategories: MenuNavCategory[] = useMemo(
    () =>
      groups.map((group, index) => ({
        slug: group.slug,
        anchorId: group.anchorId,
        label: group.name,
        count: group.items.length,
        sectionStart: index > 0 && groups[index - 1]?.section !== group.section,
      })),
    [groups],
  )

  const hasFilters = diets.length > 0 || band !== null
  const hasQuery = query.trim().length > 0

  /* --------------------------------------------------------------- URL */

  const urlQuery = searchParams.get('busca') ?? ''
  const urlCategory = searchParams.get('categoria')

  /* Guarda o que NÓS escrevemos na URL. Sem isso, a atualização que volta do
     roteador pode chegar um quadro depois de uma tecla nova e sobrescrever o
     que a pessoa acabou de digitar. */
  const selfWrittenQueryRef = useRef<string | null>(null)
  const appliedCategoryRef = useRef<string | null | undefined>(undefined)

  const writeUrl = useCallback((mutate: (params: URLSearchParams) => void, mode: 'push' | 'replace') => {
    const params = new URLSearchParams(window.location.search)
    mutate(params)
    const qs = params.toString()
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`
    // pushState/replaceState nativos são integrados ao App Router: a URL muda,
    // useSearchParams acompanha e NÃO há ida ao servidor a cada tecla.
    if (mode === 'push') window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
  }, [])

  /* Busca → URL, com folga. Digitar não é navegar: o histórico é substituído,
     senão "voltar" teria de desfazer letra por letra. */
  useEffect(() => {
    const value = query.trim()
    if (value === (searchParams.get('busca') ?? '')) return
    const id = window.setTimeout(() => {
      selfWrittenQueryRef.current = value
      writeUrl((params) => {
        if (value) params.set('busca', value)
        else params.delete('busca')
      }, 'replace')
    }, 350)
    return () => window.clearTimeout(id)
  }, [query, searchParams, writeUrl])

  /* URL → busca. É este efeito que faz o botão "voltar" do navegador funcionar:
     o campo obedece à URL sempre que ela muda por fora. */
  useEffect(() => {
    if (urlQuery === selfWrittenQueryRef.current) return
    setQuery(urlQuery)
  }, [urlQuery])

  /* --------------------------------------------------- rolagem e categoria */

  const scrollToGroup = useCallback(
    (anchorId: string, behavior: ScrollBehavior) => {
      const target = document.getElementById(anchorId)
      if (!target) return
      // `scroll-margin-top` no bloco garante que o título não pare embaixo da
      // barra sticky; o navegador soma isso ao scroll-padding do documento.
      target.scrollIntoView({ block: 'start', behavior })
    },
    [],
  )

  /*
   * URL → categoria. Cobre a entrada por deep link e o voltar/avançar do
   * navegador.
   *
   * As duas metades são separadas de propósito. O ESTADO é ajustado durante o
   * render (padrão do React para "estado derivado de prop que mudou"): num
   * efeito, a barra de categorias renderizaria uma vez marcando a categoria
   * antiga antes de corrigir. Já a ROLAGEM é efeito colateral de verdade e
   * continua no efeito, protegida pelo ref para não repetir quando fomos nós
   * que escrevemos a URL.
   */
  const [lastUrlCategory, setLastUrlCategory] = useState(urlCategory)
  if (lastUrlCategory !== urlCategory) {
    setLastUrlCategory(urlCategory)
    if (urlCategory && GROUP_BY_SLUG.has(urlCategory)) setActiveSlug(urlCategory)
  }

  useEffect(() => {
    const slug = urlCategory
    if (appliedCategoryRef.current === slug) return
    appliedCategoryRef.current = slug
    if (!slug) return
    const group = GROUP_BY_SLUG.get(slug)
    if (!group) return
    // Entrada por URL é posicionamento, não gesto: rolar suave daqui seria uma
    // viagem de dois segundos por 80 pratos até chegar onde a pessoa pediu.
    scrollToGroup(group.anchorId, 'instant')
  }, [urlCategory, scrollToGroup])

  const lockUntilRef = useRef(0)
  const applyActiveRef = useRef<(() => void) | null>(null)

  const selectCategory = useCallback(
    (slug: string) => {
      const group = GROUP_BY_SLUG.get(slug)
      if (!group) return

      setActiveSlug(slug)
      appliedCategoryRef.current = slug
      lockUntilRef.current = Date.now() + CLICK_LOCK_MS
      window.setTimeout(() => applyActiveRef.current?.(), CLICK_LOCK_MS + 60)

      // Escolher categoria É navegar: entra no histórico, e "voltar" devolve a
      // categoria anterior — o mesmo contrato de uma âncora comum.
      writeUrl((params) => params.set('categoria', slug), urlCategory === slug ? 'replace' : 'push')
      scrollToGroup(group.anchorId, reduced ? 'instant' : 'smooth')
      track('menu_open', { category: slug })
    },
    [reduced, scrollToGroup, urlCategory, writeUrl],
  )

  /* Categoria ativa conforme o scroll.
     A faixa de leitura vai do fim da barra sticky até o pé da tela, e o bloco
     ATIVO é o primeiro que a cruza — ou seja, o primeiro que ainda aparece
     abaixo da barra. Definido assim, funciona igual para "Principais" (oito
     pratos) e para "Sodas" (um), que é onde as réguas por porcentagem de tela
     costumam errar. */
  const groupsKey = groups.map((group) => group.slug).join('|')

  useEffect(() => {
    const list = listRef.current
    const root = rootRef.current
    if (!list || !root) return

    const nodes = Array.from(list.querySelectorAll<HTMLElement>('[data-group]'))
    if (nodes.length === 0) return

    const order = nodes.map((node) => node.dataset.group ?? '')
    const visible = new Map<string, boolean>()

    const apply = () => {
      const next = order.find((slug) => visible.get(slug))
      if (next) setActiveSlug(next)
    }
    applyActiveRef.current = apply

    let observer: IntersectionObserver | null = null

    const connect = () => {
      observer?.disconnect()
      // A barra é sticky: a distância dela ao topo é o próprio `top` resolvido
      // em pixels, some-se a altura e temos onde o conteúdo legível começa.
      const nav = root.querySelector('nav')
      const offset = nav ? Number.parseFloat(window.getComputedStyle(nav).top) : 0
      const barBottom = nav ? (Number.isFinite(offset) ? offset : 0) + nav.offsetHeight : 0

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const slug = (entry.target as HTMLElement).dataset.group
            if (slug) visible.set(slug, entry.isIntersecting)
          }
          // Durante a rolagem de um clique a faixa atravessa tudo que está no
          // caminho; obedecer faria o destaque correr a barra inteira.
          if (Date.now() < lockUntilRef.current) return
          apply()
        },
        { rootMargin: `-${Math.round(barBottom)}px 0px 0px 0px` },
      )
      for (const node of nodes) observer.observe(node)
    }

    connect()

    // A altura do header muda no breakpoint de 1024px e a safe-area muda ao
    // girar o aparelho: a faixa precisa ser remedida. Redimensionar é raro —
    // não é um listener de scroll disfarçado.
    let resizeTimer = 0
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(connect, 200)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      observer?.disconnect()
      applyActiveRef.current = null
    }
  }, [groupsKey])

  /* ----------------------------------------------------------- analytics */

  const openedRef = useRef(false)
  useEffect(() => {
    if (openedRef.current) return
    openedRef.current = true
    track('menu_open', initialCategory ? { category: initialCategory } : {})
  }, [initialCategory])

  useEffect(() => {
    const value = query.trim()
    if (value.length < 2) return
    // Só o que a pessoa parou de digitar interessa: sem a folga, "risoto"
    // viraria seis eventos e o relatório mediria a velocidade dos dedos.
    const id = window.setTimeout(() => track('menu_search', { query: value, results: results.length }), 600)
    return () => window.clearTimeout(id)
  }, [query, results.length])

  /* ------------------------------------------------------------- ações */

  const focusSearch = useCallback(() => {
    controlsRef.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' })
    // O foco vem depois e sem rolar de novo: o navegador puxaria o campo para
    // debaixo do header fixo, que é exatamente o que acabamos de evitar.
    inputRef.current?.focus({ preventScroll: true })
  }, [reduced])

  const toggleDiet = useCallback((key: DietKey) => {
    setDiets((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))
  }, [])

  const clearAll = useCallback(() => {
    setQuery('')
    setDiets([])
    setBandId(null)
    selfWrittenQueryRef.current = ''
    writeUrl((params) => params.delete('busca'), 'replace')
    inputRef.current?.focus()
  }, [writeUrl])

  /* --------------------------------------------------------------- render */

  return (
    <div className={styles.browser} ref={rootRef}>
      <div className={styles.controls} ref={controlsRef}>
        <div className={styles.searchField}>
          <label htmlFor="menu-busca" className={styles.searchLabel}>
            <MonoLabel size="xs" muted>
              Buscar
            </MonoLabel>
          </label>
          <input
            id="menu-busca"
            ref={inputRef}
            className={styles.input}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="prato, drink, ingrediente"
            value={query}
            aria-describedby="menu-contagem"
            onChange={(event) => setQuery(event.target.value)}
          />
          {hasQuery ? (
            <button type="button" className={styles.clear} onClick={clearAll} aria-label="Limpar busca e filtros">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
                <path d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>

        <div className={styles.filters}>
          {DIETS.length > 0 ? (
            <div className={styles.filterGroup} role="group" aria-label="Filtrar por restrição alimentar">
              {DIETS.map((diet) => {
                const active = diets.includes(diet.key)
                const count = dietCounts[diet.key] ?? 0
                return (
                  <button
                    key={diet.key}
                    type="button"
                    className={styles.chip}
                    aria-pressed={active}
                    disabled={!active && count === 0}
                    onClick={() => toggleDiet(diet.key)}
                  >
                    {diet.label}
                    <span className={styles.chipCount}>{count}</span>
                  </button>
                )
              })}
            </div>
          ) : null}

          {PRICE_BANDS.length > 0 ? (
            <div className={styles.filterGroup} role="group" aria-label="Filtrar por faixa de preço">
              {PRICE_BANDS.map((option) => {
                const active = bandId === option.id
                const count = bandCounts[option.id] ?? 0
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={styles.chip}
                    aria-pressed={active}
                    disabled={!active && count === 0}
                    // Faixa é escolha única: clicar na ativa desliga o filtro.
                    onClick={() => setBandId((current) => (current === option.id ? null : option.id))}
                  >
                    {option.label}
                    <span className={styles.chipCount}>{count}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <p className={styles.count} id="menu-contagem" role="status" aria-live="polite">
          <MonoLabel size="xs" muted numeric>
            {results.length === MENU_ITEMS.length
              ? `${MENU_ITEMS.length} itens`
              : `${results.length} de ${MENU_ITEMS.length} itens`}
          </MonoLabel>
          {hasQuery || hasFilters ? (
            <button type="button" className={styles.reset} onClick={clearAll}>
              Limpar
            </button>
          ) : null}
        </p>
      </div>

      {navCategories.length > 0 ? (
        <MenuSectionNav
          categories={navCategories}
          activeSlug={activeSlug}
          onSelect={selectCategory}
          onSearchRequest={focusSearch}
          searchActive={hasQuery}
        />
      ) : null}

      <div className={groups.length === 0 ? `${styles.list} ${styles.listEmpty}` : styles.list} ref={listRef}>
        {groups.map((group, groupIndex) => (
          <section key={group.slug} id={group.anchorId} data-group={group.slug} className={styles.group}>
            <header className={styles.groupHead}>
              <MonoLabel size="xs" muted numeric className={styles.groupNumber}>
                {String(groupIndex + 1).padStart(2, '0')}
              </MonoLabel>
              <EditorialHeading as="h2" size="3" className={styles.groupTitle}>
                {group.name}
              </EditorialHeading>
              <MonoLabel size="xs" muted numeric className={styles.groupCount}>
                {group.items.length}
              </MonoLabel>
            </header>

            <ol className={styles.items}>
              {group.items.map((item, index) => (
                <MenuRow key={item.id} item={item} index={index} />
              ))}
            </ol>
          </section>
        ))}

        {groups.length === 0 ? (
          <div className={styles.empty}>
            <EditorialHeading as="p" size="3" className={styles.emptyTitle}>
              Nada com esse nome <em>na cozinha.</em>
            </EditorialHeading>
            <Prose muted className={styles.emptyText}>
              {hasQuery
                ? `Nenhum item do cardápio corresponde a “${query.trim()}”${hasFilters ? ' com os filtros ativos' : ''}.`
                : 'Nenhum item do cardápio atende a essa combinação de filtros.'}
            </Prose>
            <div className={styles.emptyActions}>
              <button type="button" className={styles.emptyButton} onClick={clearAll}>
                Ver o cardápio inteiro
              </button>
              {hasQuery ? (
                // Quem procura "malbec" no cardápio não errou a busca, errou de
                // página: a carta tem 159 rótulos e a mesma consulta cabe lá.
                <Link href={`/vinhos?busca=${encodeURIComponent(query.trim())}`} className={styles.emptyLink}>
                  Procurar “{query.trim()}” na carta de vinhos
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* =========================================================================
   LINHA DO ÍNDICE
   ========================================================================= */

function MenuRow({ item, index }: { item: MenuItem; index: number }) {
  const photoId = dishPhoto(item.id)
  const marks = DIET_LABELS.filter((diet) => item[diet.key])

  return (
    <li className={styles.item}>
      <MonoLabel size="xs" muted numeric className={styles.itemNumber}>
        {String(index + 1).padStart(2, '0')}
      </MonoLabel>

      <div className={styles.itemBody} data-photo={photoId ? '' : undefined}>
        <div className={styles.itemHead}>
          <h3 className={styles.itemName}>{item.name}</h3>
          {/* Filete de condução até o preço. Reto e contínuo de propósito: a
              linha PONTILHADA é elemento de marca e nunca é reta (manual,
              p.14) — usá-la aqui esvaziaria o gesto. */}
          <span className={styles.leader} aria-hidden="true" />
          <span className={styles.itemPrice}>{BRL.format(item.price)}</span>
        </div>

        {item.description ? (
          <Prose size="sm" muted measured={false} className={styles.itemDescription}>
            {item.description}
          </Prose>
        ) : null}

        {marks.length > 0 || item.pairings.length > 0 ? (
          <div className={styles.itemMeta}>
            {marks.length > 0 ? (
              <span className={styles.marks}>
                {marks.map((mark) => (
                  <MonoLabel key={mark.key} size="xs" className={styles.mark}>
                    {mark.label}
                  </MonoLabel>
                ))}
              </span>
            ) : null}

            {item.pairings.length > 0 ? (
              <span className={styles.pairings}>
                <MonoLabel size="xs" muted className={styles.pairingsLabel}>
                  Harmoniza com
                </MonoLabel>
                {item.pairings.map((pairing) => {
                  const href = pairingHref(pairing)
                  // Sem destino conhecido, a harmonização continua na tela como
                  // texto: o que a casa declarou é informação, o link é comodidade.
                  return href ? (
                    <Link
                      key={pairing}
                      href={href}
                      className={styles.pairing}
                      aria-label={`${pairing} — ver na carta de vinhos`}
                    >
                      {pairing}
                    </Link>
                  ) : (
                    <span key={pairing} className={styles.pairing}>
                      {pairing}
                    </span>
                  )
                })}
              </span>
            ) : null}
          </div>
        ) : null}

        {photoId ? (
          <figure className={styles.figure} data-side={PHOTO_SIDE.get(item.id)}>
            <Reveal
              photoId={photoId}
              alt={photoAlt(item, photoId)}
              sizes="(min-width: 1024px) 20rem, 60vw"
              motion="mask"
              from="bottom"
            />
          </figure>
        ) : null}
      </div>
    </li>
  )
}
