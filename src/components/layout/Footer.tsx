import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { MonoLabel } from '@/components/primitives/Typography'
import { GlassFrieze } from '@/components/brand/GlassFrieze'
import { BRAND_COPY, CONTACTS, LOCATION, NAV_ITEMS, OPENING_HOURS, RESERVATION, SITE } from '@/data/site'
import styles from './Footer.module.css'

/**
 * Encerramento da jornada.
 *
 * Não é rodapé de SaaS com quatro colunas de links: é o último destino da
 * viagem. A pergunta da marca ("Qual é sua próxima?") ocupa a largura toda, e o
 * friso de taças — elemento oficial que sangra no rodapé das peças impressas
 * (manual, p.16) — fecha a página.
 *
 * Server Component: nada aqui precisa de interatividade.
 */
export function Footer() {
  const year = 2026

  return (
    <footer className={styles.footer} data-atmosphere="noturna" data-section="noturna">
      <div className={styles.inner}>
        <p className={styles.question}>
          Qual é <em>sua próxima?</em>
        </p>

        <div className={styles.grid}>
          <div className={styles.col}>
            <MonoLabel size="xs" muted as="h2">
              Onde
            </MonoLabel>
            <address className={styles.address}>
              {LOCATION.street}
              <br />
              {LOCATION.complement}
              <br />
              {LOCATION.city} — {LOCATION.state}
              <br />
              {LOCATION.postalCode}
            </address>
            <Link href="/#localizacao" className={styles.link}>
              Ver no mapa
            </Link>
          </div>

          <div className={styles.col}>
            <MonoLabel size="xs" muted as="h2">
              Quando
            </MonoLabel>
            <dl className={styles.hours}>
              {OPENING_HOURS.map((slot) => (
                <div key={slot.opens + slot.closes} className={styles.hoursRow}>
                  <dt>{slot.days.length > 2 ? `${slot.days[0]} a ${slot.days[slot.days.length - 1]}` : slot.days.join(' e ')}</dt>
                  <dd className="u-tnum">
                    {slot.opens}—{slot.closes}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={styles.col}>
            <MonoLabel size="xs" muted as="h2">
              Contato
            </MonoLabel>
            <ul className={styles.list}>
              {CONTACTS.map((contact) => (
                <li key={contact.label}>
                  <a
                    href={contact.href}
                    className={styles.link}
                    {...(contact.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    {contact.value}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.col}>
            <MonoLabel size="xs" muted as="h2">
              Navegar
            </MonoLabel>
            <ul className={styles.list}>
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={styles.link}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.ctaRow}>
          <a
            href={RESERVATION.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.reserve}
          >
            Reservar uma mesa
          </a>
          <p className={styles.tagline}>{BRAND_COPY.bestGlass}.</p>
        </div>
      </div>

      {/* Friso de taças sangrando na borda inferior — cercadura oficial. */}
      <GlassFrieze className={styles.frieze} />

      <div className={styles.baseline}>
        <Logo lockup="horizontal" height="clamp(0.7rem, 1.1vw, 0.9rem)" labelled={false} />
        <MonoLabel size="xs" muted>
          © {year} {SITE.name} · CNPJ {SITE.taxId}
        </MonoLabel>
      </div>
    </footer>
  )
}
