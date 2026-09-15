/**
 * Dados institucionais do Wine Garden.
 *
 * PROCEDÊNCIA — todo campo abaixo tem origem verificável, e o que não foi
 * possível confirmar está marcado com `verified: false` e documentado no
 * README (seção "Dados pendentes de confirmação"). Nada aqui é estimativa:
 * horário, endereço e telefone alimentam JSON-LD e o card do Google, e um
 * dado inventado ali é pior do que dado ausente.
 *
 * Fontes usadas (levantadas em 01/09/2026):
 * · Receita Federal via BrasilAPI — CNPJ 35.116.878/0001-71
 * · Site oficial izziwinegarden.com.br (marca anterior, mesmo CNPJ)
 * · Página de reservas GetIn — getin.app/brasilia/izzi-wine-garden
 * · Instagram @winegardenbsb
 *
 * CONTEXTO DE MARCA: a casa abriu como Wine Garden, passou a Izzi Wine Garden
 * e retomou o nome original em jul/2026 — daí o slug `izzi-wine-garden` ainda
 * presente nas URLs do GetIn.
 */

export type SiteContact = {
  label: string
  value: string
  href: string
  /** `false` quando a fonte é indireta e o cliente ainda precisa confirmar. */
  verified: boolean
}

/**
 * A URL canônica do site.
 *
 * `??` não bastava: uma variável DEFINIDA E VAZIA no painel da Vercel passa
 * pelo `??` e chega como string vazia até `new URL()`, que morre com
 * ERR_INVALID_URL na coleta de páginas — o build inteiro cai por causa de um
 * campo em branco. Por isso a cascata testa conteúdo, não existência.
 *
 * A ordem reflete a confiança: o domínio configurado à mão vence; depois o
 * domínio de produção que a Vercel injeta; depois a URL do deploy atual (que
 * muda a cada preview, mas é melhor que nada nos previews); e por fim o
 * localhost do desenvolvimento.
 */
function resolverUrlDoSite(): string {
  const candidatos = [
    process.env.NEXT_PUBLIC_SITE_URL,
    // Injetadas pela Vercel; vêm sem protocolo.
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL,
    process.env.VERCEL_URL,
  ]

  for (const bruto of candidatos) {
    const valor = bruto?.trim()
    if (!valor) continue
    const comProtocolo = /^https?:\/\//.test(valor) ? valor : `https://${valor}`
    try {
      // Normaliza e derruba lixo: `new URL` aqui é a validação, não um adorno.
      return new URL(comProtocolo).origin
    } catch {
      continue
    }
  }

  return 'http://localhost:3000'
}

export const SITE = {
  name: 'Wine Garden',
  legalName: 'Wine Garden Comércio de Bebidas e Organização de Eventos Ltda',
  taxId: '35.116.878/0001-71',
  tagline: 'Viaje o mundo, taça a taça.',
  description:
    'Wine bar e restaurante no Pontão do Lago Sul, em Brasília. Uma carta que atravessa oito países produtores, cozinha contemporânea e um jardim para novas conexões.',
  /**
   * Defina NEXT_PUBLIC_SITE_URL no deploy com o domínio final. Sem ela, a
   * cascata acima usa o domínio que a Vercel injeta — o site sobe e as URLs
   * absolutas de Open Graph, canonical e sitemap continuam coerentes.
   */
  url: resolverUrlDoSite(),
  locale: 'pt-BR',
} as const

/**
 * Lê uma coordenada de variável de ambiente sem aceitar lixo.
 *
 * Era `Number(env ?? padrão)`, e em produção isso publicou o Wine Garden em
 * 0,0 — no Golfo da Guiné — no JSON-LD e no "Como chegar": a variável existia
 * VAZIA na Vercel, o `??` a deixou passar e `Number('')` vale 0, não NaN.
 * Vazio, não numérico ou fora da faixa válida cai no padrão verificado.
 */
function coordenada(bruto: string | undefined, padrao: number, limite: number): number {
  const valor = bruto?.trim()
  if (!valor) return padrao
  const n = Number(valor)
  return Number.isFinite(n) && n !== 0 && Math.abs(n) <= limite ? n : padrao
}

export const LOCATION = {
  /** Grafia da Receita Federal, do site oficial e da ficha do Google. */
  street: 'SHIS QL 10, Lote 24',
  complement: 'Pontão do Lago Sul',
  district: 'Setor de Habitações Individuais Sul',
  city: 'Brasília',
  state: 'DF',
  postalCode: '71630-100',
  country: 'BR',
  /**
   * Coordenadas da ficha do Google (via RestaurantGuru e Wanderlog).
   * O GetIn publica um par ~310 m a oeste; ambos caem dentro do Pontão.
   * Sobrescreva por ambiente se o cliente indicar o pin exato.
   */
  lat: coordenada(process.env.NEXT_PUBLIC_WINE_GARDEN_LAT, -15.825931, 90),
  lng: coordenada(process.env.NEXT_PUBLIC_WINE_GARDEN_LNG, -47.871311, 180),
  /**
   * Place ID obtido de espelho público (Wanderlog), NÃO verificado direto no
   * Google. Fica em variável de ambiente justamente para não ir a produção
   * sem alguém validar no Place ID Finder.
   */
  placeId: process.env.NEXT_PUBLIC_WINE_GARDEN_PLACE_ID ?? '',
  addressLine: 'SHIS QL 10, Lote 24 — Pontão do Lago Sul, Brasília — DF',
} as const

