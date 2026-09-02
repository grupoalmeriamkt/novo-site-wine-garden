'use client'

import { useRef } from 'react'
import { Section } from '@/components/primitives/Section'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { Reveal } from '@/components/primitives/Reveal'
import { Cta } from '@/components/primitives/Cta'
import { Trace } from '@/components/brand/Trace'
import { EXPERIENCES, experienceAlt } from '@/data/experiences'
import { BRAND_COPY, NAV_ITEMS } from '@/data/site'
import { useGsapOn } from '@/hooks/useGsap'
import { scheduleRefresh } from '@/lib/motion/refresh'
import { track } from '@/lib/analytics'
import styles from './Experiencias.module.css'

/**
 * O que a interface escreve quando a casa ainda não fechou dia e hora.
 * É o par visível do `schedule: ''` de src/data/experiences.ts.
 */
const NO_SCHEDULE = 'Consulte a casa'

/** A numeração da seção vem do índice do menu — um lugar só para mudar a ordem. */
const SECTION_INDEX = NAV_ITEMS.find((item) => item.href === '/#experiencias')?.id ?? ''

/**
 * Copy aprovada do manual, partida na última palavra só para receber o itálico
 * da Instrument Serif. A string continua vindo inteira de BRAND_COPY — quem
 * reescrever a frase em site.ts reescreve o título aqui junto.
 */
const CONNECTIONS_WORDS = BRAND_COPY.connections.split(' ')
const CONNECTIONS_HEAD = CONNECTIONS_WORDS.slice(0, -1).join(' ')
const CONNECTIONS_TAIL = CONNECTIONS_WORDS.at(-1) ?? ''

/**
 * Experiências.
 *
 * A PÁGINA DE PASSAPORTE. A metáfora da marca é a viagem, e o grafismo que ela
 * já usa para isso é o selo postal: borda serrilhada, numeração mono, colado
 * torto. Então esta seção não é uma grade de cards de restaurante — é uma folha
 * de passaporte onde cada experiência é um carimbo, com largura e inclinação
 * diferentes, e a linha pontilhada da identidade passando por trás como
 * trajetória. Duas colunas em fluxo de coluna (não de linha) no desktop: sem
 * linhas alinhadas, o olho percorre em vez de varrer.
 *
 * Atmosfera bege: entre o herói noturno e o granada dos eventos, esta é a
 * página clara onde a leitura respira.
 *
 * É Client Component por dois motivos reais, não por conveniência: o clique em
 * cada experiência precisa de handler (`event_open`) e a entrada dos selos é
 * GSAP. A serrilha, a inclinação e o layout são CSS puro e chegam no HTML.
 */
