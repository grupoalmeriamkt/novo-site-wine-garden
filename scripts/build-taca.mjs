/**
 * Extrai os dois paths da taça oficial (contorno + líquido) para um módulo TS.
 *
 * A taça em line art é elemento da identidade (manual, p.11) e aparece no
 * rodapé como um friso vivo: cada peça representa uma categoria da carta, e o
 * nível do vinho mostra quantos rótulos ela tem. Separar os dois paths é o que
 * permite pintar o líquido com a cor de cada categoria e cortar o nível por
 * clipPath — sem redesenhar o vetor da marca.
 *
 * Uso: node scripts/build-taca.mjs
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'public', 'brand', 'tacas', 'granada.svg')
const OUT = path.join(ROOT, 'src', 'data', 'generated', 'taca.ts')

const svg = await readFile(SRC, 'utf8')
const paths = [...svg.matchAll(/<path([^>]*)\/>/g)].map((m) => m[1])
const attr = (p, a) => (p?.match(new RegExp(`${a}="([^"]+)"`)) || [])[1]

const viewBox = (svg.match(/viewBox="([^"]+)"/) || [])[1]
const contorno = attr(paths[0], 'd')
const vinho = attr(paths[1], 'd')

if (!viewBox || !contorno || !vinho) {
  throw new Error('estrutura inesperada no SVG da taça — o pipeline de SVG mudou?')
}

/*
 * Mede a caixa REAL do path do líquido.
 *
 * Sem esta medida, o corte do nível é feito sobre o viewBox inteiro — e como o
 * líquido ocupa só uma faixa dele (y 168..266 de 550), qualquer nível abaixo
 * de ~0,5 cortava acima do líquido e a taça aparecia vazia. Medir com o
 * navegador é exato; estimar por regex nos números do path erraria, porque os
 * pontos de controle das curvas ficam fora da caixa desenhada.
 */
const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(
  `<svg viewBox="${viewBox}"><path id="liquido" d="${vinho}"/></svg>`,
)
const caixa = await page.evaluate(
  `(() => { const b = document.getElementById('liquido').getBBox();
     return { topo: b.y, base: b.y + b.height } })()`,
)
await browser.close()

const round = (n) => Math.round(n * 100) / 100

const modulo = `// GERADO POR scripts/build-taca.mjs — NÃO EDITAR À MÃO.
// Fonte: public/brand/tacas/granada.svg

export const TACA = {
  viewBox: ${JSON.stringify(viewBox)},
  /** Contorno da taça — recebe a cor por currentColor. */
  contorno: ${JSON.stringify(contorno)},
  /** O líquido no bojo, na altura cheia do desenho original. */
  vinho: ${JSON.stringify(vinho)},
  /**
   * Caixa vertical do líquido dentro do viewBox, medida no navegador.
   * O corte do nível interpola ENTRE estes dois valores — cortar sobre o
   * viewBox inteiro deixaria a taça vazia em qualquer nível baixo.
   */
  liquido: { topo: ${round(caixa.topo)}, base: ${round(caixa.base)} },
} as const
`

await writeFile(OUT, modulo, 'utf8')
console.log(`✓ src/data/generated/taca.ts · ${(modulo.length / 1024).toFixed(1)} KB`)
