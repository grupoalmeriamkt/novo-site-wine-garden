'use client'

import { useRef } from 'react'
import { Section } from '@/components/primitives/Section'
import { Reveal } from '@/components/primitives/Reveal'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { Trace } from '@/components/brand/Trace'
import { useGsapOn } from '@/hooks/useGsap'
import { GARDEN } from '@/data/photos'
import styles from './Garden.module.css'

/**
 * O GARDEN — o espaço.
 *
 * Esta é a única seção em atmosfera `terroir`, e é onde o Oliva da identidade
 * finalmente faz sentido: origem, jardim, natureza. Usá-lo em qualquer outro
 * lugar seria decoração; aqui ele é o assunto.
 *
 * A composição é deliberadamente assimétrica — uma foto alta sangrando na
 * borda, duas menores deslocadas, e o texto ocupando a coluna que sobra. Uma
 * grade de quatro fotos iguais diria "galeria"; o que queremos dizer é "lugar".
 *
 * O que o texto afirma vem do que se vê nas fotografias (pergolado, cordões de
 * luz, palmeiras, piso de pedra, o letreiro na fachada). Não há número de
 * lugares, área, ano de fundação nem prêmio: nada disso foi confirmado, e
 * inventar seria o tipo de dado que acaba no Google.
 */

/* As fotos são escolhidas por papel na composição, não pela ordem do array. */
const [PERGOLA, MESA_POSTA, ENTRADA, FACHADA, PALMEIRA] = GARDEN

export function Garden() {
  const root = useRef<HTMLDivElement | null>(null)

  useGsapOn(
    root,
    ({ gsap, root: el }) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      gsap.fromTo(
        el.querySelectorAll('[data-word]'),
        { yPercent: 116 },
        {
          yPercent: 0,
          duration: 1.15,
          stagger: 0.11,
          ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 74%', once: true },
        },
      )

      gsap.fromTo(
        el.querySelectorAll('[data-fade]'),
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.1,
          scrollTrigger: { trigger: el, start: 'top 66%', once: true },
        },
      )
    },
    [],
  )

  return (
    <Section id="garden" atmosphere="terroir" className={styles.section}>
      <div ref={root} className={styles.inner}>
        <header className={styles.head}>
          <div data-fade>
            <MonoLabel size="xs" muted>
              O Garden
            </MonoLabel>
          </div>

          <div className={styles.titleWrap}>
            <EditorialHeading as="h2" size="1" className={styles.title}>
              <span className={styles.lineTop}>
                <span className={styles.mask}>
                  <span data-word className={styles.word}>
                    Um jardim para
                  </span>
                </span>
              </span>
              <span className={styles.lineBottom}>
                <span className={styles.mask}>
                  <span data-word className={`${styles.word} ${styles.italic}`}>
                    novas conexões.
                  </span>
                </span>
              </span>
            </EditorialHeading>

            {/* O gesto oficial da marca ligando as duas linhas da frase. */}
            <div className={styles.traceSlot} aria-hidden="true">
              <Trace
                points={[
                  { x: 0.04, y: 0.1 },
                  { x: 0.36, y: 0.72 },
                  { x: 0.68, y: 0.24 },
                  { x: 0.96, y: 0.82 },
                ]}
                viewBox={{ width: 900, height: 240 }}
                mode="draw"
                strokeWidth={1.6}
              />
            </div>
          </div>
        </header>

        {/*
          A composição: a coluna alta à esquerda sangra na borda superior, o
          texto ocupa o miolo, e as duas menores descem escalonadas à direita.
          Nada se alinha na mesma linha de base — é o que tira o ar de grade.
        */}
        <div className={styles.composition}>
          <div className={styles.tall}>
            {PERGOLA ? (
              <Reveal
                photoId={PERGOLA.id}
                alt={PERGOLA.alt}
                sizes="(min-width: 1024px) 38vw, 92vw"
                ratio={3 / 4}
                motion="mask"
                from="bottom"
                parallax={6}
              />
            ) : null}
          </div>

          <div data-fade className={styles.copy}>
            <Prose size="lg">
              Um pergolado de madeira, cordões de luz acesos entre as vigas e palmeiras que passam por cima do
              telhado. Do lado de fora, o piso de pedra e o letreiro na fachada ripada; do lado de dentro, o salão
              envidraçado com o jardim visível de quase todas as mesas.
            </Prose>
            <Prose muted>
              É um lugar que muda de temperatura ao longo da noite: entardece azul e termina âmbar. Serve tanto para
              uma taça no fim do expediente quanto para uma mesa comprida que atravessa o jantar inteiro.
            </Prose>

            <ul className={styles.notes}>
              <li>
                <MonoLabel size="xs" muted>
                  Jardim coberto
                </MonoLabel>
              </li>
              <li>
                <MonoLabel size="xs" muted>
                  Salão envidraçado
                </MonoLabel>
              </li>
              <li>
                <MonoLabel size="xs" muted>
                  Mesas no gramado
                </MonoLabel>
              </li>
            </ul>
          </div>

          <div className={styles.wide}>
            {MESA_POSTA ? (
              <Reveal
                photoId={MESA_POSTA.id}
                alt={MESA_POSTA.alt}
                sizes="(min-width: 1024px) 34vw, 92vw"
                ratio={4 / 5}
                motion="mask"
                from="right"
              />
            ) : null}
          </div>

          <div className={styles.small}>
            {ENTRADA ? (
              <Reveal
                photoId={ENTRADA.id}
                alt={ENTRADA.alt}
                sizes="(min-width: 1024px) 22vw, 46vw"
                ratio={3 / 4}
                motion="scale"
              />
            ) : null}
          </div>

          <div className={styles.smallLow}>
            {PALMEIRA ? (
              <Reveal
                photoId={PALMEIRA.id}
                alt={PALMEIRA.alt}
                sizes="(min-width: 1024px) 22vw, 46vw"
                ratio={3 / 4}
                motion="scale"
              />
            ) : null}
          </div>
        </div>

        {/* A fachada fecha a seção sangrando de ponta a ponta: é a imagem que
            o visitante vai reconhecer da rua. */}
        {FACHADA ? (
          <div className={styles.bleed}>
            <Reveal
              photoId={FACHADA.id}
              alt={FACHADA.alt}
              sizes="100vw"
              ratio={21 / 9}
              motion="mask"
              from="bottom"
              parallax={10}
            />
          </div>
        ) : null}
      </div>
    </Section>
  )
}
