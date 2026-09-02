import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Section } from '@/components/primitives/Section'
import { Trace } from '@/components/brand/Trace'
import { LoadingState, SkeletonRow } from '@/components/ui/Skeleton'
import { WineExplorer } from '@/components/wine/WineExplorer'
import { WINES, cartSummary, countriesInList, topGrapes } from '@/lib/wines'
import { breadcrumbJsonLd, menuJsonLd } from '@/lib/seo'
import { BRAND_COPY, SITE } from '@/data/site'
/* O desenho da abertura mora no mesmo módulo do explorador: é a mesma peça
   editorial, só que a metade de cima é estática e continua no servidor. Isso
   evita um segundo .module.css só para quatro seletores. */
import styles from '@/components/wine/WineExplorer.module.css'

/**
 * A carta.
 *
 * Server Component puro: metadados, dados e dados estruturados. Toda a
 * interação vive em <WineExplorer>, e a página não lê `searchParams` de
 * propósito — assim a rota continua estática e trocar um filtro não custa uma
 * ida ao servidor: o estado dos filtros é lido no cliente, da própria URL.
 */

const summary = cartSummary()

/** Números derivados, nunca escritos à mão. */
const priceRange = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export const metadata: Metadata = {
  title: 'Carta de vinhos',
  description: `${summary.total} rótulos de ${summary.countries} origens, ${summary.byGlass} deles servidos em taça. Filtre por país, uva, estilo e preço na carta do Wine Garden.`,
  alternates: { canonical: '/vinhos' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: `${SITE.url}/vinhos`,
    siteName: SITE.name,
    title: `Carta de vinhos — ${SITE.name}`,
    description: `${summary.total} rótulos de ${summary.countries} origens. ${SITE.tagline}`,
  },
}

const FIGURES = [
  { label: 'Rótulos', value: String(summary.total) },
  { label: 'Origens', value: String(summary.countries) },
  { label: 'Em taça', value: String(summary.byGlass) },
  { label: 'Em garrafa', value: String(summary.byBottle) },
  {
    label: 'Da mais leve à mais rara',
    value: `${priceRange.format(summary.minPrice)}–${priceRange.format(summary.maxPrice)}`,
  },
]

export default function VinhosPage() {
  const countries = countriesInList()
  const grapes = topGrapes()

  return (
    <>
      <script
        type="application/ld+json"
        // O menu completo, com o preço real de cada rótulo do cardápio oficial.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Início', path: '/' },
              { name: 'Carta de vinhos', path: '/vinhos' },
            ]),
          ),
        }}
      />

      <Section atmosphere="editorial" bleed>
        <div className={styles.page}>
          <header className={styles.masthead}>
            <p className={styles.kicker}>Carta de vinhos</p>

            <h1 className={styles.title}>
              {BRAND_COPY.world[0]}, <span className={styles.titleItalic}>{BRAND_COPY.world[1]}.</span>
            </h1>

            {/* A linha pontilhada desce do fim do título até os números: é o
                gesto de "trajetória" do manual ligando a promessa ao fato. */}
            <div className={styles.traceSlot} aria-hidden="true">
              <Trace
                points={[
                  { x: 0.04, y: 0.12 },
                  { x: 0.32, y: 0.68 },
                  { x: 0.64, y: 0.24 },
                  { x: 0.96, y: 0.8 },
                ]}
                viewBox={{ width: 900, height: 200 }}
                mode="draw"
                strokeWidth={1.5}
              />
            </div>

            <dl className={styles.figures}>
              {FIGURES.map((figure) => (
                <div key={figure.label} className={styles.figure}>
                  <dt className={styles.figureLabel}>{figure.label}</dt>
                  <dd className={styles.figureValue}>{figure.value}</dd>
                </div>
              ))}
            </dl>
          </header>

          {/* useSearchParams exige uma fronteira de Suspense no App Router:
              sem ela, a rota inteira seria renderizada sob demanda. */}
          <Suspense
            fallback={
              <div className={styles.fallback}>
                <LoadingState label="Abrindo a carta" />
                <SkeletonRow count={8} />
              </div>
            }
          >
            <WineExplorer wines={WINES} countries={countries} grapes={grapes} />
          </Suspense>
        </div>
      </Section>
    </>
  )
}
