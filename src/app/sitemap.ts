import type { MetadataRoute } from 'next'
import { SITE } from '@/data/site'
import { COUNTRIES } from '@/data/countries'

/**
 * O site é pequeno e as rotas são fixas, então o mapa é literal. Quando as
 * experiências virarem rotas próprias, elas entram aqui.
 *
 * `lastModified` usa a data do build: sem CMS, não há data de edição por
 * página, e inventar uma seria pior que usar a do deploy.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  const rotas: MetadataRoute.Sitemap = [
    { url: SITE.url, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE.url}/cardapio`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE.url}/vinhos`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE.url}/wine-match`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
  ]

  /*
   * Os recortes por origem entram no mapa.
   *
   * Cada um é uma página com conteúdo próprio e real — 31 rótulos franceses,
   * 25 portugueses — e responde a uma busca específica ("vinho português em
   * Brasília") melhor que a carta inteira. Sem estar no sitemap, um recorte
   * atrás de query string dificilmente é descoberto.
   *
   * Prioridade abaixo das rotas principais: são complementos da carta, não
   * concorrentes dela.
   */
  const porOrigem: MetadataRoute.Sitemap = COUNTRIES.map((c) => ({
    url: `${SITE.url}/vinhos?pais=${c.slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...rotas, ...porOrigem]
}
