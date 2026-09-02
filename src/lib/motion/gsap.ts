'use client'

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Registro único do GSAP para toda a aplicação.
 *
 * Registrar plugin é idempotente no GSAP, mas centralizar aqui garante que
 * nenhum componente esqueça o registro e que os defaults de easing e duração
 * venham dos tokens da marca — um componente que chama gsap.to() sem
 * especificar ease herda o sotaque certo.
 */

let registered = false

export function ensureGsap() {
  if (registered || typeof window === 'undefined') return { gsap, ScrollTrigger }
  gsap.registerPlugin(ScrollTrigger)

  gsap.defaults({
    ease: 'power3.out',
    duration: 0.72,
  })

  // O ScrollTrigger recalcula em cada resize; no iOS a barra de endereço que
  // recolhe dispara resize a cada scroll e provoca um refresh em loop. Ignorar
  // mudanças só de altura em telas de toque elimina o jank sem perder a
  // resposta a rotação de tela (que muda a largura).
  ScrollTrigger.config({ ignoreMobileResize: true })

  registered = true
  return { gsap, ScrollTrigger }
}

/**
 * Lê um token de motion do CSS. Mantém CSS e JS animando com a mesma curva
 * sem duplicar os valores — os tokens continuam sendo a fonte de verdade.
 */
export function motionToken(name: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!raw) return fallback
  const ms = raw.endsWith('ms') ? parseFloat(raw) : raw.endsWith('s') ? parseFloat(raw) * 1000 : NaN
  return Number.isFinite(ms) ? ms / 1000 : fallback
}

/** Curvas da marca, espelhando os cubic-bezier de tokens.css. */
export const EASE = {
  brand: 'cubic-bezier(0.22, 1, 0.36, 1)',
  inout: 'cubic-bezier(0.65, 0, 0.35, 1)',
  mask: 'cubic-bezier(0.76, 0, 0.24, 1)',
  outSoft: 'cubic-bezier(0.33, 1, 0.68, 1)',
} as const

export { gsap, ScrollTrigger }
