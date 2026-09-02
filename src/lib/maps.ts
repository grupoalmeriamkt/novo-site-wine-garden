/**
 * Google Maps — configuração, carregamento sob demanda e links de rota.
 *
 * Este módulo existe para que NENHUM componente saiba como o Maps entra na
 * página. Ele concentra três decisões que, espalhadas, viram bug:
 *
 * 1. CONFIGURAÇÃO É DE AMBIENTE, NUNCA DO CÓDIGO. Chave e Map ID vêm de
 *    variáveis públicas; sem elas, `getMapsConfig()` devolve `null` e a seção
 *    de localização desenha o próprio mapa (ver Localizacao.tsx). Esse é o
 *    estado padrão em desenvolvimento — não é erro, é o plano B.
 *
 * 2. O SCRIPT É PESADO (centenas de KB) e por isso só é injetado quando alguém
 *    chama `loadGoogleMaps()`. Quem chama é o MapExperience, que só monta
 *    quando a seção chega perto da viewport.
 *
 * 3. UM ÚNICO CARREGAMENTO POR SESSÃO. A promessa fica no escopo do módulo:
 *    dois mapas na mesma navegação reaproveitam o mesmo script.
 *
 * -------------------------------------------------------------------------
 * VARIÁVEIS DE AMBIENTE (definir na Vercel / .env.local)
 *
 *   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY   chave do projeto no Google Cloud com a
 *                                     "Maps JavaScript API" habilitada e
 *                                     RESTRIÇÃO POR REFERRER HTTP nos domínios
 *                                     do site (a chave é pública por natureza:
 *                                     a proteção é a restrição, não o segredo).
 *   NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID    Map ID criado em Google Cloud Console →
 *                                     Google Maps Platform → Map Management.
 *                                     OBRIGATÓRIO: o AdvancedMarkerElement só
 *                                     funciona em mapa com Map ID, e é ele que
 *                                     usamos (google.maps.Marker está
 *                                     depreciado desde fev/2024 e não recebe
 *                                     mais correções).
 *   NEXT_PUBLIC_WINE_GARDEN_PLACE_ID  opcional. Lido em src/data/site.ts. Sem
 *                                     ele, a rota cai em lat/lng — que sempre
 *                                     funciona, só não mostra o nome da casa
 *                                     no cartão de destino do Google.
 *
 * -------------------------------------------------------------------------
 * ESTÉTICA DO MAPA — configurar no Google Cloud Console, não aqui.
 *
 * Um mapa com `mapId` IGNORA a propriedade `styles` do MapOptions: o estilo
 * passa a ser servido pela nuvem (cloud-based map styling). Então o visual do
 * mapa é tarefa de configuração, e o estilo a criar deve seguir a paleta da
 * marca — do contrário o azul/bege padrão do Google briga com a página:
 *
 *   · Terreno / landscape ............ Offwhite #F7F9EA
 *   · Água (Lago Paranoá) ............ Uva #3F0A25 a 12–18% sobre o offwhite
 *   · Áreas verdes / parques ......... Oliva #414417 dessaturado
 *   · Vias arteriais e rodovias ...... Bege #C7AE9A, sem contorno branco
 *   · Rótulos de texto ............... Uva #3F0A25, halo Offwhite
 *   · POIs comerciais ................ desligados (o único ponto de interesse
 *                                      desta página é o próprio Wine Garden)
 *   · Transporte público ............. desligado
 *
 * Enquanto o estilo não existir, o mapa aparece na paleta padrão do Google —
 * feio, porém funcional. Não há como forçar o estilo por código com Map ID.
 */

import { LOCATION, SITE } from '@/data/site'

/* -------------------------------------------------------------------------
   Configuração
   ------------------------------------------------------------------------- */

/**
 * Lidas em escopo de módulo porque o Next substitui `process.env.NEXT_PUBLIC_*`
 * literalmente em build — a leitura precisa ser estática para ser inlinada.
 */
const API_KEY = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim()
const MAP_ID = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? '').trim()

