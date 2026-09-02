'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import { PHOTO_BY_ID } from '@/data/generated/photo-manifest'
import { HERO } from '@/data/photos'
import { COUNTRIES } from '@/data/countries'
import { Logo } from '@/components/brand/Logo'
import { MonoLabel } from '@/components/primitives/Typography'
import { Trace } from '@/components/brand/Trace'
import { useGsapOn } from '@/hooks/useGsap'
import { countryStats } from '@/lib/wines'
import { track } from '@/lib/analytics'
import { MomentoAgora } from './MomentoAgora'
import styles from './Hero.module.css'

/**
 * ABERTURA EM TRÊS ATOS.
 *
 * A composição é centrada e simétrica, e o scroll é o que a revela — não uma
 * página que rola, mas uma sequência que se abre:
 *
 *   ATO 1 · A MARCA     o logotipo sozinho no centro, grande, com a linha
 *                       pontilhada desenhando em volta. Nada mais na tela.
 *   ATO 2 · A FRASE     o logotipo recua e "Viaje o mundo, taça a taça."
 *                       assume o centro em escala máxima.
 *   ATO 3 · AS ORIGENS  a frase recua, os oito selos entram em arco e a
 *                       leitura do momento aparece embaixo.
 *
 * A seção fica PRESA (pin) durante os três atos e só então libera a página. É
 * por isso que o herói ocupa três alturas de tela em vez de uma: o scroll aqui
 * é o eixo do tempo da sequência, não deslocamento.
 *
 * NO CELULAR NÃO HÁ PIN. Pin em Safari móvel é a maior fonte de bug de scroll
 * que existe, e numa tela estreita os três atos não teriam espaço para
 * respirar. Lá a mesma narrativa acontece empilhada, com cada ato revelado ao
 * entrar na viewport.
 *
 * ACESSIBILIDADE: o h1 traz a frase inteira em texto para leitor de tela, e as
 * camadas visuais são marcadas como decorativas. Quem não vê a sequência
 * recebe a mesma informação em uma linha.
 */

const STAMPS = COUNTRIES.map((country, index) => ({
  country,
  stats: countryStats(country.slug),
  /*
   * Ângulo no arco. Com `rotate(θ) translateY(+r)`, θ=90° cai à esquerda,
   * 180° no topo e 270° à direita — então distribuir de 90 a 270 desenha um
   * semicírculo na METADE SUPERIOR da tela, deixando o rodapé livre para o
   * convite de scroll e a leitura do momento.
   */
  angle: 90 + index * (180 / (COUNTRIES.length - 1)),
  depth: 12 + ((index * 7) % 22),
}))

