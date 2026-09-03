import { MENU_ITEMS } from '@/data/generated/menu'
import { PAIRING_TO_CATEGORY } from '@/lib/wine-vocab'
import type { WineCategory } from '@/types/content'

/**
 * O RESUMO DA COZINHA — o cardápio sem os itens.
 *
 * A casa muda o cardápio com frequência, então publicar 245 pratos com preço
 * é publicar algo que nasce desatualizado. O que NÃO muda toda semana é a
 * estrutura: as categorias em que a cozinha se organiza, e a categoria de
 * vinho com que cada uma harmoniza.
 *
 * É isso que este módulo extrai. Tudo aqui continua vindo do documento
 * oficial — nada é descrição escrita à mão. A diferença é o nível: falamos de
 * "Crudos harmoniza com Branco Leve Fresco", não de "Ceviche de Pesce, R$ 68".
 * O primeiro segue verdadeiro depois da próxima troca de cardápio; o segundo,
 * não.
 *
 * A ordem é a de aparição no documento, que é a ordem em que a casa serve —
 * das tábuas às sobremesas. `Set` preserva a ordem de inserção, então ela vem
 * de graça.
 */

/** A seção do documento que é comida. As outras são bebida. */
const SECAO_COZINHA = 'Cardápio'

export type CategoriaCozinha = {
  nome: string
  /** Categorias da carta que os pratos desta categoria indicam. */
  vinhos: readonly WineCategory[]
}

export function categoriasDaCozinha(): readonly CategoriaCozinha[] {
  const ordem = [...new Set(MENU_ITEMS.filter((i) => i.section === SECAO_COZINHA).map((i) => i.category))]

  return ordem.map((nome) => {
    const vinhos = new Set<WineCategory>()
    for (const item of MENU_ITEMS) {
      if (item.section !== SECAO_COZINHA || item.category !== nome) continue
      for (const pairing of item.pairings) {
        const categoria = PAIRING_TO_CATEGORY[pairing]
        if (categoria) vinhos.add(categoria)
      }
    }
    return { nome, vinhos: [...vinhos] }
  })
}

/**
 * As seções de bebida, com suas categorias. Aparecem como uma lista de nomes:
 * o que a casa serve, sem rótulo nem preço.
 */
export function secoesDeBebida(): readonly { secao: string; categorias: readonly string[] }[] {
  const secoes = [...new Set(MENU_ITEMS.map((i) => i.section))].filter((s) => s !== SECAO_COZINHA)

  return secoes.map((secao) => ({
    secao,
    categorias: [...new Set(MENU_ITEMS.filter((i) => i.section === secao).map((i) => i.category))],
  }))
}
