'use client'

import { useId, useRef, useState } from 'react'
import { Section } from '@/components/primitives/Section'
import { Reveal } from '@/components/primitives/Reveal'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { useGsapOn } from '@/hooks/useGsap'
import { EVENTS_CONTACT, RESERVATION } from '@/data/site'
import { EXPERIENCES } from '@/data/photos'
import { track } from '@/lib/analytics'
import styles from './Eventos.module.css'

/**
 * EVENTOS NO WINE GARDEN.
 *
 * DECISÃO CENTRAL: não existe backend neste projeto, e um formulário que
 * responde "recebemos seu pedido!" sem enviar nada a lugar nenhum é pior que
 * não ter formulário — a pessoa vai embora achando que foi atendida.
 *
 * Então o envio é REAL, só que pelo canal que a casa de fato publica: o
 * WhatsApp de eventos do Linktree oficial. O formulário monta a mensagem já
 * redigida e abre a conversa. Quem recebe é uma pessoa, não um endpoint
 * inexistente.
 *
 * PARA PLUGAR UM BACKEND DEPOIS: troque `handleSubmit` por um `fetch` para a
 * rota de API, mantendo a validação e os estados de erro que já estão aqui. O
 * `buildMessage` continua útil como corpo do e-mail ou do payload. Nada mais
 * precisa mudar.
 */

const EVENT_TYPES = [
  'Aniversário',
  'Corporativo',
  'Confraternização',
  'Casamento ou noivado',
  'Evento privado',
  'Outro',
] as const

type FormState = {
  nome: string
  contato: string
  tipo: string
  pessoas: string
  data: string
  mensagem: string
}

const EMPTY: FormState = { nome: '', contato: '', tipo: '', pessoas: '', data: '', mensagem: '' }

/** Erros por campo. Só o que a validação encontrou — nunca todos de uma vez. */
type Errors = Partial<Record<keyof FormState, string>>

function validate(form: FormState): Errors {
  const errors: Errors = {}
  if (form.nome.trim().length < 2) errors.nome = 'Diga como podemos te chamar.'
  // Telefone ou e-mail — não exigimos formato, só que dê para responder.
  if (form.contato.trim().length < 8) {
    errors.contato = 'Deixe um telefone ou e-mail para retornarmos.'
  }
  if (!form.tipo) errors.tipo = 'Escolha o tipo de evento.'
  const pessoas = Number(form.pessoas)
  if (!form.pessoas || !Number.isFinite(pessoas) || pessoas < 1) {
    errors.pessoas = 'Informe quantas pessoas, mesmo que aproximado.'
  }
  return errors
}

/** Monta a mensagem que abre no WhatsApp já redigida. */
function buildMessage(form: FormState): string {
  const linhas = [
    'Olá! Gostaria de fazer um evento no Wine Garden.',
    '',
    `Nome: ${form.nome.trim()}`,
    `Contato: ${form.contato.trim()}`,
    `Tipo: ${form.tipo}`,
    `Pessoas: ${form.pessoas}`,
  ]
  if (form.data) {
    // O input date devolve AAAA-MM-DD; quem lê a mensagem espera DD/MM.
    const [ano, mes, dia] = form.data.split('-')
    if (ano && mes && dia) linhas.push(`Data pretendida: ${dia}/${mes}/${ano}`)
  }
  if (form.mensagem.trim()) {
    linhas.push('', form.mensagem.trim())
  }
  return linhas.join('\n')
}

