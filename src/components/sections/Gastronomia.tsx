import Link from 'next/link'

import { Trace } from '@/components/brand/Trace'
import { Cta } from '@/components/primitives/Cta'
import { Reveal } from '@/components/primitives/Reveal'
import { Section } from '@/components/primitives/Section'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { MENU_ITEMS } from '@/data/generated/menu'
import { GASTRONOMY } from '@/data/photos'
import { CATEGORY_SLUG, PAIRING_TO_CATEGORY } from '@/lib/wine-vocab'
import { categoriasDaCozinha } from '@/lib/cozinha'
import styles from './Gastronomia.module.css'

/* ========================================================================
   VOCABULÁRIO — a ponte entre a cozinha e a carta
   ======================================================================== */

/**
 * Slug de cada categoria na URL do explorador. É o nome oficial sem acento em
 * kebab-case — a mesma regra que `scripts/build-content.mjs` usa para gerar
 * ids, porque este link vai parar em favorito, WhatsApp e print de tela.
 */
/**
 * Destino da categoria na carta. `null` quando o cardápio usa um termo que não
 * existe na carta: nesse caso o rótulo continua visível como texto, sem link —
 * mostrar a harmonização declarada é obrigação, adivinhar o destino não.
 */
function pairingHref(pairing: string): string | null {
  const category = PAIRING_TO_CATEGORY[pairing]
  if (!category) return null
  return `/vinhos?categoria=${CATEGORY_SLUG[category]}`
}

/** Uma instância só: `Intl.NumberFormat` por item renderizado é caro à toa. */

/* ========================================================================
   DIREÇÃO DE ARTE
   ======================================================================== */

/** Legendas curadas indexadas por id — a abertura escolhe quadro a quadro,
 *  e não na ordem do array. */
const GASTRONOMY_BY_ID = new Map(GASTRONOMY.map((photo) => [photo.id, photo]))

type OvertureFrameProps = {
  photoId: string
  sizes: string
  ratio: number
  className?: string
  motion?: 'mask' | 'scale'
  from?: 'bottom' | 'left' | 'right'
  parallax?: number
}

/**
 * Moldura da abertura.
 *
 * O `alt` vem sempre da curadoria em `photos.ts`: se a foto sair da lista, a
 * moldura simplesmente não entra. Fotografia sem descrição não vai ao ar — e é
 * preferível um vão na composição a um `alt` inventado pelo componente.
 */
function OvertureFrame({
  photoId,
  sizes,
  ratio,
  className,
  motion = 'mask',
  from = 'bottom',
  parallax = 0,
}: OvertureFrameProps) {
  const photo = GASTRONOMY_BY_ID.get(photoId)
  if (!photo) return null

  return (
    <Reveal
      photoId={photo.id}
      alt={photo.alt}
      sizes={sizes}
      ratio={ratio}
      motion={motion}
      from={from}
      parallax={parallax}
      className={className}
    />
  )
}

type Plate = {
  /** id em MENU_ITEMS. */
  dishId: string
  /**
   * Segundo quadro do prato em DISH_PHOTOS. O primeiro já abriu a seção; usar
   * o mesmo arquivo duas vezes na mesma rolagem mataria a sequência.
   */
  photoId: string
  alt: string
  /** Proporção do quadro. Todas iguais viraria grade de restaurante. */
  ratio: number
  motion: 'mask' | 'scale'
  from: 'bottom' | 'left' | 'right'
  /** Deslocamento do parallax, em % da altura. Zero na maioria: se todo quadro
   *  se mexe, nenhum se destaca. */
  parallax: number
}

/**
 * Os três pratos em destaque.
 *
 * A ordem é a de uma refeição — entrada fria, quente, principal — e não a do
 * cardápio. Três bastam para dar o tom da cozinha: a partir do quarto quadro
 * grande a home passa a competir com a página do cardápio em vez de levar a
 * ela. O resto da prévia vive no índice compacto mais abaixo.
 *
 * Todos têm foto identificada no acervo e harmonização declarada pela casa;
 * sem os dois, o prato não entra.
 */
