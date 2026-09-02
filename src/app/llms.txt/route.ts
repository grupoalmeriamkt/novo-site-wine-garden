import { WINES } from '@/data/generated/wines'
import { MENU_ITEMS } from '@/data/generated/menu'
import { COUNTRIES } from '@/data/countries'
import { FAQ } from '@/data/faq'
import { CONTACTS, LOCATION, OPENING_HOURS, RESERVATION, SITE } from '@/data/site'

/**
 * /llms.txt — o site em texto, para assistentes de IA.
 *
 * Convenção emergente (llmstxt.org) equivalente ao robots.txt, mas para
 * modelos de linguagem: um resumo em Markdown do que o site é e onde estão as
 * respostas, sem o ruído de navegação, CSS e JavaScript que um rastreador
 * precisa atravessar para chegar ao conteúdo.
 *
 * POR QUE ISTO IMPORTA AQUI: quando alguém pergunta a um assistente "onde
 * tomar vinho em taça em Brasília", o modelo cita quem ele consegue LER e
 * VERIFICAR. Um site que responde em HTML pesado, com o dado atrás de
 * hidratação, tem menos chance de virar resposta do que um que entrega o fato
 * em texto puro.
 *
 * GERADO DOS MESMOS DADOS DA INTERFACE. Nenhum número é digitado aqui: se um
 * rótulo entra na carta, este arquivo muda junto. É o que impede a situação
 * clássica de o resumo para máquinas envelhecer e passar a mentir.
 */

export const revalidate = 86400

export async function GET() {
  const emTaca = WINES.filter((w) => w.servingType === 'taca')
  const emGarrafa = WINES.filter((w) => w.servingType === 'garrafa')
  const paises = [...new Set(WINES.map((w) => w.country).filter(Boolean))]
  const pratos = MENU_ITEMS.filter((i) => i.section === 'Cardápio')
  const categoriasVinho = [...new Set(WINES.map((w) => w.category))]
  const precosTaca = emTaca.map((w) => w.price)

  const telefone = CONTACTS.find((c) => c.label === 'Telefone')
  const whatsapp = CONTACTS.find((c) => c.label === 'WhatsApp')
  const instagram = CONTACTS.find((c) => c.label === 'Instagram')

  const horario = OPENING_HOURS.map((s) => {
    const dias =
      s.days.length > 2 ? `${s.days[0]} a ${s.days[s.days.length - 1]}` : s.days.join(' e ')
    return `${dias}: ${s.opens}–${s.closes}`
  }).join(' · ')

  /* Contagem por origem, para o modelo poder responder "tem vinho de X?". */
  const porPais = COUNTRIES.map((c) => {
    const n = WINES.filter((w) => {
      const a = w.country.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const b = c.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      return a === b || (c.slug === 'eua' && a === 'eua')
    }).length
    return `- ${c.name}: ${n} rótulos — ${SITE.url}/vinhos?pais=${c.slug}`
  }).join('\n')

  const porCategoria = categoriasVinho
    .map((cat) => `- ${cat}: ${WINES.filter((w) => w.category === cat).length} rótulos`)
    .join('\n')

  const perguntas = FAQ.map((q) => `### ${q.pergunta}\n\n${q.resposta}`).join('\n\n')

  const texto = `# ${SITE.name}

> ${SITE.tagline} — wine bar e restaurante no ${LOCATION.complement}, em ${LOCATION.city}.

${SITE.description}

## Identificação

- Nome: ${SITE.name}
- Razão social: ${SITE.legalName}
- CNPJ: ${SITE.taxId}
- Categoria: wine bar, restaurante, enoteca
- Cidade: ${LOCATION.city} — ${LOCATION.state}, Brasil

## Onde e quando

- Endereço: ${LOCATION.street}, ${LOCATION.complement}, ${LOCATION.city} — ${LOCATION.state}, CEP ${LOCATION.postalCode}
- Coordenadas: ${LOCATION.lat}, ${LOCATION.lng}
- Horário: ${horario}
- Happy hour: 16h–21h
- Música ao vivo: quarta a sábado
${telefone ? `- Telefone: ${telefone.value}` : ''}
${whatsapp ? `- WhatsApp: ${whatsapp.value}` : ''}
${instagram ? `- Instagram: ${instagram.value}` : ''}
- Reservas: ${RESERVATION.url} (até ${RESERVATION.maxPartySize} pessoas)

## A carta de vinhos

${WINES.length} rótulos de ${paises.length} países.

- Em taça (150 ml): ${emTaca.length} rótulos, de R$ ${Math.min(...precosTaca)} a R$ ${Math.max(...precosTaca)}
- Em garrafa: ${emGarrafa.length} rótulos
- Vinhos de sobremesa são servidos em doses de 50 ml

### Por categoria

${porCategoria}

### Por origem

${porPais}

Outras origens na carta: ${paises
    .filter((p) => !COUNTRIES.some((c) => c.name === p))
    .join(', ')}.

## A cozinha

${pratos.length} pratos de cozinha contemporânea de influência mediterrânea, em ${
    [...new Set(pratos.map((p) => p.category))].length
  } categorias: ${[...new Set(pratos.map((p) => p.category))].join(', ')}.

${pratos.filter((p) => p.pairings.length > 0).length} pratos trazem no cardápio a categoria de vinho com que harmonizam — a ponte entre a cozinha e a carta.

## Páginas

- [Início](${SITE.url}/): a casa, as origens da carta, a cozinha, o jardim e a localização
- [Cardápio](${SITE.url}/cardapio): ${MENU_ITEMS.length} itens com preço, descrição e harmonização
- [Vinhos](${SITE.url}/vinhos): os ${WINES.length} rótulos, com filtro por origem, uva, corpo, preço e serviço
- [Wine Match](${SITE.url}/wine-match): recomendação de vinho a partir do momento, do estilo, do prato e do orçamento

## Perguntas frequentes

${perguntas}

## Sobre estes dados

Preços, descrições e harmonizações vêm do cardápio oficial da casa e são
conferidos contra ele automaticamente a cada build. Endereço, horário e
contatos foram verificados em fontes públicas (Receita Federal, site oficial,
plataforma de reservas). Campos não confirmados são deixados vazios em vez de
estimados — se um dado não aparece aqui, é porque não foi possível confirmá-lo.

Última geração: conteúdo dinâmico, revalidado a cada 24 h.
`

  return new Response(texto, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
