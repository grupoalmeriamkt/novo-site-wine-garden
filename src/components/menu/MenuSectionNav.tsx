'use client'

import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import styles from './MenuSectionNav.module.css'

export type MenuNavCategory = {
  /** Slug estável — é o que viaja na URL (`?categoria=principais`). */
  slug: string
  /** id do bloco correspondente na lista, para a âncora funcionar sem JS. */
  anchorId: string
  label: string
  count: number
  /** Primeira categoria de uma seção do cardápio (cozinha, drinks, bebidas). */
  sectionStart: boolean
}

type MenuSectionNavProps = {
  categories: readonly MenuNavCategory[]
  activeSlug: string | null
  onSelect: (slug: string) => void
  /** Devolve o visitante ao campo de busca, que já saiu de vista no scroll. */
  onSearchRequest: () => void
  searchActive: boolean
}

/**
 * Barra de categorias.
 *
 * É o único elemento persistente da página no celular, então carrega o mínimo:
 * um alvo para voltar à busca e a régua de categorias. Nada de contador de
 * filtros, nada de logotipo repetido — quem está aqui já sabe onde está.
 *
 * Três decisões que valem a pena registrar:
 *
 * 1. Os chips são âncoras de verdade (`href="#menu-tapas"`). Sem JS, o clique
 *    ainda pula para o bloco certo; com JS, o `preventDefault` evita gravar um
 *    `#hash` na URL e deixa o pai decidir como navegar e o que registrar.
 * 2. A rolagem horizontal centraliza o chip ativo mexendo em `scrollLeft` do
 *    próprio contêiner, e não com `scrollIntoView` — que arrastaria a PÁGINA
 *    junto e brigaria com o scroll vertical que acabou de mudar a categoria.
 * 3. `overscroll-behavior-inline: contain` (no CSS) impede que o arrasto
 *    lateral vire "voltar" do navegador no iOS/Android quando a régua chega ao
 *    fim — o erro clássico de barra rolável no mobile.
 */
export function MenuSectionNav({
  categories,
  activeSlug,
  onSelect,
  onSearchRequest,
  searchActive,
}: MenuSectionNavProps) {
  const scrollerRef = useRef<HTMLUListElement | null>(null)
  const reduced = usePrefersReducedMotion()

  /* O chip ativo tem de estar visível: se a categoria muda por scroll da
     página, a régua acompanha sozinha. O ajuste é ignorado quando o chip já
     está praticamente no lugar, para não brigar com um arrasto em curso. */
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || !activeSlug) return

    const chip = scroller.querySelector<HTMLElement>(`[data-slug="${CSS.escape(activeSlug)}"]`)
    if (!chip) return

    const centered = chip.offsetLeft - (scroller.clientWidth - chip.offsetWidth) / 2
    const max = scroller.scrollWidth - scroller.clientWidth
    const left = Math.max(0, Math.min(centered, max))
    if (Math.abs(left - scroller.scrollLeft) < 8) return

    scroller.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' })
  }, [activeSlug, reduced])

  return (
    <nav className={styles.nav} aria-label="Categorias do cardápio">
      <div className={styles.inner}>
        <button
          type="button"
          className={styles.search}
          data-active={searchActive || undefined}
          onClick={onSearchRequest}
          aria-label={searchActive ? 'Voltar para a busca no cardápio' : 'Buscar no cardápio'}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
            <circle cx="9" cy="9" r="5.4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M13.1 13.1 17 17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>

        <ul className={styles.scroller} ref={scrollerRef}>
          {categories.map((category) => (
            <li key={category.slug} className={styles.item} data-section-start={category.sectionStart || undefined}>
              <a
                href={`#${category.anchorId}`}
                data-slug={category.slug}
                className={styles.chip}
                // aria-current marca a posição atual dentro de um conjunto de
                // links — é o que o leitor de tela anuncia como "atual".
                aria-current={category.slug === activeSlug ? 'true' : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  onSelect(category.slug)
                }}
              >
                <span className={styles.label}>{category.label}</span>
                <span className={styles.count}>{category.count}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
