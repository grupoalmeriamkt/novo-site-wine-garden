import { Hero } from '@/components/sections/Hero'
import { Manifesto } from '@/components/sections/Manifesto'
import { Gastronomia } from '@/components/sections/Gastronomia'
import { Pessoas } from '@/components/sections/Pessoas'
import { Cartografia } from '@/components/sections/Cartografia'
import { Eventos } from '@/components/sections/Eventos'
import { Localizacao } from '@/components/sections/Localizacao'
import { Perguntas } from '@/components/sections/Perguntas'
import type { Metadata } from 'next'
import { WINES } from '@/data/generated/wines'
import { LOCATION, SITE } from '@/data/site'
import { wineOriginsJsonLd } from '@/lib/seo'

const PAISES = new Set(WINES.map((w) => w.country).filter(Boolean)).size
const EM_TACA = WINES.filter((w) => w.servingType === 'taca').length

/**
 * Metadata da home.
 *
 * O título nomeia o que a busca procura — "wine bar", "Brasília", "vinho em
 * taça" — antes da marca, porque quem ainda não conhece o lugar não pesquisa
 * pelo nome. A descrição responde a pergunta com números reais, em vez de
 * adjetivos: é o que um assistente consegue citar.
 */
export const metadata: Metadata = {
  title: {
    absolute: `${SITE.name} — Wine bar e restaurante no Pontão do Lago Sul, Brasília`,
  },
  description: `${WINES.length} rótulos de ${PAISES} países, ${EM_TACA} deles servidos em taça. Cozinha contemporânea, jardim coberto e carta com harmonização declarada, no ${LOCATION.complement}, em ${LOCATION.city}.`,
  alternates: { canonical: '/' },
}

/*
 * MEDIDO E DESCARTADO: pôr Cartografia, Eventos e Localização em chunks
 * próprios com next/dynamic. A hipótese era tirar peso do caminho crítico de
 * hidratação; o resultado, no Lighthouse com throttling real, foi PIOR —
 * performance 84 → 78 e LCP 2,8 s → 3,4 s, com o TBT igual. Os pedidos extras
 * em cadeia custam mais, sob rede lenta, do que o bundle único economiza, e
 * como as seções renderizam no servidor o JS é preciso na hidratação de todo
 * jeito. O único dynamic que se paga aqui é o do Google Maps, dentro da
 * Localização, porque lá o código só é buscado se a chave existir.
 */

/**
 * A jornada.
 *
 * A ordem é a narrativa, e cada passo responde ao anterior:
 *
 * 1. HERO        — o desejo. "Eu quero estar nesse lugar."
 * 2. MANIFESTO   — a premissa. Escolher é o assunto da casa.
 * 3. CARTOGRAFIA — a viagem. Oito origens ligadas pela linha da marca.
 * 4. GASTRONOMIA — a mesa, e a ponte de volta para a carta pela harmonização.
 * 5. PESSOAS     — com quem. O argumento social.
 * 6. EVENTOS     — a casa inteira, para uma ocasião.
 * 7. LOCALIZAÇÃO — o fim da viagem é um endereço.
 * 8. PERGUNTAS   — o que ficou por responder, respondido.
 *
 * O Garden e Experiências saíram a pedido da casa. A perda a cobrir era o
 * espaço físico, que só aquelas seções mostravam: as fotos do jardim passaram
 * para a Gastronomia e para a Localização, onde ainda respondem "como é estar
 * lá" sem sustentar duas paradas inteiras da narrativa.
 *
 * As atmosferas alternam ao longo do percurso (noturna → editorial → terroir →
 * bege → intensa) para que o site nunca vire um bloco de bordô: é o ritmo de
 * claro e escuro que dá fôlego à leitura.
 *
 * Server Component: nenhuma destas seções precisa de dado do cliente para
 * decidir o que renderizar. As que animam declaram `'use client'` por conta
 * própria e hidratam sozinhas.
 */
export default function HomePage() {
  return (
    <>
      {/*
        As origens da carta como lista estruturada. Fica na home porque é aqui
        que a cartografia das oito origens aparece — dado estruturado precisa
        acompanhar o conteúdo que descreve.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(wineOriginsJsonLd()) }}
      />
      <Hero />
      <Manifesto />
      <Cartografia />
      <Gastronomia />
      <Pessoas />
      <Eventos />
      <Localizacao />
      <Perguntas />
    </>
  )
}
