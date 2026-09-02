/**
 * Pontos de partida para a rota até o Wine Garden.
 *
 * PROCEDÊNCIA: as coordenadas vieram do Nominatim (OpenStreetMap), consultadas
 * uma única vez em 02/09/2026 e gravadas aqui — não há chamada de geocodificação
 * em runtime. Cada par foi conferido contra a caixa do Distrito Federal
 * (lat −16,1 a −15,4 / lon −48,3 a −47,3); duas consultas que devolveram
 * resultados em Goiânia e em Guarulhos foram descartadas em vez de ajustadas
 * no olho.
 *
 * São CENTROS DE REGIÃO, não endereços: servem para dar a ordem de grandeza do
 * trajeto ("uns 15 minutos daqui"), e a interface diz isso com todas as letras.
 * Quem quer a rota exata usa o botão "Como chegar", que abre o Google Maps a
 * partir da localização real do aparelho.
 */

export type Origem = {
  slug: string
  nome: string
  lat: number
  lng: number
}

export const ORIGENS: readonly Origem[] = [
  { slug: 'asa-sul', nome: 'Asa Sul', lat: -15.837015, lng: -47.932499 },
  { slug: 'asa-norte', nome: 'Asa Norte', lat: -15.762798, lng: -47.883951 },
  { slug: 'lago-norte', nome: 'Lago Norte', lat: -15.734235, lng: -47.864158 },
  { slug: 'cruzeiro', nome: 'Cruzeiro', lat: -15.790782, lng: -47.937443 },
  { slug: 'aguas-claras', nome: 'Águas Claras', lat: -15.841993, lng: -48.028121 },
  { slug: 'taguatinga', nome: 'Taguatinga', lat: -15.833528, lng: -48.056572 },
]

export const ORIGEM_POR_SLUG: Readonly<Record<string, Origem>> = Object.fromEntries(
  ORIGENS.map((o) => [o.slug, o]),
)