const PLATES: readonly Plate[] = [
  {
    dishId: 'ceviche-de-pesce',
    photoId: 'c2-mar04665',
    alt: 'Close do ceviche: cubos de peixe branco, cebola roxa, milho e brotos verdes no caldo cítrico.',
    ratio: 4 / 5,
    motion: 'mask',
    from: 'left',
    parallax: 6,
  },
  {
    dishId: 'burrata-de-bottega',
    photoId: 'c2-mar04710',
    alt: 'Burrata polvilhada com páprica sobre azeite, em prato de cerâmica azulada, com os pães da casa dourados atrás.',
    ratio: 3 / 4,
    motion: 'mask',
    from: 'right',
    parallax: 0,
  },
  {
    dishId: 'file-com-risotto-piselli',
    photoId: 'c2-mar04798',
    // O único zoom da lista: o prato principal é o clímax da sequência.
    alt: 'Medalhão de filé mignon coberto por crispy de alho-poró sobre risoto de ervilhas, com a vegetação do jardim desfocada ao fundo.',
    ratio: 2 / 3,
    motion: 'scale',
    from: 'bottom',
    parallax: 0,
  },
]

const MENU_BY_ID = new Map(MENU_ITEMS.map((item) => [item.id, item]))

/**
 * O que a foto MOSTRA continua sendo um prato; o que o texto DIZ passou a ser
 * a categoria.
 *
 * O prato de cada quadro serve agora só para descobrir a que categoria a
 * fotografia pertence — e é a categoria, com sua harmonização, que aparece na
 * tela. Nome, preço e descrição saíram junto com o cardápio do site: mudam
 * toda semana, e a home era o lugar onde envelheciam mais à vista.
 */
type Movement = Plate & { categoria: string; vinhos: readonly string[] }

const COZINHA = categoriasDaCozinha()
const COZINHA_BY_NOME = new Map(COZINHA.map((c) => [c.nome, c]))

const MOVEMENTS: readonly Movement[] = PLATES.flatMap((plate) => {
  const dish = MENU_BY_ID.get(plate.dishId)
  const categoria = dish ? COZINHA_BY_NOME.get(dish.category) : undefined
  if (!categoria || categoria.vinhos.length === 0) return []
  return [{ ...plate, categoria: categoria.nome, vinhos: categoria.vinhos }]
})

/** Números lidos do próprio cardápio — nunca escritos à mão. */
const CATEGORIA_COUNT = COZINHA.length
const COM_HARMONIZACAO = COZINHA.filter((c) => c.vinhos.length > 0).length

/**
 * O índice compacto que segue os três destaques.
 *
 * A home mostrava seis pratos, cada um com fotografia grande — seis telas só
 * desta seção, mais que o dobro de qualquer outra. Fotografia em escala é o
 * argumento da PÁGINA do cardápio; na home, depois do terceiro prato, ela vira
 * repetição e adia a decisão de clicar.
 *
 * A troca: três destaques com foto e, no lugar dos outros três, uma lista
 * tipográfica sem imagem. Ela cabe em meia tela e mantém intacta a informação
 * que sustenta a seção — a harmonização que a casa declara.
 *
 * A seleção é derivada, não escrita: as categorias da cozinha que os três
 * destaques não cobriram, na ordem do cardápio.
 */
const DESTACADAS = new Set(MOVEMENTS.map((movement) => movement.categoria))

const INDEXED = COZINHA.filter((c) => c.vinhos.length > 0 && !DESTACADAS.has(c.nome))

/* ========================================================================
   SEÇÃO
   ======================================================================== */

