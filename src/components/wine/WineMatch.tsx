'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Trace } from '@/components/brand/Trace'
import { Cta } from '@/components/primitives/Cta'
import { Section } from '@/components/primitives/Section'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { WINES } from '@/data/generated/wines'
import { BRAND_COPY, RESERVATION } from '@/data/site'
import { track } from '@/lib/analytics'
import { askSommelier, type SommelierAnswer } from '@/lib/sommelier'
import { BUDGET_LABEL, STYLE_LABEL, dishesForMatch } from '@/lib/wine-match'
import type { MatchBudget, MatchMoment, MatchStyle, MatchAnswers, MenuItem } from '@/types/content'
import styles from './WineMatch.module.css'

/**
 * WINE MATCH — quatro perguntas, uma por tela.
 *
 * Três decisões estruturam este componente:
 *
 * 1. A URL É O ESTADO. Etapa e respostas moram em `?etapa=2&momento=jantar…`.
 *    Isso resolve de uma vez o botão voltar do navegador, o recarregar a
 *    página, o link compartilhado com o resultado e o deep link — sem um único
 *    `useState` de fluxo para sair de sincronia com o histórico.
 *
 * 2. A ESCRITA É `history.pushState` NATIVO, não `router.push`. O App Router
 *    do Next intercepta os dois métodos do History e sincroniza
 *    `useSearchParams`, então a troca de etapa acontece no mesmo frame, sem
 *    ida ao servidor. Numa sequência de quatro perguntas, qualquer latência
 *    entre o toque e a próxima pergunta destrói o ritmo.
 *
 * 3. A RECOMENDAÇÃO VEM DE `askSommelier`. Hoje ela resolve pelo algoritmo
 *    determinístico de `wine-match.ts`; quando houver camada conversacional,
 *    só o provedor muda e esta interface não é tocada. As razões exibidas são
 *    as que o algoritmo escreve — factuais, derivadas do cardápio — e nunca
 *    reescritas aqui.
 */

/* --------------------------------------------------------------- vocabulário */

/** Nomes dos parâmetros em português: a URL também é interface. */
const PARAM = {
  stage: 'etapa',
  moment: 'momento',
  style: 'estilo',
  dish: 'prato',
  budget: 'faixa',
} as const

/** Valor de `prato` para "Só o vinho" — distingue "não respondeu" de
 *  "respondeu que não vai comer", que viram `dish: null` no mesmo campo. */
const DISH_NONE = 'nenhum'

const RESULT_STAGE = 'resultado'

/** Chave gravada em `history.state` para saber se a entrada atual foi
 *  empilhada por nós (ver `goBack`). */
const DEPTH_KEY = 'wineMatchDepth'

type StepId = 1 | 2 | 3 | 4
type Stage = StepId | typeof RESULT_STAGE

const MOMENT_VALUES = ['jantar', 'encontro', 'brinde', 'descobrir'] as const
const STYLE_VALUES = ['leve-fresco', 'aromatico', 'estruturado', 'intenso'] as const
const BUDGET_VALUES = ['ate-60', '60-150', '150-350', 'sem-limite'] as const

type Choice<T extends string> = {
  value: T
  title: string
  /** Explica o que a escolha faz no ranking. Não é enfeite: cada nota abaixo
   *  descreve um peso real de `scoreWine` — quem escolhe sabe o que muda. */
  note: string
}

const MOMENT_CHOICES: readonly Choice<MatchMoment>[] = [
  { value: 'jantar', title: 'Jantar', note: 'Garrafa, para acompanhar a refeição inteira.' },
  { value: 'encontro', title: 'Encontro', note: 'Em taça — dá para provar mais de um.' },
  { value: 'brinde', title: 'Brinde', note: 'Espumante primeiro, garrafa na mesa.' },
  { value: 'descobrir', title: 'Descobrir algo novo', note: 'Origens fora do eixo comum, em taça.' },
]

/**
 * Os títulos saem de `STYLE_LABEL` — a mesma palavra que o algoritmo devolve
 * na justificativa ("é exatamente o perfil aromático que você pediu"). As notas
 * listam os descritores que a carta usa e que essa escolha procura.
 */
