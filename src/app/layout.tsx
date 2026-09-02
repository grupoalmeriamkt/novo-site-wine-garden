import type { Metadata, Viewport } from 'next'
import { fontVariables } from '@/lib/fonts'
import { SITE } from '@/data/site'
import { faqJsonLd, restaurantJsonLd, websiteJsonLd } from '@/lib/seo'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { AtmosphereObserver } from '@/components/layout/AtmosphereObserver'
import { Preloader } from '@/components/layout/Preloader'
import { MobileReserveBar } from '@/components/layout/MobileReserveBar'
import { CursorLabel } from '@/components/ui/CursorLabel'
import '@/styles/globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    'wine bar Brasília',
    'restaurante Lago Sul',
    'carta de vinhos Brasília',
    'vinho em taça',
    'Pontão do Lago Sul',
    'Wine Garden',
  ],
  authors: [{ name: SITE.name }],
  creator: SITE.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  formatDetection: { telephone: false, address: false, email: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Nunca travar o zoom: ampliar até 500% é requisito de WCAG 2.2.
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f9ea' },
    { media: '(prefers-color-scheme: dark)', color: '#3f0a25' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={fontVariables} suppressHydrationWarning>
      <head>
        {/*
          A classe `js` no <html> é o que faz o CSS confiar no GSAP para revelar
          conteúdo. Sem JS ela nunca é escrita e a regra de fallback em
          globals.css devolve tudo visível — o site continua legível.
          Inline e antes do paint para não haver flash.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('js')`,
          }}
        />
        <script
          type="application/ld+json"
          /*
           * O grafo da marca em um bloco só: o negócio, o site e as perguntas.
           * Os três se referenciam por `@id`, então o buscador entende que
           * falam da mesma entidade em vez de tratar cada página como ilha.
           * Todos os dados são verificados — ver a procedência em data/site.ts.
           */
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([restaurantJsonLd(), websiteJsonLd(), faqJsonLd()]),
          }}
        />
      </head>
      <body>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <Preloader />
        <AtmosphereObserver />
        <Header />
        <main id="conteudo">{children}</main>
        <Footer />
        <MobileReserveBar />
        <CursorLabel />
      </body>
    </html>
  )
}