export type MapsConfig = {
  apiKey: string
  mapId: string
}

/** Estado do mapa interativo. Vive aqui para o pai não importar o chunk do mapa. */
export type MapStatus = 'idle' | 'loading' | 'ready' | 'error'

let warnedMissingConfig = false

/**
 * A configuração completa, ou `null` quando falta chave ou Map ID.
 *
 * Devolver `null` (em vez de lançar) é deliberado: a ausência de configuração
 * é um caminho previsto da interface, não uma exceção. O aviso só sai em
 * desenvolvimento e só uma vez — em produção o silêncio é a resposta certa.
 */
export function getMapsConfig(): MapsConfig | null {
  if (API_KEY && MAP_ID) return { apiKey: API_KEY, mapId: MAP_ID }

  if (process.env.NODE_ENV === 'development' && !warnedMissingConfig) {
    warnedMissingConfig = true
    console.warn(
      '[maps] Mapa interativo desligado: defina NEXT_PUBLIC_GOOGLE_MAPS_API_KEY e ' +
        'NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID. A seção segue funcionando com o mapa desenhado.',
    )
  }

  return null
}

/** O ponto. Uma só fonte de verdade para mapa, marcador e links de rota. */
export const VENUE: google.maps.LatLngLiteral = { lat: LOCATION.lat, lng: LOCATION.lng }

/* -------------------------------------------------------------------------
   Carregamento do script
   ------------------------------------------------------------------------- */

const SCRIPT_ID = 'wine-garden-google-maps'
/** Nome do callback global exigido pelo parâmetro `loading=async`. */
const CALLBACK_NAME = '__wineGardenMapsReady'
/**
 * Sem teto, uma rede ruim deixa o componente pendurado para sempre. Com teto,
 * a seção assume o mapa desenhado e a vida segue.
 */
const LOAD_TIMEOUT_MS = 12_000

let loaderPromise: Promise<void> | null = null

/** O script já executou nesta página? (volta de navegação client-side, HMR). */
function isMapsLoaded(): boolean {
  if (typeof window === 'undefined') return false
  const injected = (window as unknown as { google?: { maps?: { importLibrary?: unknown } } }).google
  return typeof injected?.maps?.importLibrary === 'function'
}

/**
 * Injeta o bootstrap da Maps JavaScript API e resolve quando `google.maps`
 * está disponível. As bibliotecas em si (maps, marker) são pedidas depois com
 * `google.maps.importLibrary`, que é o caminho atual — `&libraries=` na URL
 * baixa tudo de uma vez e não é mais necessário.
 *
 * Em falha, a promessa é descartada para que uma nova tentativa (outra
 * montagem, outra rede) possa acontecer.
 */
export function loadGoogleMaps(config: MapsConfig): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('O Google Maps só pode ser carregado no cliente.'))
  }

  if (isMapsLoaded()) return Promise.resolve()
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<void>((resolve, reject) => {
    const globals = window as unknown as Record<string, unknown>
    let timeoutId = 0

    const settle = (error?: Error) => {
      window.clearTimeout(timeoutId)
      delete globals[CALLBACK_NAME]
      if (error) {
        loaderPromise = null
        reject(error)
        return
      }
      resolve()
    }

    globals[CALLBACK_NAME] = () => settle()

    const params = new URLSearchParams({
      key: config.apiKey,
      // Canal semanal: correções chegam sem precisar de deploy nosso.
      v: 'weekly',
      loading: 'async',
      callback: CALLBACK_NAME,
      language: SITE.locale,
      region: LOCATION.country,
    })

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.addEventListener('error', () => settle(new Error('Falha ao carregar o Google Maps.')))

    timeoutId = window.setTimeout(
      () => settle(new Error('Tempo esgotado ao carregar o Google Maps.')),
      LOAD_TIMEOUT_MS,
    )

    document.head.appendChild(script)
  })

  return loaderPromise
}

/* -------------------------------------------------------------------------
   Links de rota
   ------------------------------------------------------------------------- */

