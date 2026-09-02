import { SITE } from '@/data/site'
import { MENU_ITEMS } from '@/data/generated/menu'
import { capaOg, OG_CONTENT_TYPE, OG_SIZE } from '@/lib/og'

export const alt = `Cardápio — ${SITE.name}`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

const CATEGORIAS = new Set(MENU_ITEMS.map((i) => i.category)).size

export default async function Image() {
  return capaOg({
    eyebrow: 'Cardápio',
    titulo: 'A cozinha que',
    destaque: 'acompanha a carta.',
    dado: `${MENU_ITEMS.length} itens · ${CATEGORIAS} categorias`,
  })
}
