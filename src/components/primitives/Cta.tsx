'use client'

import Link from 'next/link'
import { useRef, type ReactNode } from 'react'
import { useHasPointer, usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import styles from './Cta.module.css'

type CtaProps = {
  children: ReactNode
  href: string
  /** `solid` para a conversão principal; `line` para ações secundárias. */
  variant?: 'solid' | 'line' | 'ghost'
  size?: 'md' | 'lg'
  external?: boolean
  onClick?: () => void
  className?: string
  /** Rótulo acessível quando o texto visível não basta fora de contexto. */
  ariaLabel?: string
}

/**
 * Chamada para ação.
 *
 * O atrativo magnético só liga em ponteiro fino e sem `prefers-reduced-motion`:
 * num toque ele não faz sentido, e para quem pediu menos movimento ele é
 * exatamente o tipo de coisa que incomoda. O deslocamento é pequeno de
 * propósito (máx. 6px) — a sensação tem de ser física, não elástica.
 *
 * É sempre um <a> real: navegação por teclado, abrir em nova aba e o menu de
 * contexto do navegador continuam funcionando.
 */
export function Cta({
  children,
  href,
  variant = 'solid',
  size = 'md',
  external = false,
  onClick,
  className,
  ariaLabel,
}: CtaProps) {
  const ref = useRef<HTMLAnchorElement | null>(null)
  const hasPointer = useHasPointer()
  const reduced = usePrefersReducedMotion()
  const magnetic = hasPointer && !reduced

  const handleMove = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!magnetic || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const dx = event.clientX - (rect.left + rect.width / 2)
    const dy = event.clientY - (rect.top + rect.height / 2)
    ref.current.style.setProperty('--pull-x', `${(dx / rect.width) * 12}px`)
    ref.current.style.setProperty('--pull-y', `${(dy / rect.height) * 12}px`)
  }

  const handleLeave = () => {
    if (!ref.current) return
    ref.current.style.setProperty('--pull-x', '0px')
    ref.current.style.setProperty('--pull-y', '0px')
  }

  const classes = [styles.cta, styles[variant], styles[size], className].filter(Boolean).join(' ')

  const content = (
    <>
      <span className={styles.label}>{children}</span>
      <span className={styles.arrow} aria-hidden="true">
        <svg viewBox="0 0 24 12" fill="none" focusable="false">
          <path d="M0 6h21M16 1l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </span>
    </>
  )

  if (external) {
    return (
      <a
        ref={ref}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        aria-label={ariaLabel}
        onClick={onClick}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        {content}
      </a>
    )
  }

  return (
    <Link
      ref={ref}
      href={href}
      className={classes}
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {content}
    </Link>
  )
}
