import { WINES } from '@/data/generated/wines'
import { OPENING_HOURS } from '@/data/site'
import type { Wine } from '@/types/content'

/**
 * O MOMENTO — que horas são no Wine Garden, como está o tempo lá fora, e o que
 * a casa serviria agora.
 *
 * Três regras governam este módulo:
 *
 * 1. A HORA É DE BRASÍLIA, não do visitante. Quem abre o site de São Paulo, de
 *    Lisboa ou de um fuso qualquer precisa saber se a casa está aberta AGORA —
 *    e isso só existe no fuso do restaurante.
 *
 * 2. A SUGESTÃO SAI DO CARDÁPIO. Cada recomendação é um item real, com preço
 *    real, escolhido por regra explícita. Nada é gerado, nada é inventado: se
 *    nenhuma regra casar, a função devolve `null` e a interface some com a
 *    linha em vez de dizer qualquer coisa.
 *
 * 3. O CLIMA É OPCIONAL. Sem chave, sem rede ou com a API fora, tudo aqui
 *    continua funcionando com o que se sabe do relógio.
 */

export const VENUE_TIMEZONE = 'America/Sao_Paulo'

/* ------------------------------------------------------------------ clima */

/** Subconjunto da Weather API do Google que a interface realmente usa. */
export type Clima = {
  /** Descrição já traduzida pela própria API, ex.: "Parcialmente ensolarado". */
  descricao: string
  /** Código estável da condição, ex.: `PARTLY_CLOUDY`. É nele que decidimos. */
  tipo: string
  temperatura: number
  sensacao: number
  /** Probabilidade de chuva em %. */
  chuva: number
  /** `true` entre o nascer e o pôr do sol no local. */
  dia: boolean
}

/* -------------------------------------------------------------- o relógio */

export type Periodo = 'madrugada' | 'manha' | 'tarde' | 'noite'

export type Relogio = {
  /** ISO da hora corrente no fuso do restaurante. */
  iso: string
  /** "quarta-feira, 2 de setembro" */
  dataExtenso: string
  /** "14:27" */
  hora: string
  /** 0 = domingo. */
  diaSemana: number
  minutosDoDia: number
  periodo: Periodo
  fimDeSemana: boolean
  aberto: boolean
  /** Faixa de hoje, ex.: "12:00—00:00". */
  expediente: string
  /** Minutos até fechar; `null` quando está fechado. */
  minutosParaFechar: number | null
}

/** Lê as partes da data no fuso do restaurante, sem depender do fuso da máquina. */
function partesEmBrasilia(agora: Date) {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: VENUE_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const partes = Object.fromEntries(fmt.formatToParts(agora).map((p) => [p.type, p.value]))
  // `weekday: 'long'` não devolve o índice; este formatador curto resolve.
  const curto = new Intl.DateTimeFormat('en-US', { timeZone: VENUE_TIMEZONE, weekday: 'short' })
    .format(agora)
    .toLowerCase()
  const indice = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(curto)
  return {
    weekday: partes.weekday ?? '',
    day: partes.day ?? '',
    month: partes.month ?? '',
    hour: Number(partes.hour ?? 0),
    minute: Number(partes.minute ?? 0),
    diaSemana: indice < 0 ? 0 : indice,
  }
}

function periodoDe(hora: number): Periodo {
  if (hora < 5) return 'madrugada'
  if (hora < 12) return 'manha'
  if (hora < 18) return 'tarde'
  return 'noite'
}

/**
 * A casa abre meio-dia e fecha depois da meia-noite, então o expediente
 * atravessa a virada do dia. Tratamos o fechamento em minutos "do dia
 * seguinte" para a comparação continuar simples.
 */
