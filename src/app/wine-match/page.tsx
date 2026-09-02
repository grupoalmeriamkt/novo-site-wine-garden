import type { Metadata } from 'next'
import { WineMatch } from '@/components/wine/WineMatch'
import { WINES } from '@/data/generated/wines'
import { SITE } from '@/data/site'
import { Harmonizacoes } from '@/components/sections/Harmonizacoes'
import { breadcrumbJsonLd, harmonizacoesJsonLd } from '@/lib/seo'
import { dishesForMatch } from '@/lib/wine-match'

/**
 * Rota do Wine Match.
 *
 * Server Component puro: metadados, trilha de navegação e nada mais. Toda a
 * interação vive em `<WineMatch>`, que carrega o próprio limite de Suspense
 * porque lê a etapa de `useSearchParams` — assim esta página continua
 * pré-renderizada e o palco aparece antes de qualquer JS de fluxo.
 *
 * Os números da descrição são contados dos dados na hora do build, não
 * digitados: se a carta mudar, o texto acompanha.
 */

const DISH_COUNT = dishesForMatch().length

const DESCRIPTION = `Quatro perguntas e a carta responde: de 2 a 4 rótulos entre os ${WINES.length} do Wine Garden, com o motivo de cada escolha e a harmonização que a casa escreveu para ${DISH_COUNT} pratos.`

export const metadata: Metadata = {
  title: 'Wine Match',
  description: DESCRIPTION,
  alternates: { canonical: '/wine-match' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: `${SITE.url}/wine-match`,
    siteName: SITE.name,
    title: `Wine Match — ${SITE.name}`,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `Wine Match — ${SITE.name}`,
    description: DESCRIPTION,
  },
}

export default function WineMatchPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd([
              { name: 'Início', path: '' },
              { name: 'Wine Match', path: '/wine-match' },
            ]),
            harmonizacoesJsonLd(),
          ]),
        }}
      />
      <WineMatch />
      {/*
       * Abaixo do questionário, a mesma resposta em HTML servido: quem chega
       * pela busca lê o cruzamento cozinha/carta sem precisar interagir.
       */}
      <Harmonizacoes />
    </>
  )
}
