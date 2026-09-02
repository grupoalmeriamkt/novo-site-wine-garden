import { CONTACTS, LOCATION, OPENING_HOURS_SCHEMA, RESERVATION, SITE } from '@/data/site'
import { MENU_ITEMS } from '@/data/generated/menu'
import { WINES } from '@/data/generated/wines'
import { COUNTRIES } from '@/data/countries'
import { FAQ } from '@/data/faq'
import { CATEGORY_SLUG, PAIRING_TO_CATEGORY } from '@/lib/wine-vocab'

/**
 * Dados estruturados.
 *
 * Regra dura: só entra aqui o que foi confirmado em fonte pública (ver a
 * procedência em src/data/site.ts). Nada de nota de avaliação, faixa de preço
 * estimada ou horário "provável" — o Google mostra esses campos como fato, e
 * um dado inventado no JSON-LD é desinformação sobre um negócio real.
 */

type JsonLd = Record<string, unknown>

/**
 * A entidade do negócio.
 *
 * `@id` estável é o que amarra os grafos: o `WebSite`, o `Menu` e o `FAQPage`
 * apontam todos para este mesmo identificador, e o buscador entende que falam
 * do mesmo lugar em vez de tratar cada página como uma ilha.
 */
export function restaurantJsonLd(): JsonLd {
  const instagram = CONTACTS.find((c) => c.label === 'Instagram')
  const phone = CONTACTS.find((c) => c.label === 'Telefone')
  const whats = CONTACTS.find((c) => c.label === 'WhatsApp')

  /*
   * FAIXA DE PREÇO — calculada, nunca estimada.
   *
   * `priceRange` responde "quanto custa comer aqui", então a conta é feita
   * sobre os PRATOS do cardápio, não sobre a carta: a garrafa mais cara
   * distorceria o teto e passaria uma informação errada a quem lê o resultado
   * de busca. `$$` sem lastro seria chute; este número sai do documento
   * oficial e muda sozinho quando o cardápio muda.
   */
  const precosPratos = MENU_ITEMS.filter((i) => i.section === 'Cardápio').map((i) => i.price)
  const paises = [...new Set(WINES.map((w) => w.country).filter(Boolean))]

  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${SITE.url}/#restaurant`,
    name: SITE.name,
    legalName: SITE.legalName,
    description: SITE.description,
    url: SITE.url,
    ...(phone ? { telephone: phone.href.replace('tel:', '') } : {}),
    ...(instagram ? { sameAs: [instagram.href] } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${LOCATION.street} — ${LOCATION.complement}`,
      addressLocality: LOCATION.city,
      addressRegion: LOCATION.state,
      postalCode: LOCATION.postalCode,
      addressCountry: LOCATION.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: LOCATION.lat,
      longitude: LOCATION.lng,
    },
    openingHours: [...OPENING_HOURS_SCHEMA],
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        opens: '12:00',
        closes: '00:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Friday', 'Saturday'],
        opens: '12:00',
        closes: '01:00',
      },
    ],
    servesCuisine: ['Contemporânea', 'Mediterrânea', 'Wine bar'],
    acceptsReservations: RESERVATION.url,
    hasMenu: { '@id': `${SITE.url}/cardapio#menu` },
    currenciesAccepted: 'BRL',
    /*
     * O que a casa OFERECE, em termos que uma busca por linguagem natural usa.
     * É o campo que faz "wine bar com vinho em taça em Brasília" encontrar
     * este lugar — e cada item aqui é verdadeiro e verificável no site.
     */
    amenityFeature: [
      { '@type': 'LocationFeatureSpecification', name: 'Vinho em taça', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Carta de vinhos', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Jardim coberto', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Mesas ao ar livre', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Música ao vivo', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Happy hour', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Eventos privados', value: true },
    ],
    ...(precosPratos.length > 0
      ? { priceRange: `R$ ${Math.min(...precosPratos)}–${Math.max(...precosPratos)}` }
      : {}),
    ...(whats
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'reservations',
            telephone: '+5561992115375',
            availableLanguage: ['Portuguese'],
          },
        }
      : {}),
    /* As origens da carta como área de conhecimento da casa. */
    knowsAbout: ['Vinho', 'Enogastronomia', 'Harmonização', ...paises.slice(0, 10)],
    areaServed: {
      '@type': 'City',
      name: 'Brasília',
      containedInPlace: { '@type': 'AdministrativeArea', name: 'Distrito Federal' },
    },
    // Sem aggregateRating: ninguém confirmou nota, e o Google a exibe como fato.
  }
}

/**
 * O site como entidade, com a busca interna declarada.
 *
 * O `SearchAction` habilita a caixa de busca do Google direto no resultado, e
 * diz aos motores generativos que existe um índice consultável de 159 rótulos
 * por trás desta URL — não apenas uma página institucional.
 */
