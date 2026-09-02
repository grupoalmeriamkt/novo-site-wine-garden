'use client'

import { useEffect, useState } from 'react'
import { RESERVATION } from '@/data/site'
import { track } from '@/lib/analytics'
import styles from './MobileReserveBar.module.css'

/**
 * CTA de reserva persistente no mobile.
 *
 * Só aparece depois que o visitante passou do herói — antes disso ele estaria
 * cobrindo a composição de abertura para oferecer algo que a pessoa ainda não
 * tem motivo para querer. E some quando o rodapé entra em cena, onde já existe
 * um CTA maior: dois botões de reserva empilhados na mesma tela é ruído.
 *
 * Respeita `env(safe-area-inset-bottom)` — sem isso, na barra de gestos do
 * iPhone o botão fica parcialmente inalcançável.
 */
export function MobileReserveBar() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const footer = document.querySelector('footer')

    /*
     * Uma sentinela criada aqui, com uma viewport de altura, marca "o visitante
     * já rolou o suficiente". Isso funciona em qualquer rota — a home tem
     * herói, o cardápio não — e não depende de encontrar uma seção específica.
     *
     * A primeira versão procurava `[data-section="noturna"]`, que na página do
     * cardápio casava com o RODAPÉ: como ele começa fora da tela, a barra
     * aparecia imediatamente, cobrindo os filtros.
     */
    const sentinel = document.createElement('div')
    sentinel.setAttribute('aria-hidden', 'true')
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:100svh;pointer-events:none'
    document.body.prepend(sentinel)

    let rolou = false
    let noRodape = false
    const sync = () => setVisible(rolou && !noRodape)

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === sentinel) rolou = !entry.isIntersecting
          if (entry.target === footer) noRodape = entry.isIntersecting
        }
        sync()
      },
      { threshold: 0 },
    )

    observer.observe(sentinel)
    if (footer) observer.observe(footer)

    return () => {
      observer.disconnect()
      sentinel.remove()
    }
  }, [])

  return (
    <div
      className={styles.bar}
      // Gancho estável para o teste: há outros links "Reservar uma mesa" no
      // DOM (rodapé e overlay do menu), e um seletor por texto pega o errado.
      data-reserve-bar
      data-visible={visible || undefined}
      aria-hidden={!visible}
    >
      <a
        href={RESERVATION.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.link}
        // Fora da ordem de tabulação quando invisível: um link escondido que
        // recebe foco leva o teclado para um lugar que ninguém vê.
        tabIndex={visible ? 0 : -1}
        onClick={() => track('reservation_click', { origin: 'barra-mobile' })}
      >
        Reservar uma mesa
      </a>
    </div>
  )
}
