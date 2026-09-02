'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'
import { ensureGsap, gsap } from '@/lib/motion/gsap'

/**
 * A rotina de animação. Pode devolver uma função de limpeza para o que o GSAP
 * não conhece — um IntersectionObserver, um listener, um timer: o
 * `gsap.context` chama esse retorno junto com o próprio `revert()`.
 */
type GsapSetup<T extends Element> = (context: {
  gsap: typeof gsap
  root: T
}) => void | (() => void)

/**
 * Executa uma rotina GSAP dentro de um `gsap.context` com escopo no elemento
 * e cleanup automático.
 *
 * Sem o contexto, cada remount do React Strict Mode deixa tweens e
 * ScrollTriggers órfãos apontando para nós que já saíram do DOM — o sintoma
 * é o site travar depois de navegar duas ou três vezes. `ctx.revert()` no
 * cleanup desfaz também as propriedades inline que o GSAP escreveu, devolvendo
 * o elemento ao estado do CSS.
 *
 * useLayoutEffect (e não useEffect) para que o estado inicial da animação seja
 * aplicado antes do primeiro paint: caso contrário há um flash do conteúdo já
 * posicionado antes de ele saltar para a posição inicial da timeline.
 */
export function useGsap(
  setup: GsapSetup<HTMLElement>,
  deps: readonly unknown[] = [],
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    ensureGsap()

    const ctx = gsap.context(() => {
      setup({ gsap, root })
    }, root)

    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}

/**
 * Variante para quando o elemento raiz já existe fora do hook (um ref vindo de
 * um pai, por exemplo).
 *
 * Tipado sobre `Element` e não `HTMLElement` porque o Trace ancora num
 * `<svg>` — SVGSVGElement não estende HTMLElement.
 */
export function useGsapOn<T extends Element>(
  target: RefObject<T | null>,
  setup: GsapSetup<T>,
  deps: readonly unknown[] = [],
): void {
  useLayoutEffect(() => {
    const root = target.current
    if (!root) return
    ensureGsap()
    const ctx = gsap.context(() => setup({ gsap, root }), root)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
