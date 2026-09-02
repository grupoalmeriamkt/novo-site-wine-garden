import { PHOTO_BY_ID } from '@/data/generated/photo-manifest'

/**
 * Curadoria do acervo.
 *
 * O manifesto (gerado) sabe o que EXISTE; este arquivo decide o que ENTRA e
 * onde. É direção de arte, não dado — por isso vive fora de generated/ e é
 * editado à mão.
 *
 * As legendas são descritivas de verdade porque viram `alt`: quem usa leitor de
 * tela precisa da cena, não de "foto do restaurante".
 */

export type CuratedPhoto = {
  id: string
  alt: string
}

/** A imagem de abertura. É o LCP da home — a única com `priority`. */
export const HERO: CuratedPhoto = {
  id: 'c1-mar09546',
  alt: 'Salão envidraçado do Wine Garden iluminado por dentro ao anoitecer, mesas ocupadas no gramado e palmeiras contra o céu azul-escuro.',
}

/** Fotos que sustentam o manifesto e a ideia de escolha. */
export const MANIFESTO: readonly CuratedPhoto[] = [
  {
    id: 'c1-mar09601',
    alt: 'Fio de vinho tinto caindo da torneira do dispensador na taça segurada por uma mão, com luzes âmbar ao fundo.',
  },
  {
    id: 'c1-mar09584',
    alt: 'Taça de vinho tinto estendida em primeiro plano, com um homem de blazer desfocado ao fundo do salão.',
  },
]

/** A viagem pelas origens — garrafas, adega, serviço. */
export const CELLAR: readonly CuratedPhoto[] = [
  {
    id: 'c1-mar09360',
    alt: 'Sommelier tatuado com avental Wine Garden segurando uma garrafa de tinto com as duas mãos.',
  },
  {
    id: 'c1-mar09329',
    alt: 'Garrafas de vinho branco na vitrine refrigerada, com as torneiras dosadoras alinhadas abaixo.',
  },
  {
    id: 'c1-mar09617',
    alt: 'Cliente de blazer amarelo diante da máquina self-service de vinhos, com garrafas iluminadas atrás do vidro.',
  },
  {
    id: 'c1-mar09431',
    alt: 'Mão carregando duas garrafas de vinho, uma branca e uma tinta, com o salão iluminado ao fundo.',
  },
]

/**
 * Gastronomia. A sequência é montada para alternar close e prato inteiro,
 * vertical e horizontal — não é a ordem do cardápio.
 */
export const GASTRONOMY: readonly CuratedPhoto[] = [
  {
    id: 'c2-mar04581',
    alt: 'Carpaccio de mignon em fatias finas com rúcula, grãos de mostarda e farofa de azeitonas.',
  },
  {
    id: 'c2-mar04709',
    alt: 'Burrata cremosa sobre azeite e pimenta, servida com pães da casa dourados.',
  },
  {
    id: 'c2-mar04667',
    alt: 'Ceviche de peixe branco com milho crocante, batata doce roxa e chips de raízes.',
  },
  {
    id: 'c2-mar04759',
    alt: 'Dumpling de barriga de porco sendo levantado, com o molho ponzu de maracujá escorrendo.',
  },
  {
    id: 'c2-mar04804',
    alt: 'Filé mignon fatiado sobre risoto de ervilhas frescas, com crispy de alho-poró por cima.',
  },
  {
    id: 'c2-mar04548',
    alt: 'Sobremesa Lemon: namelaka de limão, geleia de frutas vermelhas, crumble de amêndoas e marshmallow maçaricado.',
  },
]

/** Pessoas — o argumento social da casa. */
export const PEOPLE: readonly CuratedPhoto[] = [
  {
    id: 'c1-mar09534',
    alt: 'Grupo de amigos conversando à mesa sob o teto de cordões de luz e vegetação.',
  },
  {
    id: 'c1-mar00004',
    alt: 'Mulher de vestido floral rindo com uma taça de vinho tinto na mão, sob cortinas de luzes amarelas.',
  },
  {
    id: 'c1-mar09510',
    alt: 'Trio brindando com vinho branco, com o jardim e as luzinhas visíveis ao fundo.',
  },
  {
    id: 'c1-mar09550',
    alt: 'Quatro pessoas jantando à mesa no gramado, com o salão iluminado por luzinhas ao fundo.',
  },
  {
    id: 'c1-mar09528',
    alt: 'Mulher de jaqueta de couro erguendo uma taça de vinho branco sob cordões de luzes amarelas.',
  },
  {
    id: 'c1-mar09516',
    alt: 'Garçom servindo vinho tinto na taça de uma cliente, com luzinhas ao fundo.',
  },
]