const STYLE_CHOICES: readonly Choice<MatchStyle>[] = [
  { value: 'leve-fresco', title: STYLE_LABEL['leve-fresco'], note: 'Fresco, cítrico, mineral.' },
  { value: 'aromatico', title: STYLE_LABEL.aromatico, note: 'Aromático, floral, frutado.' },
  { value: 'estruturado', title: STYLE_LABEL.estruturado, note: 'Estruturado, tostado, cremoso.' },
  { value: 'intenso', title: STYLE_LABEL.intenso, note: 'Encorpado, especiado, tostado.' },
]

const BUDGET_CHOICES: readonly Choice<MatchBudget>[] = [
  { value: 'ate-60', title: BUDGET_LABEL['ate-60'], note: 'Quase tudo em taça.' },
  { value: '60-150', title: BUDGET_LABEL['60-150'], note: 'Taça generosa ou garrafa de entrada.' },
  { value: '150-350', title: BUDGET_LABEL['150-350'], note: 'O corpo da carta em garrafa.' },
  { value: 'sem-limite', title: BUDGET_LABEL['sem-limite'], note: 'A carta inteira, até os 1.484.' },
]

const STEPS = [
  { id: 1, param: PARAM.moment, kicker: 'Momento', question: 'Qual é o momento?' },
  { id: 2, param: PARAM.style, kicker: 'Estilo', question: 'O que você prefere?' },
  { id: 3, param: PARAM.dish, kicker: 'Cozinha', question: 'Vai comer?' },
  { id: 4, param: PARAM.budget, kicker: 'Investimento', question: 'Quanto pretende investir?' },
] as const satisfies readonly { id: StepId; param: string; kicker: string; question: string }[]

/* ------------------------------------------------------------------- pratos */

/** 26 pratos que a casa harmonizou. Calculado uma vez no módulo: é filtro puro
 *  sobre um array constante, não faz sentido repetir a cada render. */
const DISHES = dishesForMatch()
const DISH_BY_ID = new Map(DISHES.map((dish) => [dish.id, dish]))

/** Agrupados na ordem do cardápio impresso — 26 opções soltas numa tela só
 *  seriam uma lista para rolar, não uma escolha para fazer. */
const DISH_GROUPS: readonly { category: string; items: readonly MenuItem[] }[] = (() => {
  const groups = new Map<string, MenuItem[]>()
  for (const dish of DISHES) {
    const list = groups.get(dish.category)
    if (list) list.push(dish)
    else groups.set(dish.category, [dish])
  }
  return [...groups].map(([category, items]) => ({ category, items }))
})()

const deaccent = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/* ------------------------------------------------------------------ helpers */

function parseOne<T extends string>(values: readonly T[], raw: string | null): T | null {
  if (raw === null) return null
  return (values as readonly string[]).includes(raw) ? (raw as T) : null
}

type ParamBag = { get(name: string): string | null }

type Draft = {
  moment: MatchMoment | null
  style: MatchStyle | null
  /** id do prato; `null` tanto para "Só o vinho" quanto para "ainda não respondeu". */
  dish: string | null
  /** Só isto distingue os dois casos acima. */
  dishAnswered: boolean
  budget: MatchBudget | null
}

function readDraft(params: ParamBag): Draft {
  const rawDish = params.get(PARAM.dish)
  const known = rawDish !== null && DISH_BY_ID.has(rawDish)
  return {
    moment: parseOne(MOMENT_VALUES, params.get(PARAM.moment)),
    style: parseOne(STYLE_VALUES, params.get(PARAM.style)),
    dish: known ? rawDish : null,
    dishAnswered: known || rawDish === DISH_NONE,
    budget: parseOne(BUDGET_VALUES, params.get(PARAM.budget)),
  }
}

/** Primeira etapa ainda sem resposta — o teto até onde a URL pode saltar. */
function firstOpenStage(draft: Draft): Stage {
  if (draft.moment === null) return 1
  if (draft.style === null) return 2
  if (!draft.dishAnswered) return 3
  if (draft.budget === null) return 4
  return RESULT_STAGE
}

function parseStage(raw: string | null): Stage {
  if (raw === RESULT_STAGE) return RESULT_STAGE
  if (raw === '2') return 2
  if (raw === '3') return 3
  if (raw === '4') return 4
  return 1
}

