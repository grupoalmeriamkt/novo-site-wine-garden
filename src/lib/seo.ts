import { CONTACTS, LOCATION, OPENING_HOURS_SCHEMA, RESERVATION, SITE } from '@/data/site'
import { WINES } from '@/data/generated/wines'
import { COUNTRIES } from '@/data/countries'
import { FAQ } from '@/data/faq'
import { CATEGORY_SLUG } from '@/lib/wine-vocab'
import { categoriasDaCozinha } from '@/lib/cozinha'

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
    /*
     * `hasMenu` aponta para a PÁGINA, não para um objeto Menu com itens.
     *
     * O grafo já trouxe os 245 itens com preço, e foi removido junto com o
     * cardápio do site: a casa troca os pratos com frequência, e preço em dado
     * estruturado é exibido pelo Google como fato — um preço vencido ali é
     * desinformação sobre um negócio real, não um detalhe desatualizado.
     */
    hasMenu: `${SITE.url}/cardapio`,
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
 * "com que vinho eu acompanho um crudo", a resposta útil é a que traz a
 * indicação de uma casa real, e não uma regra genérica de enologia.
 *
 * Agregado por CATEGORIA da cozinha, e não por prato, porque a categoria
 * sobrevive à próxima troca de cardápio — ver `lib/cozinha.ts`.
 */
export function harmonizacoesJsonLd(): JsonLd {
  const porVinho = new Map<string, string[]>()
  for (const { nome, vinhos } of categoriasDaCozinha()) {
    for (const vinho of vinhos) {
      const lista = porVinho.get(vinho) ?? []
      if (!lista.includes(nome)) lista.push(nome)
      porVinho.set(vinho, lista)
    }
  }

  const entradas = [...porVinho.entries()]

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${SITE.url}/wine-match#harmonizacoes`,
    name: `Harmonizações do ${SITE.name}`,
    description: `Categoria de vinho indicada pelo cardápio do ${SITE.name} para cada categoria da cozinha.`,
    numberOfItems: entradas.length,
    itemListElement: entradas.map(([categoria, cozinha], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: categoria,
      description: `Indicado no cardápio para ${cozinha.join(', ').toLowerCase()}.`,
      url: `${SITE.url}/vinhos?categoria=${CATEGORY_SLUG[categoria as keyof typeof CATEGORY_SLUG]}`,
    })),
  }
}

/**
 * A CARTA como Menu do schema.org.
 *
 * Sucedeu o `menuJsonLd`, que publicava o cardápio inteiro — 245 itens com
 * preço. A comida saiu porque muda toda semana; a carta ficou porque não: um
 * rótulo entra e sai da adega, mas o dado publicado é conferido contra o
 * documento oficial a cada build, e é exatamente o que alguém procura quando
 * pergunta a um assistente onde beber um Malbec em Brasília.
 */
export function cartaJsonLd(): JsonLd {
  const porCategoria = new Map<string, typeof WINES>()
  for (const wine of WINES) {
    const lista = porCategoria.get(wine.category) ?? []
    porCategoria.set(wine.category, [...lista, wine] as typeof WINES)
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': `${SITE.url}/vinhos#carta`,
    name: `Carta de vinhos ${SITE.name}`,
    description: `${WINES.length} rótulos de ${new Set(WINES.map((w) => w.country).filter(Boolean)).size} países.`,
    inLanguage: 'pt-BR',
    hasMenuSection: [...porCategoria.entries()].map(([nome, rotulos]) => ({
      '@type': 'MenuSection',
      name: nome,
      hasMenuItem: rotulos.map((wine) => ({
        '@type': 'MenuItem',
        name: wine.name,
        ...(wine.description ? { description: wine.description } : {}),
        offers: {
          '@type': 'Offer',
          price: wine.price.toFixed(2),
          priceCurrency: 'BRL',
          /* O formato de serviço é o que distingue duas linhas do mesmo rótulo. */
          ...(wine.servingType === 'taca' ? { eligibleQuantity: { '@type': 'QuantitativeValue', value: 150, unitCode: 'MLT' } } : {}),
        },
      })),
    })),
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