export function lerRelogio(agora: Date = new Date()): Relogio {
  const p = partesEmBrasilia(agora)
  const minutos = p.hour * 60 + p.minute

  // Domingo a quinta = faixa 0; sexta e sábado = faixa 1.
  const faixa = p.diaSemana === 5 || p.diaSemana === 6 ? OPENING_HOURS[1] : OPENING_HOURS[0]
  const [abreH = 12, abreM = 0] = faixa.opens.split(':').map(Number)
  const [fechaH = 0, fechaM = 0] = faixa.closes.split(':').map(Number)
  const abre = abreH * 60 + abreM
  // 00:00 e 01:00 são do dia seguinte: viram 1440 e 1500.
  const fecha = fechaH * 60 + fechaM + (fechaH < abreH ? 24 * 60 : 0)

  const minutosAjustados = minutos < abre ? minutos + 24 * 60 : minutos
  const aberto = minutosAjustados >= abre && minutosAjustados < fecha

  return {
    iso: agora.toISOString(),
    dataExtenso: `${p.weekday}, ${p.day} de ${p.month}`,
    hora: `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`,
    diaSemana: p.diaSemana,
    minutosDoDia: minutos,
    periodo: periodoDe(p.hour),
    fimDeSemana: p.diaSemana === 5 || p.diaSemana === 6 || p.diaSemana === 0,
    aberto,
    expediente: `${faixa.opens}—${faixa.closes}`,
    minutosParaFechar: aberto ? fecha - minutosAjustados : null,
  }
}

/* --------------------------------------------------- leitura do ambiente */

/**
 * Frase curta que descreve o momento. É o que substitui o antigo rótulo
 * "Hoje": diz o estado do céu quando ele é conhecido, e o período quando não.
 */
export function lerAmbiente(relogio: Relogio, clima: Clima | null): string {
  if (!clima) {
    switch (relogio.periodo) {
      case 'madrugada':
        return 'Madrugada'
      case 'manha':
        return 'Manhã'
      case 'tarde':
        return 'Tarde'
      default:
        return 'Noite'
    }
  }

  const temp = `${Math.round(clima.temperatura)}°`

  // A API já devolve a descrição traduzida e adequada ao período (ela distingue
  // "ensolarado" de "limpo" conforme o sol esteja no céu ou não).
  return `${clima.descricao}, ${temp}`
}

/* ------------------------------------------------------------- sugestão */

/**
 * A sugestão aponta sempre para a CARTA, nunca para um prato.
 *
 * Antes apontava para os dois. Mudou quando o cardápio saiu do site: a casa o
 * troca com frequência, e sugerir um prato pelo nome, com preço, era prometer
 * algo que pode não estar mais lá quando a pessoa chegar. A carta é estável e
 * continua publicada rótulo a rótulo — e a ponte com a cozinha não se perde,
 * porque as categorias escolhidas abaixo são as que o próprio cardápio indica
 * para o momento (chuva à noite pede o mesmo tinto que o cardápio indica para
 * os principais).
 */
export type Sugestao = {
  /** Motivo em uma frase — por que ISTO agora. */
  motivo: string
  /** Nome do rótulo, exatamente como na carta. */
  nome: string
  /** Preço em reais. */
  preco: number
  /** Para onde o clique leva. */
  href: string
}

/** Primeiro vinho de uma categoria, do mais barato para o mais caro. */
function vinhoDaCategoria(categoria: string, servico: 'taca' | 'garrafa'): Wine | undefined {
  return WINES.filter((w) => w.category === categoria && w.servingType === servico).sort(
    (a, b) => a.price - b.price,
  )[0]
}

function comoVinho(wine: Wine | undefined, motivo: string): Sugestao | null {
  if (!wine) return null
  return {
    motivo,
    nome: wine.name,
    preco: wine.price,
    href: `/vinhos?busca=${encodeURIComponent(wine.name)}`,
  }
}

/**
 * A sugestão do momento.
 *
 * As regras são avaliadas em ordem e a primeira que casar vence — da condição
 * mais específica (chove agora) para a mais geral (é noite). Cada uma aponta
 * para uma CATEGORIA da carta, e o rótulo escolhido é o mais barato dela: se a
 * categoria ficar vazia, a regra simplesmente não produz sugestão em vez de
 * mostrar algo inexistente.
 */
