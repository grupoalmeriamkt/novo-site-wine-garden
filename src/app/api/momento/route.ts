import { NextResponse } from 'next/server'
import { LOCATION } from '@/data/site'
import { montarMomento, type Clima } from '@/lib/momento'

/**
 * /api/momento — que horas são no Wine Garden e como está o tempo lá.
 *
 * POR QUE ISTO É UM ROUTE HANDLER, e não uma chamada do navegador:
 *
 * 1. A CHAVE FICA NO SERVIDOR. `GOOGLE_WEATHER_API_KEY` não tem prefixo
 *    NEXT_PUBLIC_, então não entra no bundle do cliente. Uma chave de clima
 *    exposta no HTML é cota de outra pessoa gastando na conta do cliente.
 * 2. UMA CHAMADA SERVE TODO MUNDO. Com `revalidate`, mil visitantes num
 *    quarto de hora consomem uma requisição à API, não mil.
 * 3. A RESPOSTA JÁ VEM DECIDIDA. O cálculo de aberto/fechado e a sugestão do
 *    cardápio acontecem aqui; o cliente recebe texto pronto e não precisa
 *    carregar o cardápio inteiro para escolher uma linha.
 */

/** Quinze minutos: o tempo não muda mais rápido que isso, e o relógio da
 *  interface se atualiza sozinho entre as revalidações. */
export const revalidate = 900

const WEATHER_ENDPOINT = 'https://weather.googleapis.com/v1/currentConditions:lookup'

/** Só os campos que a interface usa — o resto da resposta é descartado. */
type WeatherResponse = {
  weatherCondition?: { type?: string; description?: { text?: string } }
  temperature?: { degrees?: number }
  feelsLikeTemperature?: { degrees?: number }
  precipitation?: { probability?: { percent?: number } }
  isDaytime?: boolean
}

async function buscarClima(): Promise<Clima | null> {
  const key = process.env.GOOGLE_WEATHER_API_KEY
  // Sem chave configurada não é erro: o momento funciona só com o relógio.
  if (!key) return null

  const url = new URL(WEATHER_ENDPOINT)
  url.searchParams.set('key', key)
  url.searchParams.set('location.latitude', String(LOCATION.lat))
  url.searchParams.set('location.longitude', String(LOCATION.lng))
  // A própria API traduz a descrição — melhor que um dicionário nosso de
  // dezenas de condições, que envelheceria a cada código novo.
  url.searchParams.set('languageCode', 'pt-BR')
  url.searchParams.set('unitsSystem', 'METRIC')

  try {
    const resposta = await fetch(url, {
      // Um teto curto: o herói não pode esperar por uma API de enfeite.
      signal: AbortSignal.timeout(4000),
      next: { revalidate },
    })
    if (!resposta.ok) return null

    const dados = (await resposta.json()) as WeatherResponse
    const graus = dados.temperature?.degrees
    const descricao = dados.weatherCondition?.description?.text
    // Sem temperatura ou sem descrição a leitura fica pela metade; melhor cair
    // no modo relógio do que mostrar "undefined°".
    if (typeof graus !== 'number' || !descricao) return null

    return {
      descricao,
      tipo: dados.weatherCondition?.type ?? '',
      temperatura: graus,
      sensacao: dados.feelsLikeTemperature?.degrees ?? graus,
      chuva: dados.precipitation?.probability?.percent ?? 0,
      dia: dados.isDaytime ?? true,
    }
  } catch {
    // Timeout, rede fora, cota estourada, chave revogada: em todos os casos o
    // herói continua mostrando data, hora e se a casa está aberta.
    return null
  }
}

export async function GET() {
  const clima = await buscarClima()
  const momento = montarMomento(new Date(), clima)

  return NextResponse.json(momento, {
    headers: {
      // O relógio muda a cada minuto, o clima a cada quinze. O `stale-while-
      // revalidate` deixa o CDN servir o valor antigo enquanto busca o novo,
      // então ninguém espera pela API.
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
    },
  })
}
