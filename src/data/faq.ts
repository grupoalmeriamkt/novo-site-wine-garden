import { WINES } from '@/data/generated/wines'
import { categoriasDaCozinha } from '@/lib/cozinha'
import { CONTACTS, EVENTS_CONTACT, LOCATION, OPENING_HOURS, RESERVATION } from '@/data/site'

/**
 * PERGUNTAS E RESPOSTAS.
 *
 * Este arquivo tem dois destinos: a seção de FAQ da página e o JSON-LD
 * `FAQPage`. E tem um terceiro leitor, que é o que motivou escrevê-lo assim:
 * os motores generativos. Quando alguém pergunta a um assistente "onde beber
 * vinho em taça em Brasília", o que é citado é quem RESPONDE a pergunta em
 * texto direto e verificável — não quem tem a página mais bonita.
 *
 * REGRAS QUE VALEM AQUI, E QUE VALEM DOBRADO PORQUE ISTO VIRA RESPOSTA DE IA:
 *
 * 1. Toda resposta é verificável. Números saem da carta e do cardápio; endereço,
 *    horário e contato saem de `site.ts`, cuja procedência está documentada.
 * 2. O que a casa não confirmou NÃO VIRA PERGUNTA. Não há entrada sobre
 *    estacionamento, acessibilidade, política de pets ou couvert — inventar
 *    qualquer uma seria pôr desinformação sobre um negócio real na boca de um
 *    assistente, e ela circularia sem correção.
 * 3. A resposta começa pela resposta. Nada de "no Wine Garden, acreditamos
 *    que…" antes do fato: o primeiro período precisa responder sozinho, porque
 *    é ele que costuma ser extraído.
 */

export type Pergunta = {
  /** Usado como âncora e como id no JSON-LD. */
  id: string
  pergunta: string
  /** Texto puro: vai igual para a tela e para o dado estruturado. */
  resposta: string
}

/* ------------------------------------------------------- números da carta */

const TOTAL_VINHOS = WINES.length
const EM_TACA = WINES.filter((w) => w.servingType === 'taca').length
const EM_GARRAFA = WINES.filter((w) => w.servingType === 'garrafa').length
const PAISES = new Set(WINES.map((w) => w.country).filter(Boolean)).size
const PRECOS_TACA = WINES.filter((w) => w.servingType === 'taca').map((w) => w.price)
const TACA_MIN = Math.min(...PRECOS_TACA)
const TACA_MAX = Math.max(...PRECOS_TACA)

/*
 * A cozinha entra por CATEGORIA, nunca por prato.
 *
 * O cardápio muda com frequência e saiu do site por isso. Uma resposta de FAQ
 * que nomeia um prato ou conta quantos existem é uma resposta que vira mentira
 * na próxima troca — e esta aqui vai parar na boca de assistentes, onde
 * circula sem correção. As categorias e as harmonizações sobrevivem.
 */
const CATEGORIAS_COZINHA = categoriasDaCozinha()

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const whatsapp = CONTACTS.find((c) => c.label === 'WhatsApp')
const instagram = CONTACTS.find((c) => c.label === 'Instagram')

/* ------------------------------------------------------------- perguntas */

