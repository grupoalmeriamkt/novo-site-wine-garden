import type { Experience } from '@/types/content'
import { CONTACTS, RESERVATION } from '@/data/site'
import { EXPERIENCES as EXPERIENCE_PHOTOS } from '@/data/photos'

/**
 * As experiências da casa.
 *
 * A REGRA QUE MANDA AQUI: `schedule` é o único campo que afirma dia e hora, e
 * ele só é preenchido quando existe fonte pública que o diga. Onde a casa ainda
 * não fechou agenda, o campo fica `''` e a interface escreve "Consulte a casa".
 * Um horário inventado num site de restaurante não é um detalhe de conteúdo: é
 * alguém que dirige até o Pontão numa terça e encontra a coisa fechada.
 *
 * PROCEDÊNCIA, item a item (levantada em 01/09/2026) — cada objeto abaixo
 * repete a sua no comentário que o precede. As descrições são redigidas por
 * nós: descrevem o FORMATO e o clima, nunca preço, cardápio ou calendário.
 */

/**
 * Os destinos possíveis de um CTA. Todos são canais REAIS e publicados da
 * casa — reserva no GetIn, WhatsApp e Instagram vêm de src/data/site.ts, que é
 * onde a procedência de cada um está documentada. Nenhuma experiência ganha
 * link inventado: sem canal, `ctaHref` fica `''` e a UI não desenha botão.
 */
const CHANNEL = {
  reserva: RESERVATION.url,
  whatsapp: CONTACTS.find((contact) => contact.label === 'WhatsApp')?.href ?? '',
  instagram: CONTACTS.find((contact) => contact.label === 'Instagram')?.href ?? '',
} as const

export const EXPERIENCES: readonly Experience[] = [
  /**
   * CONFIRMADO. "HAPPY HOUR, 16-21H" aparece literalmente no material oficial
   * da marca. A peça não nomeia os dias da semana — então o `schedule` traz só
   * a faixa de horário, e nenhuma linha do texto diz "todo dia".
   */
  {
    id: 'happy-hour',
    name: 'Happy Hour',
    kicker: 'Fim de tarde',
    description:
      'As horas em que a tarde vira noite sobre o lago e a casa fica cheia sem ficar apressada. É quando faz mais sentido sentar sem plano e deixar a carta decidir por você.',
    schedule: '16h — 21h',
    photoId: 'c1-mar00012',
    ctaLabel: 'Reservar mesa',
    ctaHref: CHANNEL.reserva,
  },

  /**
   * CONFIRMADO em parte. A imprensa de 2026 cita programação musical de quarta
   * a sábado — daí o `schedule`. O que NÃO se afirma: atração, estilo e
   * horário de início. Por isso o CTA manda para o Instagram, que é onde a casa
   * publica a agenda da semana.
   */
  {
    id: 'musica-ao-vivo',
    name: 'Música no Garden',
    kicker: 'Ao vivo',
    description:
      'Música tocada ali, no meio do jardim, no volume de quem ainda quer conversar na mesa ao lado. A atração de cada noite sai na semana, no Instagram da casa.',
    schedule: 'Quarta a sábado',
    photoId: 'c1-mar00037',
    ctaLabel: 'Ver a programação',
    ctaHref: CHANNEL.instagram,
  },

  /**
   * FORMATO CONFIRMADO, AGENDA NÃO. "Wine Tasting" aparece como formato nas
   * peças oficiais da marca, mas nenhuma fonte pública traz data, preço ou
   * número de rótulos. `schedule` fica vazio de propósito.
   */
  {
    id: 'wine-tasting',
    name: 'Wine Tasting',
    kicker: 'Degustação',
    description:
      'Uma sequência de taças lida como rota: de onde vem, de que uva é feita e por que a próxima muda tudo. O formato é da casa; a data da próxima se confirma com o salão.',
    schedule: '',
    photoId: 'c1-mar09582',
    ctaLabel: 'Consultar a próxima data',
    ctaHref: CHANNEL.whatsapp,
  },

  /**
   * NÃO CONFIRMADO. Brunch não aparece em nenhuma fonte pública verificada —
   * entra aqui como formato que a casa monta, sem dia, sem hora e sem cardápio
   * declarado. Se o cliente confirmar a agenda, é só preencher `schedule`.
   */
  {
    id: 'brunch',
    name: 'Brunch',
    kicker: 'Mesa longa',
    description:
      'Espumante, pães e uma mesa que ocupa a manhã inteira sem pressa de virar almoço. Não há data fixa publicada — dá para perguntar quando é a próxima.',
    schedule: '',
    photoId: 'c1-mar09269',
    ctaLabel: 'Perguntar a próxima data',
    ctaHref: CHANNEL.whatsapp,
  },

  /**
   * NÃO CONFIRMADO. Menu executivo também não tem fonte pública. Fica sem foto
   * de propósito: é a entrada mais frágil do conjunto e não deve receber o peso
   * visual de uma fotografia grande enquanto for só uma intenção.
   */
  {
    id: 'menu-executivo',
    name: 'Menu Executivo',
    kicker: 'Almoço',
    description:
      'Um almoço mais curto, para quem tem hora de voltar. Ainda sem dia e sem carta fechados: confirme com a casa antes de vir.',
    schedule: '',
    ctaLabel: 'Falar com a casa',
    ctaHref: CHANNEL.whatsapp,
  },
]

/**
 * Legendas do acervo indexadas por id.
 *
 * O `alt` é propriedade da curadoria (src/data/photos.ts) e mora só lá: quem
 * troca a foto troca a legenda no mesmo lugar, e esta camada continua correta.
 */
const ALT_BY_PHOTO_ID: Readonly<Record<string, string>> = Object.fromEntries(
  EXPERIENCE_PHOTOS.map((photo) => [photo.id, photo.alt]),
)

/** Legenda curada da foto de uma experiência. `''` quando a experiência não tem foto. */
export function experienceAlt(experience: Experience): string {
  if (!experience.photoId) return ''
  return ALT_BY_PHOTO_ID[experience.photoId] ?? ''
}

/**
 * Um `photoId` que não está na curadoria renderiza uma foto sem alt — falha
 * silenciosa de acessibilidade, que é o pior tipo. Em desenvolvimento, grita.
 */
if (process.env.NODE_ENV === 'development') {
  const orphans = EXPERIENCES.filter((experience) => experience.photoId && !experienceAlt(experience))
  if (orphans.length > 0) {
    console.error(`[experiences] sem legenda curada: ${orphans.map((e) => e.id).join(', ')}`)
  }
}
