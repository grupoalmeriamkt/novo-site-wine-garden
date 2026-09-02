import { matchWines } from '@/lib/wine-match'
import type { MatchAnswers, MatchResult, Wine } from '@/types/content'

/**
 * SOMMELIER DIGITAL — arquitetura preparada, sem provedor.
 *
 * O objetivo aqui é deixar o encaixe pronto para uma camada conversacional
 * futura ("quero um vinho mais fresco, até R$ 300, para comer com peixe") sem
 * inventar endpoint nenhum agora. Enquanto `SommelierProvider` não for
 * registrado, `askSommelier` resolve tudo pelo algoritmo determinístico — o
 * site funciona por completo sem IA, que é requisito, não meta.
 *
 * Quando a integração existir, ela deve:
 *   1. receber `SommelierContext` com a carta JÁ FILTRADA (o modelo nunca
 *      inventa rótulo: ele escolhe entre os que existem);
 *   2. devolver ids de vinhos + justificativa;
 *   3. ser validada por `assertProviderResult`, que descarta qualquer id fora
 *      da carta antes de chegar à interface.
 */

export type SommelierQuery = {
  /** Pergunta em linguagem natural, quando vier da interface conversacional. */
  text?: string
  /** Respostas do fluxo guiado, quando vier do Wine Match. */
  answers?: MatchAnswers
}

export type SommelierContext = {
  /** A carta inteira. O provedor nunca deve ver nada além disto. */
  wines: readonly Wine[]
  /** Quantas recomendações devolver. */
  limit: number
}

export type SommelierAnswer = {
  results: MatchResult[]
  /** Texto de abertura. Vazio quando a resposta veio do algoritmo local. */
  preamble: string
  source: 'deterministico' | 'provedor'
  /** `true` quando a faixa de preço precisou ser alargada para haver resposta. */
  relaxedBudget: boolean
}

export type SommelierProvider = {
  name: string
  /** Deve devolver apenas ids existentes em `context.wines`. */
  recommend: (
    query: SommelierQuery,
    context: SommelierContext,
  ) => Promise<{ wineIds: string[]; reasons: Record<string, string[]>; preamble?: string }>
}

let provider: SommelierProvider | null = null

/**
 * Registra a camada de inteligência. Chamada uma vez na inicialização, quando
 * (e se) houver provedor configurado por ambiente.
 */
export function registerSommelierProvider(next: SommelierProvider | null): void {
  provider = next
}

export function hasSommelierProvider(): boolean {
  return provider !== null
}

/**
 * Descarta qualquer id que não exista na carta. É a barreira que impede um
 * modelo de alucinar um rótulo que a casa não tem — o pior erro possível aqui.
 */
function assertProviderResult(
  wineIds: readonly string[],
  reasons: Readonly<Record<string, readonly string[]>>,
  wines: readonly Wine[],
): MatchResult[] {
  const byId = new Map(wines.map((wine) => [wine.id, wine]))
  const valid: MatchResult[] = []
  for (const id of wineIds) {
    const wine = byId.get(id)
    if (!wine) continue
    valid.push({ wine, score: 0, reasons: reasons[id] ?? [] })
  }
  return valid
}

export async function askSommelier(
  query: SommelierQuery,
  context: SommelierContext,
): Promise<SommelierAnswer> {
  // Piso determinístico: sempre calculado, mesmo com provedor ativo, porque é
  // o fallback se a chamada externa falhar ou devolver lixo.
  const fallback = query.answers
    ? matchWines(query.answers, context.wines)
    : { results: [], relaxedBudget: false }

  if (!provider) {
    return {
      results: fallback.results.slice(0, context.limit),
      preamble: '',
      source: 'deterministico',
      relaxedBudget: fallback.relaxedBudget,
    }
  }

  try {
    const raw = await provider.recommend(query, context)
    const results = assertProviderResult(raw.wineIds, raw.reasons, context.wines)
    if (results.length === 0) throw new Error('provedor não devolveu rótulo válido')
    return {
      results: results.slice(0, context.limit),
      preamble: raw.preamble ?? '',
      source: 'provedor',
      relaxedBudget: false,
    }
  } catch {
    // Falha do provedor nunca deixa o visitante sem resposta.
    return {
      results: fallback.results.slice(0, context.limit),
      preamble: '',
      source: 'deterministico',
      relaxedBudget: fallback.relaxedBudget,
    }
  }
}
