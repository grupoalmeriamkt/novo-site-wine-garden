'use client'

import { useSyncExternalStore } from 'react'
import { VENUE_TIMEZONE } from '@/lib/momento'

/**
 * A hora corrente no fuso do restaurante, atualizada sozinha.
 *
 * É um store externo, não um `useState` com `setInterval`: a hora é um valor
 * que vive FORA do React e muda por conta própria, que é exatamente o caso de
 * uso de `useSyncExternalStore`. A alternativa — `setState` dentro de um efeito
 * — dispara renderização em cascata e é sinalizada pelo lint do React.
 *
 * O snapshot é memoizado por minuto. `getSnapshot` é chamado várias vezes por
 * render, e devolver uma string nova a cada chamada faria o React entrar em
 * laço infinito por achar que o valor mudou.
 */

const formatador = new Intl.DateTimeFormat('pt-BR', {
  timeZone: VENUE_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

let cache = ''
let cacheMinuto = -1

function getSnapshot(): string {
  const agora = new Date()
  // A chave do cache é o minuto absoluto: muda uma vez por minuto, e é o que
  // mantém a string estável entre chamadas dentro do mesmo render.
  const minuto = Math.floor(agora.getTime() / 60_000)
  if (minuto !== cacheMinuto) {
    cacheMinuto = minuto
    cache = formatador.format(agora)
  }
  return cache
}

/**
 * Um único temporizador serve todos os assinantes. Ele acorda a cada 15s em
 * vez de a cada minuto para que a troca de dígito não atrase até 59 segundos
 * depois de acontecer.
 */
const assinantes = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(onChange: () => void): () => void {
  assinantes.add(onChange)
  if (!timer) {
    timer = setInterval(() => {
      for (const notificar of assinantes) notificar()
    }, 15_000)
  }
  return () => {
    assinantes.delete(onChange)
    if (assinantes.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

/** No servidor não há "agora" do cliente; quem chama decide o fallback. */
const getServerSnapshot = () => ''

export function useRelogioBrasilia(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
