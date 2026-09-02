'use client'

import { ScrollTrigger } from '@/lib/motion/gsap'

/**
 * Recálculo coordenado do ScrollTrigger.
 *
 * `ScrollTrigger.refresh()` remede todos os gatilhos da página. Com uma dezena
 * de componentes animados, cada um chamando o refresh ao montar, isso vira uma
 * cascata de layouts sincronizados no pior momento possível — durante a
 * hidratação.
 *
 * Aqui as chamadas são agrupadas num único refresh no próximo quadro ocioso.
 * Quem chama não precisa saber quem mais chamou.
 */

let pending = false

export function scheduleRefresh(): void {
  if (typeof window === 'undefined' || pending) return
  pending = true

  const run = () => {
    pending = false
    ScrollTrigger.refresh()
  }

  // requestIdleCallback evita competir com a pintura; o rAF é o fallback do
  // Safari, que só ganhou suporte recentemente.
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 400 })
  } else {
    requestAnimationFrame(run)
  }
}

/**
 * Refresh depois que as imagens acima da dobra terminam de carregar.
 *
 * O problema que isto resolve: uma seção cuja altura depende de fotos ainda não
 * carregadas tem `start`/`end` calculados no vazio, e a animação dispara na
 * posição errada. Observamos apenas as imagens que já estão no DOM na montagem
 * — as de baixo entram por lazy loading e o próprio ScrollTrigger reage ao
 * resize que elas provocam.
 */
export function refreshOnImagesReady(root: ParentNode = document): () => void {
  const images = [...root.querySelectorAll('img')].filter((img) => !img.complete)
  if (images.length === 0) {
    scheduleRefresh()
    return () => {}
  }

  let remaining = images.length
  const done = () => {
    remaining -= 1
    if (remaining <= 0) scheduleRefresh()
  }

  for (const img of images) {
    img.addEventListener('load', done, { once: true })
    img.addEventListener('error', done, { once: true })
  }

  return () => {
    for (const img of images) {
      img.removeEventListener('load', done)
      img.removeEventListener('error', done)
    }
  }
}
