/**
 * Geometria da linha pontilhada da marca.
 *
 * O manual (p.13, "Diagramação orgânica") é explícito: a linha "nunca é reta,
 * nunca geométrica" — ela sai do fim de uma palavra, curva, e chega ao começo
 * da próxima. Por isso não existe aqui nenhuma função que ligue dois pontos com
 * `L`: todo caminho passa por uma spline.
 *
 * Usamos Catmull-Rom convertida em Bézier cúbica porque ela tem a propriedade
 * que este desenho precisa: a curva PASSA pelos pontos de controle (ao
 * contrário de uma Bézier comum), então quando a linha liga o selo da França ao
 * selo da Itália, ela encosta exatamente nos dois.
 */

export type Point = { x: number; y: number }

/**
 * Converte uma sequência de pontos numa curva suave.
 *
 * @param points   pontos por onde a curva passa
 * @param tension  0 = anguloso, 1 = muito solto. 0.5 é o Catmull-Rom clássico;
 *                 usamos 0.62 por padrão para o traço ficar mais "à mão".
 * @param closed   fecha o caminho (rota circular, como no adesivo do manual)
 */
export function smoothPath(points: readonly Point[], tension = 0.62, closed = false): string {
  if (points.length === 0) return ''
  if (points.length === 1) {
    const p = points[0]!
    return `M ${round(p.x)} ${round(p.y)}`
  }
  if (points.length === 2) {
    // Dois pontos ainda assim curvam: o desvio perpendicular impede a reta que
    // o manual proíbe. A amplitude é 12% do comprimento do segmento.
    const [a, b] = points as [Point, Point]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const bow = 0.12
    const cx = (a.x + b.x) / 2 - dy * bow
    const cy = (a.y + b.y) / 2 + dx * bow
    return `M ${round(a.x)} ${round(a.y)} Q ${round(cx)} ${round(cy)} ${round(b.x)} ${round(b.y)}`
  }

  const pts = closed ? [points[points.length - 1]!, ...points, points[0]!, points[1]!] : points
  const first = pts[0]!
  let d = `M ${round(first.x)} ${round(first.y)}`

  const k = tension / 3

  for (let i = 0; i < pts.length - 1; i++) {
    // Nas pontas, o ponto ausente é espelhado para a tangente não colapsar.
    const p0 = pts[i - 1] ?? pts[i]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[i + 2] ?? p2

    const c1x = p1.x + (p2.x - p0.x) * k
    const c1y = p1.y + (p2.y - p0.y) * k
    const c2x = p2.x - (p3.x - p1.x) * k
    const c2y = p2.y - (p3.y - p1.y) * k

    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2.x)} ${round(p2.y)}`
  }

  return closed ? `${d} Z` : d
}

/**
 * Caminho em S entre dois pontos — o gesto que o manual chama de "quebra de
 * texto com linha conectando": desce do fim de uma linha e sobe até o início da
 * seguinte, sempre com barriga.
 *
 * @param sway amplitude lateral da onda, em unidades do viewBox
 */
export function sPath(from: Point, to: Point, sway = 42): string {
  const midY = (from.y + to.y) / 2
  return [
    `M ${round(from.x)} ${round(from.y)}`,
    `C ${round(from.x + sway)} ${round(from.y + (midY - from.y) * 0.6)},`,
    `${round(to.x - sway)} ${round(to.y - (to.y - midY) * 0.6)},`,
    `${round(to.x)} ${round(to.y)}`,
  ].join(' ')
}

/**
 * Arco para texto em curva — os modos "Conectando elementos" (arco ascendente)
 * e "Acompanhando a forma de um elemento de destaque" (domo) do manual.
 *
 * @param sweep 1 desenha o arco por cima (texto em domo), 0 por baixo.
 */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
  sweep: 0 | 1 = 1,
): string {
  const toXY = (deg: number): Point => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }
  const start = toXY(startDeg)
  const end = toXY(endDeg)
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0
  return `M ${round(start.x)} ${round(start.y)} A ${radius} ${radius} 0 ${large} ${sweep} ${round(end.x)} ${round(end.y)}`
}

/**
 * Converte pontos normalizados (0–1) para as coordenadas de um viewBox.
 * Os dados de país guardam posição normalizada para o mesmo conjunto servir
 * a composições de proporções diferentes entre desktop e mobile.
 */
export function toViewBox(
  points: readonly Point[],
  width: number,
  height: number,
  padding = 0,
): Point[] {
  const w = width - padding * 2
  const h = height - padding * 2
  return points.map((p) => ({ x: padding + p.x * w, y: padding + p.y * h }))
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
