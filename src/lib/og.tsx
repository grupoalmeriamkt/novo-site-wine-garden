import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { LOCATION } from '@/data/site'
import { LOCKUPS } from '@/data/generated/logo'

/**
 * A CAPA DE COMPARTILHAMENTO, uma só, parametrizada.
 *
 * É o que aparece no WhatsApp, no Instagram, no Slack e no cartão de resultado
 * do Google — na prática, a primeira impressão da marca para quem ainda não
 * visitou o site. Vale gerá-la com o lettering real e a paleta oficial, e não
 * com um recorte de fotografia com texto por cima.
 *
 * POR QUE UM MÓDULO, E NÃO UM ARQUIVO POR ROTA: cada página compartilhada
 * merece dizer o que ELA é ("Carta de vinhos", e não "Wine Garden" genérico),
 * mas a composição precisa ser a mesma em todas — quatro variações de layout
 * seriam quatro lugares para a marca divergir. Aqui o desenho é único e só o
 * texto muda.
 *
 * O `ImageResponse` monta a imagem com Satori, que precisa dos BYTES da fonte —
 * ele não lê CSS nem @font-face.
 *
 * SÓ A INSTRUMENT SERIF entra aqui. A JetBrains Mono do projeto é uma VARIABLE
 * FONT, e o parser do Satori quebra ao lê-la ("Cannot read properties of
 * undefined"). Como a serifa é a voz de display da marca e é estática, ela
 * carrega a composição inteira — os rótulos pequenos ganham caixa alta e
 * tracking largo, que é o gesto que a mono faria.
 */

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

type Capa = {
  /** Rótulo pequeno acima do título. Ex.: "Carta de vinhos". */
  eyebrow?: string
  /** Primeira linha do display. */
  titulo: string
  /** Segunda linha, em itálico e recuada — o gesto da assinatura da marca. */
  destaque: string
  /** Canto inferior esquerdo: o número que dá lastro à página. */
  dado: string
}

async function fonte(arquivo: string) {
  return readFile(path.join(process.cwd(), 'tipografias', arquivo))
}

export async function capaOg({ eyebrow, titulo, destaque, dado }: Capa) {
  const serif = await fonte('InstrumentSerif-Regular.ttf')
  const logo = LOCKUPS.horizontal

  /*
   * O display encolhe quando a frase é longa. Satori não quebra linha por
   * medida como um navegador faria com `text-wrap: balance`, então a medida
   * é decidida aqui — senão "Recomendação de vinho" transborda a arte.
   */
  const maior = Math.max(titulo.length, destaque.length)
  const corpo = maior > 22 ? 68 : maior > 16 ? 80 : 92

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#3f0a25',
          padding: '68px 76px',
          fontFamily: 'Instrument Serif',
          // Vinheta sutil para a composição não ficar chapada.
          backgroundImage:
            'radial-gradient(120% 90% at 30% 20%, rgba(137,26,61,0.42) 0%, rgba(63,10,37,0) 60%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          {/* O lettering oficial, em path — não uma fonte parecida. */}
          <svg viewBox={logo.viewBox} width={330} height={330 / logo.ratio} fill="#f7f9ea">
            {logo.paths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </svg>
          {eyebrow ? (
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: '#c7ae9a',
                paddingTop: 10,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              fontSize: corpo,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              color: '#f7f9ea',
            }}
          >
            {titulo}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: corpo,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              color: '#c7ae9a',
              fontStyle: 'italic',
              marginLeft: 76,
            }}
          >
            {destaque}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: 24,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#c7ae9a',
            borderTop: '1px solid rgba(199,174,154,0.32)',
            paddingTop: 22,
          }}
        >
          <div style={{ display: 'flex' }}>{dado}</div>
          <div style={{ display: 'flex' }}>
            {LOCATION.complement} · {LOCATION.city}
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [{ name: 'Instrument Serif', data: serif, style: 'normal', weight: 400 }],
    },
  )
}
