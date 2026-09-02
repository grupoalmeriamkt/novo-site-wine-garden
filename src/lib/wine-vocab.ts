import type { WineCategory } from '@/types/content'

/**
 * Vocabulário compartilhado entre a cozinha e a carta.
 *
 * Estas tabelas apareciam duplicadas em `wine-match.ts` e nas seções que
 * mostram harmonização. Duplicar um mapa de nomes é como duplicar uma constante
 * de preço: funciona até alguém corrigir um lado só.
 */

/**
 * O cardápio escreve a harmonização com nomes ligeiramente diferentes dos
 * títulos da carta. Estas três equivalências são as ÚNICAS divergências reais
 * entre os dois documentos — conferidas item a item.
 */
export const PAIRING_TO_CATEGORY: Readonly<Record<string, WineCategory>> = {
  Espumante: 'Espumante',
  'Branco Leve Fresco': 'Branco Leve Fresco',
  'Branco Aromático': 'Brancos Aromáticos',
  'Branco Amadeirado': 'Branco Amadeirado',
  'Vinho Rosé': 'Rosé e Laranja',
  'Tinto Leve': 'Tinto Leve',
  'Tinto Médio Corpo': 'Tinto Médio Corpo',
  'Tinto Encorpado': 'Tinto Encorpado',
  'Vinhos de Sobremesa': 'Vinho Sobremesa',
}

/**
 * Slug de cada categoria na URL do explorador. Nome oficial sem acento em
 * kebab-case — a mesma regra que `scripts/build-content.mjs` usa para ids,
 * porque estes links vão parar em favorito, WhatsApp e print de tela.
 */
export const CATEGORY_SLUG: Readonly<Record<WineCategory, string>> = {
  Espumante: 'espumante',
  'Branco Leve Fresco': 'branco-leve-fresco',
  'Brancos Aromáticos': 'brancos-aromaticos',
  'Branco Amadeirado': 'branco-amadeirado',
  'Rosé e Laranja': 'rose-e-laranja',
  'Tinto Leve': 'tinto-leve',
  'Tinto Médio Corpo': 'tinto-medio-corpo',
  'Tinto Encorpado': 'tinto-encorpado',
  'Vinho Sobremesa': 'vinho-sobremesa',
}

/** Caminho inverso: o slug da URL de volta para a categoria da carta. */
export const SLUG_TO_CATEGORY: Readonly<Record<string, WineCategory>> = Object.fromEntries(
  Object.entries(CATEGORY_SLUG).map(([category, slug]) => [slug, category as WineCategory]),
)

/** Categorias de vinho que uma harmonização do cardápio realmente aponta. */
export function pairingCategories(pairings: readonly string[]): WineCategory[] {
  return pairings.map((p) => PAIRING_TO_CATEGORY[p]).filter((c): c is WineCategory => Boolean(c))
}
