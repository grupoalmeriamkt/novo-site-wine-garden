'use client'

import { useSyncExternalStore } from 'react'

/**
 * Media query reativa sem hydration mismatch.
 *
 * useSyncExternalStore com snapshot de servidor explícito resolve o problema
 * clássico: no servidor não existe matchMedia, então qualquer `useState(false)`
 * + `useEffect` gera um primeiro render diferente do cliente. Aqui o React sabe
 * que o valor do servidor é `false` e reconcilia sem avisar erro.
 */
function subscribe(query: string) {
  return (onChange: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }
}

export function useMediaQuery(query: string, serverFallback = false): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () => window.matchMedia(query).matches,
    () => serverFallback,
  )
}

/**
 * Quem pediu menos movimento recebe menos movimento — em toda parte, inclusive
 * nas animações controladas por JS, não só nas de CSS.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)', false)
}

/**
 * Distingue mouse preciso de toque. Usado para ligar o cursor contextual e o
 * hover — nunca para decidir layout, que é responsabilidade dos breakpoints.
 */
export function useHasPointer(): boolean {
  return useMediaQuery('(hover: hover) and (pointer: fine)', false)
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)', false)
}
