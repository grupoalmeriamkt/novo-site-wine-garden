import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { lerRelogio, montarMomento, sugerir, type Clima } from '../src/lib/momento.ts'
import { WINES } from '../src/data/generated/wines.ts'

/**
 * O momento do herói.
 *
 * Estes testes existem por dois motivos: o horário de funcionamento atravessa
 * a meia-noite (um erro clássico de comparação), e a sugestão precisa apontar
 * SEMPRE para algo que existe no cardápio — nunca para um nome inventado.
 *
 * As datas são construídas em UTC e deslocadas +3h para cair na hora desejada
 * em Brasília, de modo que o resultado não dependa do fuso da máquina que roda
 * o teste.
 */

const emBrasilia = (dia: number, hora: number, minuto = 0) =>
  new Date(Date.UTC(2026, 8, dia, hora + 3, minuto))

// 2026-09-02 é quarta-feira; 2026-09-05 é sábado.
const QUARTA = (h: number, m = 0) => emBrasilia(2, h, m)
const SABADO = (h: number, m = 0) => emBrasilia(5, h, m)

const ceu = (over: Partial<Clima> = {}): Clima => ({
  descricao: 'Parcialmente ensolarado',
  tipo: 'PARTLY_CLOUDY',
  temperatura: 25,
  sensacao: 25,
  chuva: 5,
  dia: true,
  ...over,
})

describe('relógio da casa', () => {
  it('está fechado antes do meio-dia', () => {
    assert.equal(lerRelogio(QUARTA(11, 59)).aberto, false)
  })

  it('abre ao meio-dia', () => {
    assert.equal(lerRelogio(QUARTA(12)).aberto, true)
  })

  it('continua aberto às 23h em dia de semana', () => {
    const r = lerRelogio(QUARTA(23))
    assert.equal(r.aberto, true)
    assert.equal(r.expediente, '12:00—00:00')
  })

  it('fecha à meia-noite de quarta — o expediente atravessa o dia', () => {
    // 23h59 aberto, 00h05 fechado: é aqui que uma comparação ingênua erra.
    assert.equal(lerRelogio(QUARTA(23, 59)).aberto, true)
    assert.equal(lerRelogio(emBrasilia(3, 0, 5)).aberto, false)
  })

  it('sábado fecha uma hora mais tarde', () => {
    const r = lerRelogio(SABADO(20))
    assert.equal(r.expediente, '12:00—01:00')
    assert.equal(r.fimDeSemana, true)
  })

  it('conta os minutos que faltam para fechar', () => {
    const r = lerRelogio(QUARTA(23, 30))
    assert.equal(r.minutosParaFechar, 30)
  })

  it('a hora é de Brasília, não do fuso da máquina', () => {
    // 15:00 UTC = 12:00 em Brasília (UTC-3).
    const r = lerRelogio(new Date('2026-09-02T15:00:00Z'))
    assert.equal(r.hora, '12:00')
  })

  it('escreve a data por extenso em português', () => {
    const r = lerRelogio(QUARTA(13))
    assert.match(r.dataExtenso, /quarta-feira, 2 de setembro/)
  })
})

