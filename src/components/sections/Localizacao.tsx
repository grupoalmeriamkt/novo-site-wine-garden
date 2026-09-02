'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Section } from '@/components/primitives/Section'
import { EditorialHeading, MonoLabel } from '@/components/primitives/Typography'
import { Cta } from '@/components/primitives/Cta'
import { Trace } from '@/components/brand/Trace'
import { CONTACTS, LOCATION, OPENING_HOURS } from '@/data/site'
import { track } from '@/lib/analytics'
import {
  detectPlatform,
  directionsUrl,
  formatCoordinates,
  getMapsConfig,
  placeUrl,
  type MapStatus,
} from '@/lib/maps'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { RotaDescoberta } from '@/components/map/RotaDescoberta'
import styles from './Localizacao.module.css'

/**
 * O mapa vive num chunk separado e só é buscado quando alguém decide montá-lo.
 * `ssr: false` porque a Maps JavaScript API é DOM puro — não há nada para
 * renderizar no servidor, e tentar hidratá-la só geraria divergência.
 */
const MapExperience = dynamic(
  () => import('@/components/map/MapExperience').then((mod) => mod.MapExperience),
  { ssr: false },
)

/**
 * Constante de módulo, não estado: chave e Map ID são inlinados em build, então
 * o valor é idêntico no servidor e no cliente e nunca muda em tempo de
 * execução. Sem configuração, o componente do mapa jamais é sequer baixado.
 */
const MAPS_CONFIGURED = getMapsConfig() !== null

/** "Domingo a Quinta", "Sexta e Sábado" — mesma regra do rodapé. */
function formatDays(days: readonly string[]): string {
  const first = days[0]
  const last = days[days.length - 1]
  if (!first) return ''
  if (!last || days.length === 1) return first
  return days.length === 2 ? `${first} e ${last}` : `${first} a ${last}`
}

/**
 * Localização.
 *
 * Tela dividida no desktop: o mapa sangra na borda direita, de topo a base da
 * seção, e a coluna esquerda carrega endereço, rota, horário e contato. No
 * celular a ordem inverte a prioridade — endereço, botão de rota, e só então a
 * visualização, que fica simplificada e sob demanda.
 *
 * A REGRA QUE ORGANIZA TUDO AQUI: o mapa do Google é um ENFEITE CARO E
 * OPCIONAL. Ele pode não estar configurado (é o estado padrão em
 * desenvolvimento), pode falhar por rede, por cota estourada ou por chave
 * restrita ao domínio errado. Em nenhum desses casos a seção pode quebrar ou
 * parecer quebrada — então o que está SEMPRE na tela é o mapa desenhado: uma
 * estampa da marca, com o selo no ponto, anéis pontilhados de região e a
 * trajetória chegando. O mapa interativo, quando existe, dissolve por cima.
 *
 * Por isso o plano B não é uma caixa cinza com "erro ao carregar": é a peça que
 * o cliente vai ver na maior parte do tempo, e foi desenhada como tal.
 */
