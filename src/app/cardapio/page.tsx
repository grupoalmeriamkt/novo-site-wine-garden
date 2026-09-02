import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { MENU_ITEMS } from '@/data/generated/menu'
import { CELLAR } from '@/data/photos'
import { BRAND_COPY, SITE } from '@/data/site'
import { cartSummary } from '@/lib/wines'
import { breadcrumbJsonLd, menuJsonLd } from '@/lib/seo'
import { Section } from '@/components/primitives/Section'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { Cta } from '@/components/primitives/Cta'
import { Reveal } from '@/components/primitives/Reveal'
import { Trace } from '@/components/brand/Trace'
import { LoadingState, SkeletonRow } from '@/components/ui/Skeleton'
import { MenuBrowser } from '@/components/menu/MenuBrowser'
import styles from './page.module.css'

/* Números da página: todos derivados dos dados gerados, nenhum digitado. */
const CART = cartSummary()
const CATEGORY_COUNT = new Set(MENU_ITEMS.map((item) => item.category)).size

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const metadata: Metadata = {
  title: 'Cardápio',
  description: `Cardápio completo do ${SITE.name}: ${MENU_ITEMS.length} itens entre cozinha, drinks e bebidas, com harmonizações que levam à carta de ${CART.total} rótulos. Pontão do Lago Sul, Brasília.`,
  alternates: { canonical: '/cardapio' },
  openGraph: {
    type: 'website',
    url: '/cardapio',
    title: `Cardápio — ${SITE.name}`,
    description: `${MENU_ITEMS.length} itens em ${CATEGORY_COUNT} categorias, e ${CART.total} rótulos na carta.`,
  },
}

/** `?categoria=principais` pode chegar repetido; vale o primeiro. */
function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

/**
 * Cardápio digital.
 *
 * Não é um PDF na tela: é um índice navegável, buscável e linkável. A leitura
 * dos parâmetros acontece AQUI, no servidor, e não só no cliente — assim
 * `/cardapio?categoria=principais` chega com o HTML já montado, em vez de
 * mandar o visitante esperar o JavaScript para descobrir o que pediu.
 *
 * A carta de vinhos não é duplicada aqui. São 159 rótulos com país, uva e
 * região próprios: repeti-los no cardápio faria duas listas para manter e
 * nenhuma boa. O que fica é a ponte — o resumo e o link.
 */
export default async function CardapioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const initialCategory = firstParam(params.categoria)
  const initialQuery = firstParam(params.busca)
  const cellar = CELLAR[1] ?? CELLAR[0]

  return (
    <>
      <script
        type="application/ld+json"
        // Menu completo em schema.org: preço e descrição saem do mesmo dado que
        // a página mostra, então nunca divergem do que está na mesa.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            menuJsonLd(),
            breadcrumbJsonLd([
              { name: 'Início', path: '/' },
              { name: 'Cardápio', path: '/cardapio' },
            ]),
          ]),
        }}
      />

      <Section atmosphere="editorial" className={styles.page}>
        <div className={styles.opener}>
          <MonoLabel size="xs" muted className={styles.kicker}>
            Cardápio
          </MonoLabel>

          <EditorialHeading as="h1" size="1" className={styles.title}>
            <span className={styles.titleLine}>A vida é feita</span>
            <span className={`${styles.titleLine} ${styles.titleLineEnd}`}>de escolhas.</span>
          </EditorialHeading>

          {/* A frase já está inteira no h1 — o traço é o gesto da marca, não
              informação, e por isso fica fora da árvore de acessibilidade. */}
          <div className={styles.traceSlot} aria-hidden="true">
            <Trace
              points={[
                { x: 0.96, y: 0.04 },
                { x: 0.62, y: 0.58 },
                { x: 0.33, y: 0.4 },
                { x: 0.03, y: 0.96 },
              ]}
              viewBox={{ width: 900, height: 170 }}
              mode="draw"
              strokeWidth={1.6}
            />
          </div>

          <dl className={styles.meta}>
            <div className={styles.metaItem}>
              <MonoLabel as="dt" size="xs" muted>
                Itens
              </MonoLabel>
              <dd className={styles.metaValue}>{MENU_ITEMS.length}</dd>
            </div>
            <div className={styles.metaItem}>
              <MonoLabel as="dt" size="xs" muted>
                Categorias
              </MonoLabel>
              <dd className={styles.metaValue}>{CATEGORY_COUNT}</dd>
            </div>
            <div className={styles.metaItem}>
              <MonoLabel as="dt" size="xs" muted>
                Carta de vinhos
              </MonoLabel>
              <dd className={styles.metaValue}>
                <Link href="/vinhos" className={styles.metaLink}>
                  {CART.total} rótulos
                </Link>
              </dd>
            </div>
          </dl>
        </div>

        {/*
          useSearchParams precisa de fronteira de Suspense: sem ela, uma rota
          prerenderizada derrubaria a árvore inteira para renderização no
          cliente. Com ela, o índice é entregue pronto e só a leitura da URL
          fica sujeita ao request.
        */}
        <Suspense
          fallback={
            <div className={styles.loading}>
              <LoadingState label="Montando o cardápio" />
              <SkeletonRow count={8} />
            </div>
          }
        >
          <MenuBrowser initialQuery={initialQuery} initialCategory={initialCategory} />
        </Suspense>
      </Section>

      <Section atmosphere="intensa" label="Carta de vinhos">
        <div className={styles.wineInner}>
          {cellar ? (
            <div className={styles.wineFigure}>
              <Reveal
                photoId={cellar.id}
                alt={cellar.alt}
                sizes="(min-width: 900px) 38vw, 90vw"
                motion="mask"
                from="bottom"
              />
            </div>
          ) : null}

          <div>
            <MonoLabel size="xs" muted>
              A carta
            </MonoLabel>

            <EditorialHeading as="h2" size="2" className={styles.wineTitle}>
              {BRAND_COPY.travel[0]},
              <br />
              <em>{BRAND_COPY.travel[1]}.</em>
            </EditorialHeading>

            <Prose muted className={styles.wineText}>
              O cardápio termina aqui; a carta continua em outra página porque tem outro tamanho —
              {' '}
              {CART.total} rótulos de {CART.countries} países, com país, região e uva de cada um.
            </Prose>

            <dl className={styles.wineStats}>
              <div className={styles.statItem}>
                <MonoLabel as="dt" size="xs" muted>
                  Rótulos
                </MonoLabel>
                <dd className={styles.statValue}>{CART.total}</dd>
              </div>
              <div className={styles.statItem}>
                <MonoLabel as="dt" size="xs" muted>
                  Países
                </MonoLabel>
                <dd className={styles.statValue}>{CART.countries}</dd>
              </div>
              <div className={styles.statItem}>
                <MonoLabel as="dt" size="xs" muted>
                  Em taça
                </MonoLabel>
                <dd className={styles.statValue}>{CART.byGlass}</dd>
              </div>
              <div className={styles.statItem}>
                <MonoLabel as="dt" size="xs" muted>
                  A partir de
                </MonoLabel>
                <dd className={styles.statValue}>{BRL.format(CART.minPrice)}</dd>
              </div>
            </dl>

            <Cta href="/vinhos" variant="solid">
              Ver a carta de vinhos
            </Cta>
          </div>
        </div>
      </Section>
    </>
  )
}
