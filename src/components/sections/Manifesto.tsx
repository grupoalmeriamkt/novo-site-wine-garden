'use client'

import { Fragment, useRef } from 'react'
import { Section } from '@/components/primitives/Section'
import { Reveal } from '@/components/primitives/Reveal'
import { MonoLabel, Prose } from '@/components/primitives/Typography'
import { Trace } from '@/components/brand/Trace'
import { useGsapOn } from '@/hooks/useGsap'
import { scheduleRefresh } from '@/lib/motion/refresh'
import { MANIFESTO } from '@/data/photos'
import { cartSummary } from '@/lib/wines'
import styles from './Manifesto.module.css'

/**
 * Os números vêm da carta, nunca da mão. `cartSummary()` é função pura sobre o
 * array gerado, então roda uma vez na carga do módulo — se um rótulo entrar ou
 * sair do cardápio, o texto desta seção muda sozinho.
 *
 * O custo é levar `WINES` para o bundle do cliente. É aceitável porque a seção
 * precisa mesmo ser client (GSAP) e porque o explorador de vinhos importa o
 * mesmo módulo: os dois dividem o chunk em vez de duplicá-lo.
 */
const CARTA = cartSummary()

type PhraseWord = {
  text: string
  /**
   * Deslocamento horizontal inicial, em % da largura da viewport.
   * 0 = palavra ÂNCORA: fica parada enquanto as outras atravessam a tela.
   * O sinal alterna de propósito — as palavras se cruzam no caminho.
   */
  drift: number
  /** Início na linha do tempo normalizada (0–1) que o pin faz o scroll percorrer. */
  at?: number
  /** Duração nessa mesma linha do tempo. */
  span?: number
  /** A última a assentar. É ela que troca de cor quando chega. */
  accent?: true
}

/**
 * "A vida é feita de escolhas" — copy oficial (BRAND_COPY.choices), quebrada em
 * três linhas e seis palavras.
 *
 * A leitura da animação é literal, e é por isso que ela existe: "A vida" é
 * dado, está lá desde o começo e não se move; tudo o que vem depois chega de
 * fora, de direções opostas; e "escolhas" é a que atravessa a tela inteira e
 * assenta por último, trocando de cor quando chega. A frase só fica completa
 * quando a escolha chega — que é exatamente o que ela afirma.
 */
const PHRASE: readonly (readonly PhraseWord[])[] = [
  [
    { text: 'A', drift: 0 },
    { text: 'vida', drift: 0 },
  ],
  [
    { text: 'é', drift: 46, at: 0, span: 0.42 },
    { text: 'feita', drift: -68, at: 0.07, span: 0.46 },
    { text: 'de', drift: 88, at: 0.14, span: 0.5 },
  ],
  [{ text: 'escolhas.', drift: -128, at: 0.2, span: 0.58, accent: true }],
]

/**
 * O pin só existe onde é seguro: tela larga E ponteiro fino. Em qualquer coisa
 * com toque — celular, tablet, conversível — o pin do ScrollTrigger briga com a
 * barra de endereço que recolhe e com o scroll elástico do Safari, e o
 * resultado é a seção saltando sob o dedo. Essas telas recebem uma revelação
 * linha a linha, que não sequestra a rolagem.
 *
 * As duas queries são mutuamente exclusivas e nenhuma delas roda sob
 * `prefers-reduced-motion: reduce` — quem pediu menos movimento lê a frase
 * inteira, parada, no estado de repouso do CSS.
 */
const PINNED = '(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
const STACKED =
  '(prefers-reduced-motion: no-preference) and (max-width: 1023px),' +
  '(prefers-reduced-motion: no-preference) and (pointer: coarse)'

/**
 * Deslocamento da entrada vertical, em % da altura da própria palavra. Passa de
 * 100% porque a máscara tem folga em cima e embaixo para acentos e descendentes
 * da Instrument Serif: com 100% sobraria um fio de tipo visível na borda.
 */
const MASK_RISE = 132

