'use client'

import { useEffect, useRef, useState } from 'react'
import { useHasPointer, usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import styles from './CursorLabel.module.css'

/**
 * Cursor contextual.
 *
 * NÃO substitui o cursor do sistema — ele continua lá, visível e previsível.
 * Este componente só acrescenta um rótulo que segue o ponteiro quando ele está
 * sobre algo que anuncia uma ação implícita (`data-cursor="Explorar"`), e some
 * em qualquer outro lugar. Substituir o cursor inteiro por um ponto customizado
 * é exatamente o tipo de efeito que prejudica usabilidade sem ganho real.
 *
 * Desligado em toque e sob `prefers-reduced-motion`.
 *
 * A posição é escrita em custom properties dentro de um rAF: escrever `style.left`
 * a cada mousemove força layout 60 vezes por segundo.
 */
export function CursorLabel() {
  const hasPointer = useHasPointer()
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement | null>(null)
  const [label, setLabel] = useState<string | null>(null)

  const enabled = hasPointer && !reduced

  useEffect(() => {
    if (!enabled) return

    const node = ref.current
    if (!node) return

    let x = 0
    let y = 0
    let frame = 0

    const onMove = (event: MouseEvent) => {
      x = event.clientX
      y = event.clientY
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        node.style.setProperty('--x', `${x}px`)
        node.style.setProperty('--y', `${y}px`)
      })
    }

    const onOver = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>('[data-cursor]')
      setLabel(target?.dataset.cursor ?? null)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseover', onOver, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onOver)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div ref={ref} className={styles.cursor} data-active={label ? true : undefined} aria-hidden="true">
      <span className={styles.label}>{label}</span>
    </div>
  )
}
