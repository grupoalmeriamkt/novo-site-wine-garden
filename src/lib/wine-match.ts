import { WINES } from '@/data/generated/wines'
import type { MatchAnswers, MatchBudget, MatchResult, MatchStyle, Wine, WineCategory } from '@/types/content'

/**
 * WINE MATCH — recomendação determinística.
 *
 * A regra que sustenta tudo: nenhuma recomendação nasce de opinião do código.
 * Cada ponto somado gera uma frase de justificativa — se não dá para explicar,
 * não pontua — e as frases são o que a tela mostra.
 *
 * HOUVE UMA ETAPA DE PRATO, e ela valia mais que todo o resto somado: o
 * cardápio declara com que categoria cada prato harmoniza, e isso era a casa
 * falando, não o algoritmo. Saiu junto com o cardápio do site, porque
 * recomendar a partir de um prato que pode ter saído da cozinha é decidir
 * sobre uma premissa que ninguém garantiu. Os sinais que restaram — estilo,
 * momento e orçamento — são todos declarados pelo próprio visitante no
 * momento da pergunta, e nenhum deles envelhece.
 *
 * A camada de IA prevista para depois entra em `rankWithProvider` (ver
 * sommelier.ts): esta função continua sendo o piso, e o site funciona inteiro
 * sem nenhum provedor configurado.
 */

/* ------------------------------------------------------------ vocabulário */

/** Estilo declarado pelo visitante → categorias da carta, em ordem de aderência. */
const STYLE_TO_CATEGORIES: Readonly<Record<MatchStyle, readonly WineCategory[]>> = {
  'leve-fresco': ['Branco Leve Fresco', 'Espumante', 'Rosé e Laranja', 'Tinto Leve'],
  aromatico: ['Brancos Aromáticos', 'Rosé e Laranja', 'Tinto Leve', 'Branco Amadeirado'],
  estruturado: ['Branco Amadeirado', 'Tinto Médio Corpo', 'Tinto Encorpado'],
  intenso: ['Tinto Encorpado', 'Tinto Médio Corpo'],
}

const STYLE_LABEL: Readonly<Record<MatchStyle, string>> = {
  'leve-fresco': 'leve e fresco',
  aromatico: 'aromático',
  estruturado: 'estruturado',
  intenso: 'intenso',
}

/** Faixas de investimento. `null` no topo = sem teto. */
const BUDGET_RANGE: Readonly<Record<MatchBudget, readonly [number, number | null]>> = {
  'ate-60': [0, 60],
  '60-150': [60, 150],
  '150-350': [150, 350],
  'sem-limite': [0, null],
}

const BUDGET_LABEL: Readonly<Record<MatchBudget, string>> = {
  'ate-60': 'até R$ 60',
  '60-150': 'entre R$ 60 e R$ 150',
  '150-350': 'entre R$ 150 e R$ 350',
  'sem-limite': 'sem teto de preço',
}

/* --------------------------------------------------------------- pontuação */

const WEIGHTS = {
  /** Categoria bate exatamente com o estilo pedido. */
  styleExact: 24,
  /** Categoria é adjacente ao estilo pedido. */
  styleAdjacent: 12,
  /** Serviço (taça/garrafa) coerente com o momento. */
  momentServing: 14,
  /** Categoria que o momento pede (espumante para brindar, por exemplo). */
  momentCategory: 16,
  /** Dentro do orçamento e bem posicionado na faixa. */
  budgetSweet: 10,
  /** Descritor do texto da carta reforça o estilo pedido. */
  profileHint: 6,
  /** Para "descobrir algo novo": origem fora do eixo previsível. */
  discovery: 12,
} as const

/**
 * Origens do "eixo previsível" de uma carta brasileira. Espanha entra: com 16
 * rótulos e 12 regiões nesta carta, chamá-la de descoberta seria forçar.
 */
const MAINSTREAM = new Set(['França', 'Itália', 'Chile', 'Argentina', 'Portugal', 'Espanha', 'Brasil'])

/** Os descritores são slugs sem acento; a interface precisa de português. */
const PROFILE_LABEL: Readonly<Record<string, string>> = {
  fresco: 'fresco',
  aromatico: 'aromático',
  frutado: 'frutado',
  mineral: 'mineral',
  tostado: 'tostado',
  floral: 'floral',
  estruturado: 'estruturado',
  cremoso: 'cremoso',
  citrico: 'cítrico',
  especiado: 'especiado',
}

type Scored = { wine: Wine; score: number; reasons: string[] }

