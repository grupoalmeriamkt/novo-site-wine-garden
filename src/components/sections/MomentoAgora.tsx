'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MonoLabel } from '@/components/primitives/Typography'
import { OPENING_HOURS } from '@/data/site'
import { useRelogioBrasilia } from '@/hooks/useRelogioBrasilia'
import { track } from '@/lib/analytics'
import type { Momento } from '@/lib/momento'
import styles from './MomentoAgora.module.css'

/**
 * O MOMENTO — data, hora, céu e o que a casa serviria agora.
 *
 * Substitui o rótulo estático "Hoje 12:00—00:00" por uma leitura viva do
 * instante: a data por extenso, a hora de BRASÍLIA (não a do visitante), o
 * estado do tempo vindo da Weather API do Google, e uma sugestão real do
 * cardápio escolhida por regra — chuva à noite pede Filé au Poivre, 30° com sol
 * pede branco gelado em taça, última hora pede uma taça em vez de garrafa.
 *
 * PROGRESSIVE ENHANCEMENT. O servidor renderiza o horário de funcionamento,
 * exatamente como antes: é informação verdadeira, não depende de nada e não
 * causa mismatch de hidratação. Quando `/api/momento` responde, a linha se
 * enriquece. Se a API não responder — sem chave, sem rede, cota estourada — o
 * herói fica igual ao que já era, e ninguém percebe falta.
 *
 * O relógio anda sozinho, por um store externo (useRelogioBrasilia), sem novo
 * pedido à API a cada minuto.
 */
export function MomentoAgora() {
  const [momento, setMomento] = useState<Momento | null>(null)

  /*
   * O relógio anda sozinho, sem novo pedido à API a cada minuto — e sem
   * `setState` dentro de efeito, que dispararia renderização em cascata. A hora
   * é sempre a de Brasília, mesmo que o visitante esteja em outro fuso: é o
   * relógio da CASA que importa para saber se ela está aberta.
   */
  const horaLocal = useRelogioBrasilia()

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/momento', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: Momento | null) => {
        if (dados) setMomento(dados)
      })
      .catch(() => {
        // Silêncio proposital: a linha estática continua no ar.
      })

    return () => controller.abort()
  }, [])

  /* Estado inicial e de falha: o horário de funcionamento, como sempre foi. */
  if (!momento) {
    const hoje = OPENING_HOURS[0]
    return (
      <div className={styles.momento}>
        <MonoLabel size="xs" className={styles.chave}>
          Hoje
        </MonoLabel>
        <MonoLabel size="xs" muted numeric>
          {hoje.opens}—{hoje.closes}
        </MonoLabel>
      </div>
    )
  }

  const { relogio, ambiente, sugestao } = momento

  return (
    <div className={styles.momento}>
      {/* Linha 1: estado da casa + céu. `aria-live` anuncia a troca de aberto
          para fechado sem roubar o foco de quem estiver navegando. */}
      <p className={styles.linhaTopo} aria-live="polite">
        <span className={relogio.aberto ? styles.aberto : styles.fechado}>
          <span className={styles.ponto} aria-hidden="true" />
          {relogio.aberto ? 'Aberto agora' : 'Fechado'}
        </span>
        <span className={styles.separador} aria-hidden="true" />
        <span className={styles.ambiente}>{ambiente}</span>
      </p>

      {/* Linha 2: data e hora de Brasília. <time> dá semântica de data real. */}
      <p className={styles.linhaData}>
        <time dateTime={relogio.iso} className={styles.data}>
          {relogio.dataExtenso}
        </time>
        <span className={styles.separador} aria-hidden="true" />
        <span className={styles.hora}>
          {horaLocal || relogio.hora}
          {/* O fuso é dito porque a hora NÃO é a do visitante. */}
          <span className={styles.fuso}> Brasília</span>
        </span>
      </p>

      {/* Linha 3: a sugestão. Some inteira quando nenhuma regra casa — melhor
          um vão do que uma recomendação genérica. */}
      {sugestao ? (
        <Link
          href={sugestao.href}
          className={styles.sugestao}
          data-cursor="Ver"
          /*
           * Sem prefetch. O destino muda a cada hora (a sugestão é do
           * momento) e aponta para /cardapio, que é rota dinâmica: o prefetch
           * RSC dela fica pendurado e a página nunca atinge `networkidle`.
           * É um link secundário — não vale segurar o carregamento por ele.
           */
          prefetch={false}
          onClick={() =>
            track('menu_open', { category: sugestao.tipo === 'vinho' ? 'vinhos' : 'cardapio' })
          }
        >
          <span className={styles.motivo}>{sugestao.motivo}</span>
          <span className={styles.item}>
            <span className={styles.nome}>{sugestao.nome}</span>
            <span className={styles.preco}>
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 0,
              }).format(sugestao.preco)}
            </span>
          </span>
        </Link>
      ) : null}
    </div>
  )
}
