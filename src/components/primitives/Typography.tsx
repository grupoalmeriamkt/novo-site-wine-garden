import type { ElementType, ReactNode } from 'react'
import styles from './Typography.module.css'

/* ------------------------------------------------------------------------- */

type DisplaySize = 'mega' | '1' | '2' | '3' | '4'

type EditorialHeadingProps = {
  children: ReactNode
  as?: ElementType
  size?: DisplaySize
  /** Aplica o itálico da Instrument Serif — usado para inflexão, não ênfase. */
  italic?: boolean
  align?: 'start' | 'center' | 'end'
  className?: string
  id?: string
}

/**
 * Título em Instrument Serif.
 *
 * A escala vai a 19rem no topo porque o manual compõe assim: as frases da marca
 * ocupam a página, não uma faixa de 48px. `text-wrap: balance` evita a viúva de
 * uma palavra sozinha na última linha, que é o que estraga um display grande.
 */
export function EditorialHeading({
  children,
  as: Tag = 'h2',
  size = '2',
  italic = false,
  align = 'start',
  className,
  id,
}: EditorialHeadingProps) {
  return (
    <Tag
      id={id}
      className={[styles.display, styles[`size${size}`], italic && styles.italic, styles[`align-${align}`], className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  )
}

/* ------------------------------------------------------------------------- */

type MonoLabelProps = {
  children: ReactNode
  as?: ElementType
  size?: 'lg' | 'md' | 'sm' | 'xs'
  /** Tom mais apagado, para metadados que acompanham um título. */
  muted?: boolean
  /** Numeração de seção do índice ("01", "02") — sempre tabular. */
  numeric?: boolean
  className?: string
}

/**
 * Rótulo em JetBrains Mono, caixa alta.
 *
 * É o vocabulário funcional da marca: categorias, países, preços, horários,
 * numeração de seção. O manual especifica caixa alta com tracking -25; abaixo
 * de ~13px isso fecha demais em tela, então micro-rótulos abrem (ver a nota em
 * tokens.css sobre --tracking-label).
 */
export function MonoLabel({
  children,
  as: Tag = 'span',
  size = 'sm',
  muted = false,
  numeric = false,
  className,
}: MonoLabelProps) {
  return (
    <Tag
      className={[styles.mono, styles[`mono${size}`], muted && styles.muted, numeric && styles.numeric, className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  )
}

/* ------------------------------------------------------------------------- */

type ProseProps = {
  children: ReactNode
  as?: ElementType
  size?: 'lg' | 'md' | 'sm'
  /** Limita a medida a ~62ch — o manual compõe texto corrido em ~50 caracteres. */
  measured?: boolean
  muted?: boolean
  className?: string
}

/** Texto corrido em JetBrains Mono, sem ajuste de entreletras (regra do manual). */
export function Prose({ children, as: Tag = 'p', size = 'md', measured = true, muted = false, className }: ProseProps) {
  return (
    <Tag
      className={[styles.prose, styles[`prose${size}`], measured && styles.measured, muted && styles.muted, className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  )
}
