'use client'

import { useId, useState } from 'react'
import { Section } from '@/components/primitives/Section'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { FAQ } from '@/data/faq'
import styles from './Perguntas.module.css'

/**
 * PERGUNTAS FREQUENTES.
 *
 * A seção existe por dois motivos, e o segundo é o que define sua forma.
 *
 * O primeiro é o visitante: são as dúvidas que chegam por WhatsApp todo dia —
 * onde fica, que horas abre, precisa reservar, tem vinho em taça.
 *
 * O segundo é a busca. Motores generativos citam quem responde a pergunta em
 * texto direto, e o Google exige que todo dado estruturado esteja VISÍVEL na
 * página: um `FAQPage` no JSON-LD sem o texto correspondente na tela é
 * conteúdo oculto, e é motivo de perder o rich result. Por isso as respostas
 * ficam aqui inteiras, e o JSON-LD é gerado do mesmo arquivo — nunca podem
 * divergir.
 *
 * TODA RESPOSTA ABERTA POR PADRÃO NO HTML. O `<details>` nativo entrega o
 * conteúdo ao rastreador esteja ele aberto ou fechado, e dá busca na página
 * (Ctrl+F) de graça — coisa que um acordeão em JavaScript costuma quebrar.
 */
export function Perguntas() {
  const uid = useId().replace(/:/g, '')
  const [aberta, setAberta] = useState<string | null>(FAQ[0]?.id ?? null)

  return (
    <Section id="perguntas" atmosphere="editorial" className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <MonoLabel size="xs" muted>
            Perguntas frequentes
          </MonoLabel>
          <EditorialHeading as="h2" size="2" className={styles.title}>
            O que costumam <em className={styles.italic}>perguntar</em>
          </EditorialHeading>
          <Prose muted className={styles.lead}>
            As dúvidas que chegam todo dia, respondidas com o que a casa de fato tem — carta, cardápio,
            horário e endereço.
          </Prose>
        </header>

        <div className={styles.lista}>
          {FAQ.map((item, i) => {
            const estaAberta = aberta === item.id
            return (
              <details
                key={item.id}
                id={`pergunta-${item.id}`}
                className={styles.item}
                open={estaAberta}
                onToggle={(e) => {
                  // Acordeão de uma aberta por vez, sem impedir que o
                  // visitante feche a que está lendo.
                  const alvo = e.currentTarget
                  if (alvo.open) setAberta(item.id)
                  else if (estaAberta) setAberta(null)
                }}
              >
                <summary className={styles.pergunta}>
                  <MonoLabel size="xs" numeric className={styles.numero}>
                    {String(i + 1).padStart(2, '0')}
                  </MonoLabel>
                  <span className={styles.texto}>{item.pergunta}</span>
                  <span className={styles.sinal} aria-hidden="true" />
                </summary>
                <div className={styles.resposta} id={`${uid}-${item.id}`}>
                  <Prose size="md">{item.resposta}</Prose>
                </div>
              </details>
            )
          })}
        </div>
      </div>
    </Section>
  )
}