export function sugerir(relogio: Relogio, clima: Clima | null): Sugestao | null {
  const chovendo = clima ? clima.chuva >= 55 || /RAIN|SHOWER|STORM/.test(clima.tipo) : false
  const calor = clima ? clima.temperatura >= 28 : false
  const frio = clima ? clima.temperatura <= 19 : false
  const sol = clima ? clima.dia && /CLEAR|SUNNY|MOSTLY_CLEAR|PARTLY_CLOUDY/.test(clima.tipo) : false

  const candidatas: (Sugestao | null)[] = [
    /* Fechado: a sugestão vira convite, e o item é o que abre a próxima visita. */
    !relogio.aberto
      ? comoVinho(
          vinhoDaCategoria('Espumante', 'garrafa'),
          relogio.periodo === 'madrugada' ? 'Fechado agora. Para a próxima' : 'Ainda fechado. Guarde para hoje',
        )
      : null,

    /* Chuva na hora do jantar: a casa é coberta, e a mesa pede o tinto que o
       cardápio indica para os principais. */
    chovendo && relogio.periodo === 'noite'
      ? comoVinho(vinhoDaCategoria('Tinto Encorpado', 'taca'), 'Chuva lá fora, jardim coberto aqui')
      : null,

    chovendo
      ? comoVinho(vinhoDaCategoria('Tinto Médio Corpo', 'taca'), 'Dia de chuva pede algo quente')
      : null,

    /* Frio de Brasília é raro e curto — quando vem, o tinto encorpado ganha. */
    frio
      ? comoVinho(vinhoDaCategoria('Tinto Encorpado', 'taca'), `${Math.round(clima?.temperatura ?? 0)}° em Brasília`)
      : null,

    /* Happy hour: 16h–21h é o único horário que a marca publica nominalmente. */
    relogio.aberto && relogio.minutosDoDia >= 16 * 60 && relogio.minutosDoDia < 21 * 60
      ? comoVinho(vinhoDaCategoria('Rosé e Laranja', 'taca'), 'Happy hour até 21h')
      : null,

    /* Calor com sol: espumante e rosé em taça, para o gramado. */
    calor && sol
      ? comoVinho(
          vinhoDaCategoria('Branco Leve Fresco', 'taca'),
          `${Math.round(clima?.temperatura ?? 0)}° e sol — algo gelado`,
        )
      : null,

    /* Almoço de fim de semana no jardim: o espumante que as saladas pedem. */
    relogio.aberto && relogio.fimDeSemana && relogio.periodo === 'tarde'
      ? comoVinho(vinhoDaCategoria('Espumante', 'taca'), 'Tarde de fim de semana no jardim')
      : null,

    /* Mesa cheia para dividir — a harmonização das tábuas. */
    relogio.aberto && relogio.fimDeSemana && relogio.periodo === 'noite'
      ? comoVinho(vinhoDaCategoria('Tinto Leve', 'taca'), 'Noite de fim de semana, mesa cheia')
      : null,

    /* Última hora: quem chega agora quer uma taça, não uma garrafa. */
    relogio.aberto && relogio.minutosParaFechar !== null && relogio.minutosParaFechar <= 90
      ? comoVinho(vinhoDaCategoria('Tinto Médio Corpo', 'taca'), 'Última hora — uma taça ainda dá tempo')
      : null,

    /* Almoço em dia de semana. */
    relogio.aberto && !relogio.fimDeSemana && relogio.periodo === 'tarde'
      ? comoVinho(vinhoDaCategoria('Brancos Aromáticos', 'taca'), 'Almoço no meio da semana')
      : null,

    /* Jantar em dia de semana — o branco amadeirado que os crudos aceitam. */
    relogio.aberto && relogio.periodo === 'noite'
      ? comoVinho(vinhoDaCategoria('Branco Amadeirado', 'taca'), 'Para começar a noite')
      : null,
  ]

  return candidatas.find((s): s is Sugestao => s !== null) ?? null
}

/* --------------------------------------------------------------- payload */

export type Momento = {
  relogio: Relogio
  clima: Clima | null
  ambiente: string
  sugestao: Sugestao | null
}

export function montarMomento(agora: Date, clima: Clima | null): Momento {
  const relogio = lerRelogio(agora)
  return {
    relogio,
    clima,
    ambiente: lerAmbiente(relogio, clima),
    sugestao: sugerir(relogio, clima),
  }
}
