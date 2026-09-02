import type { CSSProperties, ReactNode } from 'react'
import { svgAsset } from '@/data/generated/svg-manifest'
import { MonoLabel } from '@/components/primitives/Typography'
import type { Country } from '@/types/content'
import styles from './CountrySeal.module.css'

/**
 * Caixa de área constante para um SVG de proporção arbitrária.
 *
 * Os oito selos oficiais NÃO têm a mesma proporção: França, Espanha, Brasil e
 * Argentina são quadrados (246×246), Itália, Chile e Portugal são retratos
 * (307×499) e os EUA são paisagem (411×253). Dimensionar todos pela altura
 * deixaria o Chile como um filete e os EUA como uma faixa — pesos visuais
 * incomparáveis numa mesma composição.
 *
 * A solução é normalizar pela ÁREA, não pelo lado: com `k = √(w/h)`, a caixa
 * `k × 1/k` tem sempre área 1 e preserva a proporção original. Cada selo
 * mantém o formato que a identidade desenhou e todos ocupam o mesmo peso na
 * página.
 */
export function svgAreaBox(key: string): { w: number; h: number } {
  const asset = svgAsset(key)
  if (!asset?.width || !asset.height) return { w: 1, h: 1 }
  const k = Math.sqrt(asset.width / asset.height)
  return { w: k, h: 1 / k }
}

export type CountrySealState =
  /** Estado neutro. */
  | 'idle'
  /** Origem aberta no momento. */
  | 'active'
  /** Fora do foco da leitura — a arte apaga, o rótulo continua legível. */
  | 'muted'

type CountrySealProps = {
  country: Country
  /**
   * Numeração da viagem ("01"). Decorativa: a posição na rota já é dita pela
   * estrutura (tablist no desktop, lista ordenada no mobile).
   */
  order?: string
  /** Linha de dados sob o selo (ex.: "31 rótulos"). */
  caption?: ReactNode
  /** `false` quando o nome do país já está escrito ao lado, como um heading. */
  showName?: boolean
  size?: 'sm' | 'md' | 'lg'
  /**
   * Medida explícita do selo, em qualquer unidade CSS. Sobrepõe `size` quando
   * a composição precisa amarrar o selo a outra medida (a calha da narrativa
   * mobile, por exemplo) em vez de repetir o clamp em dois arquivos.
   */
  box?: string
  /** Peso relativo dentro da composição. 1 = tamanho cheio da faixa. */
  scale?: number
  /** Inclinação em graus — selo colado à mão nunca fica alinhado ao grid. */
  tilt?: number
  state?: CountrySealState
  className?: string
}

/**
 * Selo postal de país.
 *
 * A identidade desenhou selo próprio para oito países (manual, p.10) e é essa
 * peça que carrega a ideia de viagem: cada origem da carta é um carimbo no
 * passaporte. O selo aparece aqui montado numa folha de papel claro — a página
 * do álbum — por dois motivos que se somam.
 *
 * O primeiro é de direção de arte: colar selo em folha é literalmente como um
 * álbum filatélico funciona, e é o gesto que a marca já usa nas peças.
 *
 * O segundo é de contraste: os selos são fechados em granada, uva e oliva, e
 * sobre a atmosfera noturna (uva profundo) o de Chile e o da França sumiriam.
 * A folha resolve isso sem tocar nos arquivos originais — e resolve de um jeito
 * que o próprio sistema de tokens já prevê, porque a folha declara
 * `data-atmosphere="editorial"` e herda o jogo claro inteiro (surface, ink,
 * rule) em vez de reescrever cor à mão.
 */
export function CountrySeal({
  country,
  order,
  caption,
  showName = true,
  size = 'md',
  box,
  scale = 1,
  tilt = 0,
  state = 'idle',
  className,
}: CountrySealProps) {
  const asset = svgAsset(`selo:${country.slug}`)
  const area = svgAreaBox(`selo:${country.slug}`)

  const vars = {
    '--seal-w': area.w.toFixed(4),
    '--seal-h': area.h.toFixed(4),
    '--seal-scale': String(scale),
    '--seal-tilt': `${tilt}deg`,
    ...(box ? { '--seal-size': box } : null),
  } as CSSProperties

  const hasLegend = Boolean(order) || showName || Boolean(caption)

  return (
    <span
      className={[styles.seal, styles[size], className].filter(Boolean).join(' ')}
      data-state={state}
      style={vars}
    >
      <span className={styles.mount} data-atmosphere="editorial">
        <img
          src={country.sealSrc}
          /* O nome do país é dito pelo texto ao lado em todos os usos; repetir
             aqui faria o leitor de tela anunciar a origem duas vezes. */
          alt=""
          width={asset?.width ?? 246}
          height={asset?.height ?? 246}
          loading="lazy"
          decoding="async"
          className={styles.img}
        />
      </span>

      {hasLegend ? (
        <span className={styles.legend}>
          {/* A ordem já é dita pela estrutura (posição no tablist, item da lista
              ordenada); repeti-la em texto só faria o leitor de tela ler
              "zero um" antes de cada país. */}
          {order ? (
            <span className={styles.orderSlot} aria-hidden="true">
              <MonoLabel size="xs" numeric className={styles.order}>
                {order}
              </MonoLabel>
            </span>
          ) : null}
          {showName ? (
            <MonoLabel size="xs" className={styles.name}>
              {country.name}
            </MonoLabel>
          ) : null}
          {caption ? (
            <MonoLabel size="xs" numeric className={styles.caption}>
              {caption}
            </MonoLabel>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}
