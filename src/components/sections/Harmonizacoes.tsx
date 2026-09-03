import Link from 'next/link'
import { Section } from '@/components/primitives/Section'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { WINES } from '@/data/generated/wines'
import { categoriasDaCozinha } from '@/lib/cozinha'
import { CATEGORY_SLUG } from '@/lib/wine-vocab'
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
 * oficial, agregado por CATEGORIA de cozinha — "Crudos", não "Ceviche de
 * Pesce". Foi assim que a tabela sobreviveu à saída do cardápio do site: o
 * nome de um prato pode não existir na semana que vem, mas a casa continua
 * servindo crudos, e continua bebendo branco leve com eles.
 */

type Linha = {
  categoria: WineCategory
  slug: string
  /** Categorias da cozinha que indicam esta categoria de vinho. */
  cozinha: readonly string[]
  rotulos: number
}

/** Inverte o resumo da cozinha: de "categoria de prato → vinhos" para
 *  "categoria de vinho → o que se come com ela". */
function montarLinhas(): readonly Linha[] {
  const porVinho = new Map<WineCategory, string[]>()

  for (const { nome, vinhos } of categoriasDaCozinha()) {
    for (const vinho of vinhos) {
      const lista = porVinho.get(vinho) ?? []
      if (!lista.includes(nome)) lista.push(nome)
      porVinho.set(vinho, lista)
    }
  }

  /* A ordem da carta, não a alfabética: do espumante ao tinto encorpado é como
     a casa organiza a própria lista, e é a progressão que faz sentido ler. */
  const ordem = [...new Set(WINES.map((w) => w.category))]

  return ordem
    .filter((categoria) => porVinho.has(categoria))
    .map((categoria) => ({
      categoria,
      slug: CATEGORY_SLUG[categoria],
      cozinha: porVinho.get(categoria) ?? [],
      rotulos: WINES.filter((w) => w.category === categoria).length,
    }))
}

const LINHAS = montarLinhas()
const TOTAL_COZINHA = categoriasDaCozinha().length

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
            A casa indica, no cardápio, com que vinho cada uma das {TOTAL_COZINHA} categorias da
            cozinha harmoniza. A tabela abaixo lê isso ao contrário: comece pelo vinho e veja o que
            se come com ele. Cada categoria leva à parte correspondente da carta.
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
                Indicado no cardápio para {linha.cozinha.join(', ').toLowerCase()}.
              </p>
            </article>
          ))}
        </div>

        <Prose size="sm" muted className={styles.nota}>
          Harmonizações impressas no cardápio oficial do Wine Garden. Os pratos e os valores de
          hoje ficam no cardápio digital, que a casa mantém atualizado.
        </Prose>
      </div>
    </Section>
  )
}
