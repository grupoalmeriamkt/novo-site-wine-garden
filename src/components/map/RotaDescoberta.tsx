'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MonoLabel } from '@/components/primitives/Typography'
import { ORIGENS } from '@/data/origens'
import { LOCATION } from '@/data/site'
import { useGeolocalizacao } from '@/hooks/useGeolocalizacao'
import { track } from '@/lib/analytics'
import { detectPlatform, navigationUrl } from '@/lib/maps'
import type { Rota } from '@/app/api/rota/route'
import styles from './RotaDescoberta.module.css'

/**
 * A CARTA DE DESCOBERTA.
 *
 * Escolha de onde você vem e a rota se desenha até a casa — em pontilhado, o
 * grafismo que o manual define como "trajetória, caminho, conexão". O selo no
 * fim é o X do mapa; a linha que chega até ele é real, calculada pela Routes
 * API do Google, com a distância e o tempo que ela devolve.
 *
 * DUAS CAMADAS, MESMA ROTA:
 *
 * · Sobre o mapa do Google, quando há chave: uma Polyline de pontos, animada
 *   ponto a ponto, e a câmera enquadra o trajeto inteiro.
 * · Sobre a carta desenhada, sempre: o mesmo traçado em SVG, projetado por
 *   Mercator. É o que aparece em desenvolvimento e se a chave faltar — e foi
 *   desenhado como peça, não como aviso de erro.
 *
 * O traço nunca é reto: é a geometria da via real, que curva sozinha.
 */

type Props = {
  /** Instância do mapa, quando ele existir. `null` = só a carta desenhada. */
  map?: google.maps.Map | null
  onRota?: (rota: Rota | null) => void
}

/** Projeção Mercator normalizada (0–1) — a mesma que o Google usa. */
function projetar(lat: number, lng: number): { x: number; y: number } {
  const x = (lng + 180) / 360
  const sin = Math.sin((lat * Math.PI) / 180)
  const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)
  return { x, y }
}

type Traçado = {
  /** Atributo `d` do path. */
  d: string
  inicio: { x: number; y: number }
  fim: { x: number; y: number }
}

/**
 * Converte a rota em um traçado de SVG num viewBox 0–100, com folga nas
 * bordas. Enquadra o percurso inteiro, seja ele curto ou longo, e devolve
 * junto as pontas — que a interface usa para pousar o círculo de origem e o X
 * do destino sem ter que reler a string do path.
 */
function traçarSvg(pontos: readonly [number, number][]): Traçado | null {
  if (pontos.length < 2) return null
  const proj = pontos.map(([lat, lng]) => projetar(lat, lng))
  const xs = proj.map((p) => p.x)
  const ys = proj.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  // Escala única nos dois eixos: usar escalas diferentes distorceria a
  // geografia, e a rota deixaria de parecer a rota.
  const span = Math.max(maxX - minX, maxY - minY) || 1
  const escala = 78 / span
  const offX = (100 - (maxX - minX) * escala) / 2
  const offY = (100 - (maxY - minY) * escala) / 2

  const emTela = proj.map((p) => ({
    x: offX + (p.x - minX) * escala,
    y: offY + (p.y - minY) * escala,
  }))

  const d = emTela
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')

  return { d, inicio: emTela[0]!, fim: emTela[emTela.length - 1]! }
}