/**
 * GASTRONOMIA + HARMONIZAÇÕES.
 *
 * São duas faixas em sequência e de peles opostas. A primeira é noturna e quase
 * muda: quatro quadros de tamanhos e cortes diferentes — um sangrando pela
 * borda da tela, um em faixa cinematográfica de ponta a ponta, dois em díptico
 * desencontrado. A segunda troca para bege, a atmosfera de respiro, porque ali
 * a fotografia deixa de ser o argumento e o texto vira interface.
 *
 * O que a segunda faixa entrega é a informação mais útil do cardápio inteiro: a
 * casa declara, prato a prato, com que CATEGORIA de vinho ele harmoniza — e
 * essas categorias são as mesmas seções da carta. Cada uma delas é um link que
 * abre o explorador já filtrado. É a única ponte factual entre as duas metades
 * do cardápio, e ela é do cliente, não do algoritmo.
 *
 * Server Component: não há um só estado aqui. A interação vive dentro de
 * `Reveal`, `Trace` e `Cta`, que já são clientes por conta própria.
 */
export function Gastronomia() {
  return (
    <>
      <Section id="gastronomia" atmosphere="noturna" className={styles.overture}>
        <div className={styles.intro}>
          <div className={styles.introCopy}>
            <MonoLabel size="sm" className={styles.kicker}>
              Gastronomia
            </MonoLabel>

            <EditorialHeading as="h2" size="1" className={styles.title}>
              <span className={styles.titleLine}>Cozinha</span>
              <span className={`${styles.titleLine} ${styles.titleShift}`}>
                <span className={styles.italic}>contemporânea</span>
              </span>
            </EditorialHeading>

            {/* Os dois números que sustentam a seção seguinte, contados do
                cardápio na carga do módulo. */}
            <p className={styles.facts}>
              <MonoLabel size="xs" numeric>
                {CATEGORIA_COUNT} categorias
              </MonoLabel>
              <span className={styles.factsRule} aria-hidden="true" />
              <MonoLabel size="xs" numeric muted>
                {COM_HARMONIZACAO} com harmonização declarada
              </MonoLabel>
            </p>
          </div>

          {/* Entra pela borda direita e é cortada pela tela: o quadro parcial
              faz o olho seguir a rolagem em vez de pousar. */}
          <OvertureFrame
            photoId="c2-mar04667"
            sizes="(min-width: 900px) 33vw, 72vw"
            ratio={3 / 4}
            from="right"
            parallax={6}
            className={`${styles.introFrame} ${styles.overscan}`}
          />
        </div>

        {/* Faixa de ponta a ponta: um macro que aguenta qualquer corte, no
            único momento em que a fotografia ocupa a largura inteira. */}
        <div className={styles.bandWrap}>
          <OvertureFrame
            photoId="c2-mar04581"
            sizes="100vw"
            ratio={3 / 2}
            parallax={12}
            className={`${styles.band} ${styles.overscan}`}
          />
        </div>

        {/* Díptico desencontrado: o quadro grande sangra pela esquerda, o
            pequeno desce e cavalga a borda inferior dele. Burrata e filé ficam
            de fora de propósito — reaparecem adiante, em outro ângulo. */}
        <div className={styles.diptych}>
          <OvertureFrame
            photoId="c2-mar04759"
            sizes="(min-width: 900px) 58vw, 92vw"
            ratio={5 / 4}
            from="left"
            parallax={8}
            className={`${styles.dipMain} ${styles.overscan}`}
          />
          <OvertureFrame
            photoId="c2-mar04548"
            sizes="(min-width: 900px) 25vw, 55vw"
            ratio={2 / 3}
            motion="scale"
            className={styles.dipInset}
          />
        </div>
      </Section>

      <Section id="harmonizacoes" atmosphere="bege" className={styles.pairings}>
        <header className={styles.pairingsHead}>
          <div className={styles.headCopy}>
            <MonoLabel size="sm" className={styles.kicker}>
              Harmonizações
            </MonoLabel>
            <EditorialHeading as="h2" size="2" className={styles.title}>
              <span className={styles.titleLine}>A cozinha aponta</span>
              <span className={`${styles.titleLine} ${styles.titleShiftSm}`}>
                <span className={styles.italic}>para a carta</span>
              </span>
            </EditorialHeading>
          </div>

          <Prose size="md" className={styles.headIntro}>
            Cada prato traz a categoria de vinho que o próprio cardápio indica — e cada categoria abre a carta já
            filtrada por ela.
          </Prose>

          {/* O gesto oficial da marca ligando as duas colunas: a linha sai do
              fim do título e chega ao começo do texto. Decorativa — a conexão
              real está nos links de cada prato. */}
          <div className={styles.traceSlot} aria-hidden="true">
            <Trace
              points={[
                { x: 0, y: 0.08 },
                { x: 0.34, y: 0.68 },
                { x: 0.68, y: 0.26 },
                { x: 1, y: 0.82 },
              ]}
              viewBox={{ width: 720, height: 220 }}
              mode="scrub"
              strokeWidth={1.4}
            />
          </div>
        </header>

        <ol className={styles.movements}>
          {MOVEMENTS.map((movement, index) => {
            return (
              <li key={movement.categoria} className={styles.movement}>
                <Reveal
                  photoId={movement.photoId}
                  alt={movement.alt}
                  sizes="(min-width: 900px) 48vw, 88vw"
                  ratio={movement.ratio}
                  motion={movement.motion}
                  from={movement.from}
                  parallax={movement.parallax}
                  className={movement.parallax === 0 ? styles.frame : `${styles.frame} ${styles.overscan}`}
                />

                <div className={styles.text}>
                  <MonoLabel size="xs" numeric className={styles.index}>
                    {String(index + 1).padStart(2, '0')}
                  </MonoLabel>

                  <EditorialHeading as="h3" size="3" className={styles.dishName}>
                    {movement.categoria}
                  </EditorialHeading>

                  <div className={styles.pairing}>
                    <MonoLabel size="xs" className={styles.pairingLabel}>
                      Harmoniza com
                    </MonoLabel>

                    <ul className={styles.pairingList} aria-label={`Harmoniza com — ${movement.categoria}`}>
                      {movement.vinhos.map((pairing) => {
                        const href = pairingHref(pairing)

                        return (
                          <li key={pairing}>
                            {href ? (
                              <Link href={href} className={styles.pairingLink}>
                                <span className={styles.pairingDot} aria-hidden="true" />
                                <MonoLabel size="sm">{pairing}</MonoLabel>
                              </Link>
                            ) : (
                              <span className={styles.pairingPlain}>
                                <span className={styles.pairingDot} aria-hidden="true" />
                                <MonoLabel size="sm">{pairing}</MonoLabel>
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        {/*
          O índice: mesma informação dos destaques — categoria e harmonização —
          em uma linha cada. Sem foto de propósito: é o contraponto de ritmo
          depois de três quadros grandes, e é o que faz a seção terminar em
          meia tela em vez de mais três.
        */}
        <ol className={styles.index}>
          {INDEXED.map((categoria, position) => (
            <li key={categoria.nome} className={styles.indexRow}>
              <MonoLabel size="xs" numeric className={styles.indexNumber}>
                {String(MOVEMENTS.length + position + 1).padStart(2, '0')}
              </MonoLabel>

              <div className={styles.indexMain}>
                <h3 className={styles.indexName}>{categoria.nome}</h3>

                <ul className={styles.indexPairings} aria-label={`Harmoniza com — ${categoria.nome}`}>
                  {categoria.vinhos.map((pairing) => {
                    const href = pairingHref(pairing)
                    return (
                      <li key={pairing}>
                        {href ? (
                          <Link href={href} className={styles.indexPairing}>
                            <MonoLabel size="xs">{pairing}</MonoLabel>
                          </Link>
                        ) : (
                          <MonoLabel size="xs" muted>
                            {pairing}
                          </MonoLabel>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>

              <span className={styles.indexLeader} aria-hidden="true" />
            </li>
          ))}
        </ol>

        <div className={styles.closing}>
          <MonoLabel size="xs" muted className={styles.closingNote}>
            Os pratos e os valores de hoje, no cardápio digital
          </MonoLabel>
          <Cta href="/cardapio" size="lg">
            Conhecer a cozinha
          </Cta>
        </div>
      </Section>
    </>
  )
}
