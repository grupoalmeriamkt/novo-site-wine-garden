'use client'

import { useEffect, useRef, useState } from 'react'
import { useGsapOn } from '@/hooks/useGsap'
import { LOCATION, SITE } from '@/data/site'
import { VENUE, getMapsConfig, loadGoogleMaps, type MapStatus } from '@/lib/maps'
import styles from './MapExperience.module.css'

type MapExperienceProps = {
  /**
   * Recebe o setter de estado do pai. Passar o setter direto (e não um handler
   * novo a cada render) é o que mantém o efeito abaixo com dependência estável
   * — do contrário o mapa seria destruído e recriado a cada render do pai.
   */
  onStatusChange: (status: MapStatus) => void
}

/**
 * A entrada da câmera.
 *
 * O zoom inicial é continental de propósito: a marca vende viagem ("Viaje o
 * mundo, taça a taça"), então o mapa começa longe e desce até a mesa. A
 * animação existe para dizer "sua viagem chegou aqui" — não é enfeite de
 * carregamento. `compact` fecha um pouco menos no celular, onde um zoom alto
 * mostra só asfalto e nenhuma referência do Pontão.
 */
const CAMERA = {
  /* Zoom 5 mostra o Brasil inteiro: longe o bastante para a chegada ter
     distância, perto o bastante para o primeiro quadro ainda ser território
     reconhecível — e não uma mancha de oceano dissolvendo sobre a estampa. */
  start: 5,
  target: 16.4,
  targetCompact: 15.6,
  durationSeconds: 2.6,
} as const

/**
 * Lê um token de cor do CSS.
 *
 * O fundo do mapa (o que aparece enquanto os tiles chegam) precisa ser o mesmo
 * offwhite da seção, senão pisca um cinza do Google entre o mapa desenhado e o
 * mapa real. Ler o token em vez de escrever o hex mantém tokens.css como fonte
 * de verdade — mesma tática de `motionToken()` em src/lib/motion/gsap.ts.
 */
function colorToken(scope: Element, name: string): string {
  return getComputedStyle(scope).getPropertyValue(name).trim()
}

/** Cria um nó já com a classe do CSS Module. */
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string | undefined,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  // `noUncheckedIndexedAccess` faz o mapa de classes do CSS Module devolver
  // `string | undefined`. A classe sempre existe em build; o fallback só
  // satisfaz o tipo sem espalhar `?? ''` por dez linhas.
  node.className = className ?? ''
  return node
}

/**
 * O marcador.
 *
 * `AdvancedMarkerElement` aceita um HTMLElement como conteúdo — é por isso que
 * ele substituiu o `google.maps.Marker` (que só aceitava imagem/ícone) e é por
 * isso que conseguimos usar o selo oficial da marca em vez de um pin genérico.
 * O elemento é ancorado pela base, então a ordem vertical (selo → haste →
 * ponto) coloca o ponto exatamente sobre a coordenada.
 */
function createMarkerContent(): HTMLElement {
  const marker = element('div', styles.marker)
  const badge = element('div', styles.markerBadge)
  const halo = element('span', styles.markerHalo)

  const seal = element('img', styles.markerSeal)
  seal.src = '/brand/selos/logotipo-1.svg'
  // Decorativo: o nome acessível do marcador vem da opção `title`, e repetir
  // aqui faria o leitor de tela anunciar a casa duas vezes.
  seal.alt = ''
  seal.width = 58
  seal.height = 49
  seal.draggable = false

  badge.append(halo, seal)

  const stem = element('span', styles.markerStem)
  const dot = element('span', styles.markerDot)

  marker.append(badge, stem, dot)
  return marker
}

/**
 * O mapa interativo.
 *
 * Carregado por `next/dynamic` com `ssr: false` a partir de Localizacao, e só
 * quando a seção se aproxima da viewport — a Maps JavaScript API pesa centenas
 * de KB e não pode entrar no carregamento inicial da home.
 *
 * O componente NUNCA é responsável pelo conteúdo da seção: se ele falhar,
 * quem está por baixo (o mapa desenhado de Localizacao) continua na tela com
 * endereço, horário e rota. Por isso todo caminho de erro termina em
 * `onStatusChange('error')` e nada mais.
 */