export function RotaDescoberta({ map = null, onRota }: Props) {
  const [origem, setOrigem] = useState<string | null>(null)
  const [rota, setRota] = useState<Rota | null>(null)
  const [estado, setEstado] = useState<'ocioso' | 'buscando' | 'pronto' | 'erro'>('ocioso')
  const pathRef = useRef<SVGPathElement | null>(null)
  /* A Polyline do Google vive fora do React: guardamos para poder removê-la. */
  const linhaRef = useRef<google.maps.Polyline | null>(null)
  const geo = useGeolocalizacao()

  /** Busca a rota para uma origem já resolvida em coordenadas ou slug. */
  const buscar = useCallback(
    async (query: string, rotulo: string) => {
      setOrigem(rotulo)
      setEstado('buscando')

      try {
        const r = await fetch(`/api/rota?${query}`)
        if (!r.ok) throw new Error('rota indisponível')
        const dados: Rota = await r.json()
        setRota(dados)
        setEstado('pronto')
        onRota?.(dados)
      } catch {
        setRota(null)
        setEstado('erro')
        onRota?.(null)
      }
    },
    [onRota],
  )

  const escolher = useCallback(
    (slug: string) => {
      track('directions_click', { platform: `carta:${slug}` })
      void buscar(`de=${slug}`, slug)
    },
    [buscar],
  )

  /*
   * A rota da posição real é buscada DENTRO da resposta do navegador, não num
   * efeito que observa o estado do hook: o efeito chamaria `setState` em
   * cascata assim que a permissão fosse concedida.
   */
  const usarMinhaPosicao = useCallback(() => {
    geo.pedir((posicao) => {
      track('directions_click', { platform: 'carta:minha-localizacao' })
      void buscar(`lat=${posicao.lat}&lng=${posicao.lng}`, 'minha-localizacao')
    })
  }, [geo, buscar])

  /* -------------------------------------------------- desenho no SVG */

  useEffect(() => {
    const path = pathRef.current
    if (!path || !rota) return

    // Revelação por dashoffset: o traço cresce da origem até o destino, como
    // uma rota sendo traçada à mão sobre a carta.
    const comprimento = path.getTotalLength()
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduzido) {
      path.style.strokeDasharray = '3 4'
      path.style.strokeDashoffset = '0'
      return
    }

    path.style.transition = 'none'
    path.style.strokeDasharray = `${comprimento}`
    path.style.strokeDashoffset = `${comprimento}`
    // Força o navegador a aplicar o estado inicial antes de animar.
    void path.getBoundingClientRect()
    path.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(0.65, 0, 0.35, 1)'
    path.style.strokeDashoffset = '0'

    // Ao terminar, troca para o pontilhado da marca — animar o offset de um
    // traço já pontilhado faria os pontos deslizarem em vez de a linha crescer.
    const t = setTimeout(() => {
      path.style.transition = 'none'
      path.style.strokeDasharray = '3 4'
      path.style.strokeDashoffset = '0'
    }, 1650)
    return () => clearTimeout(t)
  }, [rota])

  /* ------------------------------------------- desenho sobre o mapa real */

  useEffect(() => {
    if (!map || !rota) return

    linhaRef.current?.setMap(null)

    const caminho = rota.pontos.map(([lat, lng]) => ({ lat, lng }))
    const linha = new google.maps.Polyline({
      path: caminho,
      map,
      // A linha em si é invisível; o que se vê são os símbolos repetidos —
      // é assim que se faz um traço pontilhado no Google Maps.
      strokeOpacity: 0,
      icons: [
        {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 2.6,
            fillColor: '#891a3d',
            fillOpacity: 1,
            strokeOpacity: 0,
          },
          offset: '0',
          repeat: '14px',
        },
      ],
      zIndex: 40,
    })
    linhaRef.current = linha

    const limites = new google.maps.LatLngBounds()
    for (const p of caminho) limites.extend(p)
    map.fitBounds(limites, { top: 70, right: 60, bottom: 70, left: 60 })

    return () => {
      linha.setMap(null)
      linhaRef.current = null
    }
  }, [map, rota])

  const traçado = rota ? traçarSvg(rota.pontos) : null
  const daMinhaPosicao = origem === 'minha-localizacao'
  const nomeOrigem = daMinhaPosicao
    ? 'Você'
    : (ORIGENS.find((o) => o.slug === origem)?.nome ?? '')

  /* O link já sai com a origem preenchida quando ela é a posição real: o app
     abre navegando, em vez de perguntar de onde. */
  const linkJornada = navigationUrl(geo.posicao ?? undefined)

  return (
    <div className={styles.carta}>
      <div className={styles.pergunta}>
        <MonoLabel size="xs" muted>
          De onde você vem?
        </MonoLabel>

        <ul className={styles.opcoes}>
          {/*
            A posição real vem primeiro e com destaque: é a resposta certa para
            quem está a caminho. Os pontos de referência ficam como alternativa
            para quem prefere não dar a localização — ou para quem está
            planejando de outro lugar.
          */}
          <li>
            <button
              type="button"
              className={`${styles.opcao} ${styles.opcaoGeo}`}
              data-ativo={daMinhaPosicao || undefined}
              aria-pressed={daMinhaPosicao}
              onClick={usarMinhaPosicao}
              disabled={geo.estado === 'pedindo'}
            >
              <svg viewBox="0 0 16 16" className={styles.iconeGeo} aria-hidden="true" focusable="false">
                <circle cx="8" cy="8" r="2.6" fill="currentColor" />
                <circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.1" />
                <path d="M8 0v2.2M8 13.8V16M0 8h2.2M13.8 8H16" stroke="currentColor" strokeWidth="1.1" />
              </svg>
              {geo.estado === 'pedindo' ? 'Localizando…' : 'Minha localização'}
            </button>
          </li>

          {ORIGENS.map((o) => (
            <li key={o.slug}>
              <button
                type="button"
                className={styles.opcao}
                data-ativo={origem === o.slug || undefined}
                aria-pressed={origem === o.slug}
                onClick={() => escolher(o.slug)}
              >
                {o.nome}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/*
        A carta. Só entra no DOM quando há rota — antes disso não há nada
        verdadeiro para desenhar, e um traçado inventado seria pior que um vão.
      */}
      {traçado ? (
        <figure className={styles.traçado}>
          <svg viewBox="0 0 100 100" className={styles.svg} aria-hidden="true" focusable="false">
            {/* Malha de carta náutica, bem apagada. */}
            <defs>
              <pattern id="malha-carta" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M10 0 L0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.15" opacity="0.16" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#malha-carta)" />

            <path
              ref={pathRef}
              d={traçado.d}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.rota}
            />

            {/* Origem: um círculo aberto. Destino: o X que marca o lugar. */}
            <circle
              className={styles.pontoOrigem}
              r="1.5"
              cx={traçado.inicio.x}
              cy={traçado.inicio.y}
            />
            <g
              className={styles.destino}
              transform={`translate(${traçado.fim.x}, ${traçado.fim.y})`}
            >
              <path d="M-2.2 -2.2 L2.2 2.2 M2.2 -2.2 L-2.2 2.2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
              <circle r="4" fill="none" stroke="currentColor" strokeWidth="0.4" strokeDasharray="1.2 1.6" />
            </g>
          </svg>

          <figcaption className={styles.legenda}>
            <span className={styles.de}>{nomeOrigem}</span>
            <span className={styles.setaLegenda} aria-hidden="true">
              ⟶
            </span>
            <span className={styles.para}>Wine Garden</span>
            <span className={styles.numeros}>
              <strong>{rota?.distanciaTexto}</strong>
              <span aria-hidden="true"> · </span>
              <strong>{rota?.duracaoTexto}</strong>
            </span>
          </figcaption>
        </figure>
      ) : null}

      {/* Estados. `aria-live` anuncia sem roubar o foco de quem escolheu. */}
      <p className={styles.estado} aria-live="polite">
        {geo.estado === 'pedindo' ? 'Pedindo a sua localização ao navegador…' : null}
        {geo.estado === 'negado'
          ? 'Sem acesso à localização. Escolha um ponto de partida na lista acima.'
          : null}
        {geo.estado === 'indisponivel'
          ? 'Este navegador não informa localização. Escolha um ponto de partida acima.'
          : null}
        {geo.estado === 'erro'
          ? 'Não consegui a sua posição agora. Escolha um ponto de partida acima.'
          : null}
        {estado === 'buscando' ? 'Traçando a rota…' : null}
        {estado === 'erro'
          ? 'Não foi possível calcular agora — use “Iniciar jornada” para abrir no Google Maps.'
          : null}
        {estado === 'pronto' && rota
          ? `${rota.distanciaTexto} até o ${LOCATION.complement}, cerca de ${rota.duracaoTexto} de carro.`
          : null}
      </p>

      {/*
        O CTA da jornada. Só aparece com a rota calculada — antes disso não há
        tempo nem distância para prometer. O mesmo link serve celular e desktop:
        onde o Google Maps está instalado, ele intercepta e assume a navegação.
      */}
      {estado === 'pronto' && rota ? (
        <a
          href={linkJornada}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.jornada}
          onClick={() =>
            track('directions_click', {
              platform: `jornada:${detectPlatform()}${daMinhaPosicao ? ':geo' : ''}`,
            })
          }
        >
          <span className={styles.jornadaTexto}>Iniciar jornada</span>
          <span className={styles.jornadaTempo}>{rota.duracaoTexto}</span>
          <svg viewBox="0 0 24 12" className={styles.jornadaSeta} aria-hidden="true" focusable="false">
            <path d="M0 6h21M16 1l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          </svg>
        </a>
      ) : null}
    </div>
  )
}
