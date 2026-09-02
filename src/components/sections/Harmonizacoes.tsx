import Link from 'next/link'
import { Section } from '@/components/primitives/Section'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { MENU_ITEMS } from '@/data/generated/menu'
import { WINES } from '@/data/generated/wines'
import { CATEGORY_SLUG, PAIRING_TO_CATEGORY } from '@/lib/wine-vocab'
import type { WineCategory } from '@/types/content'
import styles from './Harmonizacoes.module.css'

/**
 * A TABELA DE HARMONIZAÇÕES DA CASA.
 *
 * Existe por duas razões que se reforçam.
 *
 * Para quem lê: é a resposta à pergunta que o visitante faz de verdade — "com
 * o que eu bebo a burrata?" — sem ter que atravessar o questionário.
 *
 * Para quem indexa: o Wine Match é uma página interativa, e uma página
 * interativa é quase invisível para um buscador — o conteúdo só existe depois
 * de quatro cliques. Esta seção põe em HTML servido o dado mais citável do
 * site: o cruzamento entre cozinha e carta que a casa escreveu no cardápio.
 *
 * NADA AQUI É INFERIDO. Cada linha vem do campo `pairings` do cardápio
 * oficial; o mapa `PAIRING_TO_CATEGORY` só reconcilia os três nomes que o
 * cardápio e a carta escrevem diferente. Se um prato não declara harmonização,
 * ele não aparece — não há palpite.
 */

type Linha = {
  categoria: WineCategory
  slug: string
  pratos: readonly string[]
  rotulos: number
}

function montarLinhas(): readonly Linha[] {
  const porCategoria = new Map<WineCategory, string[]>()

  for (const item of MENU_ITEMS) {
    for (const pairing of item.pairings) {
      const categoria = PAIRING_TO_CATEGORY[pairing]
      if (!categoria) continue
      const lista = porCategoria.get(categoria) ?? []
      if (!lista.includes(item.name)) lista.push(item.name)
      porCategoria.set(categoria, lista)
    }
  }

  /* A ordem da carta, não a alfabética: do espumante ao tinto encorpado é como
     a casa organiza a própria lista, e é a progressão que faz sentido ler. */
  const ordem = [...new Set(WINES.map((w) => w.category))]

  return ordem
    .filter((categoria) => porCategoria.has(categoria))
    .map((categoria) => ({
      categoria,
      slug: CATEGORY_SLUG[categoria],
      pratos: porCategoria.get(categoria) ?? [],
      rotulos: WINES.filter((w) => w.category === categoria).length,
    }))
}

const LINHAS = montarLinhas()
const TOTAL_PRATOS = new Set(
  MENU_ITEMS.filter((i) => i.pairings.length > 0).map((i) => i.name),
).size

export function Harmonizacoes() {
  return (
    <Section id="harmonizacoes" atmosphere="bege" className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <MonoLabel size="xs" muted>
            A ponte da casa
          </MonoLabel>
          <EditorialHeading as="h2" size="2" className={styles.title}>
            O que a cozinha <em className={styles.italic}>já respondeu</em>
          </EditorialHeading>
          <Prose muted className={styles.lead}>
            O Wine Match não adivinha: ele parte das {TOTAL_PRATOS} harmonizações que o cardápio já
            declara. Cada prato abaixo traz a categoria de vinho que a casa indicou — e cada
            categoria leva à parte da carta correspondente.
          </Prose>
        </header>

        <div className={styles.tabela}>
          {LINHAS.map((linha) => (
            <article key={linha.categoria} className={styles.linha}>
              <div className={styles.coluna}>
                <h3 className={styles.categoria}>
                  <Link href={`/vinhos?categoria=${linha.slug}`} className={styles.link}>
                    {linha.categoria}
                  </Link>
                </h3>
                <MonoLabel size="xs" numeric muted className={styles.contagem}>
                  {linha.rotulos} {linha.rotulos === 1 ? 'rótulo' : 'rótulos'}
                </MonoLabel>
              </div>
              <p className={styles.pratos}>
                Harmoniza com {linha.pratos.join(', ')}.
              </p>
            </article>
          ))}
        </div>

        <Prose size="sm" muted className={styles.nota}>
          Harmonizações impressas no cardápio oficial do Wine Garden. Pratos sem indicação não
          aparecem nesta tabela.
        </Prose>
      </div>
    </Section>
  )
}