export function MapExperience({ onStatusChange }: MapExperienceProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const targetZoomRef = useRef<number>(CAMERA.target)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const host = stageRef.current
    if (!host) return

    const config = getMapsConfig()
    if (!config) {
      onStatusChange('error')
      return
    }

    let cancelled = false
    let marker: google.maps.marker.AdvancedMarkerElement | null = null
    onStatusChange('loading')

    const boot = async () => {
      await loadGoogleMaps(config)

      // As bibliotecas vêm em paralelo: `maps` desenha, `marker` traz o
      // AdvancedMarkerElement. O `google.maps.Marker` clássico está depreciado
      // desde fev/2024 e não é usado em lugar nenhum deste projeto.
      const [mapsLib, markerLib] = await Promise.all([
        google.maps.importLibrary('maps'),
        google.maps.importLibrary('marker'),
      ])
      if (cancelled) return

      const { Map } = mapsLib as google.maps.MapsLibrary
      const { AdvancedMarkerElement } = markerLib as google.maps.MarkerLibrary

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const compact = !window.matchMedia('(min-width: 768px)').matches
      targetZoomRef.current = compact ? CAMERA.targetCompact : CAMERA.target

      const background = colorToken(host, '--surface-sunken')

      const map = new Map(host, {
        // Obrigatório para o AdvancedMarkerElement e único jeito de estilizar:
        // com mapId, a propriedade `styles` é ignorada e o visual vem do
        // estilo publicado no Google Cloud Console (ver src/lib/maps.ts).
        mapId: config.mapId,
        center: VENUE,
        ...(background ? { backgroundColor: background } : {}),
        zoom: reduced ? targetZoomRef.current : CAMERA.start,
        // Zoom fracionário: sem ele a câmera desce aos saltos de nível inteiro
        // e a entrada cinematográfica vira um stop-motion.
        isFractionalZoomEnabled: true,
        // A interface do Google inteira competiria com a direção de arte da
        // página; sobra o zoom, que é o único controle realmente usado.
        disableDefaultUI: true,
        zoomControl: !compact,
        // `cooperative` protege a rolagem da página: no desktop exige Ctrl para
        // dar zoom, no toque exige dois dedos para arrastar. `greedy` sequestra
        // o scroll e é a causa clássica de "não consigo passar do mapa".
        // Durante o voo da câmera fica `none` para o gesto não brigar com a
        // animação.
        gestureHandling: reduced ? 'cooperative' : 'none',
        // Os POIs do Google abririam fichas de outros estabelecimentos dentro
        // da nossa página. O único ponto de interesse aqui é a casa.
        clickableIcons: false,
      })
      mapRef.current = map

      marker = new AdvancedMarkerElement({
        map,
        position: VENUE,
        content: createMarkerContent(),
        title: `${SITE.name} — ${LOCATION.addressLine}`,
      })

      setReady(true)
      onStatusChange('ready')
    }

    boot().catch(() => {
      if (!cancelled) onStatusChange('error')
    })

    return () => {
      cancelled = true
      if (marker) marker.map = null
      if (mapRef.current) google.maps.event.clearInstanceListeners(mapRef.current)
      mapRef.current = null
      // O Maps injeta o próprio DOM dentro do host; o React não conhece esses
      // nós e não os remove quando o efeito roda de novo.
      host.replaceChildren()
    }
  }, [onStatusChange])

  /**
   * O voo da câmera.
   *
   * A tween corre sobre um objeto simples e empurra cada quadro para
   * `moveCamera` — é o jeito de animar zoom no Maps com uma curva nossa, já que
   * `setZoom` salta e `panTo` só translada. Fica dentro do gsap.context do
   * hook, então uma desmontagem no meio do voo mata a tween junto.
   */
  useGsapOn(
    stageRef,
    ({ gsap }) => {
      const map = mapRef.current
      if (!ready || !map) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const camera = { zoom: CAMERA.start }

      gsap.to(camera, {
        zoom: targetZoomRef.current,
        duration: CAMERA.durationSeconds,
        // Sai devagar, ganha velocidade na descida e freia na chegada: é a
        // curva de uma aterrissagem, não de um zoom de software.
        ease: 'power2.inOut',
        onUpdate: () => {
          map.moveCamera({ center: VENUE, zoom: camera.zoom })
        },
        onComplete: () => {
          map.setOptions({ gestureHandling: 'cooperative' })
        },
      })
    },
    [ready],
  )

  return (
    <div
      ref={stageRef}
      className={styles.map}
      data-ready={ready ? 'true' : undefined}
      // O mapa é complemento: endereço, horário e rota já estão em texto na
      // seção. O rótulo existe para quem navega por regiões saber o que é.
      role="region"
      aria-label={`Mapa interativo com a localização do ${SITE.name}`}
    />
  )
}
