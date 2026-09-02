'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Logo } from '@/components/brand/Logo'
import { Trace } from '@/components/brand/Trace'
import { useGsapOn } from '@/hooks/useGsap'
import styles from './Preloader.module.css'

/**
 * Decide, no cliente e sem efeito, se a abertura deve rodar.
 *
 * A decisão depende de duas coisas que não existem no servidor — `matchMedia` e
 * `sessionStorage` — e não muda depois do primeiro paint. `useSyncExternalStore`
 * com snapshot de servidor explícito é o mecanismo do React para exatamente
 * isso: o servidor renderiza `false` (nenhuma cortina no HTML), o cliente lê o
 * valor real, e não há mismatch de hidratação nem `setState` dentro de efeito.
 */
const neverChanges = () => () => {}

function useShouldPlayIntro(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
      try {
        return sessionStorage.getItem('wg:intro') !== 'done'
      } catch {
        // Modo privativo pode barrar o storage; nesse caso a intro roda,
        // o que é preferível a quebrar.
        return true
      }
    },
    () => false,
  )
}

/**
 * Abertura da marca.
 *
 * A regra que governa este componente: ele NUNCA pode atrasar o usuário. Não há
 * espera artificial, não há barra de progresso falsa, não há bloqueio até a
 * imagem carregar. A composição dura ~1,3 s e sai; se o herói já estiver
 * pintado antes disso, ela sai antes.
 *
 * Só aparece uma vez por aba (sessionStorage): quem volta pelo botão do
 * navegador não assiste a mesma animação de novo.
 *
 * Sem JS ele não renderiza; com `prefers-reduced-motion` ele não renderiza.
 * Em nenhum caso o conteúdo fica inacessível — o <main> já está no DOM atrás.
 */
export function Preloader() {
  const shouldPlay = useShouldPlayIntro()
  // `finished` só vira true quando a timeline termina — ele encerra a cortina,
  // não a decide.
  const [finished, setFinished] = useState(false)
  const root = useRef<HTMLDivElement | null>(null)
  const active = shouldPlay && !finished

  // A marca de "já vista" é gravada em efeito porque é escrita, não leitura:
  // o snapshot acima precisa continuar puro.
  useEffect(() => {
    if (!shouldPlay) return
    try {
      sessionStorage.setItem('wg:intro', 'done')
    } catch {
      // Sem storage, a intro roda a cada navegação. Aceitável.
    }
  }, [shouldPlay])

  useGsapOn(
    root,
    ({ gsap, root: el }) => {
      if (!active) return

      // Enquanto a cortina está no ar, a rolagem fica travada — mas por 1,3 s,
      // não por "até carregar".
      const previous = document.body.style.overflow
      document.body.style.overflow = 'hidden'

      const release = () => {
        document.body.style.overflow = previous
        setFinished(true)
      }

      gsap
        .timeline({ onComplete: release })
        .fromTo(
          el.querySelectorAll('[data-logo-path]'),
          { opacity: 0, yPercent: 30 },
          { opacity: 1, yPercent: 0, duration: 0.5, stagger: 0.028, ease: 'power2.out' },
          0.32,
        )
        .to(el.querySelector('[data-intro-mark]'), { opacity: 0, duration: 0.32 }, 1.05)
        .to(el, { yPercent: -100, duration: 0.72, ease: 'power4.inOut' }, 1.15)

      return () => {
        document.body.style.overflow = previous
      }
    },
    [active],
  )

  if (!active) return null

  return (
    <div
      ref={root}
      className={styles.preloader}
      data-atmosphere="noturna"
      // Conteúdo puramente decorativo: o leitor de tela vai direto ao <main>.
      aria-hidden="true"
    >
      <div className={styles.trace}>
        <Trace
          points={[
            { x: -0.05, y: 0.62 },
            { x: 0.28, y: 0.3 },
            { x: 0.6, y: 0.66 },
            { x: 1.05, y: 0.34 },
          ]}
          viewBox={{ width: 1000, height: 400 }}
          mode="draw"
          strokeWidth={1.8}
        />
      </div>

      <div data-intro-mark className={styles.mark}>
        <Logo lockup="horizontal" height="clamp(1.6rem, 5vw, 3.25rem)" labelled={false} />
      </div>
    </div>
  )
}
