import type { Metadata } from 'next'
import Link from 'next/link'
import { GASTRONOMY, GARDEN } from '@/data/photos'
import { RESERVATION, SITE } from '@/data/site'
import { cartSummary } from '@/lib/wines'
import { categoriasDaCozinha, secoesDeBebida } from '@/lib/cozinha'
import { CATEGORY_SLUG } from '@/lib/wine-vocab'
import { breadcrumbJsonLd } from '@/lib/seo'
import { Section } from '@/components/primitives/Section'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { Cta } from '@/components/primitives/Cta'
import { Reveal } from '@/components/primitives/Reveal'
import styles from './page.module.css'

const CART = cartSummary()
const COZINHA = categoriasDaCozinha()
const BEBIDAS = secoesDeBebida()

const DESCRICAO = `A cozinha do ${SITE.name}: ${COZINHA.length} categorias de influência mediterrânea, cada uma com a harmonização que a casa indica na carta de ${CART.total} rótulos. Pontão do Lago Sul, Brasília.`

export const metadata: Metadata = {
  title: 'Cardápio',
  description: DESCRICAO,
  alternates: { canonical: '/cardapio' },
  openGraph: {
    type: 'website',
    url: '/cardapio',
    title: `Cardápio — ${SITE.name}`,
    description: DESCRICAO,
  },
}

/**
 * O CARDÁPIO, EM RESUMO.
 *
 * Esta página já foi o cardápio inteiro — 245 itens com preço, conferidos
 * contra o documento oficial. Saiu a pedido da casa, e a razão é boa: o
 * cardápio muda com frequência, e uma lista de preços publicada é uma lista
 * que nasce vencida. Um site que informa preço errado é pior que um site que
 * não informa preço.
 *
 * O QUE FICOU é o que sobrevive à próxima troca: a estrutura da cozinha, a
 * harmonização que cada categoria pede, e a fotografia real dos pratos. Quem
 * quer o item e o valor de hoje vai ao cardápio digital, que a casa mantém —
 * o link está aqui e é sempre a versão vigente.
 *
 * Server Component, sem estado nem parâmetro de busca: a página é a mesma para
 * todo mundo e pode ser estática por inteiro.
 */
export default function CardapioPage() {
  const abertura = GASTRONOMY[1]
  const meio = GASTRONOMY[4]
  const ambiente = GARDEN[1]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Início', path: '' },
              { name: 'Cardápio', path: '/cardapio' },
            ]),
          ),
        }}
      />

      {/* ------------------------------------------------------- abertura */}

      <Section atmosphere="editorial" className={styles.abertura}>
        <div className={styles.aberturaInner}>
          <header className={styles.head}>
            <MonoLabel size="xs" muted>
              Cardápio
            </MonoLabel>
            <EditorialHeading as="h1" size="2" className={styles.titulo}>
              A cozinha que <em className={styles.italico}>acompanha a carta</em>
            </EditorialHeading>
            <Prose size="lg" className={styles.lead}>
              Cozinha contemporânea de influência mediterrânea, pensada desde o começo para ser bebida
              junto. Cada categoria abaixo traz a harmonização que a casa indica — a ponte entre a mesa
              e os {CART.total} rótulos da carta.
            </Prose>
          </header>

          {abertura ? (
            <div className={styles.aberturaFoto}>
              <Reveal
                photoId={abertura.id}
                alt={abertura.alt}
                sizes="(min-width: 1024px) 52vw, 92vw"
                ratio={4 / 5}
                motion="mask"
                priority
              />
            </div>
          ) : null}
        </div>
      </Section>

      {/* ------------------------------------------------------- a cozinha */}

      <Section atmosphere="bege" className={styles.cozinha}>
        <div className={styles.inner}>
          <div className={styles.cozinhaHead}>
            <MonoLabel size="xs" muted>
              O que a casa serve
            </MonoLabel>
            <EditorialHeading as="h2" size="3" className={styles.subtitulo}>
              Das tábuas às sobremesas
            </EditorialHeading>
          </div>

          <ul className={styles.categorias}>
            {COZINHA.map((categoria, i) => (
              <li key={categoria.nome} className={styles.categoria}>
                <MonoLabel size="xs" numeric muted className={styles.numero}>
                  {String(i + 1).padStart(2, '0')}
                </MonoLabel>
                <h3 className={styles.categoriaNome}>{categoria.nome}</h3>
                {categoria.vinhos.length > 0 ? (
                  <p className={styles.harmoniza}>
                    <span className={styles.harmonizaRotulo}>Harmoniza com </span>
                    {categoria.vinhos.map((vinho, j) => (
                      <span key={vinho}>
                        {j > 0 ? ', ' : ''}
                        <Link href={`/vinhos?categoria=${CATEGORY_SLUG[vinho]}`} className={styles.link}>
                          {vinho}
                        </Link>
                      </span>
                    ))}
                    .
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          {meio ? (
            <div className={styles.meioFoto}>
              <Reveal
                photoId={meio.id}
                alt={meio.alt}
                sizes="(min-width: 1024px) 78vw, 92vw"
                ratio={16 / 9}
                motion="scale"
                parallax={28}
              />
            </div>
          ) : null}
        </div>
      </Section>

      {/* -------------------------------------------------------- bebidas */}

      <Section atmosphere="editorial" className={styles.bebidas}>
        <div className={styles.inner}>
          <div className={styles.bebidasGrid}>
            <div className={styles.bebidasTexto}>
              <MonoLabel size="xs" muted>
                Além da carta
              </MonoLabel>
              <EditorialHeading as="h2" size="3" className={styles.subtitulo}>
                Drinks, cervejas e o resto da mesa
              </EditorialHeading>
              <dl className={styles.listaBebidas}>
                {BEBIDAS.map((bloco) => (
                  <div key={bloco.secao} className={styles.blocoBebida}>
                    <dt className={styles.bebidaSecao}>{bloco.secao}</dt>
                    <dd className={styles.bebidaCategorias}>{bloco.categorias.join(' · ')}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {ambiente ? (
              <div className={styles.bebidasFoto}>
                <Reveal
                  photoId={ambiente.id}
                  alt={ambiente.alt}
                  sizes="(min-width: 1024px) 40vw, 92vw"
                  ratio={3 / 4}
                  motion="mask"
                  from="right"
                />
              </div>
            ) : null}
          </div>
        </div>
      </Section>

      {/* --------------------------------------------------------- saídas */}

      <Section atmosphere="noturna" className={styles.saidas}>
        <div className={styles.inner}>
          <div className={styles.saidasInner}>
            <EditorialHeading as="h2" size="2" className={styles.saidasTitulo}>
              Os pratos e os valores de <em className={styles.italico}>hoje</em>
            </EditorialHeading>
            <Prose size="lg" className={styles.saidasLead}>
              A casa troca o cardápio com frequência, então a lista com preço fica onde ela é
              atualizada: no cardápio digital. Aqui ficam a estrutura e as harmonizações, que seguem
              valendo depois da próxima troca.
            </Prose>

            <div className={styles.acoes}>
              <Cta href={RESERVATION.menuUrl} variant="solid" size="lg" external>
                Ver cardápio digital
              </Cta>
              <Cta href="/vinhos" variant="line" size="lg">
                A carta de vinhos
              </Cta>
              <Cta href={RESERVATION.url} variant="ghost" size="lg" external>
                Reservar mesa
              </Cta>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}