export const FAQ: readonly Pergunta[] = [
  {
    id: 'onde-fica',
    pergunta: 'Onde fica o Wine Garden?',
    resposta: `O Wine Garden fica no ${LOCATION.complement}, em ${LOCATION.city} — ${LOCATION.street}, CEP ${LOCATION.postalCode}. É um wine bar e restaurante com jardim coberto, salão envidraçado e mesas no gramado, na orla do Lago Paranoá.`,
  },
  {
    id: 'horario',
    pergunta: 'Qual é o horário de funcionamento?',
    resposta:
      OPENING_HOURS.map((slot) => {
        const dias =
          slot.days.length > 2
            ? `${slot.days[0]} a ${slot.days[slot.days.length - 1]}`
            : slot.days.join(' e ')
        // "12:00" vira "12h" e "00:00" vira "meia-noite": a resposta é lida em
        // voz alta por assistentes, e "zero zero horas" soa a formulário.
        const hora = (h: string) => {
          if (h === '00:00') return 'meia-noite'
          if (h === '01:00') return '1h'
          const [hh, mm] = h.split(':')
          return mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}`
        }
        return `${dias}, das ${hora(slot.opens)} à${hora(slot.closes) === 'meia-noite' ? '' : 's'} ${hora(slot.closes)}`
      }).join('. ') + '. A casa abre para o almoço e segue noite adentro.',
  },
  {
    id: 'vinho-em-taca',
    pergunta: 'O Wine Garden serve vinho em taça?',
    resposta: `Sim. São ${EM_TACA} rótulos servidos em taça de 150 ml, com preços de ${brl(TACA_MIN)} a ${brl(TACA_MAX)} — vinhos de sobremesa saem em doses de 50 ml. É o formato que dá nome à casa: provar vários países numa noite, taça a taça, sem abrir uma garrafa de cada.`,
  },
  {
    id: 'tamanho-da-carta',
    pergunta: 'Quantos rótulos tem a carta de vinhos?',
    resposta: `A carta tem ${TOTAL_VINHOS} rótulos de ${PAISES} países — ${EM_TACA} disponíveis em taça e ${EM_GARRAFA} em garrafa. As origens vão de França, Itália, Espanha e Portugal a Chile, Argentina, Brasil e Estados Unidos, além de Grécia, Uruguai, África do Sul, Áustria, Alemanha, Austrália e Eslovênia.`,
  },
  {
    id: 'reserva',
    pergunta: 'Precisa reservar mesa?',
    resposta: `A reserva não é obrigatória, mas é recomendada nas noites de sexta e sábado. Ela é feita pelo ${RESERVATION.provider}, para até ${RESERVATION.maxPartySize} pessoas, em ${RESERVATION.url}.`,
  },
  {
    id: 'cozinha',
    pergunta: 'Que tipo de comida o Wine Garden serve?',
    resposta: `Cozinha contemporânea de influência mediterrânea, pensada para acompanhar vinho, em ${CATEGORIAS_COZINHA.length} categorias: ${CATEGORIAS_COZINHA.map((c) => c.nome.toLowerCase()).join(', ')}. Cada categoria traz no cardápio a indicação de com que vinho harmoniza. Os pratos e os valores vigentes estão no cardápio digital da casa.`,
  },
  {
    id: 'harmonizacao',
    pergunta: 'O cardápio indica qual vinho combina com cada prato?',
    resposta: `Sim. O cardápio declara a harmonização de cada categoria — os crudos pedem branco leve e espumante, os principais vão do branco amadeirado ao tinto de médio corpo, as sobremesas pedem vinho de sobremesa. O site também tem o Wine Match, que sugere de dois a quatro rótulos a partir do momento, do estilo desejado e do quanto se quer investir.`,
  },
  {
    id: 'vegano',
    pergunta: 'Há opções veganas ou vegetarianas?',
    resposta: `Sim. O cardápio marca os itens veganos e traz saladas, pratos à base de cogumelos e a seleção de pães e pastinhas. Como o cardápio muda com frequência, o que está disponível hoje aparece no cardápio digital — e, para restrições específicas, vale confirmar com a casa pelo WhatsApp ${whatsapp?.value ?? ''}.`,
  },
  {
    id: 'musica',
    pergunta: 'Tem música ao vivo?',
    resposta:
      'Sim, há programação musical de quarta a sábado. A agenda da semana é divulgada no Instagram ' +
      `${instagram?.value ?? ''}.`,
  },
  {
    id: 'eventos',
    pergunta: 'É possível fazer eventos no Wine Garden?',
    resposta: `Sim. A casa recebe aniversários, confraternizações de empresa, celebrações e jantares fechados. O contato comercial de eventos é o WhatsApp ${EVENTS_CONTACT.label}, e a proposta inclui espaço, cardápio e carta.`,
  },
  {
    id: 'happy-hour',
    pergunta: 'O Wine Garden tem happy hour?',
    resposta:
      'Sim, das 16h às 21h. É o horário em que o jardim coberto recebe quem sai do trabalho, com a carta em taça disponível por inteiro.',
  },
]

/** Número de perguntas — usado na interface, sem escrever à mão. */
export const TOTAL_PERGUNTAS = FAQ.length
