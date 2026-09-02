'use client'

import { useEffect } from 'react'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import styles from './not-found.module.css'

/**
 * Fronteira de erro da aplicação.
 *
 * Uma falha em qualquer seção não pode derrubar a página inteira em branco: o
 * visitante recebe uma saída em vez de um stack trace. O `reset()` do Next
 * tenta remontar a árvore sem recarregar tudo.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Em produção isto é o gancho para o serviço de monitoramento.
    console.error(error)
  }, [error])

  return (
    <div className={styles.wrap} data-atmosphere="noturna" data-section="noturna">
      <div className={styles.inner}>
        <MonoLabel size="xs" muted numeric>
          {error.digest ? `Erro ${error.digest}` : 'Erro inesperado'}
        </MonoLabel>
        <EditorialHeading as="h1" size="1" className={styles.title}>
          Algo saiu <em>do trilho.</em>
        </EditorialHeading>
        <Prose muted className={styles.text}>
          Um erro impediu esta parte da página de carregar. Tente de novo — se
          persistir, o restante do site continua acessível pelo menu.
        </Prose>
        <div className={styles.actions}>
          <button type="button" onClick={reset} className={styles.secondary}>
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  )
}
