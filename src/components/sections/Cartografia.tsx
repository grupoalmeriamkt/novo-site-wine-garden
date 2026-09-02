'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { COUNTRIES, OTHER_ORIGINS } from '@/data/countries'
import { BRAND_COPY } from '@/data/site'
import { allCountryStats, cartSummary, countriesInList, winesByCountry, type CountryStats } from '@/lib/wines'
import type { Country, CountrySlug, Wine } from '@/types/content'
import type { Point } from '@/lib/motion/path'
import { CountrySeal, svgAreaBox } from '@/components/brand/CountrySeal'
import { Trace } from '@/components/brand/Trace'
import { Cta } from '@/components/primitives/Cta'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { useGsapOn } from '@/hooks/useGsap'
import { track } from '@/lib/analytics'
import styles from './Cartografia.module.css'

/* =========================================================================
   DADOS DERIVADOS
   Tudo abaixo é função pura sobre os arrays gerados, calculada uma vez por
   módulo. Nenhum número desta seção é escrito à mão: contagem, faixa de
   preço, região e uva saem da carta oficial.
   ========================================================================= */

const SUMMARY = cartSummary()

/**
 * Inclinações fixas, uma por parada da rota.
 *
 * São valores de composição, não de sistema: o que importa é que nenhum selo
 * fique alinhado ao vizinho e que a sequência não tenha ritmo óbvio. Ficam
 * escritos, e não sorteados, para o desenho ser reproduzível e ajustável.
 */
const TILTS = [-5, 3.5, -2.5, 4.5, -4, 2.5, -3.5, 5] as const

/**
 * Contração de "de" + artigo, por país. Português não tem regra derivável
 * aqui — "da França", mas "de Portugal", "do Brasil", "dos Estados Unidos" —
 * e o link precisa estar escrito em português correto.
 */
const OF_COUNTRY: Readonly<Record<CountrySlug, string>> = {
  franca: 'da França',
  italia: 'da Itália',
  espanha: 'da Espanha',
  portugal: 'de Portugal',
  eua: 'dos Estados Unidos',
  brasil: 'do Brasil',
  argentina: 'da Argentina',
  chile: 'do Chile',
}

type Dossier = {
  country: Country
  /** Posição na viagem, já formatada ("01"). */
  order: string
  stats: CountryStats
  /** Até cinco rótulos reais da origem. */
  wines: readonly Wine[]
  /** Peso do selo na cartografia, proporcional ao tamanho da carta. */
  scale: number
  tilt: number
}

const DOSSIERS: readonly Dossier[] = (() => {
  const stats = new Map(allCountryStats().map((s) => [s.slug, s]))
  const totals = COUNTRIES.map((c) => stats.get(c.slug)?.total ?? 0)
  const min = Math.min(...totals)
  const max = Math.max(...totals)
  const span = max - min || 1

  return COUNTRIES.map((country, index) => {
    const countryStats = stats.get(country.slug)
    const total = countryStats?.total ?? 0

    return {
      country,
      order: String(index + 1).padStart(2, '0'),
      stats: countryStats ?? {
        slug: country.slug,
        total: 0,
        byGlass: 0,
        byBottle: 0,
        regions: [],
        grapes: [],
        minPrice: 0,
        maxPrice: 0,
      },
      /* A curadoria da amostra segue o conceito da seção: "taça a taça" vem
         primeiro, porque é o que dá para provar hoje sem abrir uma garrafa;
         dentro de cada grupo, do mais acessível para o mais caro. */
      wines: [...winesByCountry(country.slug)]
        .sort((a, b) =>
          a.servingType === b.servingType ? a.price - b.price : a.servingType === 'taca' ? -1 : 1,
        )
        .slice(0, 5),
      /* O selo cresce com o tamanho da carta daquela origem: a composição
         mostra, antes de qualquer número, onde a casa realmente comprou
         fundo. França (31 rótulos) é o maior selo; EUA (1) o menor. */
      scale: 0.68 + 0.32 * ((total - min) / span),
      tilt: TILTS[index % TILTS.length] ?? 0,
    }
  })
})()

/** Origens da carta que a identidade não ilustrou. Nunca inventar selo. */
const OTHERS = (() => {
  const counts = new Map(countriesInList().map((o) => [o.name, o.count]))
  return OTHER_ORIGINS.map((name) => ({ name, count: counts.get(name) ?? 0 })).filter((o) => o.count > 0)
})()

const ROUTE_POINTS: readonly Point[] = COUNTRIES.map((c) => ({ x: c.x, y: c.y }))

/* -------------------------------------------------------------- formatação */