export function Hero() {
  const root = useRef<HTMLElement | null>(null)

  useGsapOn(
    root,
    ({ gsap, root: el }) => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) return

      const mm = gsap.matchMedia()

      /* ---------------------------------------------------- desktop: pin */
      mm.add('(min-width: 900px)', () => {
        // Entrada do ato 1, antes de qualquer scroll: o logotipo cresce de
        // dentro para fora enquanto a linha se desenha em volta.
        gsap
          .timeline({ delay: 0.2 })
          .fromTo(
            el.querySelectorAll('[data-mark] [data-logo-path]'),
            { opacity: 0, yPercent: 22 },
            { opacity: 1, yPercent: 0, duration: 0.7, stagger: 0.03, ease: 'power3.out' },
          )
          .fromTo(
            el.querySelector('[data-mark-kicker]'),
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.6 },
            0.5,
          )
          .fromTo(
            el.querySelector('[data-cue]'),
            { opacity: 0 },
            { opacity: 1, duration: 0.6 },
            0.9,
          )

        /*
         * A linha do tempo da sequência. `scrub: 1` amarra cada quadro à
         * posição do scroll com um segundo de inércia — é o que faz a
         * passagem entre atos parecer câmera, e não corte.
         *
         * NÃO usamos `pin` aqui de propósito: quem prende o palco é o
         * `position: sticky` do CSS. Ligar os dois faz o GSAP reposicionar um
         * elemento que o navegador já está posicionando, e o resultado é o
         * palco soltando cedo e a seção seguinte invadindo o último ato.
         * Sticky nativo também sobrevive melhor a resize e ao Safari móvel.
         */
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1,
          },
        })

        /*
         * DURAÇÕES EXPLÍCITAS, E A SAÍDA TERMINA ANTES DA ENTRADA COMEÇAR.
         *
         * Sem `duration`, o GSAP usa o padrão e os dois atos ficavam no ar ao
         * mesmo tempo por quase todo o trecho: a frase aparecia POR CIMA do
         * logotipo, os dois legíveis e sobrepostos. Agora a marca sai por
         * inteiro em 0→0.42 e a frase só começa em 0.46 — um intervalo curto de
         * tela quase limpa entre um ato e outro, que é o que faz a passagem
         * ler como corte de câmera em vez de sobreposição.
         */

        // ATO 1 → 2
        tl.to(
          '[data-mark]',
          { scale: 0.5, autoAlpha: 0, yPercent: -26, duration: 0.42, ease: 'power2.in' },
          0,
        )
          .to('[data-mark-kicker]', { autoAlpha: 0, y: -18, duration: 0.3 }, 0)
          .to('[data-cue]', { autoAlpha: 0, duration: 0.25 }, 0)
          .fromTo(
            '[data-phrase]',
            { autoAlpha: 0, scale: 1.14, yPercent: 14 },
            { autoAlpha: 1, scale: 1, yPercent: 0, duration: 0.54, ease: 'power3.out' },
            0.46,
          )
          .fromTo(
            '[data-phrase-trace]',
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.3 },
            0.72,
          )

        // ATO 2 → 3, com o mesmo intervalo de respiro entre saída e entrada.
        tl.to(
          '[data-phrase]',
          { autoAlpha: 0, scale: 0.88, yPercent: -20, duration: 0.4, ease: 'power2.in' },
          1.05,
        )
          .to('[data-phrase-trace]', { autoAlpha: 0, duration: 0.3 }, 1.05)
          .fromTo(
            '[data-constellation]',
            { autoAlpha: 0, scale: 0.76 },
            { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' },
            1.5,
          )
          .fromTo(
            '[data-stamp]',
            { autoAlpha: 0, scale: 0.4 },
            { autoAlpha: 1, scale: 1, duration: 0.45, stagger: 0.045, ease: 'back.out(1.6)' },
            1.55,
          )
          .fromTo('[data-outro]', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 1.9)

        // A fotografia atravessa os três atos numa aproximação contínua: é o
        // que dá continuidade a uma sequência que troca de conteúdo três vezes.
        gsap.fromTo(
          '[data-media]',
          { scale: 1.22 },
          {
            scale: 1,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 1 },
          },
        )
      })

      /* ------------------------------------------- celular: sem pin, em pilha */
      mm.add('(max-width: 899px)', () => {
        gsap
          .timeline({ delay: 0.2 })
          .fromTo(
            el.querySelectorAll('[data-mark] [data-logo-path]'),
            { opacity: 0, yPercent: 24 },
            { opacity: 1, yPercent: 0, duration: 0.6, stagger: 0.028, ease: 'power3.out' },
          )
          .fromTo(el.querySelector('[data-mark-kicker]'), { opacity: 0, y: 12 }, { opacity: 1, y: 0 }, 0.45)

        // Cada bloco se revela ao entrar na tela — a mesma narrativa, sem pin.
        for (const alvo of ['[data-phrase]', '[data-constellation]', '[data-outro]']) {
          const node = el.querySelector(alvo)
          if (!node) continue
          gsap.fromTo(
            node,
            { autoAlpha: 0, y: 34 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.9,
              ease: 'power3.out',
              scrollTrigger: { trigger: node, start: 'top 82%', once: true },
            },
          )
        }

        gsap.to('[data-media]', {
          yPercent: 10,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true },
        })
      })

      return () => mm.revert()
    },
    [],
  )

  const photo = PHOTO_BY_ID[HERO.id]

  return (
    <section ref={root} className={styles.hero} data-atmosphere="noturna" data-section="noturna">
      {/*
        O palco é o que fica preso na tela durante os três atos. Tudo que se vê
        vive aqui dentro; o <section> em volta existe só para dar o comprimento
        de scroll que a sequência consome.
      */}
      <div data-stage className={styles.stage}>
        <div className={styles.mediaWrap}>
          <div data-media className={styles.media}>
            {photo ? (
              <Image
                src={photo.src}
                alt={HERO.alt}
                fill
                sizes="100vw"
                priority
                fetchPriority="high"
                placeholder="blur"
                blurDataURL={photo.blurDataURL}
                className={styles.img}
              />
            ) : null}
          </div>
          <div className={styles.scrim} aria-hidden="true" />
          <div className={styles.vignette} aria-hidden="true" />
        </div>

        {/* O texto acessível da abertura, em uma linha. As camadas visuais
            abaixo são decorativas para quem usa leitor de tela. */}
        <h1 className="u-visually-hidden">Wine Garden — Viaje o mundo, taça a taça.</h1>

        <div className={styles.acts} aria-hidden="true">
          {/* ------------------------------------------------ ATO 1 · A MARCA */}
          <div data-mark className={styles.mark}>
            <Logo lockup="empilhado" height="clamp(9rem, 30vh, 21rem)" labelled={false} />
          </div>

          <p data-mark-kicker className={styles.markKicker}>
            <span>Pontão do Lago Sul</span>
            <span className={styles.markRule} />
            <span>Brasília</span>
          </p>

          {/* ------------------------------------------------ ATO 2 · A FRASE */}
          <div data-phrase className={styles.phrase}>
            <span className={styles.phraseTop}>Viaje o mundo,</span>
            <span className={styles.phraseBottom}>taça a taça.</span>
          </div>

          <div data-phrase-trace className={styles.phraseTrace}>
            <Trace
              points={[
                { x: 0.04, y: 0.16 },
                { x: 0.36, y: 0.72 },
                { x: 0.68, y: 0.24 },
                { x: 0.96, y: 0.8 },
              ]}
              viewBox={{ width: 900, height: 240 }}
              mode="draw"
              strokeWidth={1.8}
            />
          </div>

          {/* -------------------------------------------- ATO 3 · AS ORIGENS */}
          <div data-constellation className={styles.constellation}>
            <span className={styles.constellationTitle}>Oito origens</span>
            <span className={styles.constellationSub}>na carta, agora</span>
          </div>
        </div>

        {/*
          Os selos ficam FORA do bloco decorativo: são links reais para a carta
          filtrada por origem, e precisam ser lidos e alcançados por teclado.
        */}
        <ul className={styles.stamps}>
          {STAMPS.map(({ country, stats, angle, depth }) => (
            <li
              key={country.slug}
              data-stamp
              className={styles.stampSlot}
              style={{ '--angle': `${angle}deg`, '--depth': depth } as React.CSSProperties}
            >
              <Link
                href={`/vinhos?pais=${country.slug}`}
                className={styles.stamp}
                data-cursor="Explorar"
                aria-label={`${country.name}: ver ${stats.total} rótulos na carta`}
                onClick={() => track('country_explore', { country: country.slug, wines: stats.total })}
              >
                <img
                  src={country.sealSrc}
                  alt=""
                  className={styles.stampArt}
                  loading="lazy"
                  decoding="async"
                  width={110}
                  height={110}
                />
                <span className={styles.stampInfo} aria-hidden="true">
                  <span className={styles.stampName}>{country.name}</span>
                  <span className={styles.stampCount}>{stats.total}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* A leitura do momento fecha a sequência. */}
        <div data-outro className={styles.outro}>
          <MomentoAgora />
        </div>

        <a href="#manifesto" data-cue className={styles.cue}>
          <MonoLabel size="xs">Role para descobrir</MonoLabel>
          <span className={styles.cueLine} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}
