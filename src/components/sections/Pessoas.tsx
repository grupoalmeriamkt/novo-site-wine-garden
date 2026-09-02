'use client'

import Image from 'next/image'
import { useRef, useState, type CSSProperties } from 'react'
import { PHOTO_BY_ID } from '@/data/generated/photo-manifest'
import { PEOPLE, TEAM, type CuratedPhoto } from '@/data/photos'
import { BRAND_COPY, RESERVATION } from '@/data/site'
import { Section } from '@/components/primitives/Section'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { Cta } from '@/components/primitives/Cta'
import { Trace } from '@/components/brand/Trace'
import { useGsapOn } from '@/hooks/useGsap'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { trackOnClick } from '@/lib/analytics'
import styles from './Pessoas.module.css'

/**
 * "Faça novas conexões" (BRAND_COPY.connections) quebrada em duas linhas para a
 * diagramação orgânica do manual. A divisão é declarada, não derivada de um
 * split() — que quebraria em silêncio se a copy mudasse de tamanho. O texto
 * continua contíguo no DOM, então o leitor de tela lê a frase inteira.
 */
const TITLE_TOP = 'Faça novas'
const TITLE_BOTTOM = 'conexões'

if (process.env.NODE_ENV === 'development' && `${TITLE_TOP} ${TITLE_BOTTOM}` !== BRAND_COPY.connections) {
  console.error('[pessoas] o título divergiu da copy aprovada em BRAND_COPY.connections')
}

/**
 * As duas fitas.
 *
 * Cada foto entra uma única vez: a casa (clientes) e a cozinha/salão (equipe)
 * alternam dentro da mesma fita porque o argumento da seção é justamente que
 * não há duas cenas — quem serve e quem é servido estão na mesma noite.
 */
const ROW_TOP: readonly CuratedPhoto[] = [...PEOPLE.slice(0, 3), ...TEAM.slice(0, 1), ...PEOPLE.slice(3, 4)]
const ROW_BOTTOM: readonly CuratedPhoto[] = [...PEOPLE.slice(4), ...TEAM.slice(1)]

/**
 * Quantas vezes cada fita se repete.
 *
 * O laço desloca a trilha em exatamente 1/COPIES da própria largura, o que
 * devolve o quadro idêntico ao inicial — é o que torna a emenda invisível. O
 * número precisa ser alto o bastante para que COPIES-1 repetições cubram a
 * viewport mais larga em que o site roda; 4 cobre até ~4K.
 */
const COPIES = 4

/** Item da fita. Sem `Reveal`: dentro de uma faixa em movimento, uma cortina
 *  de revelação por foto vira ruído — a fita já é o gesto. */
function RibbonItem({ photo, decorative }: { photo: CuratedPhoto; decorative: boolean }) {
  const asset = PHOTO_BY_ID[photo.id]
  if (!asset) return null

  // A largura sai da proporção real do arquivo sobre uma altura de faixa fixa:
  // é o que mistura vertical e horizontal sem cortar nenhuma composição.
  const style = { '--ratio': String(asset.ratio) } as CSSProperties

  return (
    <div className={styles.item} style={style} aria-hidden={decorative || undefined}>
      <Image
        src={asset.src}
        alt={decorative ? '' : photo.alt}
        fill
        sizes={asset.ratio >= 1 ? '(min-width: 768px) 34vw, 96vw' : '(min-width: 768px) 18vw, 48vw'}
        loading="lazy"
        placeholder="blur"
        blurDataURL={asset.blurDataURL}
        className={styles.img}
      />
    </div>
  )
}

/**
 * Pessoas — o argumento social da casa.
 *
 * A seção não descreve o ambiente, ela mostra gente nele. Por isso quase não há
 * texto: duas fitas de fotografia atravessam a tela em sentidos opostos, no
 * ritmo de uma sala cheia vista de longe. O movimento existe para dar a
 * sensação de continuidade — a noite não começa nem termina no quadro.
 *
 * WCAG 2.2.2: conteúdo em movimento que começa sozinho e dura mais de cinco
 * segundos precisa de um controle de pausa. Daí o botão — e por isso a seção é
 * cliente, não por causa da animação.
 */
