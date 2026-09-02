import { SITE } from '@/data/site'
import { WINES } from '@/data/generated/wines'
import { capaOg, OG_CONTENT_TYPE, OG_SIZE } from '@/lib/og'

export const alt = `Wine Match — ${SITE.name}`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image() {
  return capaOg({
    eyebrow: 'Wine Match',
    titulo: 'Diga o momento.',
    destaque: 'A carta responde.',
    dado: `${WINES.length} rótulos na busca`,
  })
}