function scoreWine(wine: Wine, answers: MatchAnswers): Scored {
  let score = 0
  const reasons: string[] = []

  /* 1. Estilo pedido. */
  const styleCategories = STYLE_TO_CATEGORIES[answers.style]
  const styleIndex = styleCategories.indexOf(wine.category)
  if (styleIndex === 0) {
    score += WEIGHTS.styleExact
    reasons.push(`É exatamente o perfil ${STYLE_LABEL[answers.style]} que você pediu.`)
  } else if (styleIndex > 0) {
    score += WEIGHTS.styleAdjacent
    // Índice 1 ainda é uma leitura legítima do estilo (um espumante é leve e
    // fresco); só a partir do 2 vale falar em "outro caminho".
    reasons.push(
      styleIndex === 1
        ? `Também entrega o ${STYLE_LABEL[answers.style]} que você pediu.`
        : `Outro caminho para o ${STYLE_LABEL[answers.style]}.`,
    )
  }

  /* 3. Descritores do texto da carta que reforçam o estilo. */
  const wanted: Record<MatchStyle, readonly string[]> = {
    'leve-fresco': ['fresco', 'citrico', 'mineral'],
    aromatico: ['aromatico', 'floral', 'frutado'],
    estruturado: ['estruturado', 'tostado', 'cremoso'],
    intenso: ['estruturado', 'especiado', 'tostado'],
  }
  const hits = wine.profile.filter((p) => wanted[answers.style].includes(p))
  if (hits.length > 0) {
    score += WEIGHTS.profileHint * Math.min(hits.length, 2)
    const labels = hits.slice(0, 2).map((p) => PROFILE_LABEL[p] ?? p)
    reasons.push(`A carta descreve como ${labels.join(' e ')}.`)
  }

  /* 4. Momento. */
  switch (answers.moment) {
    case 'brinde':
      if (wine.category === 'Espumante') {
        score += WEIGHTS.momentCategory
        reasons.push('Espumante, para o brinde.')
      }
      if (wine.servingType === 'garrafa') score += WEIGHTS.momentServing
      break
    case 'jantar':
      if (wine.servingType === 'garrafa') {
        score += WEIGHTS.momentServing
        reasons.push('Garrafa, para acompanhar a refeição inteira.')
      }
      break
    case 'encontro':
      if (wine.servingType === 'taca') {
        score += WEIGHTS.momentServing
        reasons.push('Serve em taça — dá para provar mais de um.')
      }
      if (['Tinto Leve', 'Rosé e Laranja', 'Brancos Aromáticos'].includes(wine.category)) {
        score += WEIGHTS.momentCategory
      }
      break
    case 'descobrir':
      if (wine.servingType === 'taca') {
        score += WEIGHTS.momentServing
        reasons.push('Em taça: descobrir sai mais barato.')
      }
      if (wine.country && !MAINSTREAM.has(wine.country)) {
        score += WEIGHTS.discovery
        reasons.push(`Origem fora do eixo comum: ${wine.country}.`)
      }
      break
  }

  /* 5. Orçamento — posição dentro da faixa, não só passar no corte. */
  const [min, max] = BUDGET_RANGE[answers.budget]
  if (max !== null) {
    // Quanto mais perto do teto, mais "aproveitado" o orçamento — sem passar.
    const position = (wine.price - min) / (max - min)
    if (position >= 0.45) {
      score += WEIGHTS.budgetSweet
    }
  }

  return { wine, score, reasons }
}

/* ------------------------------------------------------------------ ranking */

/**
 * Devolve de 2 a 4 recomendações. Se nada couber no orçamento, a função avisa
 * em vez de devolver silenciosamente vinhos fora da faixa.
 */
export function matchWines(
  answers: MatchAnswers,
  wines: readonly Wine[] = WINES,
): { results: MatchResult[]; relaxedBudget: boolean } {
  const [min, max] = BUDGET_RANGE[answers.budget]

  const inBudget = wines.filter((w) => w.price >= min && (max === null || w.price <= max))

  // Faixas estreitas podem esvaziar a carta (a de "até R$ 60" quase não tem
  // garrafa). Nesse caso alargamos e dizemos que alargamos.
  const relaxedBudget = inBudget.length < 6
  const pool = relaxedBudget ? wines : inBudget

  const scored = pool
    .map((wine) => scoreWine(wine, answers))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.wine.price - b.wine.price)

  /*
   * Diversificação: quatro Malbecs argentinos de R$ 200 não são quatro
   * recomendações, são uma. Limitamos a duas por categoria e duas por país
   * enquanto houver alternativa — o visitante veio escolher, e escolha exige
   * contraste.
   */
  const picked: Scored[] = []
  const byCategory = new Map<string, number>()
  const byCountry = new Map<string, number>()

  for (const entry of scored) {
    if (picked.length >= 4) break
    const catCount = byCategory.get(entry.wine.category) ?? 0
    const countryCount = byCountry.get(entry.wine.country) ?? 0
    if (catCount >= 2 || (entry.wine.country && countryCount >= 2)) continue
    picked.push(entry)
    byCategory.set(entry.wine.category, catCount + 1)
    if (entry.wine.country) byCountry.set(entry.wine.country, countryCount + 1)
  }

  // Se a diversificação foi restritiva demais, completa com os melhores restantes.
  if (picked.length < 2) {
    for (const entry of scored) {
      if (picked.length >= 2) break
      if (!picked.includes(entry)) picked.push(entry)
    }
  }

  const results: MatchResult[] = picked.map((entry) => ({
    wine: entry.wine,
    score: entry.score,
    reasons:
      entry.reasons.length > 0
        ? entry.reasons.slice(0, 3)
        : [`Combina com ${BUDGET_LABEL[answers.budget]} e com o momento escolhido.`],
  }))

  return { results, relaxedBudget }
}

export { BUDGET_LABEL, STYLE_LABEL }
