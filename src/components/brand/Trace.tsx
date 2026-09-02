'use client'

import { useId, useRef } from 'react'
import { useGsapOn } from '@/hooks/useGsap'
import { scheduleRefresh } from '@/lib/motion/refresh'
import { smoothPath, sPath, type Point } from '@/lib/motion/path'
import styles from './Trace.module.css'

type TraceMode =
  /** Revela conforme o scroll atravessa o elemento — o traço "viaja" com você. */
  | 'scrub'
  /** Desenha de uma vez quando entra na viewport. */
  | 'draw'
  /** Já desenhado; nenhuma animação. */
  | 'static'

type TraceProps = {
  /** Pontos normalizados (0–1) por onde a linha passa. */
  points: readonly Point[]
  /** Proporção do viewBox. Só afeta a curvatura, não o tamanho renderizado. */
  viewBox?: { width: number; height: number }
  mode?: TraceMode
  /** Elemento que dispara o scrub. Sem ele, usa o próprio SVG. */
  triggerRef?: React.RefObject<HTMLElement | null>
  /** Fecha o caminho — a rota circular do adesivo da marca. */
  closed?: boolean
  tension?: number
  /** Usa o gesto em S de duas pontas em vez da spline (para ligar dois textos). */
  sShape?: boolean
  className?: string
  /** Espessura em unidades do viewBox. */
  strokeWidth?: number
  /** Marcadores nos vértices — os "pousos" da rota. */
  showNodes?: boolean
  /** Decorativo por padrão: a linha nunca carrega informação sozinha. */
  title?: string
}

/**
 * A linha pontilhada da identidade.
 *
 * "Elemento que simboliza trajetória, caminho, conexão ou região" — definição
 * literal do manual (p.14). Ela aparece em momentos marcantes, não o tempo
 * todo: cada uso precisa conectar duas coisas que a narrativa quer aproximar.
 *
 * A revelação inverte os papéis do par path/máscara — ver o comentário no JSX
 * abaixo: o pontilhado fica no path visível, que nunca é animado, e o
 * dashoffset é animado numa máscara sólida que o vai descobrindo.
 */
export function Trace({
  points,
  viewBox = { width: 1000, height: 600 },
  mode = 'scrub',
  triggerRef,
  closed = false,
  tension = 0.62,
  sShape = false,
  className,
  strokeWidth = 2,
  showNodes = false,
  title,
}: TraceProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const maskId = useId().replace(/:/g, '')

  const scaled: Point[] = points.map((p) => ({
    x: p.x * viewBox.width,
    y: p.y * viewBox.height,
  }))

  const d =
    sShape && scaled.length >= 2
      ? sPath(scaled[0]!, scaled[scaled.length - 1]!, viewBox.width * 0.14)
      : smoothPath(scaled, tension, closed)

  // A máscara precisa ser folgada o bastante para cobrir o traço mesmo quando o
  // SVG é esticado sem manter proporção — daí a fração do lado maior.
  const maskWidth = Math.max(viewBox.width, viewBox.height) * 0.035

  useGsapOn(
    svgRef,
    ({ gsap, root }) => {
      if (mode === 'static') return
      const reveal = root.querySelector<SVGPathElement>('[data-trace-reveal]')
      if (!reveal) return

      const length = reveal.getTotalLength()
      gsap.set(reveal, { strokeDasharray: length, strokeDashoffset: length })

      // Quem pediu menos movimento vê a linha inteira, sem desenho progressivo:
      // a informação (a conexão entre os pontos) continua toda lá.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(reveal, { strokeDashoffset: 0 })
        return
      }

      const trigger = triggerRef?.current ?? root

      if (mode === 'scrub') {
        gsap.to(reveal, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: {
            trigger,
            start: 'top 78%',
            end: 'bottom 42%',
            scrub: 0.6,
          },
        })
      } else {
        gsap.to(reveal, {
          strokeDashoffset: 0,
          duration: 1.6,
          ease: 'power2.inOut',
          scrollTrigger: { trigger, start: 'top 76%', once: true },
        })
      }

      if (showNodes) {
        gsap.fromTo(
          root.querySelectorAll('[data-trace-node]'),
          { scale: 0, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.5,
            stagger: 0.09,
            ease: 'back.out(2)',
            transformOrigin: 'center',
            scrollTrigger: { trigger, start: 'top 68%', once: true },
          },
        )
      }

      // O SVG costuma estar dentro de uma seção que só ganha altura depois das
      // imagens carregarem; sem o refresh o start/end fica calculado no vazio.
      // O agendador agrupa as chamadas de todos os Traces num refresh só.
      scheduleRefresh()
    },
    [d, mode, showNodes],
  )

  return (
    <svg
      ref={svgRef}
      className={className ? `${styles.trace} ${className}` : styles.trace}
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      fill="none"
      preserveAspectRatio="none"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}

      {/*
        Animar o dashoffset de um traço JÁ pontilhado faria os pontos
        deslizarem em vez de a linha crescer. Então separamos os papéis:

        · o path VISÍVEL carrega o pontilhado da marca e nunca é animado;
        · a MÁSCARA é um traço sólido e grosso cujo dashoffset é animado —
          conforme ela cresce, vai descobrindo os pontos que já estão lá.

        A máscara não usa vectorEffect: dentro de <mask> o stroke precisa ter
        largura em unidades do viewBox, senão não cobre o traço quando o SVG é
        esticado por preserveAspectRatio="none".
      */}
      <defs>
        <mask id={`trace-${maskId}`} maskUnits="userSpaceOnUse">
          <path
            data-trace-reveal
            d={d}
            stroke="#fff"
            strokeWidth={maskWidth}
            strokeLinecap="round"
            fill="none"
          />
        </mask>
      </defs>

      <path
        d={d}
        mask={`url(#trace-${maskId})`}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray="5 7"
        vectorEffect="non-scaling-stroke"
        fill="none"
      />

      {showNodes
        ? scaled.map((p, i) => (
            <circle
              key={`${p.x}-${p.y}-${i}`}
              data-trace-node
              cx={p.x}
              cy={p.y}
              r={strokeWidth * 2.2}
              fill="currentColor"
            />
          ))
        : null}
    </svg>
  )
}
