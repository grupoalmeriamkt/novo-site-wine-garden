import { SITE } from '@/data/site'
import { WINES } from '@/data/generated/wines'
import { capaOg, OG_CONTENT_TYPE, OG_SIZE } from '@/lib/og'

export const alt = `${SITE.name} — ${SITE.tagline}`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

const PAISES = new Set(WINES.map((w) => w.country).filter(Boolean)).size

export default async function Image() {
  return capaOg({
    titulo: 'Viaje o mundo,',
    destaque: 'taça a taça.',
    dado: `${WINES.length} rótulos · ${PAISES} origens`,
  })
}