const stageOrder = (stage: Stage): number => (stage === RESULT_STAGE ? 5 : stage)
const stageToParam = (stage: Stage): string => (stage === RESULT_STAGE ? RESULT_STAGE : String(stage))
const pad = (value: number) => String(value).padStart(2, '0')
const priceLabel = (value: number) => `R$ ${value.toLocaleString('pt-BR')}`
const servingLabel = (serving: 'taca' | 'garrafa') => (serving === 'taca' ? 'Taça' : 'Garrafa')

function readDepth(): number {
  const state = window.history.state as Record<string, unknown> | null
  const depth = state?.[DEPTH_KEY]
  return typeof depth === 'number' ? depth : 0
}

/* --------------------------------------------------------------- componente */

export function WineMatch() {
  // useSearchParams força renderização no cliente; sem a fronteira de Suspense
  // a rota inteira deixaria de ser pré-renderizada estaticamente.
  return (
    <Suspense fallback={<MatchShell />}>
      <MatchFlow />
    </Suspense>
  )
}

/** Casca do palco: mesma altura e mesma pele do fluxo, para a hidratação não
 *  provocar salto de layout. */
function MatchShell() {
  return (
    <Section atmosphere="intensa" bleed className={styles.root}>
      <div className={styles.stage}>
        <div className={styles.bar}>
          <MonoLabel as="h1" size="xs" className={styles.brand}>
            Wine Match
          </MonoLabel>
        </div>
        <p className={styles.loading} role="status">
          <MonoLabel size="xs" muted>
            Abrindo a carta…
          </MonoLabel>
        </p>
      </div>
    </Section>
  )
}

