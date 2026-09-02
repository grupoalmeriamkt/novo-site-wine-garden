import { NextResponse } from 'next/server'
import { LOCATION } from '@/data/site'
import { ORIGEM_POR_SLUG } from '@/data/origens'

/**
 * /api/rota?de=<slug> — o trajeto real de um ponto de Brasília até a casa.
 *
 * Alimenta a "carta de descoberta" da seção de localização: a rota que se
 * desenha em pontilhado até o selo, com a distância e o tempo que o Google
 * calcula de verdade. É a linha da marca — trajetória, caminho — aplicada ao
 * dado real em vez de a um traço decorativo.
 *
 * Server-side pelos mesmos motivos de /api/momento: a chave não vai para o
 * navegador, e o resultado é cacheado por rota (o trânsito muda, a geometria
 * da via não).
 */

export const revalidate = 3600

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes'

export type Rota = {
  origem: string
  /** Metros. */
  distancia: number
  /** Segundos. */
  duracao: number
  /** "8,8 km" */
  distanciaTexto: string
  /** "16 min" */
  duracaoTexto: string
  /** Pontos [lat, lng] do traçado, já decodificados e afinados. */
  pontos: [number, number][]
}

/**
 * Decodifica o polyline codificado do Google.
 *
 * O algoritmo é o "encoded polyline" clássico: cada coordenada é a DIFERENÇA
 * em relação à anterior, em unidades de 1e-5 grau, codificada em base64 de
 * 5 bits com bit de continuação e sinal no bit menos significativo.
 */
function decodificarPolyline(encoded: string): [number, number][] {
  const pontos: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    for (const eixo of ['lat', 'lng'] as const) {
      let resultado = 0
      let shift = 0
      let byte: number
      do {
        byte = encoded.charCodeAt(index++) - 63
        resultado |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)
      // Bit 0 marca negativo; o resto é o valor deslocado.
      const delta = resultado & 1 ? ~(resultado >> 1) : resultado >> 1
      if (eixo === 'lat') lat += delta
      else lng += delta
    }
    pontos.push([lat / 1e5, lng / 1e5])
  }
  return pontos
}

/**
 * Reduz a quantidade de pontos mantendo o desenho.
 *
 * Uma rota urbana volta com centenas de vértices, precisos demais para o que
 * a interface faz com eles (desenhar um traço em pontilhado). Pegar um a cada
 * N — sempre preservando o primeiro e o último — corta o payload sem que a
 * diferença seja visível na tela.
 */
function afinar(pontos: [number, number][], maximo = 120): [number, number][] {
  if (pontos.length <= maximo) return pontos
  const passo = Math.ceil(pontos.length / maximo)
  const saida = pontos.filter((_, i) => i % passo === 0)
  const ultimo = pontos[pontos.length - 1]
  if (ultimo && saida[saida.length - 1] !== ultimo) saida.push(ultimo)
  return saida
}

function formatarDistancia(metros: number): string {
  if (metros < 1000) return `${metros} m`
  return `${(metros / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}

function formatarDuracao(segundos: number): string {
  const min = Math.round(segundos / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto === 0 ? `${h} h` : `${h} h ${resto} min`
}

/**
 * Resolve a origem do pedido.
 *
 * Duas formas: `?de=<slug>` para um ponto de referência conhecido, ou
 * `?lat=&lng=` para a posição real do aparelho. As coordenadas são validadas
 * como números finitos dentro da faixa válida — um NaN aqui viraria um pedido
 * malformado à Routes API e um 502 sem explicação.
 */
function resolverOrigem(url: URL): { lat: number; lng: number; rotulo: string } | null {
  const slug = url.searchParams.get('de')
  if (slug) {
    const ponto = ORIGEM_POR_SLUG[slug]
    return ponto ? { lat: ponto.lat, lng: ponto.lng, rotulo: ponto.slug } : null
  }

  const lat = Number(url.searchParams.get('lat'))
  const lng = Number(url.searchParams.get('lng'))
  const valido =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  return valido ? { lat, lng, rotulo: 'minha-localizacao' } : null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origem = resolverOrigem(url)
  if (!origem) {
    return NextResponse.json({ erro: 'origem desconhecida' }, { status: 400 })
  }

  const key = process.env.GOOGLE_WEATHER_API_KEY
  if (!key) {
    // Sem chave a seção continua funcionando: a carta desenha a rota reta
    // entre os dois pontos, e a interface não promete tempo de viagem.
    return NextResponse.json({ erro: 'sem chave' }, { status: 503 })
  }

  try {
    const resposta = await fetch(ROUTES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        // A máscara de campos é obrigatória na Routes API e é o que mantém a
        // resposta pequena: pedimos só o que a interface desenha.
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origem.lat, longitude: origem.lng } } },
        destination: { location: { latLng: { latitude: LOCATION.lat, longitude: LOCATION.lng } } },
        travelMode: 'DRIVE',
        languageCode: 'pt-BR',
        units: 'METRIC',
      }),
      signal: AbortSignal.timeout(6000),
      // Mesma razão: só a rota de ponto fixo entra no cache de dados do Next.
      next: origem.rotulo === 'minha-localizacao' ? { revalidate: 0 } : { revalidate },
    })

    if (!resposta.ok) return NextResponse.json({ erro: 'rota indisponível' }, { status: 502 })

    const dados = (await resposta.json()) as {
      routes?: {
        distanceMeters?: number
        duration?: string
        polyline?: { encodedPolyline?: string }
      }[]
    }

    const rota = dados.routes?.[0]
    const encoded = rota?.polyline?.encodedPolyline
    if (!rota || !encoded || typeof rota.distanceMeters !== 'number') {
      return NextResponse.json({ erro: 'rota vazia' }, { status: 502 })
    }

    // A duração vem como "937s".
    const segundos = Number.parseInt(rota.duration ?? '0', 10)

    const payload: Rota = {
      origem: origem.rotulo,
      distancia: rota.distanceMeters,
      duracao: segundos,
      distanciaTexto: formatarDistancia(rota.distanceMeters),
      duracaoTexto: formatarDuracao(segundos),
      pontos: afinar(decodificarPolyline(encoded)),
    }

    /*
     * Rota de ponto conhecido pode ser cacheada em CDN — é a mesma para todo
     * mundo. Rota da posição do aparelho, NÃO: é dado de uma pessoa só, e
     * guardá-la num cache compartilhado a entregaria ao próximo visitante.
     */
    const doAparelho = origem.rotulo === 'minha-localizacao'
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': doAparelho
          ? 'private, no-store'
          : 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return NextResponse.json({ erro: 'falha ao consultar a rota' }, { status: 502 })
  }
}
