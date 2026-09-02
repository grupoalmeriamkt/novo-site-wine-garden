import styles from './Skeleton.module.css'

/**
 * Estados de carregamento na linguagem da marca.
 *
 * Nada de spinner genérico: o que carrega aqui é uma carta de vinhos, e o
 * esqueleto imita a forma do que vai chegar — filetes de índice, blocos de
 * rótulo, a taça em line art. O movimento é um varrimento lento, não um pulso,
 * porque pulso lê como erro.
 */

/** Linha de índice — usada enquanto a carta ou o cardápio carregam. */
export function SkeletonRow({ count = 6 }: { count?: number }) {
  return (
    <ul className={styles.rows} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={styles.row}>
          <span className={styles.num} />
          <span className={styles.name} style={{ inlineSize: `${52 + ((i * 13) % 34)}%` }} />
          <span className={styles.price} />
        </li>
      ))}
    </ul>
  )
}

/** Bloco de fotografia, com a proporção já reservada para não causar CLS. */
export function SkeletonFrame({ ratio = 3 / 4 }: { ratio?: number }) {
  return <div className={styles.frame} style={{ aspectRatio: ratio }} aria-hidden="true" />
}

/**
 * Estado de carregamento com rótulo. O `role="status"` faz o leitor de tela
 * anunciar a espera sem roubar o foco.
 */
export function LoadingState({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className={styles.trace} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </div>
  )
}