function MatchFlow() {
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const draft = readDraft(searchParams)
  const requested = parseStage(searchParams.get(PARAM.stage))
  const open = firstOpenStage(draft)
  // Um link para `?etapa=4` sem as respostas anteriores volta para onde a
  // conversa realmente está — nunca mostra uma pergunta órfã.
  const stage: Stage = stageOrder(requested) <= stageOrder(open) ? requested : open

  const stageRef = useRef<HTMLDivElement | null>(null)
  const groupRef = useRef<HTMLDivElement | null>(null)
  const startedRef = useRef(false)
  const completedRef = useRef<string>('')
  const lastStageRef = useRef<Stage | null>(null)
  const [query, setQuery] = useState('')

  /* ------------------------------------------------------------ navegação */

  const commit = useCallback(
    (params: URLSearchParams, mode: 'push' | 'replace') => {
      const url = `${pathname}?${params.toString()}`
      const depth = readDepth()
      // O objeto de estado é nosso: passar o `history.state` do Next de volta
      // faria o patch dele tratar a chamada como interna e não atualizar
      // `useSearchParams` — a tela travaria na etapa anterior.
      if (mode === 'push') window.history.pushState({ [DEPTH_KEY]: depth + 1 }, '', url)
      else window.history.replaceState({ [DEPTH_KEY]: depth }, '', url)
    },
    [pathname],
  )

  const choose = useCallback(
    (step: StepId, param: string, value: string) => {
      track('wine_match_step', { step, answer: value })
      const params = new URLSearchParams(searchParams.toString())
      params.set(param, value)
      // Vai para a próxima etapa ainda em aberto. No caminho normal isso é
      // simplesmente "a seguinte"; para quem voltou só para trocar uma resposta,
      // é o atalho de volta ao resultado, sem refazer o que já respondeu.
      const next = firstOpenStage(readDraft(params))
      params.set(PARAM.stage, stageToParam(next))
      commit(params, 'push')
    },
    [commit, searchParams],
  )

  const goTo = useCallback(
    (target: Stage) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(PARAM.stage, stageToParam(target))
      commit(params, 'push')
    },
    [commit, searchParams],
  )

  const goBack = useCallback(() => {
    if (stage === 1) return
    // Se esta entrada foi empilhada por nós, `back()` é o gesto honesto: desfaz
    // exatamente o que o visitante fez e devolve o botão voltar ao normal.
    // Num deep link (profundidade 0) não há para onde voltar — aí trocamos a
    // entrada atual em vez de mandar o visitante para fora do site.
    if (readDepth() > 0) {
      window.history.back()
      return
    }
    const previous: Stage = stage === RESULT_STAGE ? 4 : ((stage - 1) as StepId)
    const params = new URLSearchParams(searchParams.toString())
    params.set(PARAM.stage, stageToParam(previous))
    commit(params, 'replace')
  }, [commit, searchParams, stage])

  const restart = useCallback(() => {
    track('wine_match_start', {})
    setQuery('')
    // Empilha em vez de substituir: quem clicou em "refazer" por engano volta
    // ao resultado com um toque no botão do navegador.
    window.history.pushState({ [DEPTH_KEY]: readDepth() + 1 }, '', pathname)
  }, [pathname])

  /* -------------------------------------------------------------- efeitos */

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    track('wine_match_start', {})
  }, [])

  // A URL pedida e a etapa possível divergem em deep link e em "refazer":
  // alinhar por replace mantém o endereço verdadeiro sem sujar o histórico.
  useEffect(() => {
    if (stage === requested) return
    const params = new URLSearchParams(searchParams.toString())
    params.set(PARAM.stage, stageToParam(stage))
    commit(params, 'replace')
  }, [commit, requested, searchParams, stage])

  // Cada etapa entrega o foco ao grupo de opções: o leitor de tela anuncia a
  // pergunta (que rotula o grupo) e as setas já funcionam sem um Tab antes.
  // Na primeira renderização não mexemos no foco — roubar o foco de quem
  // acabou de chegar à página é hostil.
  useEffect(() => {
    // Comparar a etapa anterior (e não um "é a primeira renderização") mantém o
    // efeito idempotente: no StrictMode, que roda os efeitos duas vezes, um
    // sinalizador booleano roubaria o foco de quem acabou de chegar.
    const previous = lastStageRef.current
    lastStageRef.current = stage
    if (previous === null || previous === stage) return
    groupRef.current?.focus({ preventScroll: true })
  }, [stage])

  /*
   * Teclado do fluxo, num só ouvinte na janela.
   *
   * Escutar na janela e não no grupo é o que faz as setas funcionarem já na
   * primeira pergunta: ao chegar na página ninguém tem o foco (roubá-lo seria
   * hostil), e um ouvinte preso ao grupo nunca receberia a primeira tecla.
   *
   * O guarda `dentroDoFluxo` impede que este atalho sequestre setas de outro
   * componente da página — o menu do header, por exemplo. Campo de texto
   * também fica de fora: lá as setas movem o cursor e Backspace apaga.
   */
  useEffect(() => {
    const NAVIGATION = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End']

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key !== 'Backspace' && !NAVIGATION.includes(event.key)) return

      const active = document.activeElement as HTMLElement | null
      const inside = active === null || active === document.body || stageRef.current?.contains(active) === true
      if (!inside) return

      const tag = active?.tagName
      const typing = active?.isContentEditable === true || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (typing) return

      if (event.key === 'Backspace') {
        event.preventDefault()
        goBack()
        return
      }

      const group = groupRef.current
      if (!group) return
      const items = Array.from(group.querySelectorAll<HTMLButtonElement>('[data-option]'))
      if (items.length === 0) return

      const current = items.indexOf(active as HTMLButtonElement)
      let next: number
      if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = items.length - 1
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = current <= 0 ? items.length - 1 : current - 1
      else next = current === -1 || current === items.length - 1 ? 0 : current + 1

      // Enter e Espaço não precisam de tratamento: as opções são <button> de
      // verdade e o navegador já os aciona.
      event.preventDefault()
      items[next]?.focus()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goBack])

  const answers = useMemo<MatchAnswers | null>(() => {
    if (draft.moment === null || draft.style === null || draft.budget === null) return null
    if (!draft.dishAnswered) return null
    return { moment: draft.moment, style: draft.style, dish: draft.dish, budget: draft.budget }
  }, [draft.moment, draft.style, draft.budget, draft.dish, draft.dishAnswered])

  /**
   * Identidade do pedido em curso. `null` enquanto faltar resposta ou enquanto
   * não estivermos na tela de resultado.
   */
  const requestKey = useMemo(() => {
    if (answers === null || stage !== RESULT_STAGE) return null
    return `${answers.moment}|${answers.style}|${answers.dish ?? DISH_NONE}|${answers.budget}`
  }, [answers, stage])

  /*
   * A resposta guarda a chave do pedido que a originou. Assim ela se invalida
   * sozinha quando o visitante volta uma etapa ou troca uma escolha — em vez de
   * um efeito precisar chamar setAnswer(null) para limpar, o que rerenderiza a
   * árvore só para apagar algo que já não deveria ser lido.
   */
  const [answerFor, setAnswerFor] = useState<{ key: string; value: SommelierAnswer } | null>(null)
  const answer = answerFor && answerFor.key === requestKey ? answerFor.value : null

  useEffect(() => {
    if (requestKey === null || answers === null) return
    let alive = true
    void askSommelier({ answers }, { wines: WINES, limit: 4 }).then((next) => {
      if (!alive) return
      setAnswerFor({ key: requestKey, value: next })
      // Uma conclusão por combinação de respostas: voltar e avançar de novo na
      // mesma escolha não é um novo match.
      if (completedRef.current === requestKey) return
      completedRef.current = requestKey
      track('wine_match_complete', {
        results: next.results.length,
        topWineId: next.results[0]?.wine.id ?? '',
      })
    })
    return () => {
      alive = false
    }
  }, [answers, requestKey])

  /* ------------------------------------------------------------- conteúdo */

  const step = stage === RESULT_STAGE ? null : STEPS.find((entry) => entry.id === stage)

  const dishMatches = useMemo(() => {
    const term = deaccent(query.trim())
    if (!term) return DISH_GROUPS
    return DISH_GROUPS.map((group) => ({
      category: group.category,
      items: group.items.filter((item) => deaccent(`${item.name} ${item.category}`).includes(term)),
    })).filter((group) => group.items.length > 0)
  }, [query])

  const dishMatchCount = dishMatches.reduce((total, group) => total + group.items.length, 0)
  const chosenDish = draft.dish !== null ? DISH_BY_ID.get(draft.dish) : undefined

  return (
    <Section atmosphere="intensa" bleed className={styles.root}>
      <div ref={stageRef} className={styles.stage}>
        {/* -------------------------------------------------------- topo */}
        <div className={styles.bar}>
          <MonoLabel as="h1" size="xs" className={styles.brand}>
            Wine Match
          </MonoLabel>

          <ol className={styles.rail} aria-hidden="true">
            {STEPS.map((entry) => (
              <li
                key={entry.id}
                className={styles.railStep}
                data-state={
                  stage === RESULT_STAGE || entry.id < stageOrder(stage)
                    ? 'done'
                    : entry.id === stage
                      ? 'current'
                      : 'todo'
                }
              />
            ))}
          </ol>

          <p className={styles.count}>
            <span className="u-visually-hidden">
              {stage === RESULT_STAGE ? 'Resultado do Wine Match' : `Etapa ${stage} de 4`}
            </span>
            <span aria-hidden="true">
              <MonoLabel size="xs" numeric muted>
                {stage === RESULT_STAGE ? 'Resultado' : `${pad(stage)} / 04`}
              </MonoLabel>
            </span>
          </p>
        </div>

        {/* ---------------------------------------------------- perguntas */}
        {step ? (
          <div key={step.id} className={styles.body}>
            <div className={styles.questionCol}>
              <MonoLabel size="xs" muted className={styles.kicker}>
                {step.kicker}
              </MonoLabel>
              <EditorialHeading as="h2" id="wm-question" size="1" className={styles.question}>
                {step.question}
              </EditorialHeading>

              {/* O traço da marca liga a pergunta às escolhas: trajetória, não
                  ornamento. Estático porque o palco já nasce visível — uma
                  revelação por scroll aqui nunca dispararia. */}
              <div className={styles.traceSlot} aria-hidden="true">
                <Trace
                  points={[
                    { x: 0.02, y: 0.1 },
                    { x: 0.34, y: 0.72 },
                    { x: 0.68, y: 0.28 },
                    { x: 0.98, y: 0.84 },
                  ]}
                  viewBox={{ width: 620, height: 180 }}
                  mode="static"
                  strokeWidth={1.4}
                />
              </div>
            </div>

            <div className={styles.optionsCol}>
              {step.id === 3 ? (
                <>
                  <div className={styles.dishTools}>
                    <label className={styles.searchField}>
                      <span className="u-visually-hidden">Buscar prato pelo nome</span>
                      <input
                        type="search"
                        className={styles.search}
                        value={query}
                        placeholder="Buscar prato"
                        autoComplete="off"
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                          // Seta para baixo e Enter entregam a lista: digitar e
                          // escolher sem tirar a mão do teclado.
                          if (event.key !== 'ArrowDown' && event.key !== 'Enter') return
                          event.preventDefault()
                          groupRef.current?.querySelector<HTMLButtonElement>('[data-option]')?.focus()
                        }}
                      />
                    </label>
                    <MonoLabel size="xs" muted numeric className={styles.dishCount}>
                      {pad(dishMatchCount)} pratos
                    </MonoLabel>
                  </div>

                  <div
                    ref={groupRef}
                    role="group"
                    aria-labelledby="wm-question"
                    tabIndex={-1}
                    className={`${styles.options} ${styles.dishScroller}`}
                  >
                    <button
                      type="button"
                      data-option
                      className={`${styles.option} ${styles.optionSolo}`}
                      style={{ '--i': 0 } as React.CSSProperties}
                      aria-current={draft.dishAnswered && draft.dish === null ? 'true' : undefined}
                      onClick={() => choose(3, PARAM.dish, DISH_NONE)}
                    >
                      <span className={styles.optionTitle}>Só o vinho</span>
                      <span className={styles.optionNote}>
                        Sem prato: a escolha olha só para o momento, o estilo e a faixa.
                      </span>
                    </button>

                    {dishMatches.map((group) => (
                      <div key={group.category} className={styles.dishGroup}>
                        <MonoLabel as="h3" size="xs" muted className={styles.dishGroupTitle}>
                          {group.category}
                        </MonoLabel>
                        {group.items.map((item, index) => (
                          <button
                            key={item.id}
                            type="button"
                            data-option
                            className={`${styles.option} ${styles.dishRow}`}
                            style={{ '--i': Math.min(index + 1, 6) } as React.CSSProperties}
                            aria-current={draft.dish === item.id ? 'true' : undefined}
                            onClick={() => choose(3, PARAM.dish, item.id)}
                          >
                            <span className={styles.dishName}>{item.name}</span>
                            <span className={styles.dishPrice}>{priceLabel(item.price)}</span>
                          </button>
                        ))}
                      </div>
                    ))}

                    {dishMatchCount === 0 ? (
                      <p className={styles.empty}>
                        <MonoLabel size="xs" muted>
                          Nenhum prato com esse nome. Limpe a busca ou siga só com o vinho.
                        </MonoLabel>
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <div
                  ref={groupRef}
                  role="group"
                  aria-labelledby="wm-question"
                  tabIndex={-1}
                  className={styles.options}
                >
                  {(step.id === 1 ? MOMENT_CHOICES : step.id === 2 ? STYLE_CHOICES : BUDGET_CHOICES).map(
                    (choice, index) => {
                      const selected =
                        (step.id === 1 && draft.moment === choice.value) ||
                        (step.id === 2 && draft.style === choice.value) ||
                        (step.id === 4 && draft.budget === choice.value)
                      return (
                        <button
                          key={choice.value}
                          type="button"
                          data-option
                          className={styles.option}
                          style={{ '--i': index } as React.CSSProperties}
                          aria-current={selected ? 'true' : undefined}
                          onClick={() => choose(step.id, step.param, choice.value)}
                        >
                          <span className={styles.optionIndex} aria-hidden="true">
                            {pad(index + 1)}
                          </span>
                          <span className={styles.optionTitle}>{choice.title}</span>
                          <span className={styles.optionNote}>{choice.note}</span>
                        </button>
                      )
                    },
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <MatchResults
            answer={answer}
            draft={draft}
            dishName={chosenDish?.name ?? null}
            onEdit={goTo}
            onRestart={restart}
          />
        )}

        {/* ------------------------------------------------------- rodapé */}
        <div className={styles.footerBar}>
          {stage !== 1 ? (
            <button type="button" className={styles.back} onClick={goBack}>
              <span aria-hidden="true">←</span>
              <MonoLabel size="xs">Voltar</MonoLabel>
            </button>
          ) : (
            <span />
          )}

          <p className={styles.hint} aria-hidden="true">
            <MonoLabel size="xs" muted>
              Setas navegam · Enter escolhe · Backspace volta
            </MonoLabel>
          </p>
        </div>
      </div>
    </Section>
  )
}

/* ---------------------------------------------------------------- resultado */

type ResultsProps = {
  answer: SommelierAnswer | null
  draft: Draft
  dishName: string | null
  onEdit: (stage: Stage) => void
  onRestart: () => void
}

function MatchResults({ answer, draft, dishName, onEdit, onRestart }: ResultsProps) {
  const chips: readonly { label: string; stage: StepId }[] = [
    { label: MOMENT_CHOICES.find((c) => c.value === draft.moment)?.title ?? '', stage: 1 },
    { label: draft.style !== null ? STYLE_LABEL[draft.style] : '', stage: 2 },
    { label: dishName ?? 'Só o vinho', stage: 3 },
    { label: draft.budget !== null ? BUDGET_LABEL[draft.budget] : '', stage: 4 },
  ]

  if (answer === null) {
    return (
      <div className={styles.body}>
        <p className={styles.loading} role="status">
          <MonoLabel size="xs" muted>
            Lendo os {WINES.length} rótulos da carta…
          </MonoLabel>
        </p>
      </div>
    )
  }

  return (
    <div className={styles.result}>
      <div className={styles.resultHead}>
        <MonoLabel size="xs" muted className={styles.kicker}>
          {answer.results.length === 1 ? 'Uma escolha' : `${pad(answer.results.length)} escolhas`}
        </MonoLabel>
        <EditorialHeading as="h2" size="2" italic className={styles.resultTitle}>
          {BRAND_COPY.bestGlass}
        </EditorialHeading>

        <ul className={styles.chips}>
          {chips.map((chip) => (
            <li key={chip.stage}>
              <button type="button" className={styles.chip} onClick={() => onEdit(chip.stage)}>
                <span className="u-visually-hidden">Alterar resposta: </span>
                {chip.label}
              </button>
            </li>
          ))}
        </ul>

        {answer.preamble ? <Prose className={styles.preamble}>{answer.preamble}</Prose> : null}

        {/* Alargar a faixa é uma decisão do algoritmo que muda o preço do que
            está na tela. Esconder isso seria enganar quem definiu um teto. */}
        {answer.relaxedBudget ? (
          <p className={styles.notice}>
            <MonoLabel size="xs">Faixa alargada</MonoLabel>
            <span className={styles.noticeText}>
              A carta tem poucos rótulos {draft.budget !== null ? BUDGET_LABEL[draft.budget] : ''} — para ter o que
              recomendar, olhamos além dessa faixa. Confira os preços abaixo.
            </span>
          </p>
        ) : null}
      </div>

      <ol className={styles.results}>
        {answer.results.map((result, index) => (
          <li key={result.wine.id} className={styles.resultItem} style={{ '--i': index } as React.CSSProperties}>
            <Link
              href={`/vinhos?busca=${encodeURIComponent(result.wine.name)}`}
              className={`${styles.card} ${index === 0 ? styles.cardTop : ''}`}
            >
              <span className={styles.cardIndex} aria-hidden="true">
                {pad(index + 1)}
              </span>

              <span className={styles.cardMain}>
                <span className={styles.cardName}>{result.wine.name}</span>
                <span className={styles.cardMeta}>
                  {[
                    result.wine.category,
                    result.wine.country,
                    result.wine.region,
                    servingLabel(result.wine.servingType),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className={styles.reasons}>
                  {result.reasons.map((reason) => (
                    <span key={reason} className={styles.reason}>
                      {reason}
                    </span>
                  ))}
                </span>
              </span>

              <span className={styles.cardPrice}>{priceLabel(result.wine.price)}</span>
            </Link>
          </li>
        ))}
      </ol>

      <div className={styles.actions}>
        <button type="button" className={styles.restart} onClick={onRestart}>
          <MonoLabel size="xs">Refazer</MonoLabel>
        </button>
        <Cta
          href={RESERVATION.url}
          external
          variant="solid"
          size="lg"
          onClick={() => track('reservation_click', { origin: 'wine-match' })}
        >
          Reservar mesa
        </Cta>
        <Cta href="/vinhos" variant="line" size="lg">
          Ver a carta inteira
        </Cta>
      </div>
    </div>
  )
}