export function Pessoas() {
  const root = useRef<HTMLDivElement | null>(null)
  const [paused, setPaused] = useState(false)
  const reduced = usePrefersReducedMotion()

  useGsapOn(
    root,
    ({ gsap, root: el }) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const words = el.querySelectorAll('[data-word]')
      const fades = el.querySelectorAll('[data-fade]')
      const rows = el.querySelectorAll('[data-row]')
      const band = el.querySelector('[data-band]')

      // A frase sobe por trás da máscara, como no herói: as duas seções falam a
      // mesma língua tipográfica, e um fade aqui apagaria o parentesco.
      gsap.fromTo(
        words,
        { yPercent: 118 },
        {
          yPercent: 0,
          duration: 1.15,
          stagger: 0.12,
          ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 76%', once: true },
        },
      )

      gsap.fromTo(
        fades,
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.1,
          scrollTrigger: { trigger: el, start: 'top 70%', once: true },
        },
      )

      // O scroll arrasta as fitas um pouco além do próprio laço. É o que liga o
      // movimento ao gesto do usuário em vez de deixá-lo puramente decorativo.
      // Só para a esquerda: um deslocamento positivo descobriria a ponta
      // esquerda da trilha e abriria um vão na borda da faixa.
      if (band) {
        rows.forEach((row, i) => {
          gsap.fromTo(
            row,
            { xPercent: 0 },
            {
              xPercent: i % 2 === 0 ? -4 : -2.4,
              ease: 'none',
              scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: true },
            },
          )
        })
      }
    },
    [],
  )

  return (
    <Section id="pessoas" atmosphere="noturna" className={styles.section}>
      <div ref={root} className={styles.inner}>
        <header className={styles.head}>
          <div data-fade className={styles.eyebrow}>
            <MonoLabel size="xs" muted>
              Pessoas
            </MonoLabel>
          </div>

          <div className={styles.titleWrap}>
            <EditorialHeading as="h2" size="1" className={styles.title}>
              <span className={styles.lineTop}>
                <span className={styles.mask}>
                  <span data-word className={styles.word}>
                    {TITLE_TOP}
                  </span>
                </span>
              </span>{' '}
              <span className={styles.lineBottom}>
                <span className={styles.mask}>
                  <span data-word className={`${styles.word} ${styles.italic}`}>
                    {TITLE_BOTTOM}
                  </span>
                </span>
              </span>
            </EditorialHeading>

            {/* O gesto oficial da marca: a linha sai do fim da primeira linha e
                chega ao começo da segunda. Decorativa — a frase já está no h2. */}
            <div className={styles.traceSlot} aria-hidden="true">
              <Trace
                points={[
                  { x: 0.03, y: 0.06 },
                  { x: 0.33, y: 0.68 },
                  { x: 0.66, y: 0.28 },
                  { x: 0.97, y: 0.88 },
                ]}
                viewBox={{ width: 900, height: 240 }}
                mode="draw"
                strokeWidth={1.6}
              />
            </div>
          </div>

          <div data-fade className={styles.lead}>
            <Prose size="lg">
              Tem gente brindando na mesa ao lado, luzes acesas por cima e o jardim inteiro conversando. A carta é o
              pretexto — o que fica da noite é sempre quem estava nela.
            </Prose>
          </div>
        </header>

        {/* A faixa sangra de ponta a ponta: recortada aqui dentro, nunca na
            página — `overflow: hidden` no contêiner impede o scroll lateral que
            um marquee costuma provocar no iOS. */}
        <div
          data-band
          className={styles.band}
          data-paused={paused ? 'true' : 'false'}
          data-static={reduced ? 'true' : 'false'}
          tabIndex={reduced ? 0 : undefined}
          role={reduced ? 'group' : undefined}
          aria-label={reduced ? 'Fotografias do salão, dos clientes e da equipe' : undefined}
        >
          <div data-row className={styles.row}>
            <div className={styles.track}>
              {Array.from({ length: reduced ? 1 : COPIES }, (_, copy) =>
                ROW_TOP.map((photo) => (
                  <RibbonItem key={`${copy}-${photo.id}`} photo={photo} decorative={copy > 0} />
                )),
              )}
            </div>
          </div>

          <div data-row className={styles.row}>
            <div className={`${styles.track} ${styles.trackReverse}`}>
              {Array.from({ length: reduced ? 1 : COPIES }, (_, copy) =>
                ROW_BOTTOM.map((photo) => (
                  <RibbonItem key={`${copy}-${photo.id}`} photo={photo} decorative={copy > 0} />
                )),
              )}
            </div>
          </div>
        </div>

        <div className={styles.controls}>
          {/* Sem movimento não há o que pausar: o botão simplesmente não existe
              para quem pediu menos movimento, em vez de virar um alvo inerte. */}
          {reduced ? (
            <span className={styles.hint}>
              <MonoLabel size="xs" muted>
                Role a faixa para o lado
              </MonoLabel>
            </span>
          ) : (
            <button
              type="button"
              className={styles.toggle}
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? 'Retomar a sequência de fotos' : 'Pausar a sequência de fotos'}
            >
              <svg viewBox="0 0 12 12" className={styles.toggleIcon} aria-hidden="true" focusable="false">
                {paused ? (
                  <path d="M3 1.8 10 6l-7 4.2Z" fill="currentColor" />
                ) : (
                  <>
                    <rect x="2.8" y="2" width="2.3" height="8" fill="currentColor" />
                    <rect x="6.9" y="2" width="2.3" height="8" fill="currentColor" />
                  </>
                )}
              </svg>
              <MonoLabel size="xs">{paused ? 'Retomar' : 'Pausar'}</MonoLabel>
            </button>
          )}

          <Cta
            href={RESERVATION.url}
            external
            variant="line"
            onClick={trackOnClick('reservation_click', { origin: 'pessoas' })}
          >
            Reservar uma mesa
          </Cta>
        </div>
      </div>
    </Section>
  )
}
