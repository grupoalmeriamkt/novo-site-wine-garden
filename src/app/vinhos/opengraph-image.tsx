import { SITE } from '@/data/site'
import { WINES } from '@/data/generated/wines'
import { capaOg, OG_CONTENT_TYPE, OG_SIZE } from '@/lib/og'

export const alt = `Carta de vinhos — ${SITE.name}`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

const PAISES = new Set(WINES.map((w) => w.country).filter(Boolean)).size
const EM_TACA = WINES.filter((w) => w.servingType === 'taca').length

export default async function Image() {
  return capaOg({
    eyebrow: 'Carta de vinhos',
    titulo: `${WINES.length} rótulos,`,
    destaque: `${PAISES} origens.`,
    dado: `${EM_TACA} servidos em taça`,
  })
}