export function Eventos() {
  const root = useRef<HTMLDivElement | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)
  const fieldId = useId()
  const foto = EXPERIENCES[1]

  useGsapOn(
    root,
    ({ gsap, root: el }) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.fromTo(
        el.querySelectorAll('[data-fade]'),
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.08,
          scrollTrigger: { trigger: el, start: 'top 72%', once: true },
        },
      )
    },
    [],
  )

  const update = (field: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    // Limpa o erro do campo assim que a pessoa mexe nele: manter o aviso
    // enquanto ela corrige é ruído.
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validate(form)
    setErrors(found)

    if (Object.keys(found).length > 0) {
      // Leva o foco para o primeiro campo com erro — sem isso, quem usa
      // teclado ou leitor de tela não sabe onde o formulário parou.
      const first = Object.keys(found)[0]
      document.getElementById(`${fieldId}-${first}`)?.focus()
      return
    }

    track('event_lead', { channel: 'whatsapp' })
    const url = `${EVENTS_CONTACT.whatsapp}?text=${encodeURIComponent(buildMessage(form))}`
    window.open(url, '_blank', 'noopener,noreferrer')
    setSubmitted(true)
  }

  const describedBy = (field: keyof FormState) =>
    errors[field] ? `${fieldId}-${field}-erro` : undefined

  return (
    <Section id="eventos" atmosphere="intensa" className={styles.section}>
      <div ref={root} className={styles.inner}>
        <div className={styles.aside}>
          <div data-fade>
            <MonoLabel size="xs" muted>
              Eventos
            </MonoLabel>
          </div>

          <EditorialHeading as="h2" size="2" data-fade className={styles.title}>
            Eventos no <em>Wine Garden.</em>
          </EditorialHeading>

          <div data-fade>
            <Prose size="lg">
              Aniversários, confraternizações, celebrações de empresa e jantares fechados. Conte o que você tem em
              mente e a casa monta a proposta — carta, cardápio e espaço.
            </Prose>
          </div>

          {foto ? (
            <div data-fade className={styles.photo}>
              <Reveal
                photoId={foto.id}
                alt={foto.alt}
                sizes="(min-width: 1024px) 34vw, 92vw"
                ratio={4 / 3}
                motion="mask"
                from="left"
              />
            </div>
          ) : null}

          <div data-fade className={styles.direct}>
            <MonoLabel size="xs" muted>
              Ou fale direto
            </MonoLabel>
            <a
              href={EVENTS_CONTACT.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.directLink}
              onClick={() => track('whatsapp_click', { origin: 'eventos' })}
            >
              WhatsApp {EVENTS_CONTACT.label}
            </a>
          </div>
        </div>

        <form data-fade className={styles.form} onSubmit={handleSubmit} noValidate>
          {/*
            `noValidate` desliga as bolhas nativas do navegador — elas não são
            estilizáveis, somem sozinhas e o leitor de tela nem sempre as
            anuncia. A validação abaixo é nossa, com erro persistente e
            associado ao campo por aria-describedby.
          */}
          <div className={styles.field}>
            <label htmlFor={`${fieldId}-nome`} className={styles.label}>
              Nome
            </label>
            <input
              id={`${fieldId}-nome`}
              name="nome"
              type="text"
              autoComplete="name"
              className={styles.input}
              value={form.nome}
              onChange={(e) => update('nome')(e.target.value)}
              aria-invalid={errors.nome ? true : undefined}
              aria-describedby={describedBy('nome')}
            />
            {errors.nome ? (
              <p id={`${fieldId}-nome-erro`} className={styles.error}>
                {errors.nome}
              </p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor={`${fieldId}-contato`} className={styles.label}>
              Telefone ou e-mail
            </label>
            <input
              id={`${fieldId}-contato`}
              name="contato"
              type="text"
              inputMode="text"
              autoComplete="tel"
              className={styles.input}
              value={form.contato}
              onChange={(e) => update('contato')(e.target.value)}
              aria-invalid={errors.contato ? true : undefined}
              aria-describedby={describedBy('contato')}
            />
            {errors.contato ? (
              <p id={`${fieldId}-contato-erro`} className={styles.error}>
                {errors.contato}
              </p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor={`${fieldId}-tipo`} className={styles.label}>
              Tipo de evento
            </label>
            <select
              id={`${fieldId}-tipo`}
              name="tipo"
              className={styles.input}
              value={form.tipo}
              onChange={(e) => update('tipo')(e.target.value)}
              aria-invalid={errors.tipo ? true : undefined}
              aria-describedby={describedBy('tipo')}
            >
              <option value="">Selecione</option>
              {EVENT_TYPES.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
            {errors.tipo ? (
              <p id={`${fieldId}-tipo-erro`} className={styles.error}>
                {errors.tipo}
              </p>
            ) : null}
          </div>

          <div className={styles.pair}>
            <div className={styles.field}>
              <label htmlFor={`${fieldId}-pessoas`} className={styles.label}>
                Pessoas
              </label>
              <input
                id={`${fieldId}-pessoas`}
                name="pessoas"
                type="number"
                min={1}
                max={500}
                inputMode="numeric"
                className={styles.input}
                value={form.pessoas}
                onChange={(e) => update('pessoas')(e.target.value)}
                aria-invalid={errors.pessoas ? true : undefined}
                aria-describedby={describedBy('pessoas')}
              />
              {errors.pessoas ? (
                <p id={`${fieldId}-pessoas-erro`} className={styles.error}>
                  {errors.pessoas}
                </p>
              ) : null}
            </div>

            <div className={styles.field}>
              <label htmlFor={`${fieldId}-data`} className={styles.label}>
                Data pretendida
                <span className={styles.optional}> (opcional)</span>
              </label>
              <input
                id={`${fieldId}-data`}
                name="data"
                type="date"
                className={styles.input}
                value={form.data}
                onChange={(e) => update('data')(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor={`${fieldId}-mensagem`} className={styles.label}>
              Sobre o evento
              <span className={styles.optional}> (opcional)</span>
            </label>
            <textarea
              id={`${fieldId}-mensagem`}
              name="mensagem"
              rows={4}
              className={`${styles.input} ${styles.textarea}`}
              value={form.mensagem}
              onChange={(e) => update('mensagem')(e.target.value)}
            />
          </div>

          <button type="submit" className={styles.submit}>
            Enviar pelo WhatsApp
          </button>

          {/*
            Aviso honesto sobre o que o botão faz. `aria-live` anuncia a
            confirmação sem mover o foco de quem acabou de enviar.
          */}
          <p className={styles.note} aria-live="polite">
            {submitted
              ? 'Conversa aberta no WhatsApp com a mensagem pronta. Se não abriu, use o link acima.'
              : 'O envio abre o WhatsApp da casa com a mensagem já preenchida.'}
          </p>

          <p className={styles.altCta}>
            Para uma mesa comum,{' '}
            <a
              href={RESERVATION.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('reservation_click', { origin: 'eventos' })}
            >
              reserve por aqui
            </a>
            .
          </p>
        </form>
      </div>
    </Section>
  )
}