/**
 * Horário publicado por três fontes concordantes (GetIn, site oficial e ficha
 * do Google). Formato de 24 h para virar `openingHours` do schema.org direto.
 */
export const OPENING_HOURS = [
  { days: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta'], opens: '12:00', closes: '00:00' },
  { days: ['Sexta', 'Sábado'], opens: '12:00', closes: '01:00' },
] as const

/** Formato compacto para o schema.org: `Su-Th 12:00-00:00`. */
export const OPENING_HOURS_SCHEMA = ['Su-Th 12:00-00:00', 'Fr-Sa 12:00-01:00'] as const

export const CONTACTS: readonly SiteContact[] = [
  {
    label: 'Telefone',
    value: '(61) 99022-7437',
    href: 'tel:+5561990227437',
    verified: true,
  },
  {
    label: 'WhatsApp',
    value: '(61) 99211-5375',
    href: 'https://wa.me/5561992115375',
    verified: true,
  },
  {
    label: 'Instagram',
    value: '@winegardenbsb',
    href: 'https://www.instagram.com/winegardenbsb/',
    verified: true,
  },
]

/**
 * Reserva. O link do GetIn é a integração real da casa — não inventamos
 * formulário próprio nem endpoint de reserva.
 */
export const RESERVATION = {
  provider: 'GetIn',
  /**
   * FIXO NO CÓDIGO, de propósito — definido pela casa em 15/09/2026.
   *
   * Já foi `process.env.NEXT_PUBLIC_RESERVATION_URL ?? <este endereço>`, e isso
   * quebrou em produção: a variável existia VAZIA no painel da Vercel, o `??`
   * deixou a string vazia passar, e os seis botões de reserva do site saíram
   * com `href=""` — clicavam e não iam a lugar nenhum. É o CTA de conversão do
   * site inteiro; não pode depender de um campo de painel. Não é credencial,
   * então não há motivo para vir de variável de ambiente.
   */
  url: 'https://www.getin.app/brasilia/izzi-wine-garden',
  /** Cardápio digital oficial — origem dos dados em src/data/menu.ts. */
  menuUrl: 'https://menu.getin.app/store/O6OadgPa/1',
  maxPartySize: 20,
} as const

/**
 * Eventos privados — o canal comercial da casa.
 *
 * Número definido pela casa em 15/09/2026. É PARA ONDE VAI O FORMULÁRIO de
 * eventos: trocar este valor redireciona todos os leads. Não alterar sem
 * confirmação.
 *
 * `phone` leva o DDI 55. O link repassado pela casa veio como `phone=61…`, e o
 * WhatsApp lê o número em formato internacional: sem o 55, "61" é o código da
 * Austrália e a conversa abriria com um número de outro país.
 */
export const EVENTS_CONTACT = {
  phone: '5561998117063',
  label: '(61) 99811-7063',
  verified: true,
} as const

/**
 * Link do WhatsApp de eventos, no formato `api.whatsapp.com/send` pedido pela
 * casa, com a mensagem já escrita em `text`. Sem texto, abre a conversa vazia.
 *
 * `encodeURIComponent` e não `URLSearchParams`: este converte espaço em `+`, e
 * alguns clientes do WhatsApp mostram o `+` literal na mensagem.
 */
export function whatsappEventosUrl(texto = ''): string {
  return `https://api.whatsapp.com/send/?phone=${EVENTS_CONTACT.phone}&text=${encodeURIComponent(texto)}&type=phone_number&app_absent=0`
}

/**
 * A navegação.
 *
 * Cinco entradas, e a poda foi deliberada: Experiências e O Garden saíram a
 * pedido da casa. Um menu curto é o que faz cada item ser lido — a lista de
 * sete diluía justamente o que importa, que é a carta e a mesa.
 *
 * `Header` mostra as três primeiras na barra fixa; o menu completo e o rodapé
 * mostram todas.
 */
export const NAV_ITEMS = [
  { id: '01', label: 'Cardápio', href: '/cardapio' },
  { id: '02', label: 'Vinhos', href: '/vinhos' },
  { id: '03', label: 'Wine Match', href: '/wine-match' },
  { id: '04', label: 'Eventos', href: '/#eventos' },
  { id: '05', label: 'Localização', href: '/#localizacao' },
] as const

/**
 * Frases oficiais do manual de identidade (p.13–19). Usadas literalmente:
 * não reescrever nem "melhorar" — são copy aprovada da marca.
 */
export const BRAND_COPY = {
  travel: ['Viaje o mundo', 'taça a taça'],
  world: ['O mundo todo', 'taça a taça'],
  next: 'Descubra o próximo',
  connections: 'Faça novas conexões',
  choices: 'A vida é feita de escolhas',
  question: 'Qual é sua próxima?',
  bestGlass: 'A melhor taça é sempre a próxima',
  arrived: 'Sua viagem pelo mundo chegou',
} as const

/** Palavras-chave do conceito, na prancha "CONCEITO / Palavras-chave" (p.3). */
export const BRAND_KEYWORDS = [
  'Descoberta',
  'explorar',
  'Viagem',
  'provar',
  'novo',
  'Conexão',
  'mala',
  'selo',
  'Origem',
  'escolha',
  'match',
  'Trajetória',
  'países',
  'caminho',
  'Encontro',
] as const
