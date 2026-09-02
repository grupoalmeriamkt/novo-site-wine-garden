import { LOCKUPS, type LockupName } from '@/data/generated/logo'
import styles from './Logo.module.css'

type LogoProps = {
  /** `horizontal` (4,91:1) para header e rodapé; `empilhado` (1,04:1) para selos. */
  lockup?: LockupName
  /**
   * Altura do logo. Largura é derivada da proporção real do lettering, então o
   * lockup nunca distorce nem reserva espaço vazio.
   */
  height?: string
  /**
   * `true` quando o logo é o nome acessível do elemento (link do header).
   * `false` quando há texto ao lado dizendo a mesma coisa — aí ele vira
   * decorativo e o leitor de tela não repete "Wine Garden" duas vezes.
   */
  labelled?: boolean
  className?: string
}

/**
 * O lettering oficial do Wine Garden.
 *
 * Inline em vez de <img> por três razões: pinta com `currentColor` (e portanto
 * troca junto com a atmosfera da seção), pode ser animado path a path na
 * abertura, e não custa uma requisição no caminho crítico do primeiro paint.
 *
 * O desenho não é reproduzido em CSS nem redesenhado — são os paths do arquivo
 * oficial, apenas com o viewBox recortado à caixa real do desenho.
 */
export function Logo({ lockup = 'horizontal', height = '1em', labelled = true, className }: LogoProps) {
  const { viewBox, ratio, paths } = LOCKUPS[lockup]

  return (
    <svg
      className={className ? `${styles.logo} ${className}` : styles.logo}
      viewBox={viewBox}
      style={{ height, width: `calc(${height} * ${ratio})` }}
      fill="currentColor"
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? 'Wine Garden' : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} data-logo-path />
      ))}
    </svg>
  )
}
