/**
 * Contratos de conteúdo do Wine Garden.
 *
 * Regra que atravessa todo o arquivo: campo desconhecido é campo vazio, nunca
 * campo inventado. Preço, descrição, país e harmonização vêm do cardápio
 * oficial; o que o documento não diz fica `''` ou `[]` e a UI trata a ausência.
 * Isso é o que permite trocar estes módulos por um CMS depois sem redesenhar a
 * aplicação.
 */

/* ------------------------------------------------------------------ vinhos */

/** Categorias tal como aparecem no cardápio oficial — não inventar novas. */
export type WineCategory =
  | 'Espumante'
  | 'Branco Leve Fresco'
  | 'Brancos Aromáticos'
  | 'Branco Amadeirado'
  | 'Rosé e Laranja'
  | 'Tinto Leve'
  | 'Tinto Médio Corpo'
  | 'Tinto Encorpado'
  | 'Vinho Sobremesa'

export type ServingType = 'garrafa' | 'taca'

export type WineBody = 'leve' | 'medio' | 'encorpado' | ''

/** Descritores derivados literalmente do texto da carta. */
export type WineProfile =
  | 'fresco'
  | 'aromatico'
  | 'frutado'
  | 'mineral'
  | 'tostado'
  | 'floral'
  | 'estruturado'
  | 'cremoso'
  | 'citrico'
  | 'especiado'

export type Wine = {
  id: string
  name: string
  price: number
  category: WineCategory
  servingType: ServingType
  description: string
  /** País de origem extraído da descrição. `''` quando a carta não diz. */
  country: string
  /** Região/denominação extraída da descrição. `''` quando ausente. */
  region: string
  grapes: readonly string[]
  body: WineBody
  profile: readonly WineProfile[]
  /** Alimentos citados em "ideal para harmonizar com". */
  pairings: readonly string[]
  /** `true` só quando a carta traz a palavra "Vegano". */
  vegan: boolean
  /** `true` quando a descrição cita barrica, carvalho ou tonel. */
  oakAged: boolean
}

/* ------------------------------------------------------------------ cozinha */

export type MenuSection =
  | 'Cardápio'
  | 'Vinhos em Garrafa'
  | 'Vinhos em Taça'
  | 'Drinks e Doses'
  | 'Cervejas'
  | 'Bebidas'

export type MenuItem = {
  id: string
  name: string
  price: number
  /** Categoria exata do documento (heading `###`). */
  category: string
  section: MenuSection
  description: string
  /**
   * Categorias de vinho citadas em "Harmoniza com:", literais.
   * É a ponte entre a cozinha e a carta — o eixo do Wine Match.
   */
  pairings: readonly string[]
  vegan: boolean
  glutenFree: boolean
  lactoseFree: boolean
  kids: boolean
  /** id de PHOTO_MANIFEST, quando o acervo tem foto identificada do prato. */
  photoId?: string
}

/* ------------------------------------------------------------------- países */

export type CountrySlug =
  | 'franca'
  | 'italia'
  | 'espanha'
  | 'portugal'
  | 'chile'
  | 'argentina'
  | 'brasil'
  | 'eua'

/**
 * Um país da rota "Viaje o mundo, taça a taça". Só entram países que têm
 * ao mesmo tempo SVG oficial na identidade e rótulos na carta.
 */
export type Country = {
  slug: CountrySlug
  name: string
  /** Rótulo curto para o selo, como aparece na identidade (ex.: "EUA"). */
  stamp: string
  /** Caminho do mapa sólido em public/brand/mapas/. */
  mapSrc: string
  /** Caminho do selo oficial em public/brand/selos/. */
  sealSrc: string
  /** Coordenadas normalizadas (0–1) na trajetória — posição na cartografia. */
  x: number
  y: number
  /** Uma frase editorial sobre a origem. Redigida, não extraída da carta. */
  note: string
}

/* -------------------------------------------------------------- experiências */

export type Experience = {
  id: string
  name: string
  kicker: string
  description: string
  /** Texto livre; `''` enquanto a casa não confirmar dia e horário. */
  schedule: string
  photoId?: string
  ctaLabel?: string
  ctaHref?: string
}

/* ------------------------------------------------------------------ wine match */

export type MatchMoment = 'jantar' | 'encontro' | 'brinde' | 'descobrir'
export type MatchStyle = 'leve-fresco' | 'aromatico' | 'estruturado' | 'intenso'
export type MatchBudget = 'ate-60' | '60-150' | '150-350' | 'sem-limite'

export type MatchAnswers = {
  moment: MatchMoment
  style: MatchStyle
  budget: MatchBudget
}

export type MatchResult = {
  wine: Wine
  score: number
  /** Frases curtas explicando por que a garrafa combina. Derivadas de dados. */
  reasons: readonly string[]
}