/** Reais sem depender de ICU: o valor precisa ser idêntico no servidor e no
 *  cliente, senão a hidratação acusa divergência. Todos os preços da carta
 *  são inteiros. */
function brl(value: number): string {
  return `R$ ${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

function priceRange(stats: CountryStats): string {
  if (stats.total === 0) return '—'
  if (stats.minPrice === stats.maxPrice) return brl(stats.minPrice)
  return `${brl(stats.minPrice)} – ${brl(stats.maxPrice)}`
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** Lista com corte: o resto vira "+7" em vez de sumir. */
function capped(values: readonly string[], limit: number): { shown: readonly string[]; rest: number } {
  return { shown: values.slice(0, limit), rest: Math.max(0, values.length - limit) }
}

/** Curva do conector vertical da narrativa mobile. Alterna o lado da barriga
 *  para a descida não virar uma sequência de vírgulas iguais. */
function connectorPoints(index: number): readonly Point[] {
  const bow = index % 2 === 0 ? 0.78 : 0.22
  return [
    { x: 0.5, y: 0 },
    { x: bow, y: 0.5 },
    { x: 0.5, y: 1 },
  ]
}

/* =========================================================================
   SEÇÃO
   ========================================================================= */

const PANEL_ID = 'cartografia-dossie'
const tabId = (slug: string) => `cartografia-selo-${slug}`

/**
 * Viaje o mundo, taça a taça — a cartografia editorial das origens.
 *
 * NÃO é um mapa geográfico, e a seção diz isso em voz alta no rodapé do
 * quadro. É uma cartografia editorial: os oito selos da identidade dispostos
 * numa composição, ligados pela linha pontilhada da marca na ordem da viagem
 * (Velho Mundo → travessia do Atlântico → Novo Mundo). A rota se desenha
 * conforme o scroll porque é isso que uma viagem faz: acontece ao longo do
 * caminho, não de uma vez.
 *
 * ATMOSFERA: noturna. A casa abre ao meio-dia e fecha à meia-noite (à uma da
 * manhã na sexta e no sábado), e a viagem pela carta é um programa de noite.
 * Sobre o uva profundo os oito selos viram folhas de álbum iluminadas e a
 * linha pontilhada ganha o bege — uma rota traçada sobre uma carta náutica.
 * A alternativa, terroir, é o verde da origem e do jardim: fala de solo, não
 * de distância; fica para a seção do Garden.
 *
 * DESKTOP e MOBILE são leituras diferentes do mesmo conteúdo, e por isso os
 * dois blocos existem no HTML e o CSS escolhe qual mostrar (`display: none`
 * tira o outro também da árvore de acessibilidade). Renderizar por media
 * query em JS custaria um salto de layout na primeira pintura e deixaria a
 * página sem conteúdo antes da hidratação.
 */
export function Cartografia() {
  const root = useRef<HTMLElement | null>(null)
  const planeColumn = useRef<HTMLDivElement | null>(null)
  const dossierRef = useRef<HTMLDivElement | null>(null)
  const mobileRef = useRef<HTMLOListElement | null>(null)
  const seals = useRef<(HTMLButtonElement | null)[]>([])
  /* Distingue a primeira pintura de uma troca pedida pelo visitante: o dossiê
     não deve "virar a página" sozinho ao carregar. */
  const interacted = useRef(false)

  const [activeIndex, setActiveIndex] = useState(0)
  const active = DOSSIERS[activeIndex]

  const open = useCallback((index: number, moveFocus = false) => {
    const dossier = DOSSIERS[index]
    if (!dossier) return

    interacted.current = true
    setActiveIndex(index)
    track('country_explore', { country: dossier.country.slug, wines: dossier.stats.total })
    if (moveFocus) seals.current[index]?.focus()
  }, [])

  /* Navegação por teclado do conjunto de selos. O padrão é o de abas: um só
     tabstop para os oito (tabindex móvel) e as setas percorrem a rota — que
     é exatamente a ordem da viagem, então a seta faz o que o desenho promete.
     A ativação acompanha o foco porque o conteúdo já está na página: não há
     custo em abrir a origem enquanto se navega. */
  const onSealKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const last = DOSSIERS.length - 1
      let next: number | null = null

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = activeIndex === last ? 0 : activeIndex + 1
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = activeIndex === 0 ? last : activeIndex - 1
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = last

      if (next === null) return
      event.preventDefault()
      open(next, true)
    },
    [activeIndex, open],
  )

  /* Na narrativa mobile todas as origens já estão abertas, então "abrir um
     país" é o país entrar em cena. O observador registra cada origem uma
     única vez; no desktop o bloco está em `display: none` e nunca intersecta,
     então não há evento duplicado. */
  useEffect(() => {
    const stack = mobileRef.current
    if (!stack) return

    const seen = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          const slug = el.dataset.country
          if (!slug || seen.has(slug)) continue
          seen.add(slug)
          observer.unobserve(el)
          track('country_explore', { country: slug, wines: Number(el.dataset.wines ?? 0) })
        }
      },
      { threshold: 0.9 },
    )

    stack.querySelectorAll<HTMLElement>('[data-country]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  /* ------------------------------------------------------------- animação */

  useGsapOn(
    root,
    ({ gsap, root: el }) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      /* As duas leituras têm gestos diferentes e nunca coexistem. matchMedia
         cria (e destrói) cada conjunto na fronteira do breakpoint; criado
         dentro do gsap.context do hook, tudo volta atrás no unmount. */
      const mm = gsap.matchMedia()

      mm.add('(min-width: 1024px)', () => {
        /* Os selos são CARIMBADOS na ordem da viagem: entram na sequência da
           rota, com um leve exagero final — o gesto físico de pressionar um
           carimbo, não um fade genérico. */
        gsap.fromTo(
          el.querySelectorAll('[data-seal]'),
          { scale: 0.72, opacity: 0, rotation: -7 },
          {
            scale: 1,
            opacity: 1,
            rotation: 0,
            duration: 0.72,
            stagger: 0.085,
            ease: 'back.out(1.4)',
            scrollTrigger: { trigger: el.querySelector('[data-plane]'), start: 'top 78%', once: true },
          },
        )
      })

      mm.add('(max-width: 1023.98px)', () => {
        /* Na narrativa vertical cada parada chega separadamente: o bloco sobe
           quando a rota chega nele. Sem stagger entre blocos — eles já estão
           separados pelo scroll. */
        el.querySelectorAll<HTMLElement>('[data-block]').forEach((block) => {
          gsap.fromTo(
            block.querySelectorAll('[data-block-item]'),
            { y: 24, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.7,
              stagger: 0.07,
              ease: 'power3.out',
              scrollTrigger: { trigger: block, start: 'top 82%', once: true },
            },
          )
        })
      })
    },
    [],
  )

  /* Troca de origem: o dossiê vira a página. Existe para que a mudança seja
     percebida — sem ela, trocar de país num painel fixo lê como se nada
     tivesse acontecido. Só dispara em troca pedida pelo visitante. */
  useGsapOn(
    dossierRef,
    ({ gsap, root: el }) => {
      if (!interacted.current) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      gsap.fromTo(
        el.querySelectorAll('[data-dossier-item]'),
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.055, ease: 'power3.out' },
      )
    },
    [activeIndex],
  )

  /* ----------------------------------------------------------------- JSX */

  return (
    <section
      ref={root}
      id="cartografia"
      className={styles.section}
      data-atmosphere="noturna"
      data-section="noturna"
      aria-labelledby="cartografia-titulo"
    >
      <header className={styles.head}>
        <MonoLabel size="xs" className={styles.kicker}>
          A rota · oito origens com selo
        </MonoLabel>

        <EditorialHeading as="h2" size="1" id="cartografia-titulo" className={styles.title}>
          <span className={styles.titleTop}>{BRAND_COPY.world[0]},</span>
          <span className={styles.titleBottom}>{BRAND_COPY.world[1]}.</span>
        </EditorialHeading>

        <Prose size="lg" className={styles.lede}>
          {SUMMARY.total} rótulos na carta, {SUMMARY.byGlass} deles servidos em taça. A viagem começa em{' '}
          {DOSSIERS[0]?.country.name ?? ''} e termina no {DOSSIERS[DOSSIERS.length - 1]?.country.name ?? ''} — oito
          paradas, na ordem em que a linha pontilhada as liga.
        </Prose>
      </header>

      {/* ------------------------------------------------------- desktop */}

      <div className={styles.desktop}>
        <div className={styles.split}>
          <div ref={planeColumn} className={styles.planeColumn}>
            <div data-plane className={styles.plane}>
              <div className={styles.field}>
                {/* A rota se desenha com o scroll. O gatilho é a COLUNA, não
                    o quadro: o quadro é sticky e ficaria parado em relação à
                    tela, congelando o cálculo do scrub. */}
                <Trace
                  points={ROUTE_POINTS}
                  viewBox={{ width: 1000, height: 720 }}
                  mode="scrub"
                  triggerRef={planeColumn}
                  strokeWidth={1.6}
                  className={styles.route}
                />

                <div
                  role="tablist"
                  aria-label="Origens da carta"
                  className={styles.seals}
                  onKeyDown={onSealKeyDown}
                >
                  {DOSSIERS.map((dossier, index) => {
                    const selected = index === activeIndex
                    return (
                      <button
                        key={dossier.country.slug}
                        ref={(node) => {
                          seals.current[index] = node
                        }}
                        data-seal
                        type="button"
                        role="tab"
                        id={tabId(dossier.country.slug)}
                        aria-selected={selected}
                        aria-controls={PANEL_ID}
                        tabIndex={selected ? 0 : -1}
                        className={styles.sealButton}
                        style={
                          {
                            '--x': String(dossier.country.x),
                            '--y': String(dossier.country.y),
                          } as CSSProperties
                        }
                        onClick={() => open(index)}
                      >
                        <CountrySeal
                          country={dossier.country}
                          order={dossier.order}
                          caption={plural(dossier.stats.total, 'rótulo', 'rótulos')}
                          size="md"
                          scale={dossier.scale}
                          tilt={dossier.tilt}
                          state={selected ? 'active' : 'muted'}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>

              <MonoLabel size="xs" muted className={styles.planeTag}>
                Cartografia editorial — a posição é composição, não geografia
              </MonoLabel>

              <div className={styles.planeNote}>
                <MonoLabel size="xs" muted>
                  Clique num selo para abrir a origem · as setas percorrem a rota
                </MonoLabel>
                <MonoLabel size="xs" muted numeric>
                  {String(DOSSIERS.length).padStart(2, '0')} paradas
                </MonoLabel>
              </div>
            </div>
          </div>

          <div className={styles.panelColumn}>
            {active ? (
              <div
                ref={dossierRef}
                id={PANEL_ID}
                role="tabpanel"
                aria-labelledby={tabId(active.country.slug)}
                data-atmosphere="editorial"
                className={styles.dossier}
              >
                <DossierBody dossier={active} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------- mobile */}

      <ol ref={mobileRef} className={styles.mobile}>
        {DOSSIERS.map((dossier, index) => (
          <li key={dossier.country.slug} data-block className={styles.block}>
            <div className={styles.blockRail}>
              <span data-block-item className={styles.blockSeal}>
                <CountrySeal
                  country={dossier.country}
                  order={dossier.order}
                  showName={false}
                  box="var(--rail)"
                  tilt={dossier.tilt}
                />
              </span>

              {/* A linha da marca corre verticalmente entre uma parada e a
                  seguinte. Um traço por vão, e não um só para a coluna
                  inteira, porque assim ele nasce e morre exatamente no eixo
                  dos selos por mais que os blocos mudem de altura. */}
              {index < DOSSIERS.length - 1 ? (
                <span className={styles.connector} aria-hidden="true">
                  <Trace
                    points={connectorPoints(index)}
                    viewBox={{ width: 100, height: 340 }}
                    mode="draw"
                    strokeWidth={1.4}
                  />
                </span>
              ) : null}
            </div>

            <div className={styles.blockBody}>
              <DossierBody dossier={dossier} itemAttr="data-block-item" observed />
            </div>
          </li>
        ))}
      </ol>

      {/* ---------------------------------------------------------- coda */}

      <div className={styles.coda}>
        <MonoLabel size="xs" className={styles.codaLabel}>
          E mais {plural(OTHERS.length, 'origem', 'origens')} na carta
        </MonoLabel>
        <p className={styles.codaList}>
          {OTHERS.map((origin, index) => (
            <span key={origin.name} className={styles.codaItem}>
              {index > 0 ? <span aria-hidden="true"> · </span> : null}
              {origin.name} <span className={styles.codaCount}>{origin.count}</span>
            </span>
          ))}
        </p>
        <Prose size="sm" muted className={styles.codaNote}>
          A identidade desenhou selo postal para oito países. Estas origens estão na carta sem carimbo próprio — e
          continuam no explorador de vinhos, com filtro por país.
        </Prose>
        <Cta href="/vinhos" variant="line" className={styles.codaCta}>
          Ver a carta inteira
        </Cta>
      </div>
    </section>
  )
}

/* =========================================================================
   DOSSIÊ DE UMA ORIGEM
   O mesmo conteúdo serve ao painel do desktop e ao bloco da narrativa
   mobile; o que muda é a moldura em volta. Escrever duas vezes seria a
   forma mais fácil de as duas leituras divergirem com o tempo.
   ========================================================================= */

type DossierBodyProps = {
  dossier: Dossier
  /** Gancho do GSAP para escalonar a entrada. Muda entre as duas leituras. */
  itemAttr?: 'data-dossier-item' | 'data-block-item'
  /** `true` no mobile: o cabeçalho carrega os dados do evento de analytics. */
  observed?: boolean
}

function DossierBody({ dossier, itemAttr = 'data-dossier-item', observed = false }: DossierBodyProps) {
  const { country, order, stats, wines } = dossier
  const item: Record<string, string> = { [itemAttr]: '' }
  const map = svgAreaBox(`mapa:${country.slug}`)
  const regions = capped(stats.regions, 6)
  const grapes = capped(stats.grapes, 8)

  return (
    <>
      <header
        {...item}
        className={styles.dossierHead}
        {...(observed ? { 'data-country': country.slug, 'data-wines': String(stats.total) } : {})}
      >
        <div className={styles.dossierTitle}>
          <MonoLabel size="xs" muted numeric>
            Origem {order} de {String(DOSSIERS.length).padStart(2, '0')}
          </MonoLabel>
          <EditorialHeading as="h3" size="2" className={styles.countryName}>
            {country.name}
          </EditorialHeading>
        </div>

        <img
          src={country.mapSrc}
          /* O nome do país está imediatamente ao lado: a silhueta é
             ilustração de marca, não informação nova. */
          alt=""
          className={styles.map}
          style={{ '--map-w': map.w.toFixed(4), '--map-h': map.h.toFixed(4) } as CSSProperties}
          loading="lazy"
          decoding="async"
        />
      </header>

      <Prose {...item} size="md" className={styles.note}>
        {country.note}
      </Prose>

      <dl {...item} className={styles.figures}>
        <div className={styles.figure}>
          <dt>
            <MonoLabel size="xs" muted>
              {stats.total === 1 ? 'Rótulo' : 'Rótulos'}
            </MonoLabel>
          </dt>
          <dd className={styles.figureValue}>{stats.total}</dd>
        </div>
        <div className={styles.figure}>
          <dt>
            <MonoLabel size="xs" muted>
              Em taça
            </MonoLabel>
          </dt>
          <dd className={styles.figureValue}>{stats.byGlass}</dd>
        </div>
        <div className={styles.figure}>
          <dt>
            <MonoLabel size="xs" muted>
              Em garrafa
            </MonoLabel>
          </dt>
          <dd className={styles.figureValue}>{stats.byBottle}</dd>
        </div>
        <div className={`${styles.figure} ${styles.figureWide}`}>
          <dt>
            <MonoLabel size="xs" muted>
              Faixa
            </MonoLabel>
          </dt>
          <dd className={`${styles.figureValue} ${styles.figurePrice}`}>{priceRange(stats)}</dd>
        </div>
      </dl>

      {regions.shown.length > 0 || grapes.shown.length > 0 ? (
        <div {...item} className={styles.facets}>
          {regions.shown.length > 0 ? (
            <div className={styles.facet}>
              <MonoLabel size="xs" muted className={styles.facetKey}>
                Regiões
              </MonoLabel>
              <p className={styles.facetValue}>
                {regions.shown.join(' · ')}
                {regions.rest > 0 ? <span className={styles.facetRest}> +{regions.rest}</span> : null}
              </p>
            </div>
          ) : null}

          {grapes.shown.length > 0 ? (
            <div className={styles.facet}>
              <MonoLabel size="xs" muted className={styles.facetKey}>
                Uvas
              </MonoLabel>
              <p className={styles.facetValue}>
                {grapes.shown.join(' · ')}
                {grapes.rest > 0 ? <span className={styles.facetRest}> +{grapes.rest}</span> : null}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {wines.length > 0 ? (
        <div {...item} className={styles.wines}>
          <MonoLabel size="xs" muted className={styles.winesKey}>
            Na carta agora
          </MonoLabel>
          <ul className={styles.wineList}>
            {wines.map((wine) => (
              <li key={wine.id} className={styles.wine}>
                <span className={styles.wineName}>{wine.name}</span>
                <span className={styles.wineMeta}>
                  {wine.category} · {wine.servingType === 'taca' ? 'taça' : 'garrafa'}
                </span>
                <span className={styles.winePrice}>{brl(wine.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div {...item} className={styles.dossierFoot}>
        <Cta href={`/vinhos?pais=${country.slug}`} variant="ghost">
          {stats.total === 1
            ? `Ver o vinho ${OF_COUNTRY[country.slug]}`
            : `Ver todos os ${stats.total} vinhos ${OF_COUNTRY[country.slug]}`}
        </Cta>
      </div>
    </>
  )
}