export function Localizacao() {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [mapStatus, setMapStatus] = useState<MapStatus>('idle')
  const isDesktop = useIsDesktop()

  /**
   * Carregamento antecipado no desktop.
   *
   * A margem generosa (600px) faz o script começar a descer enquanto a seção
   * ainda está fora da tela, para o mapa já estar pronto quando ela chegar —
   * sem nunca pesar no carregamento inicial da página. O observer se desliga
   * no primeiro cruzamento: é um gatilho, não um monitor.
   *
   * No celular o carregamento é manual (botão na estampa): meia dúzia de
   * centenas de KB numa rede móvel, para um mapa que muita gente só quer para
   * tocar em "Como chegar", é um custo que não se justifica sozinho.
   */
  useEffect(() => {
    const el = stageRef.current
    if (!el || !MAPS_CONFIGURED || !isDesktop) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        setMounted(true)
      },
      { rootMargin: '600px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [isDesktop])

  /**
   * `map_open` mede quem CHEGOU na localização, e por isso dispara com a seção
   * de fato visível — não na margem de pré-carregamento e não na prontidão do
   * script, que dependeria de haver chave configurada.
   */
  useEffect(() => {
    const el = stageRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        track('map_open', {})
      },
      { threshold: 0.35 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleDirections = useCallback(() => {
    track('directions_click', { platform: detectPlatform() })
  }, [])

  const coordinates = formatCoordinates()

  return (
    <Section id="localizacao" atmosphere="editorial" bleed className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <MonoLabel size="xs" className={styles.index}>
            07 — Localização
          </MonoLabel>
          {/* Copy oficial do manual (BRAND_COPY.arrived), com a inflexão em
              itálico na palavra que fecha a viagem. */}
          <EditorialHeading as="h2" size="2" className={styles.title}>
            Sua viagem pelo mundo <em className={styles.italic}>chegou</em>
          </EditorialHeading>
        </header>

        <div className={styles.addressBlock}>
          <MonoLabel size="xs" muted as="h3" className={styles.blockLabel}>
            Onde
          </MonoLabel>
          <address className={styles.address}>
            {LOCATION.street}
            <br />
            {LOCATION.complement}
            <br />
            {LOCATION.city} — {LOCATION.state} · {LOCATION.postalCode}
          </address>
        </div>

        <div className={styles.actions}>
          <Cta
            href={directionsUrl()}
            external
            size="lg"
            className={styles.cta}
            onClick={handleDirections}
            ariaLabel={`Como chegar ao Wine Garden — ${LOCATION.addressLine}`}
          >
            Como chegar
          </Cta>
          <Cta href={placeUrl()} external variant="line" size="lg" className={styles.cta}>
            Ver no Google Maps
          </Cta>
        </div>

        {/* ---------------------------------------------------------------
            A estampa. Sempre presente, sempre por baixo do mapa interativo.
            Decorativa do começo ao fim: tudo que ela diz (endereço, região)
            está em texto na coluna ao lado.
            --------------------------------------------------------------- */}
        <div ref={stageRef} className={styles.stage} data-map={mapStatus}>
          <div className={styles.plate} aria-hidden="true">
            <div className={styles.plateGround} />

            <div className={styles.rings}>
              <span className={styles.ring} />
              <span className={styles.ring} />
              <span className={styles.ring} />
            </div>

            {/* A trajetória chega ao selo — "linha que simboliza trajetória,
                caminho, conexão ou região" (manual, p.14). */}
            <Trace
              className={styles.trace}
              points={[
                { x: 0.02, y: 0.94 },
                { x: 0.26, y: 0.68 },
                { x: 0.44, y: 0.78 },
                { x: 0.5, y: 0.54 },
              ]}
              viewBox={{ width: 900, height: 900 }}
              mode="draw"
              strokeWidth={2}
            />

            <div className={styles.mark}>
              <img
                src="/brand/selos/logotipo-1.svg"
                alt=""
                className={styles.markSeal}
                width={96}
                height={82}
                loading="lazy"
                decoding="async"
              />
              <span className={styles.markStem} />
              <span className={styles.markDot} />
            </div>

            <div className={styles.plateMeta}>
              <MonoLabel size="xs">{LOCATION.complement}</MonoLabel>
              <MonoLabel size="xs" muted numeric>
                {coordinates}
              </MonoLabel>
            </div>
          </div>

          {mounted ? <MapExperience onStatusChange={setMapStatus} /> : null}

          {/* Carregamento sob demanda no celular. Só aparece quando há mapa
              para carregar — um botão que não pode funcionar é pior do que
              botão nenhum. */}
          {MAPS_CONFIGURED && !isDesktop && !mounted ? (
            <button type="button" className={styles.loadMap} onClick={() => setMounted(true)}>
              <MonoLabel size="xs">Carregar mapa</MonoLabel>
            </button>
          ) : null}
        </div>

        {/*
          A carta de descoberta. Escolher a origem traça a rota real até a casa
          — em pontilhado sobre o mapa quando ele existe, e sempre sobre a
          carta desenhada. É o grafismo de "trajetória" da marca aplicado a um
          dado verdadeiro, e não a um traço decorativo.
        */}
        <div className={styles.rota}>
          <RotaDescoberta />
        </div>

        <div className={styles.details}>
          <div className={styles.detailCol}>
            <MonoLabel size="xs" muted as="h3" className={styles.blockLabel}>
              Quando
            </MonoLabel>
            <dl className={styles.hours}>
              {OPENING_HOURS.map((slot) => (
                <div key={slot.opens + slot.closes} className={styles.hoursRow}>
                  <dt>{formatDays(slot.days)}</dt>
                  <dd className="u-tnum">
                    {slot.opens}—{slot.closes}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={styles.detailCol}>
            <MonoLabel size="xs" muted as="h3" className={styles.blockLabel}>
              Contato
            </MonoLabel>
            <ul className={styles.contacts}>
              {CONTACTS.map((contact) => {
                const isExternal = contact.href.startsWith('http')
                return (
                  <li key={contact.label}>
                    <a
                      href={contact.href}
                      className={styles.contactLink}
                      onClick={
                        contact.label === 'WhatsApp'
                          ? () => track('whatsapp_click', { origin: 'localizacao' })
                          : undefined
                      }
                      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      <MonoLabel size="xs" muted className={styles.contactLabel}>
                        {contact.label}
                      </MonoLabel>
                      <span className={styles.contactValue}>{contact.value}</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  )
}