describe('sugestão do momento', () => {
  /* A sugestão aponta sempre para a carta: o cardápio saiu do site porque a
     casa o troca com frequência, e sugerir um prato pelo nome era prometer
     algo que pode não estar mais lá. */
  const nomesReais = new Set(WINES.map((w) => w.name))

  it('toda sugestão aponta para um rótulo que existe na carta', () => {
    const climas: (Clima | null)[] = [
      null,
      ceu(),
      ceu({ tipo: 'RAIN', chuva: 85, temperatura: 20 }),
      ceu({ tipo: 'CLEAR', temperatura: 33 }),
      ceu({ tipo: 'CLOUDY', temperatura: 15 }),
      ceu({ dia: false, tipo: 'CLEAR', temperatura: 22 }),
    ]

    // Varre a semana inteira, de hora em hora, com cada clima.
    for (let dia = 30; dia <= 36; dia++) {
      for (let hora = 0; hora < 24; hora++) {
        for (const clima of climas) {
          const data = new Date(Date.UTC(2026, 7, dia, hora + 3))
          const s = sugerir(lerRelogio(data), clima)
          if (!s) continue
          assert.ok(
            nomesReais.has(s.nome),
            `sugeriu "${s.nome}", que não existe na carta (dia ${dia}, ${hora}h)`,
          )
          assert.ok(s.preco > 0, `"${s.nome}" com preço ${s.preco}`)
          assert.ok(s.motivo.length > 3, 'sugestão sem motivo legível')
        }
      }
    }
  })

  it('chuva à noite leva a um tinto encorpado', () => {
    const s = sugerir(lerRelogio(QUARTA(20)), ceu({ tipo: 'RAIN', chuva: 85, temperatura: 20 }))
    const wine = WINES.find((w) => w.name === s?.nome)
    assert.equal(wine?.category, 'Tinto Encorpado')
    assert.match(s?.motivo ?? '', /chuva/i)
  })

  it('calor com sol leva a algo gelado em taça', () => {
    const s = sugerir(lerRelogio(QUARTA(14)), ceu({ tipo: 'CLEAR', temperatura: 32 }))
    const wine = WINES.find((w) => w.name === s?.nome)
    assert.equal(wine?.servingType, 'taca')
    assert.match(s?.motivo ?? '', /32°/)
  })

  it('dentro do happy hour, cita o happy hour', () => {
    const s = sugerir(lerRelogio(QUARTA(17)), ceu())
    assert.match(s?.motivo ?? '', /happy hour/i)
  })

  it('na última hora oferece taça, não garrafa', () => {
    const s = sugerir(lerRelogio(QUARTA(23, 20)), ceu({ dia: false }))
    assert.match(s?.motivo ?? '', /última hora/i)
    const wine = WINES.find((w) => w.name === s?.nome)
    assert.equal(wine?.servingType, 'taca')
  })

  it('fim de semana à noite sugere o tinto leve das tábuas', () => {
    const s = sugerir(lerRelogio(SABADO(21)), ceu({ dia: false }))
    const wine = WINES.find((w) => w.name === s?.nome)
    assert.equal(wine?.category, 'Tinto Leve')
    assert.match(s?.motivo ?? '', /fim de semana/i)
  })

  it('com a casa fechada, a sugestão vira convite', () => {
    const s = sugerir(lerRelogio(QUARTA(9)), ceu())
    assert.match(s?.motivo ?? '', /fechado/i)
  })

  it('funciona sem clima nenhum', () => {
    const m = montarMomento(QUARTA(20), null)
    assert.equal(m.clima, null)
    assert.equal(m.ambiente, 'Noite')
    assert.ok(m.sugestao, 'sem clima ainda deve haver sugestão pelo relógio')
  })

  it('o mesmo instante devolve sempre a mesma sugestão', () => {
    const a = sugerir(lerRelogio(QUARTA(20)), ceu())
    const b = sugerir(lerRelogio(QUARTA(20)), ceu())
    assert.equal(a?.nome, b?.nome)
  })
})

describe('leitura do ambiente', () => {
  it('usa a descrição traduzida da API e a temperatura arredondada', () => {
    const m = montarMomento(QUARTA(14), ceu({ descricao: 'Ensolarado', temperatura: 28.6 }))
    assert.equal(m.ambiente, 'Ensolarado, 29°')
  })

  it('sem clima, cai para o período do dia', () => {
    assert.equal(montarMomento(QUARTA(9), null).ambiente, 'Manhã')
    assert.equal(montarMomento(QUARTA(14), null).ambiente, 'Tarde')
    assert.equal(montarMomento(QUARTA(21), null).ambiente, 'Noite')
    assert.equal(montarMomento(QUARTA(3), null).ambiente, 'Madrugada')
  })
})
