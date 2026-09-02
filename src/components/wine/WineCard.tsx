'use client'

import { useId, useState } from 'react'
import type { ServingType, Wine, WineBody } from '@/types/content'
import styles from './WineCard.module.css'

/**
 * Preço em pt-BR.
 *
 * A carta hoje só traz valores inteiros, mas o formatador aceita centavos: se
 * um dia o cardápio trouxer R$ 22,50, é melhor mostrar do que arredondar em
 * silêncio. `maximumFractionDigits: 2` com mínimo 0 resolve os dois casos sem
 * poluir a coluna com ",00" em 159 linhas.
 */
const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatPrice(value: number): string {
  return BRL.format(value)
}

/**
 * Rótulos de exibição. `''` — corpo que a carta não declara — não tem entrada
 * aqui de propósito: campo ausente some da interface, nunca vira "N/A".
 */
const BODY_LABEL: Readonly<Record<Exclude<WineBody, ''>, string>> = {
  leve: 'Leve',
  medio: 'Médio',
  encorpado: 'Encorpado',
}

export const SERVING_LABEL: Readonly<Record<ServingType, string>> = {
  taca: 'Taça',
  garrafa: 'Garrafa',
}

/** Quantas castas cabem na linha de metadados antes de ela virar ruído. */
const GRAPES_INLINE = 3

type WineCardProps = {
  wine: Wine
  /**
   * Posição no resultado inteiro — a numeração do índice impresso, não a do
   * lote visível. Por isso ela não recomeça a cada "carregar mais".
   */
  position: number
  /** Chamado só na abertura: é o que vira `wine_detail` no analytics. */
  onOpen: (wineId: string) => void
}

/**
 * Um rótulo da carta.
 *
 * Não é um cartão: é uma linha de índice. Numeração mono à esquerda, nome em
 * Instrument Serif, filete embaixo, preço alinhado à direita em números
 * tabulares — a estrutura de uma carta de vinhos impressa, não de uma grade de
 * e-commerce. A descrição fica atrás de uma revelação porque 159 parágrafos
 * abertos ao mesmo tempo tornariam a carta ilegível; a linha inteira é o botão,
 * o que dá um alvo de toque de largura total.
 *
 * O `<h4>` existe para que leitores de tela naveguem rótulo a rótulo: a
 * hierarquia da página é h1 (a carta) › h2 (a lista) › h3 (a categoria) › h4
 * (o rótulo).
 */
export function WineCard({ wine, position, onOpen }: WineCardProps) {
  const [open, setOpen] = useState(false)
  const panelId = `carta-${useId().replace(/:/g, '')}`

  const body = wine.body ? BODY_LABEL[wine.body] : ''
  const inlineGrapes = wine.grapes.slice(0, GRAPES_INLINE)
  const hiddenGrapes = wine.grapes.length - inlineGrapes.length

  // Cada parte só entra se existir no cardápio oficial. O `.filter(Boolean)` é
  // a regra de conteúdo inteira: sem dado, sem linha.
  const meta = [
    wine.country,
    wine.region,
    inlineGrapes.length > 0 ? `${inlineGrapes.join(', ')}${hiddenGrapes > 0 ? ` +${hiddenGrapes}` : ''}` : '',
    body,
  ].filter(Boolean)

  const toggle = () => {
    const next = !open
    setOpen(next)
    // Fora do setState: o updater do React roda duas vezes em StrictMode e o
    // evento sairia duplicado.
    if (next) onOpen(wine.id)
  }

  return (
    <li className={styles.row} data-open={open || undefined}>
      <h4 className={styles.heading}>
        <button
          type="button"
          className={styles.trigger}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
        >
          <span className={styles.position} aria-hidden="true">
            {String(position).padStart(3, '0')}
          </span>

          <span className={styles.name}>{wine.name}</span>

          {meta.length > 0 ? (
            <span className={styles.meta}>
              {meta.map((part) => (
                <span key={part} className={styles.metaPart}>
                  {part}
                </span>
              ))}
            </span>
          ) : null}

          <span className={styles.pricing}>
            <span className={styles.amount}>{formatPrice(wine.price)}</span>
            <span className={styles.serving}>{SERVING_LABEL[wine.servingType]}</span>
          </span>

          <span className={styles.sign} aria-hidden="true" />
        </button>
      </h4>

      {/* `hidden` (e não display:none no CSS) para que o conteúdo saia também da
          árvore de acessibilidade enquanto está fechado. */}
      <div id={panelId} className={styles.panel} hidden={!open}>
        <div className={styles.panelInner}>
          {wine.description ? <p className={styles.description}>{wine.description}</p> : null}

          <dl className={styles.facts}>
            {wine.grapes.length > 0 ? (
              <>
                <dt className={styles.term}>Uvas</dt>
                <dd className={styles.def}>{wine.grapes.join(', ')}</dd>
              </>
            ) : null}
            {wine.region ? (
              <>
                <dt className={styles.term}>Região</dt>
                <dd className={styles.def}>{wine.region}</dd>
              </>
            ) : null}
            {wine.country ? (
              <>
                <dt className={styles.term}>País</dt>
                <dd className={styles.def}>{wine.country}</dd>
              </>
            ) : null}
            {body ? (
              <>
                <dt className={styles.term}>Corpo</dt>
                <dd className={styles.def}>{body}</dd>
              </>
            ) : null}
            <dt className={styles.term}>Serviço</dt>
            <dd className={styles.def}>{SERVING_LABEL[wine.servingType]}</dd>
            {wine.pairings.length > 0 ? (
              <>
                <dt className={styles.term}>Harmoniza com</dt>
                <dd className={styles.def}>{wine.pairings.join(', ')}</dd>
              </>
            ) : null}
            {/* Só aparece quando a carta traz a palavra: nada de deduzir selo. */}
            {wine.vegan ? (
              <>
                <dt className={styles.term}>Certificação</dt>
                <dd className={styles.def}>Vegano</dd>
              </>
            ) : null}
            {wine.oakAged ? (
              <>
                <dt className={styles.term}>Amadurecimento</dt>
                <dd className={styles.def}>Barrica</dd>
              </>
            ) : null}
          </dl>
        </div>
      </div>
    </li>
  )
}