export function Manifesto() {
  const root = useRef<HTMLDivElement | null>(null)
  const photo = MANIFESTO[0]

  useGsapOn(
    root,
    ({ gsap, root: el }) => {
      const stage = el.querySelector<HTMLElement>('[data-stage]')
      const lines = Array.from(el.querySelectorAll<HTMLElement>('[data-line]'))
      const words = Array.from(el.querySelectorAll<HTMLElement>('[data-word]'))
      const echo = el.querySelector<HTMLElement>('[data-echo]')
      if (!stage || words.length === 0) return

      const movers = words.filter((word) => Number(word.dataset.drift) !== 0)
      const anchors = words.filter((word) => Number(word.dataset.drift) === 0)

      // Nenhum estado inicial mora no CSS: o repouso da folha JÁ é o estado
      // final. Toda posição de partida é escrita aqui, por fromTo, e some junto
      // com o contexto no cleanup.
      const mm = gsap.matchMedia()

      mm.add(PINNED, () => {
        // As âncoras sobem de trás da máscara ANTES do pin começar: quando o
        // palco trava, "A vida" já está posta e o scroll passa a mover só o
        // resto. Sem isso o pin abriria com a tela vazia.
        const anchorInners = anchors
          .map((word) => word.querySelector<HTMLElement>('[data-inner]'))
          .filter((inner): inner is HTMLElement => inner !== null)

        gsap.fromTo(
          anchorInners,
          { yPercent: MASK_RISE },
          {
            yPercent: 0,
            duration: 1.15,
            stagger: 0.09,
            ease: 'power4.out',
            scrollTrigger: { trigger: stage, start: 'top 72%', once: true },
          },
        )

        const tl = gsap.timeline({
          // Desacelerar na chegada é o que faz a palavra "assentar" em vez de
          // simplesmente parar. Com scrub, a ease é o peso do movimento.
          defaults: { ease: 'power2.out' },
          scrollTrigger: {
            trigger: stage,
            start: 'top top',
            // Uma tela e um terço de rolagem: menos que isso a frase se monta
            // rápido demais para ser lida; mais que isso vira sequestro.
            end: () => `+=${Math.round(window.innerHeight * 1.35)}`,
            pin: stage,
            anticipatePin: 1,
            // O leve atraso do scrub tira o aspecto mecânico do 1:1 com a roda.
            scrub: 0.65,
            invalidateOnRefresh: true,
          },
        })

        for (const word of movers) {
          const drift = Number(word.dataset.drift)
          const at = Number(word.dataset.at)
          const span = Number(word.dataset.span)
          if (!Number.isFinite(drift) || !Number.isFinite(at) || !Number.isFinite(span)) continue

          tl.fromTo(
            word,
            // Valor em função para o `invalidateOnRefresh` recalcular a
            // distância quando a janela muda de largura.
            { x: () => (drift / 100) * window.innerWidth },
            { x: 0, duration: span },
            at,
          )
        }

        // A troca de cor é por sobreposição, não por tween de `color`: o eco em
        // --accent está sempre no lugar e só a opacidade anima — a única
        // propriedade barata além de transform.
        if (echo) tl.fromTo(echo, { opacity: 0 }, { opacity: 1, duration: 0.1, ease: 'none' }, 0.78)

        // Respiro: os últimos 12% do pin não animam nada. A frase completa fica
        // parada um instante antes de a seção devolver o scroll.
        tl.to({}, { duration: 0.12 }, 0.88)

        // O pin muda a altura do documento; sem remedir, os gatilhos que vêm
        // depois (o traço, a fotografia) ficam calculados na posição antiga.
        scheduleRefresh()
      })

      mm.add(STACKED, () => {
        // Sem pin: cada linha se revela sozinha ao entrar. A leitura continua
        // sendo por partes — "A vida", depois "é feita de", depois "escolhas" —
        // só que quem controla o ritmo é o dedo, não a timeline.
        for (const line of lines) {
          gsap.fromTo(
            line.querySelectorAll('[data-inner]'),
            { yPercent: MASK_RISE },
            {
              yPercent: 0,
              duration: 1,
              stagger: 0.08,
              ease: 'power4.out',
              scrollTrigger: { trigger: line, start: 'top 88%', once: true },
            },
          )
        }

        if (echo) {
          gsap.fromTo(
            echo,
            { opacity: 0 },
            {
              opacity: 1,
              duration: 0.55,
              ease: 'none',
              // Só depois de a linha inteira ter subido: a cor é a conclusão.
              delay: 0.5,
              scrollTrigger: { trigger: echo, start: 'top 82%', once: true },
            },
          )
        }
      })
    },
    [],
  )

  return (
    <Section id="manifesto" atmosphere="editorial" bleed>
      <div ref={root} className={styles.root}>
        {/* ----------------------------------------------------------- palco */}
        <div data-stage className={styles.stage}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowRule} aria-hidden="true" />
            <MonoLabel size="xs" muted>
              Manifesto
            </MonoLabel>
          </div>

          <div className={styles.phraseViewport}>
            <h2 className={styles.phrase}>
              {PHRASE.map((line, lineIndex) => (
                <span
                  key={line.map((word) => word.text).join('-')}
                  data-line={lineIndex}
                  className={styles.line}
                >
                  {line.map((word, wordIndex) => (
                    <Fragment key={word.text}>
                      {/* Espaço de verdade entre as palavras: com `gap` de
                          flexbox o leitor de tela leria tudo emendado. */}
                      {wordIndex > 0 ? ' ' : null}
                      <span
                        data-word
                        data-drift={word.drift}
                        data-at={word.at}
                        data-span={word.span}
                        className={styles.word}
                      >
                        <span className={styles.wordMask}>
                          <span data-inner className={styles.wordInner}>
                            {word.text}
                            {word.accent ? (
                              <span data-echo aria-hidden="true" className={styles.echo}>
                                {word.text}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </span>
                    </Fragment>
                  ))}{' '}
                </span>
              ))}
            </h2>
          </div>
        </div>

        {/* --------------------------------------------------------- depois */}
        <div className={styles.aftermath}>
          <div className={styles.body}>
            <Prose size="lg">
              Ninguém atravessa {CARTA.total} rótulos pedindo sempre o mesmo.
            </Prose>
            <Prose size="md" muted>
              A dose é a unidade de medida — {CARTA.countries} países cabem numa mesma noite, e a
              próxima taça não precisa repetir a anterior. A carta é grande por um motivo: nela cabe
              a dúvida.
            </Prose>
          </div>

          {/* O gesto do manual ("quebra de texto com linha conectando"): a linha
              sai do fim do argumento, atravessa o vão e desce até a prova. É
              decorativa — os dois blocos se leem inteiros sem ela. */}
          <div className={styles.traceSlot}>
            <Trace
              points={[
                { x: 0.05, y: 0.04 },
                { x: 0.48, y: 0.32 },
                { x: 0.29, y: 0.7 },
                { x: 0.88, y: 0.96 },
              ]}
              viewBox={{ width: 620, height: 420 }}
              mode="scrub"
              strokeWidth={1.6}
            />
          </div>

          {/* Dado, não cartão de estatística: rótulo em cima, número embaixo,
              tudo em mono, um filete só acima da faixa inteira. */}
          <div className={styles.dataBlock}>
            <MonoLabel size="xs" muted>
              Na carta
            </MonoLabel>
            <dl className={styles.data}>
              <div className={styles.datum}>
                <dt>
                  <MonoLabel size="xs" muted>
                    Rótulos
                  </MonoLabel>
                </dt>
                <dd>
                  <MonoLabel size="lg" numeric className={styles.value}>
                    {CARTA.total}
                  </MonoLabel>
                </dd>
              </div>
              <div className={styles.datum}>
                <dt>
                  <MonoLabel size="xs" muted>
                    Países
                  </MonoLabel>
                </dt>
                <dd>
                  <MonoLabel size="lg" numeric className={styles.value}>
                    {CARTA.countries}
                  </MonoLabel>
                </dd>
              </div>
              <div className={styles.datum}>
                <dt>
                  <MonoLabel size="xs" muted>
                    Em taça
                  </MonoLabel>
                </dt>
                <dd>
                  <MonoLabel size="lg" numeric className={styles.value}>
                    {CARTA.byGlass}
                  </MonoLabel>
                </dd>
              </div>
              <div className={styles.datum}>
                <dt>
                  <MonoLabel size="xs" muted>
                    Em garrafa
                  </MonoLabel>
                </dt>
                <dd>
                  <MonoLabel size="lg" numeric className={styles.value}>
                    {CARTA.byBottle}
                  </MonoLabel>
                </dd>
              </div>
            </dl>
          </div>

          {/* A foto não centraliza e não fecha a grade: começa depois de uma
              coluna vazia, sangra pela direita e desce mais que a coluna de
              texto. O vão que sobra à esquerda é o que o traço atravessa. */}
          {photo ? (
            <figure className={styles.figure}>
              <Reveal
                photoId={photo.id}
                alt={photo.alt}
                sizes="(min-width: 1024px) 44vw, 100vw"
                motion="mask"
                from="bottom"
                // Recorte editorial: o arquivo é 2:3 e, na largura desta coluna,
                // ficaria alto demais para conviver com a coluna de texto.
                ratio={4 / 5}
              />
              <figcaption className={styles.caption}>
                <MonoLabel size="xs" muted>
                  Taça a taça
                </MonoLabel>
              </figcaption>
            </figure>
          ) : null}
        </div>
      </div>
    </Section>
  )
}
