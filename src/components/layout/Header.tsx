'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Logo } from '@/components/brand/Logo'
import { MonoLabel } from '@/components/primitives/Typography'
import { NAV_ITEMS, RESERVATION, CONTACTS, BRAND_COPY } from '@/data/site'
import { track } from '@/lib/analytics'
import { useGsapOn } from '@/hooks/useGsap'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import styles from './Header.module.css'

/**
 * Cabeçalho e navegação principal.
 *
 * Os sete destinos não cabem no topo sem virar barra de SaaS, então o topo
 * carrega só o essencial (marca, abrir menu, reservar) e o índice completo mora
 * num overlay que assume a estética de passaporte do manual: numeração em mono,
 * entradas em Instrument Serif grande, carimbo no canto.
 *
 * Acessibilidade do overlay: foco preso enquanto aberto, Escape fecha, o foco
 * volta para o botão que abriu, e o resto da página fica inerte para leitores
 * de tela.
 */
export function Header() {
  const [open, setOpen] = useState(false)
  const [condensed, setCondensed] = useState(false)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  const pathname = usePathname()
  const reduced = usePrefersReducedMotion()

  const close = useCallback(() => setOpen(false), [])

  /*
   * Rota nova, menu fechado — sem isto o overlay sobrevive à navegação.
   *
   * O ajuste acontece DURANTE o render, comparando com o pathname anterior, e
   * não num efeito. É o padrão que o React documenta para "ajustar estado
   * quando uma prop muda": o efeito equivalente renderizaria uma vez com o
   * overlay ainda aberto sobre a página nova antes de fechá-lo.
   */
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    if (open) setOpen(false)
  }

  /* O header encolhe assim que sai do topo — o herói é full-bleed e o header
     precisa ser quase invisível sobre ele. IntersectionObserver com uma
     sentinela custa muito menos que um listener de scroll. */
  useEffect(() => {
    const sentinel = document.createElement('div')
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none'
    document.body.prepend(sentinel)
    const io = new IntersectionObserver(([entry]) => setCondensed(!entry?.isIntersecting), {
      rootMargin: '-88px 0px 0px 0px',
    })
    io.observe(sentinel)
    return () => {
      io.disconnect()
      sentinel.remove()
    }
  }, [])

  /* Escape, trava de rolagem e armadilha de foco enquanto o overlay está aberto. */
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab' || !overlayRef.current) return

      const focusables = overlayRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    // Trava a rolagem compensando a barra, senão o conteúdo salta ao abrir.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    const { overflow, paddingRight } = document.body.style
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`

    overlayRef.current?.querySelector<HTMLElement>('a[href]')?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
      previouslyFocused?.focus()
    }
  }, [open, close])

  /* Entrada do overlay: as linhas do índice sobem escalonadas por trás de uma
     máscara — o mesmo gesto de "revelar por baixo" das fotos. */
  useGsapOn(
    overlayRef,
    ({ gsap, root }) => {
      if (!open || reduced) return
      const rows = root.querySelectorAll('[data-nav-row]')
      const meta = root.querySelectorAll('[data-nav-meta]')
      gsap
        .timeline()
        .fromTo(
          rows,
          { yPercent: 118, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.78, stagger: 0.055, ease: 'power3.out' },
        )
        .fromTo(meta, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06 }, 0.32)
    },
    [open, reduced],
  )

  return (
    <>
      <header className={`${styles.header} ${condensed ? styles.condensed : ''}`} data-open={open || undefined}>
        <div className={styles.bar}>
          <Link
            href="/"
            className={styles.brand}
            aria-label={`${'Wine Garden'} — página inicial`}
            onClick={close}
          >
            <Logo height="clamp(0.85rem, 1.5vw, 1.15rem)" labelled={false} />
          </Link>

          <nav className={styles.inline} aria-label="Navegação principal">
            {NAV_ITEMS.slice(0, 3).map((item) => (
              <Link key={item.href} href={item.href} className={styles.inlineLink}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={styles.actions}>
            <a
              href={RESERVATION.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.reserve}
              onClick={() => track('reservation_click', { origin: 'header' })}
            >
              Reservar
            </a>

            <button
              ref={toggleRef}
              type="button"
              className={styles.toggle}
              aria-expanded={open}
              aria-controls="menu-principal"
              onClick={() => {
                if (!open) track('nav_open', {})
                setOpen((v) => !v)
              }}
            >
              <span className={styles.toggleLabel}>{open ? 'Fechar' : 'Menu'}</span>
              <span className={styles.toggleIcon} aria-hidden="true">
                <span />
                <span />
              </span>
            </button>
          </div>
        </div>
      </header>

      <div
        ref={overlayRef}
        id="menu-principal"
        className={styles.overlay}
        data-atmosphere="noturna"
        hidden={!open}
        // aria-modal + role dialog fazem o leitor de tela ignorar o resto.
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
      >
        <div className={styles.overlayInner}>
          <nav className={styles.index} aria-label="Seções do site">
            <ul>
              {NAV_ITEMS.map((item) => (
                <li key={item.href} className={styles.indexItem}>
                  <span className={styles.rowMask}>
                    <Link href={item.href} className={styles.indexLink} data-nav-row onClick={close}>
                      <MonoLabel size="xs" className={styles.indexNumber} numeric>
                        {item.id}
                      </MonoLabel>
                      <span className={styles.indexLabel}>{item.label}</span>
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.aside}>
            <p className={styles.asideCopy} data-nav-meta>
              {BRAND_COPY.travel[0]},<br />
              <em>{BRAND_COPY.travel[1]}.</em>
            </p>

            <div className={styles.asideContacts} data-nav-meta>
              {CONTACTS.map((contact) => (
                <a
                  key={contact.label}
                  href={contact.href}
                  className={styles.asideLink}
                  {...(contact.href.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  onClick={() => {
                    if (contact.label === 'WhatsApp') track('whatsapp_click', { origin: 'menu' })
                  }}
                >
                  <MonoLabel size="xs" muted>
                    {contact.label}
                  </MonoLabel>
                  <span>{contact.value}</span>
                </a>
              ))}
            </div>

            <a
              href={RESERVATION.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.asideReserve}
              data-nav-meta
              onClick={() => track('reservation_click', { origin: 'menu' })}
            >
              Reservar uma mesa
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
