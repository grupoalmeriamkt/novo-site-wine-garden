'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { useGsapOn } from '@/hooks/useGsap'
import { PHOTO_BY_ID } from '@/data/generated/photo-manifest'
import styles from './Reveal.module.css'

type RevealProps = {
  /** id do PHOTO_MANIFEST. */
  photoId: string
  alt: string
  /** `sizes` do next/image. Errar aqui é a causa nº 1 de imagem pesada demais. */
  sizes: string
  /** Só na imagem que é o LCP — o herói. Em qualquer outra, atrasa o resto. */
  priority?: boolean
  /**
   * `mask` desliza uma cortina que descobre a foto; `scale` faz a foto crescer
   * dentro do quadro fixo; `none` entra sem animação (usado em grades densas,
   * onde 12 revelações simultâneas viram ruído).
   */
  motion?: 'mask' | 'scale' | 'none'
  /** Direção da cortina. */
  from?: 'bottom' | 'left' | 'right'
  /** Proporção forçada do quadro. Sem ela, usa a proporção real do arquivo. */
  ratio?: number
  /** Parallax sutil durante o scroll, em px de deslocamento total. */
  parallax?: number
  className?: string
  children?: React.ReactNode
}

/**
 * Fotografia com revelação editorial.
 *
 * O acervo é o protagonista deste site, então a imagem entra com gesto — mas o
 * gesto é sempre de máscara ou escala, nunca de opacidade sozinha: fade é o que
 * faz uma foto parecer banner. `object-fit: cover` com proporção declarada
 * mantém o CLS em zero mesmo antes do arquivo chegar.
 */
export function Reveal({
  photoId,
  alt,
  sizes,
  priority = false,
  motion = 'mask',
  from = 'bottom',
  ratio,
  parallax = 0,
  className,
  children,
}: RevealProps) {
  const root = useRef<HTMLDivElement | null>(null)
  const photo = PHOTO_BY_ID[photoId]

  useGsapOn(
    root,
    ({ gsap, root: el }) => {
      const curtain = el.querySelector<HTMLElement>('[data-curtain]')
      const media = el.querySelector<HTMLElement>('[data-media]')

      // A cortina começa cobrindo (ver Reveal.module.css). Se por qualquer
      // motivo não formos animar, ela precisa sair AGORA — senão a foto fica
      // permanentemente escondida atrás dela.
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced || (motion === 'none' && parallax === 0)) {
        if (curtain) curtain.style.display = 'none'
        return
      }

      if (!media) return

      if (motion === 'mask' && curtain) {
        const exit = from === 'bottom' ? { yPercent: -101 } : from === 'left' ? { xPercent: -101 } : { xPercent: 101 }
        gsap
          .timeline({ scrollTrigger: { trigger: el, start: 'top 82%', once: true } })
          // A foto começa maior e assenta enquanto a cortina sai: os dois
          // movimentos em direções opostas é o que dá a sensação de câmera.
          .fromTo(media, { scale: 1.16 }, { scale: 1, duration: 1.3, ease: 'power3.out' }, 0)
          .to(curtain, { ...exit, duration: 1.05, ease: 'power4.inOut' }, 0)
      }

      if (motion === 'scale') {
        gsap.fromTo(
          media,
          { scale: 1.22, opacity: 0.4 },
          {
            scale: 1,
            opacity: 1,
            duration: 1.2,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 84%', once: true },
          },
        )
      }

      if (parallax !== 0) {
        gsap.fromTo(
          media,
          { yPercent: -parallax / 2 },
          {
            yPercent: parallax / 2,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        )
      }

      /*
       * Rede de segurança.
       *
       * A cortina começa COBRINDO a foto, então uma falha do ScrollTrigger —
       * start calculado antes de a seção ganhar altura, refresh perdido num
       * resize durante o carregamento — não deixaria a animação por fazer:
       * deixaria a FOTO INVISÍVEL para sempre. É a única falha deste
       * componente que apaga conteúdo, e por isso vale um guarda.
       *
       * O observador só age se, um segundo depois de o quadro estar de fato na
       * tela, a cortina ainda não tiver começado a sair. Em operação normal ele
       * nunca dispara.
       */
      if (motion === 'mask' && curtain) {
        let timer = 0
        const guard = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue
              window.clearTimeout(timer)
              timer = window.setTimeout(() => {
                const t = window.getComputedStyle(curtain).transform
                const aindaCobrindo = t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)'
                if (aindaCobrindo) curtain.style.display = 'none'
                guard.disconnect()
              }, 1000)
            }
          },
          { threshold: 0.25 },
        )
        guard.observe(el)
        // O gsap.context não conhece o observer: o cleanup é nosso.
        return () => {
          window.clearTimeout(timer)
          guard.disconnect()
        }
      }
      return undefined
    },
    [photoId, motion, from, parallax],
  )

  if (!photo) {
    // Placeholder da marca: o layout não pode colapsar porque uma foto sumiu.
    return (
      <div
        ref={root}
        className={[styles.frame, styles.missing, className].filter(Boolean).join(' ')}
        style={{ aspectRatio: ratio ?? 3 / 4 }}
        role="img"
        aria-label={alt}
      >
        <span className={styles.missingMark}>Wine Garden</span>
      </div>
    )
  }

  return (
    <div
      ref={root}
      className={[styles.frame, className].filter(Boolean).join(' ')}
      style={{ aspectRatio: ratio ?? photo.ratio }}
    >
      <div data-media className={styles.media}>
        <Image
          src={photo.src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          placeholder="blur"
          blurDataURL={photo.blurDataURL}
          className={styles.img}
        />
      </div>
      {motion === 'mask' ? <div data-curtain className={styles.curtain} aria-hidden="true" /> : null}
      {children}
    </div>
  )
}
