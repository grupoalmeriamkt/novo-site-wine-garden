import type { Country, CountrySlug } from '@/types/content'

/**
 * As oito origens que a identidade desenhou.
 *
 * O manual traz selo postal e mapa próprios para exatamente estes oito países
 * (p.10) — são eles que formam a rota de "Viaje o mundo, taça a taça". Não
 * inventamos selo para país sem arte oficial: as demais origens da carta
 * aparecem em OTHER_ORIGINS, sem selo, para que nenhum rótulo suma do
 * explorador só por não ter ilustração.
 *
 * `x`/`y` são posições normalizadas (0–1) numa CARTOGRAFIA EDITORIAL, não num
 * mapa geográfico. A ordem do array é a ordem da viagem — Velho Mundo, travessia
 * do Atlântico, Novo Mundo — e a linha pontilhada percorre o array nessa ordem.
 */
export const COUNTRIES: readonly Country[] = [
  {
    slug: 'franca',
    name: 'França',
    stamp: 'FRANÇA',
    mapSrc: '/brand/mapas/franca.svg',
    sealSrc: '/brand/selos/franca.svg',
    x: 0.135,
    y: 0.14,
    note: 'Onde a palavra terroir foi inventada. De Bordeaux ao Rhône, é a origem que mais ocupa a nossa carta.',
  },
  {
    slug: 'italia',
    name: 'Itália',
    stamp: 'ITÁLIA',
    mapSrc: '/brand/mapas/italia.svg',
    sealSrc: '/brand/selos/italia.svg',
    x: 0.375,
    y: 0.245,
    note: 'Do Piemonte à Puglia, vinte regiões que discordam entre si — e é justamente isso que faz a Itália.',
  },
  {
    slug: 'espanha',
    name: 'Espanha',
    stamp: 'ESPANHA',
    mapSrc: '/brand/mapas/espanha.svg',
    sealSrc: '/brand/selos/espanha.svg',
    x: 0.185,
    y: 0.395,
    note: 'Rioja, Ribera, Jerez, Galícia. Sol e altitude na mesma garrafa, do fino ao encorpado.',
  },
  {
    slug: 'portugal',
    name: 'Portugal',
    stamp: 'PORTUGAL',
    mapSrc: '/brand/mapas/portugal.svg',
    sealSrc: '/brand/selos/portugal.svg',
    x: 0.425,
    y: 0.5,
    note: 'Douro e Alentejo, castas que não existem em nenhum outro lugar. E o Porto para terminar a noite.',
  },
  {
    slug: 'eua',
    name: 'Estados Unidos',
    stamp: 'EUA',
    mapSrc: '/brand/mapas/eua.svg',
    sealSrc: '/brand/selos/eua.svg',
    x: 0.755,
    y: 0.3,
    note: 'A Califórnia provou que o Novo Mundo podia jogar o mesmo jogo. Fruta madura, sem pedir licença.',
  },
  {
    slug: 'brasil',
    name: 'Brasil',
    stamp: 'BRASIL',
    mapSrc: '/brand/mapas/brasil.svg',
    sealSrc: '/brand/selos/brasil.svg',
    x: 0.615,
    y: 0.605,
    note: 'Serra Gaúcha e Cerrado de altitude — inclusive o Distrito Federal. Vinho feito perto de casa.',
  },
  {
    slug: 'argentina',
    name: 'Argentina',
    stamp: 'ARGENTINA',
    mapSrc: '/brand/mapas/argentina.svg',
    sealSrc: '/brand/selos/argentina.svg',
    x: 0.83,
    y: 0.735,
    note: 'Mendoza e o Vale de Uco. Altitude, amplitude térmica e Malbec — a fórmula que virou identidade.',
  },
  {
    slug: 'chile',
    name: 'Chile',
    stamp: 'CHILE',
    mapSrc: '/brand/mapas/chile.svg',
    sealSrc: '/brand/selos/chile.svg',
    x: 0.535,
    y: 0.855,
    note: 'Uma faixa estreita entre a cordilheira e o Pacífico. Do Limarí ao Colchagua, frescor por geografia.',
  },
]

export const COUNTRY_BY_SLUG: Readonly<Record<CountrySlug, Country>> = Object.fromEntries(
  COUNTRIES.map((c) => [c.slug, c]),
) as Record<CountrySlug, Country>

/**
 * Mapeia o nome do país tal como aparece na carta para o slug da cartografia.
 * A carta escreve "Estados Unidos" como "EUA" e vice-versa dependendo do
 * rótulo; a normalização acontece aqui, num lugar só.
 */
const COUNTRY_ALIASES: Readonly<Record<string, CountrySlug>> = {
  franca: 'franca',
  frança: 'franca',
  italia: 'italia',
  itália: 'italia',
  espanha: 'espanha',
  portugal: 'portugal',
  eua: 'eua',
  'estados unidos': 'eua',
  brasil: 'brasil',
  argentina: 'argentina',
  chile: 'chile',
}

export function countrySlugFor(rawCountry: string): CountrySlug | null {
  const key = rawCountry
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
  return COUNTRY_ALIASES[key] ?? COUNTRY_ALIASES[rawCountry.toLowerCase().trim()] ?? null
}

/**
 * Origens presentes na carta que a identidade não ilustrou. Aparecem no
 * explorador como filtro de texto — sem selo inventado.
 */
export const OTHER_ORIGINS = [
  'Grécia',
  'África do Sul',
  'Uruguai',
  'Eslovênia',
  'Austrália',
  'Áustria',
  'Alemanha',
] as const
