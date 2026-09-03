import { SITE } from '@/data/site'
import { categoriasDaCozinha } from '@/lib/cozinha'
import { capaOg, OG_CONTENT_TYPE, OG_SIZE } from '@/lib/og'

export const alt = `Cardápio — ${SITE.name}`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

const CATEGORIAS = categoriasDaCozinha().length

export default async function Image() {
  return capaOg({
    eyebrow: 'Cardápio',
    titulo: 'A cozinha que',
    destaque: 'acompanha a carta.',
    dado: `${CATEGORIAS} categorias · harmonização declarada`,
  })
}
