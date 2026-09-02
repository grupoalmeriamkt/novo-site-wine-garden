import Link from 'next/link'
import { EditorialHeading, MonoLabel, Prose } from '@/components/primitives/Typography'
import { Cta } from '@/components/primitives/Cta'
import { GlassFrieze } from '@/components/brand/GlassFrieze'
import styles from './not-found.module.css'

export const metadata = { title: 'Página não encontrada' }

/**
 * 404 na linguagem da marca: uma rota que não existe é um destino que saiu do
 * mapa. Sem ilustração genérica, sem "oops".
 */
export default function NotFound() {
  return (
    <div className={styles.wrap} data-atmosphere="noturna" data-section="noturna">
      <div className={styles.inner}>
        <MonoLabel size="xs" muted numeric>
          Erro 404
        </MonoLabel>
        <EditorialHeading as="h1" size="1" className={styles.title}>
          Este destino saiu <em>do mapa.</em>
        </EditorialHeading>
        <Prose muted className={styles.text}>
          A página que você procurava não existe mais — ou nunca existiu. A carta,
          o cardápio e o jardim continuam onde estavam.
        </Prose>
        <div className={styles.actions}>
          <Cta href="/" variant="solid">
            Voltar ao início
          </Cta>
          <Link href="/vinhos" className={styles.secondary}>
            Ver a carta de vinhos
          </Link>
        </div>
      </div>
      <GlassFrieze />
    </div>
  )
}
