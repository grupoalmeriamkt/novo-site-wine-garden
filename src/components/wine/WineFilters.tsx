'use client'

import { useEffect, useRef, useState } from 'react'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import styles from './WineFilters.module.css'

/** As facetas, com os mesmos nomes que aparecem na URL. */
export type FacetKey = 'servico' | 'categoria' | 'pais' | 'uva' | 'corpo' | 'preco' | 'vegano'

export type FacetOption = {
  /** Valor canônico usado na URL. */
  value: string
  label: string
  /** Quantos rótulos esta opção traria, considerando os OUTROS filtros ativos. */
  count: number
  selected: boolean
}

export type FacetGroup = {
  facet: FacetKey
  legend: string
  /**
   * `single` são escolhas excludentes (serviço, faixa de preço) e viram rádio;
   * `multiple` acumulam e viram caixa de seleção. A distinção é semântica, não
   * decorativa: o leitor de tela precisa saber se marcar um desmarca o outro.
   */
  type: 'single' | 'multiple'
  options: readonly FacetOption[]
}

type WineFiltersProps = {
  id: string
  groups: readonly FacetGroup[]
  /** Quantas facetas estão ativas — alimenta o rótulo do botão e o "limpar". */
  activeCount: number
  resultCount: number
  onToggle: (facet: FacetKey, value: string) => void
  onClear: () => void
  /** Só governa a gaveta do mobile; no desktop o painel é sempre visível. */
  open: boolean
  onClose: () => void
}

/**
 * Acima deste número a lista vira parede. Países são 16 e castas passam de 30:
 * mostramos as mais frequentes e o resto entra por um "ver todas".
 */
const COLLAPSE_AFTER = 8

/**
 * Os filtros da carta.
 *
 * Duas apresentações, um único DOM. No desktop é um rail fixo que acompanha a
 * rolagem; abaixo de 1024px o MESMO painel vira uma gaveta que sobe da base.
 * Renderizar dois painéis duplicaria ids e estados de "ver todas" — então o
 * layout é responsabilidade do CSS e só os papéis de acessibilidade
 * (`dialog`/`aria-modal`) trocam por JS, porque no desktop não há modal nenhum.
 *
 * A regra que faz a exploração honesta: opção que levaria a zero resultados
 * aparece DESABILITADA com a contagem 0, nunca escondida. Sumir com a opção faz
 * o visitante achar que a carta não tem aquele país; mostrá-la apagada ensina
 * que a combinação atual é que não existe.
 */
export function WineFilters({
  id,
  groups,
  activeCount,
  resultCount,
  onToggle,
  onClear,
  open,
  onClose,
}: WineFiltersProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const titleId = `${id}-titulo`
  const isDesktop = useIsDesktop()
  const [expanded, setExpanded] = useState<Readonly<Record<string, boolean>>>({})

  /* Escape fecha, Tab fica preso e a rolagem do fundo trava — mas só enquanto a
     gaveta existe de fato, isto é, fora do desktop. No rail nada disso se
     aplica: ele é parte da página. */
  useEffect(() => {
    if (!open || isDesktop) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    // Compensar a barra de rolagem evita o salto lateral do conteúdo ao travar.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    const { overflow, paddingRight } = document.body.style
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`

    panelRef.current?.querySelector<HTMLElement>('button, input')?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
      previouslyFocused?.focus()
    }
  }, [open, isDesktop, onClose])

  return (
    <>
      {/* O véu só existe na gaveta; no desktop o CSS o remove. */}
      <div
        className={styles.scrim}
        data-open={open || undefined}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        id={id}
        ref={panelRef}
        className={styles.panel}
        data-open={open || undefined}
        role={isDesktop ? undefined : 'dialog'}
        aria-modal={isDesktop ? undefined : true}
        aria-labelledby={titleId}
      >
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            Filtrar a carta
          </h2>
          <button type="button" className={styles.close} onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className={styles.groups}>
          {groups.map((group) => {
            const isOpen = expanded[group.facet] === true
            const overflows = group.options.length > COLLAPSE_AFTER
            // Uma opção marcada nunca some no corte: senão não dá para
            // desmarcá-la sem abrir a lista inteira.
            const shown =
              !overflows || isOpen
                ? group.options
                : [
                    ...group.options.slice(0, COLLAPSE_AFTER),
                    ...group.options.slice(COLLAPSE_AFTER).filter((option) => option.selected),
                  ]

            return (
              <fieldset key={group.facet} className={styles.group}>
                <legend className={styles.legend}>{group.legend}</legend>

                <ul className={styles.options}>
                  {shown.map((option) => {
                    // Nunca desabilitar o que está marcado — seria uma armadilha
                    // sem saída para quem chegou por deep link.
                    const disabled = option.count === 0 && !option.selected
                    return (
                      <li key={option.value}>
                        <label
                          className={styles.option}
                          data-selected={option.selected || undefined}
                          data-disabled={disabled || undefined}
                        >
                          <input
                            className={styles.control}
                            type={group.type === 'single' ? 'radio' : 'checkbox'}
                            name={`${id}-${group.facet}`}
                            value={option.value}
                            checked={option.selected}
                            disabled={disabled}
                            onChange={() => onToggle(group.facet, option.value)}
                          />
                          <span className={styles.optionLabel}>{option.label}</span>
                          <span className={styles.leader} aria-hidden="true" />
                          <span className={styles.count}>
                            {option.count}
                            <span className="u-visually-hidden"> rótulos</span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>

                {overflows ? (
                  <button
                    type="button"
                    className={styles.more}
                    aria-expanded={isOpen}
                    onClick={() => setExpanded((was) => ({ ...was, [group.facet]: !isOpen }))}
                  >
                    {isOpen ? 'Ver menos' : `Ver todas (${group.options.length})`}
                  </button>
                ) : null}
              </fieldset>
            )
          })}
        </div>

        <div className={styles.foot}>
          <button type="button" className={styles.clear} onClick={onClear} disabled={activeCount === 0}>
            Limpar filtros
          </button>
          <button type="button" className={styles.apply} onClick={onClose}>
            Ver {resultCount} {resultCount === 1 ? 'rótulo' : 'rótulos'}
          </button>
        </div>
      </div>
    </>
  )
}