export function websiteJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    inLanguage: 'pt-BR',
    publisher: { '@id': `${SITE.url}/#restaurant` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE.url}/vinhos?busca={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/**
 * Perguntas e respostas.
 *
 * É o formato que os motores generativos citam com mais frequência, porque a
 * resposta já vem delimitada e atribuível. O conteúdo vem de `data/faq.ts`, o
 * mesmo que a página mostra — texto estruturado que não aparece na tela é
 * exatamente o que as diretrizes do Google chamam de conteúdo oculto.
 */
export function faqJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE.url}/#faq`,
    isPartOf: { '@id': `${SITE.url}/#website` },
    about: { '@id': `${SITE.url}/#restaurant` },
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      '@id': `${SITE.url}/#faq-${item.id}`,
      name: item.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: item.resposta },
    })),
  }
}

/**
 * A carta como lista de países produtores.
 *
 * Dá aos motores a estrutura "este lugar tem vinhos DESTAS origens, nesta
 * quantidade" — a forma da pergunta que alguém faz a um assistente quando
 * quer um vinho português em Brasília.
 */
export function wineOriginsJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${SITE.url}/vinhos#origens`,
    name: `Origens da carta do ${SITE.name}`,
    numberOfItems: COUNTRIES.length,
    itemListElement: COUNTRIES.map((country, index) => {
      const total = WINES.filter((w) => {
        const nome = w.country.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        const alvo = country.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        return nome === alvo || (country.slug === 'eua' && nome === 'eua')
      }).length
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: country.name,
        description: `${total} rótulos de ${country.name} na carta do ${SITE.name}.`,
        url: `${SITE.url}/vinhos?pais=${country.slug}`,
      }
    }),
  }
}

/**
 * As harmonizações que a casa declara, como dado estruturado.
 *
 * É a informação mais citável do site: quando alguém pergunta a um assistente
 * "com que vinho eu acompanho um filé au poivre", a resposta útil é a que traz
 * a indicação de uma casa real, e não uma regra genérica de enologia.
 *
 * Cada par vem do campo `pairings` do cardápio oficial. Prato sem indicação
 * fica de fora — não há inferência aqui.
 */
export function harmonizacoesJsonLd(): JsonLd {
  const porCategoria = new Map<string, string[]>()
  for (const item of MENU_ITEMS) {
    for (const pairing of item.pairings) {
      const categoria = PAIRING_TO_CATEGORY[pairing]
      if (!categoria) continue
      const lista = porCategoria.get(categoria) ?? []
      if (!lista.includes(item.name)) lista.push(item.name)
      porCategoria.set(categoria, lista)
    }
  }

  const entradas = [...porCategoria.entries()]

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${SITE.url}/wine-match#harmonizacoes`,
    name: `Harmonizações do ${SITE.name}`,
    description: `Categoria de vinho indicada pelo cardápio do ${SITE.name} para cada prato.`,
    numberOfItems: entradas.length,
    itemListElement: entradas.map(([categoria, pratos], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: categoria,
      description: `Harmoniza com ${pratos.join(', ')}.`,
      url: `${SITE.url}/vinhos?categoria=${CATEGORY_SLUG[categoria as keyof typeof CATEGORY_SLUG]}`,
    })),
  }
}

/**
 * Menu completo em schema.org. Cada seção vira MenuSection e cada item traz o
 * preço real do cardápio oficial.
 */
export function menuJsonLd(): JsonLd {
  const bySection = new Map<string, typeof MENU_ITEMS>()
  for (const item of MENU_ITEMS) {
    const list = bySection.get(item.category) ?? []
    bySection.set(item.category, [...list, item] as typeof MENU_ITEMS)
  }

  const wineSection = {
    '@type': 'MenuSection',
    name: 'Vinhos',
    description: `${WINES.length} rótulos de ${new Set(WINES.map((w) => w.country).filter(Boolean)).size} países.`,
    hasMenuItem: WINES.map((wine) => ({
      '@type': 'MenuItem',
      name: wine.name,
      ...(wine.description ? { description: wine.description } : {}),
      offers: {
        '@type': 'Offer',
        price: wine.price.toFixed(2),
        priceCurrency: 'BRL',
      },
    })),
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': `${SITE.url}/cardapio#menu`,
    name: `Cardápio ${SITE.name}`,
    inLanguage: 'pt-BR',
    hasMenuSection: [
      ...[...bySection.entries()].map(([name, items]) => ({
        '@type': 'MenuSection',
        name,
        hasMenuItem: items.map((item) => ({
          '@type': 'MenuItem',
          name: item.name,
          ...(item.description ? { description: item.description } : {}),
          ...(item.vegan || item.glutenFree
            ? {
                suitableForDiet: [
                  ...(item.vegan ? ['https://schema.org/VeganDiet'] : []),
                  ...(item.glutenFree ? ['https://schema.org/GlutenFreeDiet'] : []),
                ],
              }
            : {}),
          offers: { '@type': 'Offer', price: item.price.toFixed(2), priceCurrency: 'BRL' },
        })),
      })),
      wineSection,
    ],
  }
}

/**
 * Trilha de navegação. Ajuda o Google a entender a hierarquia das páginas
 * internas e melhora o snippet.
 */
export function breadcrumbJsonLd(trail: readonly { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: `${SITE.url}${step.path}`,
    })),
  }
}