/**
 * URL universal de navegação. No celular, o próprio sistema entrega ao app do
 * Google Maps (ou ao Apple Maps, via redirecionamento do usuário); no desktop
 * abre a rota no navegador. Por isso não há deep link por plataforma aqui:
 * `maps/dir/?api=1` é o endereço que o Google documenta como universal, e
 * inventar `comgooglemaps://` só quebraria em quem não tem o app.
 *
 * `destination_place_id` entra quando existe: com ele o destino aparece como
 * "Wine Garden" e não como um par de coordenadas soltas. O `destination` em
 * lat/lng continua obrigatório mesmo com Place ID — é o que o Google pede.
 */
export function directionsUrl(): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${VENUE.lat},${VENUE.lng}`,
  })
  if (LOCATION.placeId) params.set('destination_place_id', LOCATION.placeId)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/**
 * Inicia a navegação a partir de um ponto de origem conhecido.
 *
 * Usa a mesma URL universal do `directionsUrl`, mas com `origin` preenchido —
 * assim o app já abre com a rota traçada em vez de pedir "de onde?".
 *
 * NO CELULAR o Google Maps instalado intercepta este endereço e assume a
 * navegação; sem o app, abre no navegador. NO DESKTOP abre a rota no
 * navegador. É o mesmo link nos dois casos: inventar `comgooglemaps://` só
 * quebraria para quem não tem o aplicativo, e `intent://` é exclusivo do
 * Android — a URL universal cobre todos sem detecção de plataforma.
 */
export function navigationUrl(origin?: { lat: number; lng: number }): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${VENUE.lat},${VENUE.lng}`,
    travelmode: 'driving',
    // Abre já no modo navegação quando o aparelho suporta.
    dir_action: 'navigate',
  })
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`)
  if (LOCATION.placeId) params.set('destination_place_id', LOCATION.placeId)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** Ficha do lugar no Google Maps — para quem quer ver fotos, avaliações, rua. */
export function placeUrl(): string {
  const params = new URLSearchParams({
    api: '1',
    query: `${VENUE.lat},${VENUE.lng}`,
  })
  if (LOCATION.placeId) params.set('query_place_id', LOCATION.placeId)
  return `https://www.google.com/maps/search/?${params.toString()}`
}

/**
 * Plataforma do clique, só para instrumentação: saber se a rota é pedida no
 * celular (a caminho) ou no desktop (planejando) muda o que a casa faz com o
 * dado. Calculado no clique, nunca no render — no servidor não há navigator, e
 * decidir markup por user agent geraria divergência de hidratação.
 */
export function detectPlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/* -------------------------------------------------------------------------
   Coordenadas legíveis
   ------------------------------------------------------------------------- */

function toDms(value: number, positive: string, negative: string): string {
  const hemisphere = value >= 0 ? positive : negative
  const absolute = Math.abs(value)

  let degrees = Math.floor(absolute)
  let minutes = Math.floor((absolute - degrees) * 60)
  let seconds = Math.round((absolute - degrees - minutes / 60) * 3600)

  // O arredondamento dos segundos pode estourar em 60: sem normalizar, sai
  // 47°52'60"W — que é tecnicamente 47°53'00"W e passa vergonha na tela.
  if (seconds === 60) {
    seconds = 0
    minutes += 1
  }
  if (minutes === 60) {
    minutes = 0
    degrees += 1
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${degrees}°${pad(minutes)}'${pad(seconds)}"${hemisphere}`
}

/**
 * Coordenadas em graus/minutos/segundos — a notação de carta náutica, que é o
 * vocabulário certo para uma marca que fala em viagem. Derivadas de LOCATION,
 * nunca escritas à mão: se o cliente corrigir o pin, o rótulo acompanha.
 */
export function formatCoordinates(lat: number = VENUE.lat, lng: number = VENUE.lng): string {
  return `${toDms(lat, 'N', 'S')} ${toDms(lng, 'E', 'W')}`
}
