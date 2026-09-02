import type { ReactNode } from 'react'
import styles from './Section.module.css'

export type Atmosphere = 'editorial' | 'noturna' | 'terroir' | 'intensa' | 'bege'

type SectionProps = {
  children: ReactNode
  /**
   * A pele da seção. Trocar de atmosfera é o que impede o site de virar um
   * bloco de bordô do começo ao fim — e é o que dá ritmo à narrativa.
   */
  atmosphere?: Atmosphere
  id?: string
  /** Rótulo acessível quando a seção não abre com um heading visível. */
  label?: string
  /** Remove o padding vertical padrão (seções full-bleed cuidam do próprio). */
  bleed?: boolean
  tight?: boolean
  className?: string
}

/**
 * Faixa da narrativa.
 *
 * `data-atmosphere` redefine os papéis de cor (surface/ink/accent) para tudo
 * que está dentro, e `data-section` é o gancho que o observador de atmosfera
 * usa para pintar o `body` conforme o scroll — assim a área além do conteúdo
 * (o overscroll do iOS, por exemplo) nunca aparece na cor errada.
 */
export function Section({
  children,
  atmosphere = 'editorial',
  id,
  label,
  bleed = false,
  tight = false,
  className,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-label={label}
      data-atmosphere={atmosphere}
      data-section={atmosphere}
      className={[styles.section, bleed && styles.bleed, tight && styles.tight, className].filter(Boolean).join(' ')}
    >
      {children}
    </section>
  )
}