/** O Garden — arquitetura, jardim, fachada, noite. */
export const GARDEN: readonly CuratedPhoto[] = [
  {
    id: 'c1-mar09266',
    alt: 'Pergolado com árvore e cordões de luz sobre mesas de cadeiras vermelhas, ao entardecer.',
  },
  {
    id: 'c1-mar09263',
    alt: 'Mesa posta em primeiro plano sob o teto de luzinhas amarelas, com cadeiras coloridas e plantas ao redor.',
  },
  {
    id: 'c1-mar09295',
    alt: 'Entrada lateral com pergolado iluminado e vegetação densa ao longo do caminho de pedra.',
  },
  {
    id: 'c1-mar09284',
    alt: 'Entrada de piso de pedra com palmeiras iluminadas e o letreiro Wine Garden ao fundo.',
  },
  {
    id: 'c1-mar09282',
    alt: 'Palmeira em primeiro plano diante do muro ripado com o letreiro Wine Garden aceso à noite.',
  },
]

/** Equipe e serviço — a casa por dentro. */
export const TEAM: readonly CuratedPhoto[] = [
  {
    id: 'c1-mar09463',
    alt: 'Funcionária com avental Wine Garden sorrindo atrás do balcão.',
  },
  {
    id: 'c1-mar09620',
    alt: 'Funcionária explicando o dispensador de vinhos para três clientes.',
  },
  {
    id: 'c2-mar04400',
    alt: 'Cozinheiro levantando um espeto de camarões grelhados acima da brasa, com fumaça em contraluz.',
  },
  {
    id: 'c1-mar09305',
    alt: 'Recepcionista sorrindo atrás do púlpito de madeira entalhada, sob o teto de luzes e plantas.',
  },
]

/** Experiências — música ao vivo, encontros, celebração. */
export const EXPERIENCES: readonly CuratedPhoto[] = [
  {
    id: 'c1-mar00037',
    alt: 'Guitarrista sorrindo durante apresentação ao vivo, com plantas pendentes e luminárias ao fundo.',
  },
  {
    id: 'c1-mar00012',
    alt: 'Quatro mulheres lado a lado com taças de vinho tinto, sob luzes penduradas no jardim.',
  },
  {
    id: 'c1-mar09269',
    alt: 'Balde de gelo com quatro garrafas de espumante e taças ao lado, com garçom desfocado atrás.',
  },
  {
    id: 'c1-mar09582',
    alt: 'Homem de blazer bege sorrindo e estendendo uma taça de tinto diante da parede de garrafas iluminada.',
  },
]

/**
 * Fotos por prato do cardápio. Só entram pratos que foram identificados
 * visualmente com confiança alta ou média — nada de associar uma foto de
 * camarão na brasa a um prato que não existe na carta só para preencher grade.
 */
export const DISH_PHOTOS: Readonly<Record<string, readonly string[]>> = {
  'tabua-de-salumeria': ['c1-mar09576'],
  'carpaccio-de-mignon': ['c2-mar04581', 'c2-mar04767', 'c2-mar04595', 'c2-mar04588'],
  'ceviche-de-pesce': ['c2-mar04667', 'c2-mar04665', 'c2-mar04663', 'c2-mar04670'],
  'crudo-de-atum': ['c2-mar04746', 'c2-mar04741', 'c2-mar04673'],
  'crudo-de-mignon': ['c2-mar04648', 'c2-mar04647', 'c2-mar04644'],
  'burrata-de-bottega': ['c2-mar04709', 'c2-mar04710', 'c2-mar04708'],
  'risotto-de-cogumelos': ['c2-mar04615', 'c2-mar04612', 'c2-mar04637'],
  'dumpling-de-porco': ['c2-mar04759', 'c2-mar04779', 'c2-mar04753'],
  'croqueta-de-pato': ['c2-mar04797', 'c2-mar04792', 'c2-mar04791'],
  'file-com-risotto-piselli': ['c2-mar04804', 'c2-mar04798', 'c2-mar04811'],
  'pani-e-antipasti': ['c1-mar09604', 'c2-mar04714', 'c2-mar04755'],
  lemon: ['c2-mar04548', 'c2-mar04546', 'c2-mar04545'],
}

/** Primeira foto de um prato, se houver. */
export function dishPhoto(dishId: string): string | undefined {
  return DISH_PHOTOS[dishId]?.[0]
}

/**
 * Confere na carga do módulo que toda foto curada existe no manifesto. Um id
 * digitado errado renderiza o placeholder da marca em silêncio; em
 * desenvolvimento, é melhor gritar.
 */
if (process.env.NODE_ENV === 'development') {
  const referenced = [
    HERO,
    ...MANIFESTO,
    ...CELLAR,
    ...GASTRONOMY,
    ...PEOPLE,
    ...GARDEN,
    ...TEAM,
    ...EXPERIENCES,
  ].map((p) => p.id)
  const missing = [...referenced, ...Object.values(DISH_PHOTOS).flat()].filter((id) => !PHOTO_BY_ID[id])
  if (missing.length > 0) {
    console.error(`[photos] ids fora do manifesto: ${[...new Set(missing)].join(', ')}`)
  }
}
