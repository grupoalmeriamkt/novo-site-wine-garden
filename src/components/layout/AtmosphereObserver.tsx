'use client'

import { useEffect } from 'react'

/**
 * Sincroniza a cor do <body> com a atmosfera da seção que ocupa o meio da tela.
 *
 * Sem isto, o overscroll elástico do iOS e a área além do conteúdo aparecem na
 * cor da atmosfera padrão, quebrando a imersão justamente quando o usuário
 * "puxa" a página. A transição fica por conta do CSS do body.
 *
 * Um único IntersectionObserver com rootMargin que reduz a raiz a uma faixa
 * central: só a seção que cruza essa faixa manda na cor. É mais barato e mais
 * estável que medir posição no scroll.
 */
export function AtmosphereObserver() {
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('[data-section]')
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Entre várias candidatas, vence a mais visível na faixa.
        const winner = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const atmosphere = winner?.target.getAttribute('data-section')
        if (atmosphere) document.body.dataset.atmosphere = atmosphere
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.5, 1] },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  return null
}
