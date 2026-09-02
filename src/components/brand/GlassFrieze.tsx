'use client'

import Link from 'next/link'
import { useId } from 'react'
import { TACA } from '@/data/generated/taca'
import { WINES } from '@/data/generated/wines'
import { CATEGORY_SLUG } from '@/lib/wine-vocab'
import { track } from '@/lib/analytics'
import type { WineCategory } from '@/types/content'
import styles from './GlassFrieze.module.css'

/**
 * FRISO DE TAÇAS — a carta inteira em uma linha.
 *
 * O friso é elemento oficial da identidade: taças em line art sangrando na
 * borda inferior das peças (manual, p.11 e p.16). Aqui ele deixa de ser
 * ornamento e passa a dizer alguma coisa.
 *
 * CADA TAÇA É UMA CATEGORIA DA CARTA, na ordem em que o cardápio as lista — do
 * espumante ao vinho de sobremesa. E O NÍVEL DO VINHO É O NÚMERO DE RÓTULOS:
 * Tinto Médio Corpo tem 73 e transborda; Branco Amadeirado tem 4 e mal cobre o
 * fundo. O rodapé vira um gráfico da carta que só quem olha duas vezes percebe
 * ser um gráfico.
 *
 * Cada taça é um link para o explorador já filtrado por aquela categoria. O
 * ornamento passou a ter função — que é o teste que este projeto aplica a todo
 * efeito.
 */

/** Cor do líquido por categoria, dentro da paleta oficial. */
const COR: Readonly<Record<WineCategory, string>> = {
  Espumante: 'var(--bege-300)',
  'Branco Leve Fresco': 'var(--bege-300)',
  'Brancos Aromáticos': 'var(--bege)',
  'Branco Amadeirado': 'var(--bege)',
  'Rosé e Laranja': 'var(--purpura-600)',
  'Tinto Leve': 'var(--purpura)',
  'Tinto Médio Corpo': 'var(--granada)',
  'Tinto Encorpado': 'var(--uva)',
  'Vinho Sobremesa': 'var(--uva-900)',
}

/** A ordem da carta impressa, do mais leve ao mais intenso. */
const ORDEM: readonly WineCategory[] = [
  'Espumante',
  'Branco Leve Fresco',
  'Brancos Aromáticos',
  'Branco Amadeirado',
  'Rosé e Laranja',
  'Tinto Leve',
  'Tinto Médio Corpo',
  'Tinto Encorpado',
  'Vinho Sobremesa',
]

const [, , VB_W = 186, VB_H = 550] = TACA.viewBox.split(' ').map(Number)

const TACAS = (() => {
  const contagem = ORDEM.map((categoria) => ({
    categoria,
    total: WINES.filter((w) => w.category === categoria).length,
  }))
  const maximo = Math.max(...contagem.map((c) => c.total))

  return contagem.map(({ categoria, total }) => ({
    categoria,
    total,
    slug: CATEGORY_SLUG[categoria],
    cor: COR[categoria],
    /*
     * Fração do bojo preenchida.
     *
     * A escala é a RAIZ da proporção, não a proporção direta: entre 73 rótulos
     * (Tinto Médio Corpo) e 4 (Branco Amadeirado) há um fator de 18, e no
     * linear oito das nove taças apareciam vazias — o friso deixava de
     * informar e parecia defeito. A raiz comprime a diferença preservando a
     * ordem, e o piso garante que a menor categoria ainda mostre vinho.
     */
    nivel: 0.22 + Math.sqrt(total / maximo) * 0.72,
  }))
})()

export function GlassFrieze({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')

  return (
    <div className={className ? `${styles.frieze} ${className}` : styles.frieze}>
      <ul className={styles.fila}>
        {TACAS.map((taca, i) => (
          <li key={taca.categoria} className={styles.item}>
            <Link
              href={`/vinhos?categoria=${taca.slug}`}
              className={styles.taca}
              data-cursor="Explorar"
              aria-label={`${taca.categoria}: ${taca.total} rótulos na carta`}
              onClick={() => track('wine_filter', { facet: 'categoria', value: taca.slug, results: taca.total })}
            >
              <svg
                className={styles.desenho}
                viewBox={TACA.viewBox}
                fill="none"
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  {/*
                    O corte do nível. O retângulo cobre o bojo de baixo para
                    cima na fração calculada — é o que transforma o path fixo do
                    líquido num indicador de quantidade.
                  */}
                  <clipPath id={`nivel-${uid}-${i}`}>
                    {/*
                      O corte interpola dentro da CAIXA DO LÍQUIDO (medida no
                      build), não do viewBox: o líquido ocupa só uma faixa da
                      taça, e cortar sobre a altura total deixava tudo vazio em
                      qualquer nível abaixo da metade.
                    */}
                    <rect
                      x="0"
                      y={TACA.liquido.base - taca.nivel * (TACA.liquido.base - TACA.liquido.topo)}
                      width={VB_W}
                      height={VB_H}
                    />
                  </clipPath>
                </defs>

                <path d={TACA.vinho} fill={taca.cor} clipPath={`url(#nivel-${uid}-${i})`} />
                <path d={TACA.contorno} fill="currentColor" />
              </svg>

              {/* Aparece no hover e no foco — nunca só no hover, que no toque
                  nunca acontece. */}
              <span className={styles.info} aria-hidden="true">
                <span className={styles.nome}>{taca.categoria}</span>
                <span className={styles.total}>{taca.total}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