export function Experiencias() {
  const root = useRef<HTMLDivElement | null>(null)

  useGsapOn(
    root,
    ({ gsap, root: el }) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      // Cada selo tem o próprio gatilho em vez de um stagger único: no fluxo de
      // colunas o segundo card visual está no TOPO da coluna da direita, e um
      // stagger por ordem de DOM o faria entrar por último, já dentro da tela.
      const cards = el.querySelectorAll<HTMLElement>('[data-stamp]')
      cards.forEach((card) => {
        gsap.fromTo(
          card,
          // Entra maior e assenta: é um carimbo sendo pressionado no papel.
          // Sem elástico — o gesto de carimbar termina firme, não quicando.
          { opacity: 0, scale: 1.09 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.62,
            ease: 'power4.out',
            scrollTrigger: { trigger: card, start: 'top 88%', once: true },
          },
        )
      })

      // A altura da seção só se estabiliza quando as fotos chegam; sem o
      // recálculo os gatilhos ficam medidos no vazio. O agendador agrupa.
      scheduleRefresh()
    },
    [],
  )

  return (
    <Section id="experiencias" atmosphere="bege" className={styles.section}>
      <div ref={root} className={styles.stage}>
        {/* A trajetória atravessa a folha por trás dos selos: é o "caminho" do
            manual, não um enfeite de fundo. Decorativa — nada é dito só por ela. */}
        <div className={styles.traceLayer} aria-hidden="true">
          <Trace
            points={[
              { x: 0.06, y: 0.02 },
              { x: 0.52, y: 0.22 },
              { x: 0.18, y: 0.52 },
              { x: 0.74, y: 0.68 },
              { x: 0.34, y: 0.97 },
            ]}
            viewBox={{ width: 900, height: 1400 }}
            mode="scrub"
            triggerRef={root}
            strokeWidth={1.6}
          />
        </div>

        <div className={styles.inner}>
          <header className={styles.head}>
            <p className={styles.index}>
              {SECTION_INDEX ? (
                <MonoLabel size="xs" numeric muted>
                  {SECTION_INDEX}
                </MonoLabel>
              ) : null}
              <MonoLabel size="xs">Experiências</MonoLabel>
            </p>

            <EditorialHeading as="h2" size="1" className={styles.title}>
              {CONNECTIONS_HEAD} <em>{CONNECTIONS_TAIL}</em>
            </EditorialHeading>

            <Prose size="lg" className={styles.intro}>
              A casa não fecha entre o almoço e o jantar: a tarde vira noite com o jardim aberto, e cada
              faixa do dia tem o próprio motivo para estar aqui.
            </Prose>
          </header>

          <ol className={styles.rail}>
            {EXPERIENCES.map((experience, index) => {
              const alt = experienceAlt(experience)
              const pending = experience.schedule === ''

              return (
                <li key={experience.id} className={styles.slot}>
                  <article data-stamp className={styles.card}>
                    <p className={styles.cardHead}>
                      <MonoLabel size="xs" numeric muted>
                        {String(index + 1).padStart(2, '0')}
                      </MonoLabel>
                      <MonoLabel size="xs">{experience.kicker}</MonoLabel>
                    </p>

                    <div className={styles.plate}>
                      {experience.photoId ? (
                        // Sem `ratio`: a proporção real do arquivo é o que mistura
                        // vertical e horizontal na folha e quebra o alinhamento.
                        <Reveal
                          photoId={experience.photoId}
                          alt={alt}
                          sizes="(min-width: 900px) 42vw, 88vw"
                          motion="mask"
                        />
                      ) : (
                        /* Sem foto confirmada, o quadro vira selo da marca em vez
                           de ficar vazio ou de receber uma imagem qualquer. */
                        <div className={styles.seal}>
                          <img
                            src="/brand/selos/logotipo-2.svg"
                            alt=""
                            width={534}
                            height={529}
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      )}
                    </div>

                    <EditorialHeading as="h3" size="3" className={styles.name}>
                      {experience.name}
                    </EditorialHeading>

                    <p className={styles.schedule} data-pending={pending}>
                      <span className={styles.scheduleRule} aria-hidden="true" />
                      <span className={pending ? undefined : 'u-tnum'}>
                        {pending ? NO_SCHEDULE : experience.schedule}
                      </span>
                    </p>

                    <Prose size="sm" measured={false} muted className={styles.description}>
                      {experience.description}
                    </Prose>

                    {experience.ctaLabel && experience.ctaHref ? (
                      <Cta
                        href={experience.ctaHref}
                        variant="ghost"
                        external
                        className={styles.action}
                        ariaLabel={`${experience.ctaLabel} — ${experience.name}`}
                        onClick={() => track('event_open', { experienceId: experience.id })}
                      >
                        {experience.ctaLabel}
                      </Cta>
                    ) : null}
                  </article>
                </li>
              )
            })}
          </ol>

          <div className={styles.close}>
            <p className={styles.choice}>{BRAND_COPY.choices}</p>
            <p className={styles.disclaimer}>
              Só publicamos dia e hora que a casa confirmou. Onde se lê “{NO_SCHEDULE}”, ainda não há agenda
              fechada — e o vazio é mais honesto que um horário inventado.
            </p>
          </div>
        </div>
      </div>
    </Section>
  )
}
